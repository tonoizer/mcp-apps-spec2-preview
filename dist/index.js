#!/usr/bin/env node
/**
 * Entry point for running the Module Federation MCP server.
 * Run with: npx @mcp-server/module-federation
 * Or: node dist/index.js [--stdio]
 */
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, InMemoryTransport } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "./server.js";
/**
 * Starts an MCP server with Streamable HTTP transport.
 *
 * Also exposes /mcp-json endpoint for clients that expect plain JSON-RPC responses
 * (e.g. custom MCP clients that call response.json() directly instead of handling SSE).
 *
 * @param createServerFn - Factory function that creates a new McpServer instance per request.
 */
async function startStreamableHTTPServer(createServerFn) {
    const port = parseInt(process.env.PORT ?? "3001", 10);
    // MF_MCP_BASE_URL allows overriding the public base URL when running behind a
    // Falls back to http://localhost:{port} for local development.
    const shellBaseUrl = process.env.MF_MCP_BASE_URL?.replace(/\/$/, '') ?? `http://localhost:${port}`;
    const app = createMcpExpressApp({ host: "0.0.0.0" });
    app.use(cors());
    // MCP Core v2's handler owns the Streamable HTTP lifecycle. Its factory is
    // invoked for every request, so HTTP serving is stateless by default (the
    // v2 equivalent of sessionIdGenerator: undefined).
    const mcpHandler = createMcpHandler(() => createServerFn(shellBaseUrl));
    const handleMcp = toNodeHandler(mcpHandler, {
        onerror: (error) => console.error("MCP error:", error),
    });
    // Serve built JS/CSS assets from dist/static/ at /static so the iframe
    // (shell HTML mode) can load them via absolute URLs like
    // http://localhost:{port}/static/js/mcp-app-shell.js
    const express = (await import("express")).default;
    const distDir = new URL("../dist", import.meta.url).pathname;
    app.use("/static", express.static(path.join(distDir, "static")));
    // Dedicated route: /static/mcp-app-shell.html
    // express.static above serves dist/static/* but mcp-app-shell.html lives in
    // dist/ (root). We serve it here with __MF_MCP_BASE__ already replaced so
    // external hosts (e.g. ai-paas) can load it directly via <iframe src=>.
    app.get("/static/mcp-app-shell.html", async (req, res) => {
        try {
            const raw = await fs.readFile(path.join(distDir, "mcp-app-shell.html"), "utf-8");
            // Derive the real public origin from the request so this works behind
            // reverse proxies (e.g. https://o1qeqmry.fn.bytedance.net) without
            // needing to configure MF_MCP_BASE_URL.
            // X-Forwarded-Proto/Host are set by most proxies; fall back to req.protocol/host.
            const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() ?? req.protocol;
            const host = req.headers['x-forwarded-host']?.split(',')[0].trim() ?? req.get('host') ?? `localhost:${port}`;
            const requestBase = `${proto}://${host}`;
            const html = raw.replaceAll("__MF_MCP_BASE__", requestBase);
            res.type("html").send(html);
        }
        catch {
            res.status(404).send("mcp-app-shell.html not found — run pnpm build:ui");
        }
    });
    // Also serve dist/mcp-app.html at /static/mcp-app.html for backwards compat
    // with hosts that still reference the old full-inline URL.
    app.get("/static/mcp-app.html", async (_req, res) => {
        try {
            const html = await fs.readFile(path.join(distDir, "mcp-app.html"), "utf-8");
            res.type("html").send(html);
        }
        catch {
            res.status(404).send("mcp-app.html not found — run pnpm build:ui");
        }
    });
    // Standard stateless Streamable HTTP endpoint for MCP clients.
    app.all("/mcp", (req, res) => {
        void handleMcp(req, res, req.body);
    });
    // Plain JSON-RPC endpoint — for MCP clients that call response.json() directly
    // instead of handling the standard SSE/Streamable HTTP response.
    // The client sends standard JSON-RPC (tools/list, tools/call, resources/read, resources/list)
    // and expects a plain JSON response like { jsonrpc, id, result }
    app.post("/mcp-rpc", async (req, res) => {
        let server;
        try {
            server = await createServerFn(shellBaseUrl);
            const requestBody = req.body;
            const isNotification = typeof requestBody?.method === "string" &&
                (requestBody.id === undefined || requestBody.id === null);
            const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
            await server.connect(serverTransport);
            if (isNotification) {
                await clientTransport.send(requestBody);
                res.status(202).send();
                return;
            }
            const responsePromise = new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("MCP request timed out")), 30000);
                clientTransport.onmessage = (message) => {
                    clearTimeout(timer);
                    resolve(message);
                };
                clientTransport.onerror = (error) => {
                    clearTimeout(timer);
                    reject(error);
                };
            });
            await clientTransport.send(requestBody);
            res.json(await responsePromise);
        }
        catch (error) {
            console.error("[MF MCP] /mcp-rpc error:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: { code: -32603, message: error?.message ?? "Internal server error" },
                    id: req.body?.id ?? null,
                });
            }
        }
        finally {
            await server?.close().catch(() => { });
        }
    });
    const httpServer = app.listen(port, (err) => {
        if (err) {
            console.error("Failed to start server:", err);
            process.exit(1);
        }
        console.error(`[MF MCP] HTTP server listening on http://localhost:${port}/mcp`);
        console.error(`[MF MCP] Plain JSON endpoint: http://localhost:${port}/mcp-rpc`);
    });
    const shutdown = async () => {
        console.error("\n[MF MCP] Shutting down...");
        await mcpHandler.close();
        httpServer.close(() => process.exit(0));
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
}
/**
 * Starts an MCP server with stdio transport.
 *
 * @param createServerFn - Factory function that creates a new McpServer instance.
 */
async function startStdioServer(createServerFn) {
    // In stdio mode there is no HTTP server, so no shellBaseUrl — the full
    // self-contained mcp-app.html is served inline.
    const server = await createServerFn(undefined);
    await server.connect(new StdioServerTransport());
    console.error('[MF MCP] Server started via stdio');
}
async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const configPathIndex = args.indexOf('--config');
    // Config path resolution priority:
    //   1. --config <path>  (CLI argument)
    //   2. MF_MCP_CONFIG    (environment variable)
    //   3. ./mcp_apps.json  (default: cwd)
    let configPath;
    if (configPathIndex !== -1 && args[configPathIndex + 1]) {
        configPath = path.resolve(args[configPathIndex + 1]);
    }
    else if (process.env.MF_MCP_CONFIG) {
        configPath = path.resolve(process.env.MF_MCP_CONFIG);
    }
    else {
        configPath = path.join(process.cwd(), 'mcp_apps.json');
        console.error(`[MF MCP] No --config specified, using default: ${configPath}`);
    }
    console.error(`[MF MCP] 📄 Config: ${configPath}`);
    const devMode = args.includes('--dev') || process.env.NODE_ENV === 'development';
    const factory = (shellBaseUrl) => createServer({ configPath, devMode, shellBaseUrl });
    if (args.includes("--stdio")) {
        await startStdioServer(factory);
    }
    else {
        await startStreamableHTTPServer(factory);
    }
}
main().catch((error) => {
    console.error('[MF MCP] Fatal error:', error);
    process.exit(1);
});

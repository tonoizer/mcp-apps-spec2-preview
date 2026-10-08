import { createServer, type CreateServerOptions } from '@module-federation/mcp-apps';
import { MFProvider, RemoteComponentContainer, useRemoteComponent } from '@module-federation/mcp-apps/renderer';
import type * as Types from '@module-federation/mcp-apps/types';
import { McpAppRenderer } from '@module-federation/mcp-apps/react';
import type { McpAppRendererProps, McpAppResource } from '@module-federation/mcp-apps/react';
import type { McpServer } from '@modelcontextprotocol/server';
import * as React from 'react';

const opts: CreateServerOptions = { configPath: './mcp_apps.json', devMode: true, shellBaseUrl: 'http://localhost:3001' };
export async function boot(): Promise<McpServer> {
  const server: McpServer = await createServer(opts);
  return server;
}
const res: McpAppResource = { html: '<p/>', callToolResult: {} };
const props: McpAppRendererProps = { uiResource: res, messageId: 'm', onMessage: (p) => void p.content[0]?.text };
export const el = React.createElement(McpAppRenderer, props);
export const el2 = React.createElement(MFProvider, null);
export const Container = RemoteComponentContainer;
export type T = keyof typeof Types;
export const hook = useRemoteComponent;

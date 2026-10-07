// ─────────────────────────────────────────────────────────────────────────────
// ByteDance-internal: vmok manifest format
//
// vmok is a ByteDance-internal extension of Module Federation that adds a
// snapshot mechanism (vmok-snapshot.json) for dependency resolution and CDN
// path derivation via getPublicPath function strings.
//
// External users should use manifestType: 'mf' (the default), which works
// with standard mf-manifest.json produced by any Module Federation build.
// The vmok path below is unreachable with the public mcp_apps.json schema.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Initialize the __VMOK__ global object (ByteDance-internal, vmok mode only)
 */
export function initializeVMOK() {
    if (!window.__VMOK__) {
        window.__VMOK__ = { moduleInfo: {} };
    }
    else if (!window.__VMOK__.moduleInfo) {
        window.__VMOK__.moduleInfo = {};
    }
}
/**
 * Load and inject a snapshot into the global __VMOK__ object.
 * Supports caching to avoid repeated fetches.
 */
export async function loadAndInjectSnapshot({ snapshotUrl, addLog, snapshotCache }) {
    if (!snapshotUrl) {
        return;
    }
    // Check cache
    if (snapshotCache.has(snapshotUrl)) {
        window.__VMOK__.moduleInfo = snapshotCache.get(snapshotUrl);
        addLog(`✅ Using cached snapshot`);
        return;
    }
    try {
        addLog(`🚀 Loading snapshot...`);
        // Fetch directly; the origin must be in CSP connectDomains
        const response = await fetch(snapshotUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const snapshotData = await response.json();
        // Fix protocol-relative URLs (// prefix)
        const fixedData = fixProtocolRelativeUrls(snapshotData);
        const snapshotText = JSON.stringify(fixedData);
        addLog(`✅ Snapshot loaded (${Math.round(snapshotText.length / 1024)}KB)`);
        // Cache and inject into window.__VMOK__
        snapshotCache.set(snapshotUrl, fixedData);
        window.__VMOK__.moduleInfo = fixedData;
        addLog(`✅ Snapshot cached and injected`);
        // Validate
        validateSnapshot(fixedData, addLog);
    }
    catch (snapshotErr) {
        addLog(`❌ Snapshot load failed: ${snapshotErr.message}`);
        console.error('[Snapshot Loader] Error:', snapshotErr);
        throw snapshotErr;
    }
}
/**
 * Recursively fix protocol-relative URLs (// prefix → https://).
 * Special-cases `getPublicPath` values which are JS function strings.
 */
function fixProtocolRelativeUrls(obj, key) {
    if (typeof obj === 'string') {
        if (obj.startsWith('//')) {
            return 'https:' + obj;
        }
        // getPublicPath values are JS function strings; replace // URLs inside them
        if (key === 'getPublicPath' && obj.includes('//')) {
            return obj.replace(/(['"`])\/\//g, '$1https://');
        }
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => fixProtocolRelativeUrls(item));
    }
    if (obj && typeof obj === 'object') {
        const fixed = {};
        for (const [k, value] of Object.entries(obj)) {
            fixed[k] = fixProtocolRelativeUrls(value, k);
        }
        return fixed;
    }
    return obj;
}
/**
 * Validate snapshot data and log warnings for any remaining issues.
 */
function validateSnapshot(snapshotData, addLog) {
    // Check for any remaining protocol-relative URLs
    const jsonStr = JSON.stringify(snapshotData);
    const hasProtocolRelative = jsonStr.includes('"//"') || jsonStr.includes("'//");
    if (hasProtocolRelative) {
        addLog(`⚠️ Warning: snapshot still contains protocol-relative URLs`);
    }
    else {
        addLog(`✅ Snapshot URL validation passed`);
    }
    // Log __VMOK__ data key count for observability
    const vmokKeys = Object.keys(window.__VMOK__.moduleInfo || {});
    addLog(`📦 __VMOK__ keys: ${vmokKeys.slice(0, 5).join(', ')}...`);
}
/**
 * Generate a snapshot URL.
 * Falls back to auto-deriving from remoteEntry if not provided.
 */
export function generateSnapshotUrl(configSnapshotUrl, remoteEntry) {
    return configSnapshotUrl || remoteEntry.replace('vmok-manifest.json', 'vmok-snapshot.json');
}
/**
 * Fix a single protocol-relative URL (// prefix → https://).
 */
export function fixProtocolRelativeUrl(url) {
    return url.startsWith('//') ? 'https:' + url : url;
}

// Console log collector
let consoleLogCollector = [];
const safeStringify = (obj) => {
    const seen = new WeakSet();
    try {
        return JSON.stringify(obj, (_key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value))
                    return '[Circular]';
                seen.add(value);
            }
            return value;
        }, 2).substring(0, 200);
    }
    catch {
        return String(obj);
    }
};
const addToConsoleLog = (type, ...args) => {
    const message = `[${type.toUpperCase()}] ${args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ')}`;
    consoleLogCollector.push(message);
    if (consoleLogCollector.length > 50) {
        consoleLogCollector.shift();
    }
};
// Intercept console methods to collect logs
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
console.log = (...args) => {
    addToConsoleLog('log', ...args);
    originalLog(...args);
};
console.warn = (...args) => {
    addToConsoleLog('warn', ...args);
    originalWarn(...args);
};
console.error = (...args) => {
    addToConsoleLog('error', ...args);
    originalError(...args);
};
export { consoleLogCollector };

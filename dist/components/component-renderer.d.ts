import type { ToolData } from '../utils/types.js';
import type { App } from '@modelcontextprotocol/ext-apps';
import '../styles/component-renderer.css';
interface ComponentRendererProps {
    isLoadingMF: boolean;
    mfError: string | null;
    RemoteComponent: any;
    currentTool: ToolData | null;
    addLog: (msg: string) => void;
    app: App | null;
}
export declare function ComponentRenderer({ isLoadingMF, mfError, RemoteComponent, currentTool, addLog, app, }: ComponentRendererProps): import("react/jsx-runtime").JSX.Element;
export {};

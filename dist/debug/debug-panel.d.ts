import '../styles/debug-panel.css';
interface DebugPanelProps {
    isConnected: boolean;
    app: any;
    showMFComponent: boolean;
    isLoadingMF?: boolean;
    RemoteComponent?: any;
    mfError?: string | null;
    logs?: string[];
    currentTool?: any;
    resources?: any[];
    onToggle: () => void;
}
export declare function DebugPanel({ isConnected, app, showMFComponent, isLoadingMF, RemoteComponent, mfError, logs, currentTool, resources, }: DebugPanelProps): import("react/jsx-runtime").JSX.Element;
export declare function DebugToolbarButton({ showDebugPanel, onToggle }: {
    showDebugPanel: boolean;
    onToggle: () => void;
}): import("react/jsx-runtime").JSX.Element;
export {};

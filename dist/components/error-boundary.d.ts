import React from 'react';
import '../styles/error-boundary.css';
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: any;
}
export declare class ErrorBoundary extends React.Component<{
    children: React.ReactNode;
}, ErrorBoundaryState> {
    constructor(props: any);
    static getDerivedStateFromError(error: Error): {
        hasError: boolean;
        error: Error;
    };
    componentDidCatch(error: Error, errorInfo: any): void;
    render(): string | number | boolean | Iterable<React.ReactNode> | import("react/jsx-runtime").JSX.Element | null | undefined;
}
export {};

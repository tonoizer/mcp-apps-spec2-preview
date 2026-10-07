import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import '../styles/error-boundary.css';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('🛡️ ErrorBoundary caught error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { className: "error-boundary-container", children: [_jsx("h1", { className: "error-boundary-title", children: "\uD83D\uDEE1\uFE0F Error caught!" }), _jsxs("div", { className: "error-boundary-message-wrapper", children: [_jsx("h2", { className: "error-boundary-message-title", children: "Error:" }), _jsx("pre", { className: "error-boundary-message-content", children: this.state.error?.toString() })] }), this.state.error?.stack && (_jsxs("div", { className: "error-boundary-stack-wrapper", children: [_jsx("h2", { className: "error-boundary-stack-title", children: "Stack trace:" }), _jsx("pre", { className: "error-boundary-stack-content", children: this.state.error.stack })] })), _jsx("button", { onClick: () => window.location.reload(), className: "error-boundary-reload-btn", children: "\uD83D\uDD04 Reload page" })] }));
        }
        return this.props.children;
    }
}

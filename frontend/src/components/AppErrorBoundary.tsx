import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { message: string };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : "Unknown browser error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard render failed", error, info);
  }

  render() {
    if (!this.state.message) return this.props.children;

    return (
      <main
        style={{
          maxWidth: 720,
          margin: "64px auto",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1>Dashboard could not start</h1>
        <p>
          Refresh the page. If the problem continues, check the browser console.
        </p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.message}</pre>
      </main>
    );
  }
}

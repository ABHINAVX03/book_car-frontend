import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-content" role="alert" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card center" style={{ maxWidth: 460, padding: '2rem' }}>
            <h3>Something went wrong</h3>
            <p className="hint-text" style={{ marginBottom: '1rem', color: 'var(--muted)' }}>
              {this.state.error?.message || "Refresh the page and try again. Your session is still preserved."}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-dark"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/dashboard";
                }}
              >
                Go to Dashboard
              </button>
              <button className="btn btn-ghost" onClick={() => window.location.reload()}>
                Refresh
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = "/login";
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

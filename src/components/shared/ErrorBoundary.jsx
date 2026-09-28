import React from 'react';

/**
 * Fronteira de erro para rotas e para o layout.
 *
 * `fallback` pode ser um nó (comportamento original) ou uma função
 * `({ error, reset }) => node`, o que permite oferecer uma ação de repetição que
 * volta a montar a subárvore (a fronteira do layout usa-a com `ErrorState`).
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, reset: this.reset });
      }
      if (fallback) return fallback;
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground mb-2">Something went wrong loading this page.</p>
          <button
            onClick={this.reset}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

import React from 'react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';

/**
 * ErrorBoundary — catches render errors in lazy-loaded routes and offers a retry
 * (remount) instead of crashing the whole app.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Route render error:', error, info?.componentStack);
  }

  handleReset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 space-y-4">
          <EmptyState title="Ocorreu um erro ao carregar esta secção." className="h-48" />
          <div className="flex justify-center">
            <Button variant="outline" onClick={this.handleReset}>Tentar novamente</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { motion } from 'motion/react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-full p-8 text-center"
        >
          <div className="text-2xl mb-4">Something went wrong</div>
          <p className="text-body mb-4 max-w-md">
            An unexpected error occurred while rendering the graph.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-accent-blue rounded-lg hover:bg-accent-blue/80 transition-colors"
          >
            Try again
          </button>
        </motion.div>
      );
    }
    return this.props.children;
  }
}

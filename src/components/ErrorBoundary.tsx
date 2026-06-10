import { Component, type ReactNode, type ErrorInfo } from 'react';
import { motion } from 'motion/react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  language?: 'en' | 'id';
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
      const lang = this.props.language || 'en';
      return this.props.fallback || (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-full p-8 text-center"
        >
          <div className="text-2xl mb-4">{lang === 'en' ? 'Something went wrong' : 'Terjadi kesalahan'}</div>
          <p className="text-body mb-4 max-w-md">
            {lang === 'en' ? 'An unexpected error occurred while rendering the graph.' : 'Terjadi kesalahan yang tidak terduga saat merender grafik.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-accent-blue rounded-lg hover:bg-accent-blue/80 transition-colors"
          >
            {lang === 'en' ? 'Try again' : 'Coba lagi'}
          </button>
        </motion.div>
      );
    }
    return this.props.children;
  }
}

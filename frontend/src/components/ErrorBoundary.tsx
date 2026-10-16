import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-medical-mist px-4">
          <div className="rounded-3xl bg-white p-8 shadow-xl md:p-12">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <div className="h-8 w-8 text-red-600">⚠️</div>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-medical-ink">Something went wrong</h1>
            <p className="mb-6 text-slate-600">
              An error occurred. Please try refreshing the page or contact support.
            </p>
            {this.state.error && (
              <div className="mb-6 rounded-lg bg-red-50 p-4">
                <p className="text-sm text-red-800">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-medical-blue px-6 py-2 font-semibold text-white transition hover:bg-medical-blue/90"
              >
                Refresh Page
              </button>
              <a
                href="/"
                className="rounded-xl border border-slate-200 px-6 py-2 font-semibold text-medical-blue transition hover:bg-slate-50"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

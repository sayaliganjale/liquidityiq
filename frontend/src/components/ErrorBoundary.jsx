import { Component } from "react";
import { ShieldWarning, ArrowCounterClockwise } from "@phosphor-icons/react";

/**
 * React error boundary that catches rendering crashes and displays
 * a graceful fallback instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary label="Dashboard Section">
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary: ${this.props.label || "unknown"}]`, error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="rounded-xl border border-rose-200/60 bg-rose-50/30 p-6 text-center"
          data-testid="error-boundary-fallback"
        >
          <ShieldWarning size={28} className="mx-auto text-rose-500/70 mb-3" />
          <p className="text-sm text-rose-700 font-medium">
            {this.props.label
              ? `Something went wrong in "${this.props.label}".`
              : "Something went wrong."}
          </p>
          <p className="mt-1 text-xs text-rose-500/80 max-w-md mx-auto">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.reset}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-rose-200 text-[11px] font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-100 transition-colors"
          >
            <ArrowCounterClockwise size={13} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

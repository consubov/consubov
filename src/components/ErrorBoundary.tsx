import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback title */
  title?: string;
  /** Optional custom fallback message */
  message?: string;
  /** Optional custom retry button label */
  retryLabel?: string;
  /** Optional custom reload button label */
  reloadLabel?: string;
  /** Whether to show the raw error message */
  showErrorDetails?: boolean;
  /**
   * If true, automatically resets the boundary when the page becomes visible
   * again (visibilitychange/pageshow). Useful for iOS background resume where
   * a transient render error should not be shown to the user.
   */
  autoResetOnVisibility?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Increments to force a re-mount of children after a reset */
  resetKey: number;
}

/**
 * Generic Error Boundary that prevents blank screens on runtime errors.
 *
 * Only catches REAL render errors thrown by React. It does not listen to
 * window 'error' / 'unhandledrejection' — those fire spuriously on iOS
 * Safari when the app resumes from background and would cause false
 * "something went wrong" screens.
 *
 * When `autoResetOnVisibility` is true, the boundary silently resets
 * whenever the document becomes visible again (visibilitychange or
 * pageshow), so background-resume induced transient crashes never reach
 * the user.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, resetKey: 0 };

  private visibilityHandler?: () => void;
  private pageShowHandler?: () => void;
  private autoRetryAttempted = false;
  private autoRetryTimeout?: number;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidMount() {
    if (!this.props.autoResetOnVisibility) return;
    if (typeof document === "undefined" || typeof window === "undefined") return;

    this.visibilityHandler = () => {
      if (document.visibilityState === "visible" && this.state.hasError) {
        this.silentReset();
      }
    };
    this.pageShowHandler = () => {
      if (this.state.hasError) this.silentReset();
    };

    document.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("pageshow", this.pageShowHandler);
  }

  componentWillUnmount() {
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    if (this.pageShowHandler && typeof window !== "undefined") {
      window.removeEventListener("pageshow", this.pageShowHandler);
    }
    if (this.autoRetryTimeout && typeof window !== "undefined") {
      window.clearTimeout(this.autoRetryTimeout);
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] captured:", error, errorInfo);
    // Auto-retry once silently — covers transient first-render failures
    // (lazy chunk races, hook init order, hydration timing) so the user
    // never sees a flashed "Erro ao carregar" on a healthy app.
    if (!this.autoRetryAttempted && typeof window !== "undefined") {
      this.autoRetryAttempted = true;
      this.autoRetryTimeout = window.setTimeout(() => {
        this.silentReset();
      }, 150);
    }
  }

  private silentReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  private handleRetry = () => {
    this.silentReset();
  };

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      /* noop */
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-md w-full text-center space-y-4 p-6 rounded-2xl border border-border bg-card">
            <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">
              {this.props.title ?? "Algo deu errado ao carregar a tela"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {this.props.message ??
                "Seus dados offline (salgas, observações e mortalidade) estão preservados no aparelho. Tente novamente."}
            </p>
            {this.props.showErrorDetails !== false && this.state.error?.message && (
              <p className="text-xs text-muted-foreground/80 break-words">
                Detalhe: {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={this.handleRetry} className="w-full" size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                {this.props.retryLabel ?? "Tentar novamente"}
              </Button>
              <Button onClick={this.handleReload} variant="outline" className="w-full">
                {this.props.reloadLabel ?? "Recarregar página"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // resetKey forces children to fully re-mount after a silent reset
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}

export default ErrorBoundary;

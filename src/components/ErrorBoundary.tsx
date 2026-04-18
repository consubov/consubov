import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback message */
  message?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic Error Boundary that prevents blank screens on runtime errors.
 * Especially important for routes that read from IndexedDB on Safari iOS,
 * where storage failures or schema mismatches can throw synchronously
 * during render.
 *
 * The fallback UI explicitly tells the user that offline data is preserved
 * and offers a retry button (which re-mounts the children) plus a full
 * reload as a last resort.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log so it surfaces in Safari Web Inspector / Lovable console
    console.error("[ErrorBoundary] captured:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
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
              Algo deu errado ao carregar a tela
            </h1>
            <p className="text-sm text-muted-foreground">
              {this.props.message ??
                "Seus dados offline (salgas, observações e mortalidade) estão preservados no aparelho. Tente novamente."}
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground/80 break-words">
                Detalhe: {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={this.handleRetry} className="w-full" size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
              <Button onClick={this.handleReload} variant="outline" className="w-full">
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

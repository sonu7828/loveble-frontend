import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ClinicalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Clinical charting screen failed", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Charting recovered</h1>
          <p className="text-sm text-muted-foreground">
            The charting screen hit an error instead of going blank. Your local draft autosave should still be available when this page reloads.
          </p>
        </div>
        <Button type="button" onClick={() => window.location.reload()}>
          Reload chart
        </Button>
      </div>
    );
  }
}
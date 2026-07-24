import { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** True while data is being fetched. Shows a spinner. */
  loading?: boolean;
  /** Error object or message. Shows a recoverable error block. */
  error?: unknown;
  /** True when fetch succeeded but result is empty. */
  empty?: boolean;
  /** What to render once data is ready. */
  children: ReactNode;

  /** Skeleton override for loading state (e.g. a row placeholder). */
  loadingSkeleton?: ReactNode;
  /** Empty-state copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  /** Error-state copy. */
  errorTitle?: string;
  /** Retry handler shown as a button in the error state. */
  onRetry?: () => void;

  /** Visual density. */
  variant?: "page" | "card" | "inline";
  className?: string;
};

/**
 * Unified loading / error / empty wrapper.
 *
 *   <DataState
 *     loading={isLoading}
 *     error={err}
 *     empty={items.length === 0}
 *     onRetry={refetch}
 *     emptyTitle="No appointments yet"
 *   >
 *     {items.map(...)}
 *   </DataState>
 *
 * Precedence: loading → error → empty → children.
 */
export function DataState({
  loading,
  error,
  empty,
  children,
  loadingSkeleton,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyIcon,
  emptyAction,
  errorTitle = "Couldn't load this",
  onRetry,
  variant = "card",
  className,
}: Props) {
  if (loading) {
    if (loadingSkeleton) return <>{loadingSkeleton}</>;
    return (
      <Frame variant={variant} className={className}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </Frame>
    );
  }

  if (error) {
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Something went wrong.";
    return (
      <Frame variant={variant} className={className}>
        <AlertCircle className="h-6 w-6 text-destructive mb-2" aria-hidden />
        <div className="font-serif text-lg">{errorTitle}</div>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{msg}</p>
        {onRetry && (
          <Button onClick={onRetry} size="sm" variant="outline" className="mt-4 rounded-full">
            Try again
          </Button>
        )}
      </Frame>
    );
  }

  if (empty) {
    return (
      <Frame variant={variant} className={className}>
        {emptyIcon ?? <Inbox className="h-6 w-6 text-muted-foreground mb-2" aria-hidden />}
        <div className="font-serif text-lg">{emptyTitle}</div>
        {emptyDescription && (
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">{emptyDescription}</p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </Frame>
    );
  }

  return <>{children}</>;
}

function Frame({
  variant,
  className,
  children,
}: {
  variant: "page" | "card" | "inline";
  className?: string;
  children: ReactNode;
}) {
  const base = "flex flex-col items-center justify-center text-center";
  const sizing =
    variant === "page"
      ? "min-h-[60vh] py-20"
      : variant === "card"
      ? "rounded-2xl border border-dashed border-border bg-card/30 p-12"
      : "py-6";
  return <div className={`${base} ${sizing} ${className ?? ""}`}>{children}</div>;
}

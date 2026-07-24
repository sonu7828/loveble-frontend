import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Replacement for browser-native window.confirm / window.prompt.
// Renders as a styled shadcn Dialog (iPad-friendly, on-brand). Imperative API:
//
//   if (!(await confirmDialog({ title: "Cancel this appointment?" }))) return;
//   const slug = await promptDialog({ title: "Slug:", defaultValue: "" });
//
// Mount <ConfirmDialogHost /> once near the top of the React tree.
// ---------------------------------------------------------------------------

type ConfirmOpts = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PromptOpts = {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
};

type State =
  | { kind: "idle" }
  | ({
      kind: "confirm";
      resolve: (v: boolean) => void;
    } & Required<Omit<ConfirmOpts, "description">> & { description?: string })
  | ({
      kind: "prompt";
      resolve: (v: string | null) => void;
    } & Required<Omit<PromptOpts, "description" | "placeholder">> & {
        description?: string;
        placeholder?: string;
      });

let setStateRef: ((s: State) => void) | null = null;

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setStateRef) {
      // Fallback if host isn't mounted — fail safely with native confirm.
      resolve(window.confirm(opts.title + (opts.description ? `\n\n${opts.description}` : "")));
      return;
    }
    setStateRef({
      kind: "confirm",
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.confirmLabel ?? "Confirm",
      cancelLabel: opts.cancelLabel ?? "Cancel",
      destructive: !!opts.destructive,
      resolve,
    });
  });
}

export function alertDialog(opts: { title: string; description?: string; okLabel?: string }): Promise<void> {
  return new Promise((resolve) => {
    confirmDialog({
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.okLabel ?? "OK",
      cancelLabel: "Close",
    }).then(() => resolve());
  });
}

export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    if (!setStateRef) {
      const v = window.prompt(opts.title, opts.defaultValue ?? "");
      resolve(v);
      return;
    }
    setStateRef({
      kind: "prompt",
      title: opts.title,
      description: opts.description,
      placeholder: opts.placeholder,
      defaultValue: opts.defaultValue ?? "",
      confirmLabel: opts.confirmLabel ?? "OK",
      cancelLabel: opts.cancelLabel ?? "Cancel",
      required: !!opts.required,
      resolve,
    });
  });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [value, setValue] = useState("");

  useEffect(() => {
    setStateRef = setState;
    return () => {
      setStateRef = null;
    };
  }, []);

  useEffect(() => {
    if (state.kind === "prompt") setValue(state.defaultValue);
  }, [state]);

  const close = (result: boolean | string | null) => {
    if (state.kind === "idle") return;
    (state.resolve as (v: any) => void)(result);
    setState({ kind: "idle" });
  };

  const open = state.kind !== "idle";

  const cancelValue = state.kind === "prompt" ? null : false;
  const confirmValue = () => (state.kind === "prompt" ? value : true);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(cancelValue);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {state.kind !== "idle" && (
          <>
            <DialogHeader>
              <DialogTitle>{state.title}</DialogTitle>
              {state.description && (
                <DialogDescription className="whitespace-pre-wrap">
                  {state.description}
                </DialogDescription>
              )}
            </DialogHeader>
            {state.kind === "prompt" && (
              <Input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={state.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (state.required && !value.trim()) return;
                    close(value);
                  }
                }}
              />
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => close(cancelValue)}
              >
                {state.cancelLabel}
              </Button>
              <Button
                variant={
                  state.kind === "confirm" && state.destructive
                    ? "destructive"
                    : "default"
                }
                className="rounded-full"
                disabled={
                  state.kind === "prompt" && state.required && !value.trim()
                }
                onClick={() => close(confirmValue())}
              >
                {state.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

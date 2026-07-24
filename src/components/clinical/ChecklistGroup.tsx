import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  options: readonly string[] | string[];
  value: string[];
  onChange: (next: string[]) => void;
  required?: boolean;
  columns?: 1 | 2 | 3;
};

function ChecklistGroupBase({ label, options, value, onChange, required, columns = 2 }: Props) {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  };
  const colCls = columns === 3 ? "sm:grid-cols-3" : columns === 1 ? "" : "sm:grid-cols-2";
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className={cn("grid grid-cols-1 gap-2.5", colCls)}>
        {options.map(opt => {
          const checked = value.includes(opt);
          return (
            <label
              key={opt}
              onClick={(e) => { e.preventDefault(); toggle(opt); }}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 min-h-[52px] cursor-pointer transition text-[15px] select-none touch-manipulation active:scale-[0.99]",
                checked ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-secondary/40",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(opt)}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 shrink-0"
              />
              <span className="leading-snug flex-1">{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Memoized so that updating one ChecklistGroup (or any unrelated state in a
// parent form) does not re-render every other group. Equality intentionally
// ignores `onChange` identity since handlers are recreated each render but
// always operate on the same `value`/`options`.
export const ChecklistGroup = memo(ChecklistGroupBase, (a, b) =>
  a.label === b.label &&
  a.required === b.required &&
  a.columns === b.columns &&
  a.options === b.options &&
  a.value === b.value,
);

type RadioProps = {
  label: string;
  options: readonly string[] | string[];
  value: string | null;
  onChange: (next: string) => void;
  required?: boolean;
  columns?: 1 | 2 | 3;
};

function SingleSelectChipsBase({ label, options, value, onChange, required, columns = 3 }: RadioProps) {
  const colCls = columns === 3 ? "sm:grid-cols-3" : columns === 1 ? "" : "sm:grid-cols-2";
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className={cn("grid grid-cols-2 gap-2.5", colCls)}>
        {options.map(opt => {
          const checked = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "rounded-lg border px-4 py-3 min-h-[52px] text-[15px] transition text-left touch-manipulation active:scale-[0.99]",
                checked ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30 font-medium" : "border-border hover:border-primary/40 hover:bg-secondary/40",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const SingleSelectChips = memo(SingleSelectChipsBase, (a, b) =>
  a.label === b.label &&
  a.required === b.required &&
  a.columns === b.columns &&
  a.options === b.options &&
  a.value === b.value,
);

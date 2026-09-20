import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OptionCardProps {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  rounded?: "xl" | "full";
}

export function OptionCard({ selected, onClick, children, className, rounded = "xl" }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden border bg-card text-left transition-all hover:border-primary/60 hover:shadow-sm",
        rounded === "full" ? "rounded-full" : "rounded-lg",
        selected ? "border-primary shadow-sm bg-primary/8" : "border-border",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface OptionLabelProps {
  selected?: boolean;
  children: ReactNode;
}

export function OptionLabel({ selected, children }: OptionLabelProps) {
  return (
    <div
      className={cn(
        "px-4 py-3.5 text-base font-medium transition-colors",
        selected ? "bg-primary/5 text-foreground" : "bg-card text-foreground",
      )}
    >
      {children}
    </div>
  );
}

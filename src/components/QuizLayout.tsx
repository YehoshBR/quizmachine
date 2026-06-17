import { ReactNode } from "react";
import { quizMeta } from "@/lib/quiz-config";
import { cn } from "@/lib/utils";

interface QuizLayoutProps {
  progress: number;
  onBack?: () => void;
  children: ReactNode;
  className?: string;
}

export function QuizLayout({ progress, onBack, children, className }: QuizLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-2xl items-center justify-center px-4 py-3">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-4 text-base text-muted-foreground hover:text-foreground"
              aria-label="Voltar"
            >
              ←
            </button>
          )}
          {typeof quizMeta.logo === "string" && quizMeta.logo.startsWith("/") ? (
            <img src={quizMeta.logo} alt={quizMeta.logoAlt} className="h-10 w-auto" />
          ) : (
            <img src={quizMeta.logo as string} alt={quizMeta.logoAlt} className="h-10 w-auto" />
          )}
        </div>
        <div className="h-1.5 w-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>
      <main className={cn("mx-auto max-w-2xl px-4 py-2 pb-8", className)}>{children}</main>
    </div>
  );
}

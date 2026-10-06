import { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { quizMeta as fallbackQuizMeta } from "@/lib/quiz-config";
import { cn } from "@/lib/utils";

interface QuizLayoutProps {
  progress: number;
  onBack?: () => void;
  children: ReactNode;
  className?: string;
}

export function QuizLayout({ progress, onBack, children, className }: QuizLayoutProps) {
  // Logo do quiz do domínio atual (multi-tenant), vindo do loader da rota "/".
  // Sem isso, todo quiz mostrava o logo estático do quiz-config.ts.
  const tenantMeta = useRouterState({
    select: (s) =>
      (s.matches.find((m) => m.routeId === "/")?.loaderData as
        | { quizMeta?: { logo?: string; logoAlt?: string } }
        | undefined)?.quizMeta,
  });
  const logo = (tenantMeta?.logo ?? fallbackQuizMeta.logo) as string;
  const logoAlt = tenantMeta?.logoAlt ?? fallbackQuizMeta.logoAlt;
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
          <span className="rounded-lg bg-black px-2.5 py-1.5">
            <img
              src={logo}
              alt={logoAlt}
              className="block h-7 w-auto"
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.svg"; }}
            />
          </span>
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

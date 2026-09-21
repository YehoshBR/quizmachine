import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { getTenantQuiz } from "@/lib/tenant";
import type { QuizMeta } from "@/lib/quiz-config";

/**
 * Monta o override de tema por tenant. "dark" troca a base inteira (fundo,
 * card, texto, borda) pra uma paleta escura ANTES de aplicar primary/secondary
 * — assim um quiz com logo em fundo preto/neon (ex: Digital Start) não briga
 * com um fundo claro genérico. Sem backgroundMode, só primary/secondary mudam.
 */
function buildThemeCss(quizMeta: QuizMeta | undefined): string {
  if (!quizMeta) return "";
  const tokens: string[] = [];

  if (quizMeta.backgroundMode === "dark") {
    tokens.push(
      "--background:oklch(0.09 0 0)",
      "--foreground:oklch(0.98 0 0)",
      "--card:oklch(0.15 0.003 264)",
      "--card-foreground:oklch(0.98 0 0)",
      "--muted:oklch(0.19 0.003 264)",
      "--muted-foreground:oklch(0.68 0.005 264)",
      "--accent:oklch(0.22 0.01 264)",
      "--accent-foreground:oklch(0.98 0 0)",
      "--border:oklch(0.27 0.01 264)",
      "--input:oklch(0.19 0.003 264)"
    );
  }
  if (quizMeta.primaryColor) {
    tokens.push(`--primary:${quizMeta.primaryColor}`, `--ring:${quizMeta.primaryColor}`);
  }
  if (quizMeta.secondaryColor) {
    tokens.push(`--secondary:${quizMeta.secondaryColor}`);
  }

  return tokens.length ? `:root{${tokens.join(";")}}` : "";
}

/** Monta os scripts de rastreamento configurados no painel (Pixel + script customizado). */
function buildTrackingScripts(quizMeta: QuizMeta | undefined): { children: string }[] {
  if (!quizMeta) return [];
  const scripts: { children: string }[] = [];
  const pixelId = quizMeta.facebookPixelId?.replace(/[^0-9]/g, "");
  if (pixelId) {
    scripts.push({
      children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`,
    });
  }
  if (quizMeta.customHeadScript?.trim()) {
    scripts.push({ children: quizMeta.customHeadScript });
  }
  return scripts;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">Esta página não existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Erro ao carregar</h1>
        <p className="mt-2 text-sm text-muted-foreground">Algo deu errado. Tente novamente.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => getTenantQuiz(),
  head: ({ loaderData }) => {
    const quizMeta = loaderData?.quizMeta;
    // Sobrescreve o tema por tenant, direto no <head>, pra não ter flash da
    // cor/fundo errado no primeiro paint (SSR já sai com o tema certo).
    const themeCss = buildThemeCss(quizMeta);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: quizMeta?.title ?? "Quiz" },
        { name: "description", content: quizMeta?.description ?? "" },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
      styles: themeCss ? [{ children: themeCss }] : [],
      scripts: buildTrackingScripts(quizMeta),
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

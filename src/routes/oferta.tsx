import { createFileRoute } from "@tanstack/react-router";
import { quizMeta } from "@/lib/quiz-config";

export const Route = createFileRoute("/oferta")({
  head: () => ({
    meta: [
      { title: `Oferta — ${quizMeta.title}` },
    ],
  }),
  component: OfertaPage,
});

function OfertaPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center py-16">
        <img
          src={quizMeta.logo as string}
          alt={quizMeta.logoAlt}
          className="h-12 w-auto mx-auto mb-8"
        />
        <h1 className="text-3xl font-extrabold text-foreground">
          Sua página de oferta
        </h1>
        <p className="mt-4 text-muted-foreground">
          Configure esta página em <code className="bg-muted px-1 rounded">src/routes/oferta.tsx</code>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Produto: <strong>{quizMeta.productName ?? "[Defina productName no quizMeta]"}</strong>
        </p>
      </div>
    </div>
  );
}

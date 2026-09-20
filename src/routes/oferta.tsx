import { createFileRoute } from "@tanstack/react-router";
import { quizMeta } from "@/lib/quiz-config";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/oferta")({
  head: () => ({
    meta: [
      { title: `Oferta — ${quizMeta.title}` },
    ],
  }),
  component: OfertaPage,
});

// ============================================================
// PÁGINA DE OFERTA — template inicial
// ============================================================
// Esta página é o ponto de partida. Ela é DIFERENTE do quiz: aqui você edita
// o JSX diretamente (não tem um "arquivo de config" central como o quiz),
// porque cada oferta tem uma estrutura de blocos própria (hero, prova social,
// preço, garantia, FAQ...). Use como referência o padrão de página de venda
// que você já usa no Lovable — headline com <span className="text-primary">
// destacando a palavra-chave, eyebrow em uppercase tracking-widest, e CTA
// grande usando <Button> (já vem com o gradiente/brilho do tema).
// ============================================================

function OfertaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-center py-6">
        <span className="inline-block rounded-xl bg-black px-4 py-2.5">
          <img src={quizMeta.logo as string} alt={quizMeta.logoAlt} className="block h-10 w-auto" />
        </span>
      </header>

      {/* BLOCO — Hero */}
      <section className="px-5 pb-14 pt-4 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
            Seu diagnóstico está pronto
          </p>
          <h1 className="mt-4 text-3xl font-extrabold uppercase leading-tight text-foreground sm:text-4xl">
            Substitua por uma headline que fala com{" "}
            <span className="text-primary">a dor do avatar</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Subheadline: explique em uma frase o benefício principal do{" "}
            <strong>{quizMeta.productName ?? "[Defina productName no quizMeta]"}</strong>.
          </p>
          <Button className="mt-8 h-14 px-10 text-base font-bold uppercase tracking-wide">
            Chamada para ação →
          </Button>
        </div>
      </section>

      <section className="border-t border-border px-5 py-14 text-center">
        <div className="mx-auto max-w-xl">
          <p className="text-sm text-muted-foreground">
            Configure o restante da página (prova social, mecanismo, preço, garantia, FAQ) em{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">src/routes/oferta.tsx</code>.
            Use os blocos do seu padrão de página de venda do Lovable como referência de estrutura.
          </p>
        </div>
      </section>
    </div>
  );
}

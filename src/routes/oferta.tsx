import { createFileRoute } from "@tanstack/react-router";
import { createElement, Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { getTenantQuiz } from "@/lib/tenant";
import { computeTopSignals, readPersistedAnswers } from "@/lib/signals";
import { trackEvent } from "@/lib/tracking";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/oferta")({
  loader: () => getTenantQuiz(),
  head: ({ loaderData }) => ({
    meta: [{ title: `Oferta — ${loaderData?.quizMeta.title ?? "Quiz"}` }],
  }),
  component: OfertaPage,
});

// ============================================================
// PÁGINA DE OFERTA — genérica, a mesma pra qualquer quiz
// ============================================================
// O produto é sempre o mesmo (quizMeta.product, definido uma vez no painel).
// O que muda por visitante é qual dor/desejo aparece primeiro — calculado a
// partir das respostas do quiz (sessionStorage → computeTopSignals). Sem
// sinais configurados ou sem resposta guardada, mostra a versão genérica do
// produto — nunca quebra.
// ============================================================

/** Troca *palavra* por <span class="text-primary">palavra</span>. Seguro (sem dangerouslySetInnerHTML). */
function highlight(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      createElement("span", { key: `h${key++}`, className: "text-primary font-extrabold" }, m[1])
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return createElement(Fragment, null, ...parts);
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function buildCheckoutUrl(base: string): string {
  if (typeof window === "undefined") return base;
  try {
    const url = new URL(base);
    const current = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
      const v = current.get(k) || sessionStorage.getItem(k);
      if (v) {
        sessionStorage.setItem(k, v);
        url.searchParams.set(k, v);
      }
    });
    const fbclid = current.get("fbclid") || sessionStorage.getItem("fbclid");
    if (fbclid) url.searchParams.set("fbclid", fbclid);
    const fbp = getCookie("_fbp");
    if (fbp) url.searchParams.set("fbp", fbp);
    const fbc = getCookie("_fbc");
    if (fbc) url.searchParams.set("fbc", fbc);
    return url.toString();
  } catch {
    return base;
  }
}

function useCountdown(totalSeconds: number) {
  const [left, setLeft] = useState(totalSeconds);
  useEffect(() => {
    const i = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(i);
  }, []);
  const m = Math.floor(left / 60).toString().padStart(2, "0");
  const s = (left % 60).toString().padStart(2, "0");
  return { label: `${m}:${s}`, done: left <= 0 };
}

function OfertaPage() {
  const { id: quizId, quizMeta, screens } = Route.useLoaderData();
  const product = quizMeta.product;
  const countdown = useCountdown(20 * 60);

  const [signals, setSignals] = useState<ReturnType<typeof computeTopSignals> | null>(null);
  useEffect(() => {
    const answers = readPersistedAnswers();
    if (!answers) return;
    setSignals(computeTopSignals(screens, answers, quizMeta.signalLibrary));
  }, [screens, quizMeta.signalLibrary]);

  const testimonialsScreen = useMemo(
    () => screens.find((s): s is Extract<typeof screens[number], { type: "testimonials" }> => s.type === "testimonials"),
    [screens]
  );

  const topPain = signals?.topPain;
  const topDesire = signals?.topDesire;
  const checkoutUrl = product ? buildCheckoutUrl(product.checkoutUrl) : "#";

  const headline = topPain?.headline ?? (product ? `A hora de resolver isso é agora: *${product.name}*` : "Sua oferta personalizada");
  const subheadline = topPain?.body ?? product?.promise ?? "Configure quizMeta.product no painel pra ativar essa página.";

  function trackCheckout() {
    if (quizId) trackEvent(quizId, "checkout_click", { data: { url: checkoutUrl } });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Barra de urgência */}
      {!countdown.done && (
        <div className="sticky top-0 z-40 bg-destructive py-2 text-center text-xs font-bold uppercase tracking-wider text-destructive-foreground">
          ⏱ {countdown.label} · Condição especial desta sessão
        </div>
      )}

      <header className="flex justify-center py-6">
        <span className="inline-block rounded-xl bg-black px-4 py-2.5">
          <img src={quizMeta.logo as string} alt={quizMeta.logoAlt} className="block h-10 w-auto" />
        </span>
      </header>

      {/* HERO — personalizado pela dor dominante */}
      <section className="px-5 pb-10 pt-2 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
            Seu diagnóstico está pronto
          </p>
          <h1 className="mt-4 text-2xl font-extrabold uppercase leading-tight text-foreground sm:text-3xl">
            {highlight(headline)}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            {subheadline}
          </p>
          <Button onClick={trackCheckout} asChild className="mt-8 h-14 px-10 text-base font-bold uppercase tracking-wide">
            <a href={checkoutUrl}>Quero resolver isso agora →</a>
          </Button>
        </div>
      </section>

      {/* HOJE x DEPOIS — dor dominante x desejo dominante */}
      {(topPain || topDesire) && (
        <section className="border-y border-border bg-card/40 px-5 py-12">
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            {topPain && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-destructive">🔴 Hoje</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{topPain.body}</p>
              </div>
            )}
            {topDesire && (
              <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-secondary">🟢 Com {product?.name ?? "o método"}</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{topDesire.body}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* BENEFÍCIOS — sempre o mesmo produto */}
      {product && product.benefits.length > 0 && (
        <section className="px-5 py-14">
          <div className="mx-auto max-w-xl">
            <h2 className="text-center text-xl font-extrabold uppercase text-foreground sm:text-2xl">
              O que vem com o <span className="text-primary">{product.name}</span>
            </h2>
            <ul className="mx-auto mt-8 max-w-md space-y-3">
              {product.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                  <span className="text-lg leading-none text-primary">✅</span>
                  <span className="pt-0.5 text-sm leading-relaxed text-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* PROVA SOCIAL — reaproveita os depoimentos do próprio quiz, se existirem */}
      {testimonialsScreen && (
        <section className="border-y border-border bg-card/40 px-5 py-14">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-xl font-extrabold uppercase text-foreground sm:text-2xl">
              {testimonialsScreen.title}
            </h2>
            <div className="mt-8 space-y-3">
              {testimonialsScreen.items.map((t) => (
                <div key={t.name} className="rounded-xl bg-card p-4 shadow-sm">
                  <p className="text-sm italic text-foreground">"{t.text}"</p>
                  <p className="mt-2 text-xs font-semibold text-secondary">— {t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PREÇO + CTA */}
      <section id="oferta" className="px-5 py-14">
        <div className="mx-auto max-w-md">
          <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-card p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              Acesso imediato
            </span>
            {product ? (
              <>
                <p className="mt-2 text-center text-sm font-bold uppercase text-primary">{product.name}</p>
                {product.originalPrice && (
                  <p className="mt-3 text-center text-sm font-bold text-destructive line-through">
                    De {product.originalPrice}
                  </p>
                )}
                <p className="mt-1 text-center text-5xl font-extrabold text-foreground">{product.price}</p>
                {product.installments && (
                  <p className="text-center text-sm text-muted-foreground">{product.installments}</p>
                )}
                <ul className="mt-6 space-y-2 text-sm text-foreground">
                  {product.benefits.slice(0, 5).map((b) => (
                    <li key={b}>✅ {b}</li>
                  ))}
                </ul>
                <Button onClick={trackCheckout} asChild className="mt-7 h-14 w-full text-base font-bold uppercase">
                  <a href={checkoutUrl}>Quero garantir minha vaga →</a>
                </Button>
                {product.guarantee && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">🔒 {product.guarantee}</p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Configure os dados do produto (preço, checkout, benefícios) na aba "Produto" do
                painel administrativo pra essa seção aparecer completa.
              </p>
            )}
          </div>
        </div>
      </section>

      <footer className="px-5 pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {product?.name ?? quizMeta.productName}
      </footer>

      {/* CTA flutuante mobile */}
      {product && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase text-muted-foreground">Por apenas</span>
              <span className="text-lg font-extrabold text-primary">{product.price}</span>
            </div>
            <Button onClick={trackCheckout} asChild className="ml-auto h-11 flex-1 font-bold">
              <a href={checkoutUrl}>Garantir agora →</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

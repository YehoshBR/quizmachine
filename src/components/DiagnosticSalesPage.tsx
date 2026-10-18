import { createElement, Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import type { QuizMeta, Screen, SalesPageConfig } from "@/lib/quiz-config";
import { computeDiagnosisScore, readPersistedAnswers } from "@/lib/signals";
import { trackEvent } from "@/lib/tracking";
import { Button } from "@/components/ui/button";
import { PaginaPremium } from "@/components/premium/PaginaPremium";

// ============================================================
// PÁGINA DE DIAGNÓSTICO (high ticket) — ativada por quizMeta.salesPage
// ============================================================
// Em vez de abrir com o botão de compra, entrega o diagnóstico: nome do lead,
// nível calculado pelas respostas, leitura do que cada resposta mostra, a
// ponte para o produto, objeções tiradas das próprias respostas e, só no fim,
// a escolha entre os planos (com o recomendado já selecionado). Sem barra
// flutuante: isso é recurso de low ticket.
// ============================================================

type Answers = Record<string, string | string[]>;

/** *destaque* vira negrito na cor primária. Seguro (sem dangerouslySetInnerHTML). */
function rich(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(createElement("strong", { key: `r${key++}`, className: "font-bold text-primary" }, m[1]));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return createElement(Fragment, null, ...parts);
}

/** Troca {nome}; sem nome, "{nome}, texto" vira "Texto". */
function withName(text: string, name: string): string {
  if (name) return text.split("{nome}").join(name);
  const t = text.replace(/\{nome\},?\s*/g, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Props = {
  quizId: string | null;
  quizMeta: QuizMeta;
  screens: Screen[];
  scoringMap: Record<string, Record<string, number>>;
  cfg: SalesPageConfig;
  planKey: string | null;
  buildCheckoutUrl: (base: string, leadName?: string) => string;
};

export function DiagnosticSalesPage({ quizId, quizMeta, screens, scoringMap, cfg, planKey, buildCheckoutUrl }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [selected, setSelected] = useState<string>(cfg.choice.recommend.default);
  const [recommended, setRecommended] = useState<string>(cfg.choice.recommend.default);

  useEffect(() => {
    const a = readPersistedAnswers() ?? {};
    setAnswers(a);
    const byAnswer = cfg.choice.recommend.map[String(a[cfg.choice.recommend.id] ?? "")];
    const rec = (planKey && cfg.choice.options.some((o) => o.key === planKey) ? planKey : byAnswer) || cfg.choice.recommend.default;
    setRecommended(rec);
    setSelected(rec);
  }, [cfg, planKey]);

  const fullName = typeof answers["name"] === "string" ? (answers["name"] as string) : "";
  const name = fullName.trim().split(/\s+/)[0] ?? "";
  const nm = (t: string) => withName(t, name);

  const diag = useMemo(
    () => screens.find((s): s is Extract<Screen, { type: "diagnosis" }> => s.type === "diagnosis"),
    [screens]
  );
  const answered = Object.keys(answers).length > 0;
  const pct = answered ? computeDiagnosisScore(scoringMap, answers) : null;
  const levelIdx = diag && pct !== null ? Math.min(diag.levels.length - 1, Math.floor(pct / (100 / diag.levels.length))) : -1;
  const highlight =
    diag?.dynamicHighlight && pct !== null
      ? [...diag.dynamicHighlight].sort((a, b) => b.minPct - a.minPct).find((h) => pct >= h.minPct)
      : undefined;

  const findings = cfg.findings
    .map((f) => f.map[String(answers[f.id] ?? "")])
    .filter((t): t is string => Boolean(t))
    .slice(0, cfg.maxFindings ?? 5);

  const objections = cfg.objections
    .map((o) => o.map[String(answers[o.id] ?? "")])
    .filter((o): o is { q: string; a: string } => Boolean(o));

  const option = cfg.choice.options.find((o) => o.key === selected) ?? cfg.choice.options[0];
  const checkoutUrl = buildCheckoutUrl(option.checkoutUrl, fullName);

  function goCheckout() {
    if (quizId) trackEvent(quizId, "checkout_click", { data: { url: checkoutUrl, plano: option.key } });
  }

  if (cfg.estilo === "premium") {
    const porResposta = cfg.closing?.byAnswer;
    return (
      <PaginaPremium
        quizMeta={quizMeta}
        cfg={cfg}
        nm={nm}
        diag={diag}
        pct={pct}
        levelIdx={levelIdx}
        highlight={highlight}
        findings={findings}
        objections={objections}
        closingByAnswer={porResposta ? porResposta.map[String(answers[porResposta.id] ?? "")] : undefined}
        selected={selected}
        recommended={recommended}
        setSelected={setSelected}
        option={option}
        checkoutUrl={checkoutUrl}
        goCheckout={goCheckout}
      />
    );
  }

  const section = "px-5 py-12";
  const h2 = "text-center text-xl font-extrabold uppercase leading-tight text-foreground sm:text-2xl";

  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-center py-6">
        <span className="inline-block rounded-xl bg-black px-4 py-2.5">
          <img src={quizMeta.logo as string} alt={quizMeta.logoAlt} className="block h-10 w-auto" />
        </span>
      </header>

      {/* 1. DIAGNÓSTICO — nome + nível, sem botão de compra */}
      <section className="px-5 pb-12 pt-2">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Diagnóstico O Caminho do Mentor</p>
          <h1 className="mt-4 text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">{rich(nm(cfg.heroTitle))}</h1>
          {cfg.heroSubtitle && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{rich(nm(cfg.heroSubtitle))}</p>}
        </div>
        {diag && pct !== null && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-border bg-card p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{diag.barLabel ?? diag.title}</p>
            <div className="mt-4 flex gap-1">
              {diag.levels.map((l, i) => (
                <div key={l} className={`h-2.5 flex-1 rounded-full ${i <= levelIdx ? diag.levelColors[i] : "bg-muted"}`} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase text-muted-foreground">
              <span>{diag.levels[0]}</span>
              <span>{diag.levels[diag.levels.length - 1]}</span>
            </div>
            <p className="mt-5 text-center text-sm text-muted-foreground">Seu nível hoje</p>
            <p className="text-center text-2xl font-extrabold text-primary">
              {diag.levels[levelIdx]} <span className="text-base font-bold text-muted-foreground">· {pct}%</span>
            </p>
            {highlight && (
              <div className="mt-5 rounded-xl bg-background/60 p-4">
                <p className="font-bold text-foreground">{highlight.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{highlight.body}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. O QUE AS RESPOSTAS MOSTRAM */}
      {findings.length > 0 && (
        <section className={`${section} border-y border-border bg-card/40`}>
          <div className="mx-auto max-w-xl">
            <h2 className={h2}>{rich(nm(cfg.findingsTitle))}</h2>
            <ol className="mt-8 space-y-3">
              {findings.map((t, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-sm leading-relaxed text-foreground">{rich(nm(t))}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* 3. PONTE */}
      {cfg.bridge && (
        <section className={section}>
          <div className="mx-auto max-w-xl text-center">
            <h2 className={h2}>{rich(nm(cfg.bridge.title))}</h2>
            <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{rich(nm(cfg.bridge.body))}</p>
          </div>
        </section>
      )}

      {/* 4. O PRODUTO */}
      <section className={`${section} border-y border-border bg-card/40`}>
        <div className="mx-auto max-w-xl">
          <h2 className={h2}>{rich(nm(cfg.product.title))}</h2>
          <p className="mt-5 whitespace-pre-line text-center text-base leading-relaxed text-muted-foreground">{rich(nm(cfg.product.body))}</p>
          {cfg.product.steps && (
            <div className="mt-8 space-y-3">
              {cfg.product.steps.map((s, i) => (
                <div key={s.title} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Etapa {i + 1}</p>
                  <p className="mt-1 font-bold text-foreground">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{rich(nm(s.text))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. QUEM CONDUZ */}
      {cfg.proof && (
        <section className={section}>
          <div className="mx-auto max-w-xl text-center">
            <h2 className={h2}>{rich(nm(cfg.proof.title))}</h2>
            <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{rich(nm(cfg.proof.body))}</p>
          </div>
        </section>
      )}

      {/* 6. OBJEÇÕES — primeiro as que a pessoa levantou no quiz */}
      {(objections.length > 0 || (cfg.faq?.length ?? 0) > 0) && (
        <section className={`${section} border-y border-border bg-card/40`}>
          <div className="mx-auto max-w-xl">
            <h2 className={h2}>{rich(nm(cfg.objectionsTitle))}</h2>
            <div className="mt-8 space-y-3">
              {[...objections, ...(cfg.faq ?? [])].map((o) => (
                <details key={o.q} className="group rounded-xl border border-border bg-card p-4" open={objections.includes(o)}>
                  <summary className="cursor-pointer list-none font-bold text-foreground">
                    <span className="mr-2 text-primary group-open:hidden">+</span>
                    <span className="mr-2 hidden text-primary group-open:inline">−</span>
                    {o.q}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rich(nm(o.a))}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. ESCOLHA DO CAMINHO — cartões selecionáveis, o recomendado já vem marcado */}
      <section id="escolha" className={section}>
        <div className="mx-auto max-w-md">
          <h2 className={h2}>{rich(nm(cfg.choice.title))}</h2>
          {cfg.choice.subtitle && (
            <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">{rich(nm(cfg.choice.subtitle))}</p>
          )}
          <div className="mt-7 space-y-3" role="radiogroup">
            {cfg.choice.options.map((o) => {
              const on = o.key === selected;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(o.key)}
                  className={`relative w-full rounded-2xl border-2 p-5 text-left transition ${
                    on ? "border-primary bg-card shadow-lg" : "border-border bg-card/40"
                  }`}
                >
                  {o.key === recommended && (
                    <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                      {cfg.choice.recommendLabel ?? "Recomendado para você"}
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        on ? "border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className={`font-extrabold ${on ? "text-primary" : "text-foreground"}`}>{o.label}</p>
                        <p className="shrink-0 text-lg font-extrabold text-foreground">{o.price}</p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{o.desc}</p>
                      {o.installments && <p className="mt-1 text-xs text-muted-foreground">{o.installments}</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {cfg.choice.note && <p className="mt-5 text-center text-sm leading-relaxed text-foreground">{rich(nm(cfg.choice.note))}</p>}
          <Button onClick={goCheckout} asChild className="mt-6 h-14 w-full text-base font-bold uppercase">
            <a href={checkoutUrl}>{option.cta}</a>
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">🔒 Pagamento seguro · Pix ou cartão em até 12x</p>
        </div>
      </section>

      {/* 8. FECHAMENTO */}
      {cfg.closing && (
        <section className={`${section} border-t border-border bg-card/40`}>
          <div className="mx-auto max-w-xl text-center">
            <h2 className={h2}>{rich(nm(cfg.closing.title))}</h2>
            {cfg.closing.byAnswer && cfg.closing.byAnswer.map[String(answers[cfg.closing.byAnswer.id] ?? "")] && (
              <p className="mt-5 text-base leading-relaxed text-foreground">
                {rich(nm(cfg.closing.byAnswer.map[String(answers[cfg.closing.byAnswer.id])]))}
              </p>
            )}
            <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{rich(nm(cfg.closing.body))}</p>
            <Button asChild variant="outline" className="mt-7 h-12 px-8 font-bold">
              <a href="#escolha">Escolher o meu caminho ↑</a>
            </Button>
          </div>
        </section>
      )}

      <footer className="px-5 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {quizMeta.productName}
      </footer>
    </div>
  );
}

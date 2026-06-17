import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QuizLayout } from "@/components/QuizLayout";
import { OptionCard, OptionLabel } from "@/components/QuizCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { screens, quizMeta } from "@/lib/quiz-config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: quizMeta.title },
      { name: "description", content: quizMeta.description },
    ],
  }),
  component: QuizPage,
});

type Answers = Record<string, string | string[]>;

// =================== MAIN QUIZ PAGE ===================
function QuizPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [leadValues, setLeadValues] = useState<Record<string, string>>({});
  const [loadingPct, setLoadingPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const screen = screens[step];
  const totalScreens = screens.length;

  const progress = useMemo(() => (step / (totalScreens - 1)) * 100, [step, totalScreens]);

  const next = () => setStep((s) => Math.min(s + 1, totalScreens - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const setAnswer = (id: string, value: string | string[]) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  // Loading screen animation
  useEffect(() => {
    if (screen.type !== "loading") return;
    setLoadingPct(0);
    const duration = screen.durationMs ?? 4000;
    const start = Date.now();
    const i = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / duration) * 100);
      setLoadingPct(pct);
      if (pct >= 100) {
        clearInterval(i);
        setTimeout(() => {
          // Resolve offer URL from answers if segmented LPs are configured
          let offerPath = quizMeta.offerUrl;
          if (quizMeta.offerRouteByAnswer) {
            for (const [answerId, routes] of Object.entries(quizMeta.offerRouteByAnswer)) {
              const ans = answers[answerId] as string | undefined;
              if (ans && routes) {
                const routeMap = routes as unknown as Record<string, string>;
                offerPath = routeMap[ans] ?? routeMap["_default"] ?? quizMeta.offerUrl;
                break;
              }
            }
          }
          navigate({ to: offerPath as "/" });
        }, 300);
      }
    }, 60);
    return () => clearInterval(i);
  }, [screen.id]);

  // Analyzing → offer redirect
  if (analyzing) {
    return (
      <AnalyzingScreen
        onDone={() => navigate({ to: quizMeta.offerUrl as "/" })}
      />
    );
  }

  // ─────────── INTRO ───────────
  if (screen.type === "intro") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex justify-center pt-4">
          <img src={quizMeta.logo as string} alt={quizMeta.logoAlt} className="h-14 w-auto" />
        </div>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-4 text-center">
          <h1 className="text-xl font-extrabold leading-tight text-foreground sm:text-2xl uppercase">
            {screen.headline}
          </h1>
          {screen.subheadline && (
            <p className="mt-4 text-base text-muted-foreground">{screen.subheadline}</p>
          )}

          <div className="mt-6 w-full border-t border-dashed border-muted-foreground/30 pt-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">{screen.firstQuestion}</h2>
            <div className="grid grid-cols-2 gap-4">
              {screen.firstOptions.map((opt) => (
                <OptionCard
                  key={opt.value}
                  selected={answers["intro_first"] === opt.value}
                  rounded="xl"
                  onClick={() => {
                    setAnswer("intro_first", opt.value);
                    setStep(1);
                  }}
                >
                  {opt.image && (
                    <img
                      src={opt.image}
                      alt={opt.label}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <OptionLabel selected={answers["intro_first"] === opt.value}>
                    {opt.label}
                  </OptionLabel>
                </OptionCard>
              ))}
            </div>
          </div>

          {screen.badge && (
            <p className="mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="text-lg">🕐</span> {screen.badge}
            </p>
          )}
        </main>
      </div>
    );
  }

  // ─────────── SINGLE ───────────
  if (screen.type === "single") {
    const current = answers[screen.id] as string | undefined;
    const hasImages = screen.options.some((o) => o.image);
    const cols =
      hasImages
        ? "grid-cols-2"
        : screen.grid === 2
        ? "grid-cols-2"
        : screen.grid === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-1";

    return (
      <QuizLayout progress={progress} onBack={back}>
        <div className="flex min-h-[calc(100vh-12rem)] flex-col justify-center py-2">
          <h2
            className="mb-4 text-center text-xl font-bold text-foreground sm:text-2xl"
            dangerouslySetInnerHTML={{ __html: screen.question.replace(/<hl>(.*?)<\/hl>/g, "<strong>$1</strong>") }}
          />
          <div className={`grid gap-2 ${cols}`}>
            {screen.options.map((opt) => {
              const selected = current === opt.value;
              return (
                <OptionCard
                  key={opt.value}
                  selected={selected}
                  rounded={hasImages ? "xl" : "full"}
                  onClick={() => {
                    setAnswer(screen.id, opt.value);
                    setTimeout(next, 200);
                  }}
                >
                  {opt.image && (
                    <img
                      src={opt.image}
                      alt={opt.label}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {opt.image ? (
                    <OptionLabel selected={selected}>{opt.label}</OptionLabel>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-4">
                      {opt.emoji && <span className="text-2xl leading-none">{opt.emoji}</span>}
                      <span className="text-base font-medium text-foreground">{opt.label}</span>
                    </div>
                  )}
                </OptionCard>
              );
            })}
          </div>
        </div>
      </QuizLayout>
    );
  }

  // ─────────── MULTI ───────────
  if (screen.type === "multi") {
    const current = (answers[screen.id] as string[]) || [];
    const minSelect = screen.minSelect ?? 1;
    const toggle = (v: string) => {
      const set = new Set(current);
      if (set.has(v)) set.delete(v);
      else set.add(v);
      setAnswer(screen.id, Array.from(set));
    };
    return (
      <QuizLayout progress={progress} onBack={back}>
        <h2
          className="mb-2 text-center text-xl font-bold text-foreground sm:text-2xl"
          dangerouslySetInnerHTML={{ __html: screen.question.replace(/<hl>(.*?)<\/hl>/g, "<strong>$1</strong>") }}
        />
        <p className="mb-4 text-center text-sm text-muted-foreground">
          {screen.subtitle ?? "Selecione todas que se aplicam"}
        </p>
        <div className="grid gap-2">
          {screen.options.map((opt) => {
            const selected = current.includes(opt.value);
            return (
              <OptionCard key={opt.value} selected={selected} onClick={() => toggle(opt.value)}>
                <OptionLabel selected={selected}>{opt.label}</OptionLabel>
              </OptionCard>
            );
          })}
        </div>
        <Button
          className="mt-6 h-12 w-full text-base font-bold"
          onClick={next}
          disabled={current.length < minSelect}
        >
          Continuar →
        </Button>
      </QuizLayout>
    );
  }

  // ─────────── SCALE ───────────
  if (screen.type === "scale") {
    const current = answers[screen.id] as string | undefined;
    const labels = [
      "Concordo totalmente",
      "Concordo parcialmente",
      "Neutro",
      "Discordo parcialmente",
      "Discordo totalmente",
    ];
    return (
      <QuizLayout progress={progress} onBack={back}>
        <p className="mb-2 text-center text-sm font-medium text-muted-foreground">
          {screen.question}
        </p>
        <h2 className="mb-6 text-center text-2xl font-bold italic text-foreground">
          "{screen.statement}"
        </h2>
        <div className="grid gap-2">
          {labels.map((l, i) => {
            const v = String(i);
            const selected = current === v;
            return (
              <OptionCard
                key={v}
                selected={selected}
                onClick={() => {
                  setAnswer(screen.id, v);
                  setTimeout(next, 200);
                }}
              >
                <OptionLabel selected={selected}>{l}</OptionLabel>
              </OptionCard>
            );
          })}
        </div>
      </QuizLayout>
    );
  }

  // ─────────── CONTENT ───────────
  if (screen.type === "content") {
    return (
      <QuizLayout progress={progress} onBack={back}>
        <article className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
          {screen.highlight && (
            <p className="mb-3 rounded-xl bg-primary/5 px-4 py-3 text-sm font-semibold text-primary border border-primary/10">
              {screen.highlight}
            </p>
          )}
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">{screen.title}</h2>
          {screen.image && (
            <div className="my-3 overflow-hidden rounded-xl border border-border shadow-sm">
              <img src={screen.image} alt="" className="w-full object-contain" loading="lazy" />
            </div>
          )}
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
            {screen.body}
          </p>
          {screen.quote && (
            <blockquote className="mt-5 rounded-xl border-l-4 border-secondary bg-muted/50 p-4">
              <p className="text-sm italic text-foreground">"{screen.quote.text}"</p>
              <footer className="mt-2 text-xs font-semibold text-secondary">
                — {screen.quote.author}
              </footer>
            </blockquote>
          )}
          <Button className="mt-6 h-12 w-full text-base font-bold" onClick={next}>
            Continuar →
          </Button>
        </article>
      </QuizLayout>
    );
  }

  // ─────────── SOCIAL PROOF ───────────
  if (screen.type === "social-proof") {
    return (
      <QuizLayout progress={progress} onBack={back}>
        <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">{screen.title}</h2>

          {screen.stat && (
            <div className="my-4 text-center">
              <p className="text-5xl font-extrabold text-primary">{screen.stat}</p>
              {screen.source && (
                <p className="mt-1 text-sm text-muted-foreground">{screen.source}</p>
              )}
            </div>
          )}

          <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground">
            {screen.body}
          </p>

          {screen.image && (
            <div className="mt-4 overflow-hidden rounded-xl border border-border shadow-sm">
              <img src={screen.image} alt="Prova social" className="w-full object-contain" loading="lazy" />
            </div>
          )}

          {screen.whatsapp && (
            <div className="mt-4 rounded-2xl bg-[#dcf8c6] p-4 dark:bg-[#025144]">
              <p className="text-xs font-semibold text-[#075e54] dark:text-[#dcf8c6]">
                {screen.whatsapp.author}
              </p>
              <p className="mt-1 text-sm text-foreground">{screen.whatsapp.text}</p>
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {screen.whatsapp.meta}
              </p>
            </div>
          )}

          <Button className="mt-6 h-12 w-full text-base font-bold" onClick={next}>
            Continuar →
          </Button>
        </div>
      </QuizLayout>
    );
  }

  // ─────────── LOADING ───────────
  if (screen.type === "loading") {
    const lineIdx = Math.min(
      screen.lines.length - 1,
      Math.floor((loadingPct / 100) * screen.lines.length)
    );
    return (
      <QuizLayout progress={progress}>
        <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">{screen.title}</h2>
          <div className="my-8">
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
                style={{ width: `${loadingPct}%` }}
              />
            </div>
            <p className="mt-3 text-3xl font-extrabold text-primary">
              {Math.round(loadingPct)}%
            </p>
          </div>
          <p className="mt-3 min-h-[2rem] animate-pulse text-sm font-medium text-primary">
            {screen.lines[lineIdx]}
          </p>
        </div>
      </QuizLayout>
    );
  }

  // ─────────── DIAGNOSIS ───────────
  if (screen.type === "diagnosis") {
    return (
      <DiagnosisScreen
        screen={screen}
        progress={progress}
        onBack={back}
        onNext={next}
        answers={answers}
      />
    );
  }

  // ─────────── COMPARE ───────────
  if (screen.type === "compare") {
    return (
      <CompareScreen
        screen={screen}
        progress={progress}
        onBack={back}
        onNext={next}
      />
    );
  }

  // ─────────── TESTIMONIALS ───────────
  if (screen.type === "testimonials") {
    return (
      <QuizLayout progress={progress} onBack={back}>
        <h2 className="mb-6 text-center text-xl font-bold text-foreground sm:text-2xl">
          {screen.title}
        </h2>
        <div className="space-y-3">
          {screen.items.map((t) => (
            <div key={t.name} className="rounded-xl bg-card p-4 shadow-sm">
              <p className="text-sm italic text-foreground">"{t.text}"</p>
              <p className="mt-2 text-xs font-semibold text-secondary">— {t.name}</p>
            </div>
          ))}
        </div>
        <Button className="mt-6 h-12 w-full text-base font-bold" onClick={next}>
          Continuar →
        </Button>
      </QuizLayout>
    );
  }

  // ─────────── MIRROR CHART ───────────
  if (screen.type === "mirror-chart") {
    return (
      <MirrorChartScreen
        screen={screen}
        progress={progress}
        onBack={back}
        onNext={next}
      />
    );
  }

  // ─────────── LEAD ───────────
  if (screen.type === "lead") {
    const fields = quizMeta.leadFields;
    const valid = fields.every(
      (f) => !f.required || (leadValues[f.id] ?? "").trim().length > 0
    );

    return (
      <QuizLayout progress={100} onBack={back}>
        <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-center text-xl font-bold text-foreground sm:text-2xl">
            {screen.title}
          </h2>
          {(screen.expertImage || quizMeta.expertImage) && (
            <img
              src={(screen.expertImage ?? quizMeta.expertImage) as string}
              alt={quizMeta.expertName ?? "Expert"}
              className="my-5 mx-auto h-32 w-32 rounded-full object-cover shadow-md"
              loading="lazy"
            />
          )}
          {screen.subtitle && (
            <p className="text-center text-sm text-muted-foreground">{screen.subtitle}</p>
          )}
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!valid || submitting) return;
              setSubmitting(true);
              // TODO: salvar lead no Supabase (configurar SUPABASE_URL e SUPABASE_ANON_KEY)
              // Por ora, vai direto para a tela de análise
              setSubmitting(false);
              setAnalyzing(true);
            }}
          >
            {fields.map((f) => (
              <div key={f.id}>
                <Label htmlFor={f.id}>{f.label}</Label>
                <Input
                  id={f.id}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={leadValues[f.id] ?? ""}
                  onChange={(e) =>
                    setLeadValues((v) => ({ ...v, [f.id]: e.target.value }))
                  }
                  required={f.required}
                  className="mt-1 h-12"
                />
              </div>
            ))}
            <Button
              type="submit"
              disabled={!valid || submitting}
              className="h-14 w-full text-base font-bold"
            >
              {submitting ? "ENVIANDO..." : (screen.ctaText ?? "CONTINUAR →")}
            </Button>
            {screen.privacyText && (
              <p className="text-center text-xs text-muted-foreground">{screen.privacyText}</p>
            )}
          </form>
        </div>
      </QuizLayout>
    );
  }

  return null;
}

// =================== DIAGNOSIS SCREEN ===================
type DiagScreenProps = {
  screen: Extract<import("@/lib/quiz-config").Screen, { type: "diagnosis" }>;
  progress: number;
  onBack: () => void;
  onNext: () => void;
  answers: Answers;
};

function DiagnosisScreen({ screen, progress, onBack, onNext, answers }: DiagScreenProps) {
  const targetPct =
    screen.targetPct === "computed"
      ? computeDiagnosisScore(answers)
      : screen.targetPct;

  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setPct(0);
    setDone(false);
    const start = Date.now();
    const duration = 2200;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(eased * targetPct);
      if (t >= 1) {
        clearInterval(id);
        setDone(true);
      }
    }, 30);
    return () => clearInterval(id);
  }, [targetPct]);

  const highlightColors = {
    success: "border-emerald-500 bg-emerald-500/5",
    warning: "border-amber-500 bg-amber-500/5",
    danger: "border-destructive bg-destructive/5",
  };
  const textColors = {
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-600",
    danger: "text-destructive",
  };

  return (
    <QuizLayout progress={progress} onBack={onBack}>
      <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-center text-xl font-extrabold text-foreground sm:text-2xl">
          {screen.title}
        </h2>
        {screen.subtitle && (
          <p className="mt-2 text-center text-sm text-muted-foreground">{screen.subtitle}</p>
        )}

        {/* Barra de nível animada */}
        <div className="mt-6">
          {screen.barLabel && (
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {screen.barLabel}
            </p>
          )}
          <div className="relative h-3 w-full overflow-hidden rounded-full">
            <div className="absolute inset-0 flex">
              {screen.levels.map((l, i) => (
                <div key={l} className={`h-full flex-1 ${screen.levelColors[i] ?? "bg-muted"}`} />
              ))}
            </div>
          </div>
          <div className="relative h-8">
            <div
              className="absolute -top-2 transition-all duration-100 ease-out"
              style={{ left: `calc(${pct}% - 14px)` }}
            >
              <div className="flex flex-col items-center">
                <div className="rounded-md bg-foreground px-2 py-0.5 text-[10px] font-bold text-background shadow">
                  {screen.label}
                </div>
                <div className="mt-1 h-3 w-3 rounded-full border-2 border-background bg-foreground shadow" />
              </div>
            </div>
          </div>
          <div className="-mt-2 flex justify-between text-[10px] font-semibold text-muted-foreground">
            {screen.levels.map((l) => (
              <span key={l} className="flex-1 text-center">{l}</span>
            ))}
          </div>
        </div>

        {/* Card de highlight — dinâmico (como SoulBicho) ou estático */}
        {screen.dynamicHighlight ? (
          (() => {
            const active = screen.dynamicHighlight
              .slice()
              .sort((a, b) => b.minPct - a.minPct)
              .find((d) => pct >= d.minPct) ?? screen.dynamicHighlight[screen.dynamicHighlight.length - 1];
            return (
              <div className={`mt-6 rounded-xl border-l-4 p-4 ${highlightColors[active.color]}`}>
                <p className={`text-sm font-bold ${textColors[active.color]}`}>{active.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{active.body}</p>
              </div>
            );
          })()
        ) : screen.highlightCard ? (
          <div className={`mt-6 rounded-xl border-l-4 p-4 ${highlightColors[screen.highlightCard.color]}`}>
            <p className={`text-sm font-bold ${textColors[screen.highlightCard.color]}`}>
              {screen.highlightCard.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {screen.highlightCard.body}
            </p>
          </div>
        ) : null}

        {/* Cards informativos */}
        {screen.cards && screen.cards.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            {screen.cards.map((c) => (
              <div key={c.label} className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs uppercase text-muted-foreground">{c.label}</p>
                <p className="font-bold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        className="mt-6 h-12 w-full text-base font-bold"
        onClick={onNext}
        disabled={!done}
      >
        {done ? "Continuar →" : "Analisando..."}
      </Button>
    </QuizLayout>
  );
}

function computeDiagnosisScore(answers: Answers): number {
  // Calcula um score baseado nas respostas — personalize conforme o quiz
  const positiveValues = ["sim", "muito", "sempre", "fogo", "comprometido", "pronto"];
  let score = 0;
  let total = 0;
  for (const val of Object.values(answers)) {
    if (Array.isArray(val)) {
      total += val.length;
      score += val.filter((v) => positiveValues.some((p) => v.includes(p))).length;
    } else {
      total += 1;
      if (positiveValues.some((p) => val.includes(p))) score += 1;
    }
  }
  const base = total > 0 ? (score / total) * 100 : 70;
  return Math.min(96, Math.max(54, Math.round(base)));
}

// =================== COMPARE SCREEN ===================
type CompareScreenProps = {
  screen: Extract<import("@/lib/quiz-config").Screen, { type: "compare" }>;
  progress: number;
  onBack: () => void;
  onNext: () => void;
};

function CompareScreen({ screen, progress, onBack, onNext }: CompareScreenProps) {
  const [animPct, setAnimPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setAnimPct(0);
    setDone(false);
    const start = Date.now();
    const duration = screen.durationMs ?? 1800;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimPct(eased);
      if (t >= 1) {
        clearInterval(id);
        setDone(true);
      }
    }, 30);
    return () => clearInterval(id);
  }, []);

  return (
    <QuizLayout progress={progress} onBack={onBack}>
      <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-center text-xl font-extrabold text-foreground sm:text-2xl">
          {screen.title}
        </h2>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-destructive/10 p-3 text-center">
            <p className="text-sm font-extrabold text-destructive">{screen.beforeLabel}</p>
          </div>
          <div className="rounded-xl bg-secondary/15 p-3 text-center">
            <p className="text-sm font-extrabold text-secondary">{screen.afterLabel}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {screen.rows.map((r) => (
            <div key={r.label} className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{r.label}</span>
                  <span className="font-bold text-destructive">
                    {Math.round(r.beforePct * animPct)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-destructive transition-[width] duration-100"
                    style={{ width: `${r.beforePct * animPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{r.label}</span>
                  <span className="font-bold text-secondary">
                    {Math.round(r.afterPct * animPct)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-secondary transition-[width] duration-100"
                    style={{ width: `${r.afterPct * animPct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {(screen.summaryBefore || screen.summaryAfter) && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {screen.summaryBefore && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                <p className="text-3xl font-extrabold text-destructive">
                  {Math.round(parseInt(screen.summaryBefore.value) * animPct)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{screen.summaryBefore.desc}</p>
              </div>
            )}
            {screen.summaryAfter && (
              <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 text-center">
                <p className="text-3xl font-extrabold text-secondary">
                  {Math.round(parseInt(screen.summaryAfter.value) * animPct)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{screen.summaryAfter.desc}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        className="mt-6 h-12 w-full text-base font-bold"
        onClick={onNext}
        disabled={!done}
      >
        {done ? "Continuar →" : "Calculando..."}
      </Button>
    </QuizLayout>
  );
}

// =================== MIRROR CHART SCREEN ===================
type MirrorScreenProps = {
  screen: Extract<import("@/lib/quiz-config").Screen, { type: "mirror-chart" }>;
  progress: number;
  onBack: () => void;
  onNext: () => void;
};

function MirrorChartScreen({ screen, progress, onBack, onNext }: MirrorScreenProps) {
  const [t, setT] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setT(0);
    setDone(false);
    const start = Date.now();
    const duration = 1800;
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setT(eased);
      if (k >= 1) {
        clearInterval(id);
        setDone(true);
      }
    }, 30);
    return () => clearInterval(id);
  }, []);

  const points = [
    { x: 40, y: 170 },
    { x: 170, y: 60 },
    { x: 300, y: 150 },
    { x: 430, y: 215 },
  ];
  const pathD =
    `M ${points[0].x} ${points[0].y} ` +
    `C 110 170, 120 60, ${points[1].x} ${points[1].y} ` +
    `S 250 200, ${points[2].x} ${points[2].y} ` +
    `S 400 230, ${points[3].x} ${points[3].y}`;

  const effortFill = screen.effortPct * t;
  const resultFill = screen.resultPct * t;

  return (
    <QuizLayout progress={progress} onBack={onBack}>
      <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
        {screen.intro && (
          <p className="text-center text-sm text-muted-foreground">{screen.intro}</p>
        )}
        <h2 className="mt-4 text-center text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
          {screen.title}
        </h2>

        <p className="mt-2 text-xs italic text-muted-foreground">Esforço x Resultado relatado:</p>
        <div className="relative mt-2 w-full overflow-hidden rounded-xl bg-muted/40 p-3">
          <svg viewBox="0 0 480 240" className="w-full">
            <defs>
              <linearGradient id="curveFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.7 0.2 50)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="oklch(0.65 0.22 25)" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="curveStroke" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="oklch(0.75 0.18 60)" />
                <stop offset="50%" stopColor="oklch(0.7 0.22 35)" />
                <stop offset="100%" stopColor="oklch(0.6 0.24 20)" />
              </linearGradient>
              <clipPath id="reveal">
                <rect x="0" y="0" width={480 * t} height="240" />
              </clipPath>
            </defs>
            {[0, 60, 120, 180].map((y) => (
              <line key={y} x1="30" x2="470" y1={30 + y} y2={30 + y}
                stroke="oklch(0.85 0.01 250)" strokeDasharray="4 4" />
            ))}
            {["100", "75", "50", "25", "0"].map((lbl, i) => (
              <text key={lbl} x="6" y={34 + i * 45} fontSize="10" fill="oklch(0.55 0.04 257)">{lbl}</text>
            ))}
            <g clipPath="url(#reveal)">
              <path d={`${pathD} L 430 220 L 40 220 Z`} fill="url(#curveFill)" />
              <path d={pathD} fill="none" stroke="url(#curveStroke)" strokeWidth="3" strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="6" fill="white"
                  stroke="oklch(0.65 0.22 25)" strokeWidth="2" />
              ))}
            </g>
            {t > 0.1 && (
              <g>
                <rect x="14" y="148" rx="4" width="44" height="18" fill="oklch(0.6 0.22 25)" />
                <text x="36" y="161" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">Você</text>
              </g>
            )}
            {[{ x: 40, t: "Começo" }, { x: 170, t: "1 mês" }, { x: 300, t: "2 meses" }, { x: 430, t: "3 meses" }].map((p) => (
              <text key={p.t} x={p.x} y="235" fontSize="10" textAnchor="middle" fill="oklch(0.45 0.04 257)">{p.t}</text>
            ))}
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <GaugeBar
            label={screen.effortLabel ?? "Esforço dedicado"}
            pct={effortFill}
            color="bg-destructive"
          />
          <GaugeBar
            label={screen.resultLabel ?? "Resultado percebido"}
            pct={resultFill}
            color="bg-destructive/70"
          />
        </div>

        <p className="mt-5 text-center text-sm font-extrabold uppercase tracking-wide text-foreground">
          {screen.insight}
        </p>
      </div>

      <Button
        className="mt-6 h-12 w-full text-base font-bold"
        onClick={onNext}
        disabled={!done}
      >
        {done ? "Continuar →" : "Analisando..."}
      </Button>
    </QuizLayout>
  );
}

function GaugeBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mx-auto flex h-32 w-12 flex-col-reverse overflow-hidden rounded-md bg-muted">
        <div className={`${color} w-full transition-[height] duration-100`} style={{ height: `${pct}%` }} />
      </div>
      <p className="mt-1 text-center text-xs font-bold text-foreground">{Math.round(pct)}%</p>
      <p className="mt-1 text-center text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

// =================== ANALYZING SCREEN ===================
function AnalyzingScreen({ onDone }: { onDone: () => void }) {
  const expertName = quizMeta.expertName ?? "nossos especialistas";
  const lines = [
    `Analisando o perfil que você construiu…`,
    `Cruzando com dados de resultado…`,
    `Calculando oportunidades personalizadas…`,
    `Identificando os maiores pontos de melhoria…`,
    `Montando o plano com ${expertName}…`,
    `Quase pronto. Preparando seu diagnóstico final…`,
  ];
  const [idx, setIdx] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const total = 9000;
    const start = Date.now();
    const i = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / total) * 100);
      setPct(p);
      setIdx(Math.min(lines.length - 1, Math.floor((p / 100) * lines.length)));
      if (p >= 100) {
        clearInterval(i);
        setTimeout(onDone, 500);
      }
    }, 80);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-muted px-6 text-center">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
        <svg className="h-12 w-12 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <p className="mb-1 text-xs uppercase tracking-widest text-primary font-bold">
        Processando Análise Personalizada
      </p>
      <h1 className="mb-3 max-w-md text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
        Estamos preparando seu diagnóstico personalizado…
      </h1>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Não feche esta página. O resultado pode revelar algo que você ainda não sabe.
      </p>
      <div className="w-full max-w-sm">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-primary tabular-nums">{Math.round(pct)}%</p>
        <p className="mt-3 min-h-[2.5rem] animate-pulse text-sm font-medium text-foreground">
          {lines[idx]}
        </p>
      </div>
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        Configurando protocolo exclusivo…
      </div>
    </div>
  );
}

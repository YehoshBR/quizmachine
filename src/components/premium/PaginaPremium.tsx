import { createElement, Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  animate,
  domAnimation,
  m,
  useInView,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import type { QuizMeta, SalesPageConfig, Screen } from "@/lib/quiz-config";
import { LogoDeParticulas } from "./logo-particulas";
import { LadoALado, Mudancas, Radar, montarDimensoes } from "./MapaDiagnostico";

// ============================================================
// PÁGINA DE DIAGNÓSTICO PREMIUM — ativada por salesPage.estilo = "premium"
// ============================================================
// Mesmo conteúdo e a mesma lógica da DiagnosticSalesPage, com a linguagem visual da página da Matilha
// (matilha.joemello.pro): logo de partículas no topo, barra de nível dourada, achados entrando um a um,
// linha dourada que se desenha nas etapas, prints de resultado, card do plano com borda girando e preço contando.
// Cores vêm dos tokens do tenant (primary/secondary); fontes de salesPage.premium.
// ============================================================

type Diag = Extract<Screen, { type: "diagnosis" }>;
type Opcao = SalesPageConfig["choice"]["options"][number];

export type DadosPremium = {
  quizMeta: QuizMeta;
  answers: Record<string, string | string[]>;
  cfg: SalesPageConfig;
  nm: (t: string) => string;
  diag?: Diag;
  pct: number | null;
  levelIdx: number;
  highlight?: { title: string; body: string };
  findings: string[];
  objections: { q: string; a: string }[];
  closingByAnswer?: string;
  selected: string;
  recommended: string;
  setSelected: (k: string) => void;
  option: Opcao;
  checkoutUrl: string;
  goCheckout: () => void;
};

const suave = [0.16, 1, 0.3, 1] as const;
const ouroTexto = "bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent";

/** *destaque* vira texto em degradê dourado. */
function rich(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  let mm: RegExpExecArray | null;
  let key = 0;
  while ((mm = re.exec(text)) !== null) {
    if (mm.index > last) parts.push(text.slice(last, mm.index));
    parts.push(createElement("strong", { key: `r${key++}`, className: `font-semibold ${ouroTexto}` }, mm[1]));
    last = mm.index + mm[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return createElement(Fragment, null, ...parts);
}

function Revela({ children, className, atraso = 0 }: { children: ReactNode; className?: string; atraso?: number }) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.7, ease: suave, delay: atraso }}
    >
      {children}
    </m.div>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">{children}</p>;
}

export function PaginaPremium(d: DadosPremium) {
  const p = d.cfg.premium ?? {};
  const fonteTitulo = p.fonteTitulo ?? "Playfair Display";
  const fonteMarca = p.fonteMarca ?? "Cinzel";

  // fontes da página premium (Google Fonts)
  useEffect(() => {
    const id = "fontes-premium";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    const fam = (f: string, w: string) => `family=${f.replace(/ /g, "+")}:wght@${w}`;
    l.href = `https://fonts.googleapis.com/css2?${fam(fonteTitulo, "500;600;700")}&${fam(fonteMarca, "500;700")}&display=swap`;
    document.head.appendChild(l);
  }, [fonteTitulo, fonteMarca]);

  const estiloTitulo = { fontFamily: `'${fonteTitulo}', Georgia, serif`, fontVariantNumeric: "lining-nums" } as const;
  const estiloMarca = { fontFamily: `'${fonteMarca}', Georgia, serif` } as const;
  const h2 = "text-center text-[clamp(28px,6vw,44px)] font-semibold leading-[1.1] text-foreground [text-wrap:balance]";

  const { scrollYProgress } = useScroll();
  const leitura = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="never">
        <div className="min-h-screen overflow-x-clip bg-background text-foreground">
          {/* linha dourada de leitura */}
          <m.div
            aria-hidden
            style={{ scaleX: leitura }}
            className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-primary/60 to-secondary"
          />

          <Topo d={d} estiloTitulo={estiloTitulo} estiloMarca={estiloMarca} />

          {/* NÍVEL */}
          {d.diag && d.pct !== null && (
            <section id="nivel" className="scroll-mt-6 px-5 pb-6">
              <Nivel d={d} estiloTitulo={estiloTitulo} />
            </section>
          )}

          {/* MAPA PERSONALIZADO: hoje × depois */}
          {d.cfg.mapa && <SecaoMapa d={d} h2={h2} estiloTitulo={estiloTitulo} />}

          {/* O QUE AS RESPOSTAS MOSTRAM */}
          {!d.cfg.mapa && d.findings.length > 0 && (
            <section className="px-5 py-20">
              <div className="mx-auto max-w-xl">
                <Revela>
                  <h2 className={h2} style={estiloTitulo}>{rich(d.nm(d.cfg.findingsTitle))}</h2>
                </Revela>
                <ol className="mt-10 space-y-4">
                  {d.findings.map((t, i) => (
                    <m.li
                      key={i}
                      initial={{ opacity: 0, x: -24 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
                      transition={{ duration: 0.6, ease: suave, delay: i * 0.06 }}
                      className="relative flex gap-4 overflow-hidden rounded-b-lg rounded-t-[22px] border border-border bg-card/70 p-5"
                    >
                      <span
                        aria-hidden
                        className="shrink-0 text-[44px] leading-none text-transparent [-webkit-text-stroke:1px_var(--primary)]"
                        style={estiloTitulo}
                      >
                        {i + 1}
                      </span>
                      <p className="pt-1 text-[15px] leading-relaxed text-foreground/90">{rich(d.nm(t))}</p>
                    </m.li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {/* PONTE */}
          {d.cfg.bridge && (
            <section className="relative overflow-hidden px-5 py-24">
              <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_65%)]" />
              <Revela className="relative mx-auto max-w-xl text-center">
                <h2 className="text-[clamp(30px,7vw,52px)] font-semibold leading-[1.08] [text-wrap:balance]" style={estiloTitulo}>
                  {rich(d.nm(d.cfg.bridge.title))}
                </h2>
                <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{rich(d.nm(d.cfg.bridge.body))}</p>
              </Revela>
            </section>
          )}

          {/* O PRODUTO, com a linha dourada nas etapas */}
          <section className="px-5 py-20">
            <div className="mx-auto max-w-xl">
              <Revela className="text-center">
                {p.marca && (
                  <p className="text-[22px] font-bold tracking-[0.16em] text-secondary" style={estiloMarca}>
                    {p.marca}
                  </p>
                )}
                <h2 className={`${h2} mt-3`} style={estiloTitulo}>{rich(d.nm(d.cfg.product.title))}</h2>
                <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{rich(d.nm(d.cfg.product.body))}</p>
              </Revela>
              {d.cfg.product.steps && <Etapas passos={d.cfg.product.steps} nm={d.nm} estiloTitulo={estiloTitulo} />}
            </div>
          </section>

          {/* QUEM CONDUZ + PRINTS */}
          {d.cfg.proof && (
            <section className="px-5 py-20">
              <div className="mx-auto max-w-3xl">
                <Revela className="mx-auto max-w-xl text-center">
                  <Rotulo>quem conduz</Rotulo>
                  <h2 className={`${h2} mt-4`} style={estiloTitulo}>{rich(d.nm(d.cfg.proof.title))}</h2>
                  <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{rich(d.nm(d.cfg.proof.body))}</p>
                </Revela>
                {d.cfg.proof.imagens && d.cfg.proof.imagens.length > 0 && (
                  <div className="mt-12 grid gap-4 sm:grid-cols-2">
                    {d.cfg.proof.imagens.map((im, i) => (
                      <Revela key={im.src} atraso={(i % 2) * 0.08}>
                        <m.article
                          whileHover={{ y: -6 }}
                          transition={{ type: "spring", stiffness: 300, damping: 22 }}
                          className="group h-full rounded-b-lg rounded-t-[24px] border border-border bg-card/80 p-4 transition-colors hover:border-primary/60"
                        >
                          <div className="overflow-hidden rounded-xl border border-border bg-black">
                            <img
                              src={im.src}
                              alt={`print do resultado: ${im.legenda}`}
                              loading="lazy"
                              className="aspect-[16/10] w-full object-contain transition-transform duration-700 group-hover:scale-[1.04]"
                            />
                          </div>
                          <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary">{im.quem}</p>
                          <p className={`mt-1 text-[26px] font-semibold leading-tight ${ouroTexto}`} style={estiloTitulo}>
                            {im.destaque}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{im.legenda}</p>
                        </m.article>
                      </Revela>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PARA QUEM É (substitui as dúvidas quando existe) */}
          {d.cfg.paraQuem && <ParaQuem pq={d.cfg.paraQuem} nm={d.nm} h2={h2} estiloTitulo={estiloTitulo} />}

          {/* OBJEÇÕES */}
          {!d.cfg.paraQuem && (d.objections.length > 0 || (d.cfg.faq?.length ?? 0) > 0) && (
            <section className="px-5 py-20">
              <div className="mx-auto max-w-xl">
                <Revela>
                  <h2 className={h2} style={estiloTitulo}>{rich(d.nm(d.cfg.objectionsTitle))}</h2>
                </Revela>
                <div className="mt-10 space-y-3">
                  {[...d.objections, ...(d.cfg.faq ?? [])].map((o, i) => (
                    <Duvida key={o.q} q={o.q} a={d.nm(o.a)} aberta={i < d.objections.length} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ESCOLHA */}
          <Escolha d={d} h2={h2} estiloTitulo={estiloTitulo} />

          {/* FECHAMENTO */}
          {d.cfg.closing && (
            <section className="relative overflow-hidden px-5 pb-24 pt-20 text-center">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[380px] bg-[radial-gradient(60%_100%_at_50%_100%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_70%)]" />
              <Revela className="relative mx-auto max-w-xl">
                {p.selo && (
                  <m.img
                    src={p.selo}
                    alt=""
                    className="mx-auto h-20 w-auto mix-blend-lighten"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <h2 className={`${h2} mt-6`} style={estiloTitulo}>{rich(d.nm(d.cfg.closing.title))}</h2>
                {d.closingByAnswer && <p className="mt-6 text-base leading-relaxed text-foreground">{rich(d.nm(d.closingByAnswer))}</p>}
                <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{rich(d.nm(d.cfg.closing.body))}</p>
                <m.a
                  href="#escolha"
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-9 inline-block rounded-b-lg rounded-t-[26px] border border-primary/70 px-8 pb-3.5 pt-4 text-[13px] font-bold uppercase tracking-[0.08em] text-secondary"
                >
                  escolher o meu caminho ↑
                </m.a>
              </Revela>
            </section>
          )}

          <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {d.quizMeta.productName}
          </footer>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/* ---------- topo: logo de partículas + título ---------- */

function Topo({ d, estiloTitulo, estiloMarca }: { d: DadosPremium; estiloTitulo: React.CSSProperties; estiloMarca: React.CSSProperties }) {
  const part = d.cfg.premium?.particulas;
  const palco = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const motor = useRef<LogoDeParticulas | null>(null);
  const palavras = d.nm(d.cfg.heroTitle).replace(/\*/g, "").split(" ");

  useEffect(() => {
    if (!part) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!palco.current || !canvas.current) return;
      try {
        motor.current = new LogoDeParticulas(palco.current, canvas.current, img, part);
      } catch {
        /* imagem sem CORS: fica só o fundo */
      }
    };
    img.src = part.imagem;
    return () => { motor.current?.destruir(); motor.current = null; };
  }, [part]);

  const ponto = (e: React.PointerEvent) => {
    const r = palco.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <header className="relative">
      <div
        ref={palco}
        className={`relative isolate overflow-hidden ${part ? "h-[44svh] min-h-[300px] max-h-[460px] cursor-crosshair touch-pan-y" : "h-28"}`}
        onPointerMove={(e) => { const [x, y] = ponto(e); motor.current?.moverMouse(x, y); }}
        onPointerLeave={() => motor.current?.soltarMouse()}
        onPointerDown={(e) => { const [x, y] = ponto(e); motor.current?.explodir(x, y); }}
      >
        <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
        <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_70%_65%_at_50%_46%,transparent_40%,var(--background)_100%)]" />
        <div className="absolute inset-x-0 top-5 flex justify-center">
          <span className="inline-block rounded-xl bg-black/80 px-4 py-2.5 backdrop-blur">
            <img src={d.quizMeta.logo as string} alt={d.quizMeta.logoAlt} className="block h-9 w-auto" />
          </span>
        </div>
      </div>

      <div className={`relative mx-auto max-w-xl px-5 text-center ${part ? "-mt-12" : ""}`}>
        <m.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-[11px] font-semibold uppercase tracking-[0.34em] text-primary"
          style={estiloMarca}
        >
          diagnóstico · {d.quizMeta.productName}
        </m.p>
        <h1 className="mt-4 text-[clamp(32px,8vw,54px)] font-semibold leading-[1.06] [text-wrap:balance]" style={estiloTitulo}>
          {palavras.map((w, i) => (
            <m.span
              key={i}
              className={`mr-[0.25em] inline-block last:mr-0 ${i === 0 ? ouroTexto : ""}`}
              initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: suave, delay: 0.45 + i * 0.07 }}
            >
              {w}
            </m.span>
          ))}
        </h1>
        {d.cfg.premium?.roteiro ? (
          <Roteiro itens={d.cfg.premium.roteiro} />
        ) : d.cfg.heroSubtitle && (
          <m.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mt-4 text-base leading-relaxed text-muted-foreground"
          >
            {rich(d.nm(d.cfg.heroSubtitle))}
          </m.p>
        )}
      </div>
    </header>
  );
}

/* ---------- barra de nível dourada ---------- */

function Nivel({ d, estiloTitulo }: { d: DadosPremium; estiloTitulo: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  const [num, setNum] = useState(0);
  const diag = d.diag!;
  const alvo = d.pct ?? 0;

  useEffect(() => {
    if (!visivel) return;
    const c = animate(0, alvo, { duration: 1.8, ease: suave, onUpdate: (v) => setNum(Math.round(v)) });
    return () => c.stop();
  }, [visivel, alvo]);

  return (
    <Revela className="mx-auto mt-12 max-w-xl">
      <div ref={ref} className="relative overflow-hidden rounded-b-xl rounded-t-[28px] border border-primary/40 bg-card/80 p-6 shadow-[0_30px_80px_-40px_var(--primary)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{diag.barLabel ?? diag.title}</p>
        <div className="mt-5 flex gap-1.5">
          {diag.levels.map((l, i) => (
            <div key={l} className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <m.div
                className="h-full origin-left rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_12px_var(--secondary)]"
                initial={{ scaleX: 0 }}
                animate={visivel && i <= d.levelIdx ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.45, delay: 0.2 + i * 0.32, ease: "easeOut" }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{diag.levels[0]}</span>
          <span>{diag.levels[diag.levels.length - 1]}</span>
        </div>
        <p className="mt-7 text-center text-sm text-muted-foreground">seu nível hoje</p>
        <p className="mt-1 text-center" style={estiloTitulo}>
          <span className={`text-[clamp(34px,8vw,46px)] font-semibold ${ouroTexto}`}>{diag.levels[d.levelIdx]}</span>
          <span className="ml-2 text-xl text-muted-foreground [font-variant-numeric:lining-nums_tabular-nums]">· {num}%</span>
        </p>
        {d.highlight && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={visivel ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 + diag.levels.length * 0.32 }}
            className="mt-6 rounded-xl border border-border bg-background/60 p-4"
          >
            <p className="font-semibold text-foreground">{d.highlight.title}</p>
            {!d.cfg.mapa && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.highlight.body}</p>}
          </m.div>
        )}
      </div>
    </Revela>
  );
}

/* ---------- etapas com a linha dourada ---------- */

function Etapas({ passos, nm, estiloTitulo }: { passos: { title: string; text: string }[]; nm: (t: string) => string; estiloTitulo: React.CSSProperties }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const linha = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  const ponta = useTransform(linha, (v) => `${v * 100}%`);
  const [acesos, setAcesos] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setAcesos(passos.filter((_, i) => v >= i / Math.max(1, passos.length - 1) - 0.08).length);
  });

  return (
    <ol ref={ref} className="relative mt-12 space-y-8 pl-12">
      <div aria-hidden className="absolute bottom-0 left-4 top-0 w-[2px] -translate-x-1/2 bg-border" />
      <m.div aria-hidden style={{ scaleY: linha }} className="absolute bottom-0 left-4 top-0 w-[2px] origin-top -translate-x-1/2 bg-gradient-to-b from-secondary via-primary to-primary/40 shadow-[0_0_14px_var(--secondary)]" />
      <m.div aria-hidden style={{ top: ponta }} className="absolute left-4 z-10">
        <span className="block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary shadow-[0_0_10px_3px_var(--secondary)]" />
      </m.div>
      {passos.map((s, i) => {
        const aceso = i < acesos;
        return (
          <li key={s.title} className="relative">
            <m.span
              aria-hidden
              animate={aceso ? { scale: 1.25, opacity: 1 } : { scale: 1, opacity: 0.5 }}
              className={`absolute -left-8 top-6 h-4 w-4 -translate-x-1/2 rounded-full border-2 ${aceso ? "border-secondary bg-primary shadow-[0_0_18px_var(--secondary)]" : "border-border bg-background"}`}
            />
            <m.div
              initial={false}
              animate={aceso ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0.3, y: 24, filter: "blur(3px)" }}
              transition={{ duration: 0.7, ease: suave }}
              className="rounded-b-lg rounded-t-[22px] border border-border bg-card/80 p-5"
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-primary">etapa {i + 1}</p>
              <p className="mt-2 text-[21px] font-semibold leading-snug text-foreground" style={estiloTitulo}>{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rich(nm(s.text))}</p>
            </m.div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- para quem é ---------- */

function ParaQuem({
  pq,
  nm,
  h2,
  estiloTitulo,
}: {
  pq: NonNullable<SalesPageConfig["paraQuem"]>;
  nm: (t: string) => string;
  h2: string;
  estiloTitulo: React.CSSProperties;
}) {
  return (
    <section id="para-quem" className="relative overflow-hidden px-5 py-20">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]" />
      <div className="relative mx-auto max-w-xl">
        <Revela className="text-center">
          <Rotulo>para quem é</Rotulo>
          <h2 className={`${h2} mt-4`} style={estiloTitulo}>{rich(nm(pq.titulo))}</h2>
        </Revela>
        <Revela atraso={0.1} className="mt-8 rounded-b-lg rounded-t-[26px] border border-primary/40 bg-card/70 p-6 text-center">
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground/90">{rich(nm(pq.chamada))}</p>
        </Revela>
        {pq.rotulo && (
          <Revela className="mt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{pq.rotulo}</p>
          </Revela>
        )}
        <ul className="mt-4 space-y-3">
          {pq.itens.map((t, i) => (
            <m.li
              key={t}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "0px 0px -40px 0px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: suave }}
              className="flex gap-3 rounded-b-lg rounded-t-[20px] border border-border bg-card/60 p-4"
            >
              <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-[13px] font-bold text-background">
                ✓
              </span>
              <p className="text-[15px] leading-relaxed text-foreground/90">{rich(nm(t))}</p>
            </m.li>
          ))}
        </ul>
        {pq.aviso && (
          <Revela className="mt-8">
            <p className="border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">{rich(nm(pq.aviso))}</p>
          </Revela>
        )}
      </div>
    </section>
  );
}

/* ---------- dúvida que abre e fecha ---------- */

function Duvida({ q, a, aberta }: { q: string; a: string; aberta: boolean }) {
  const [on, setOn] = useState(aberta);
  return (
    <Revela>
      <div className={`overflow-hidden rounded-b-lg rounded-t-[20px] border bg-card/70 transition-colors ${on ? "border-primary/60" : "border-border"}`}>
        <button type="button" onClick={() => setOn((v) => !v)} aria-expanded={on} className="flex w-full items-start gap-3 p-5 text-left">
          <m.span animate={{ rotate: on ? 45 : 0 }} className="mt-0.5 text-xl leading-none text-primary">+</m.span>
          <span className="font-semibold text-foreground">{q}</span>
        </button>
        <AnimatePresence initial={false}>
          {on && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: suave }}
            >
              <p className="px-5 pb-5 pl-12 text-sm leading-relaxed text-muted-foreground">{rich(a)}</p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </Revela>
  );
}

/* ---------- escolha do plano ---------- */

function Preco({ texto, estiloTitulo }: { texto: string; estiloTitulo: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visivel = useInView(ref, { once: true });
  const alvo = Number(texto.replace(/\D/g, "")) || 0;
  const prefixo = texto.match(/^[^\d]*/)?.[0] ?? "";
  const [v, setV] = useState(alvo);
  useEffect(() => {
    if (!visivel || !alvo) return;
    const c = animate(0, alvo, { duration: 1.4, ease: suave, onUpdate: (x) => setV(Math.round(x / 10) * 10) });
    return () => c.stop();
  }, [visivel, alvo]);
  return (
    <span ref={ref} className="whitespace-nowrap" style={estiloTitulo}>
      <span className="text-sm text-primary">{prefixo.trim()} </span>
      <span className={`text-[30px] font-semibold [font-variant-numeric:lining-nums_tabular-nums] ${ouroTexto}`}>{alvo ? v.toLocaleString("pt-BR") : texto}</span>
    </span>
  );
}

function Escolha({ d, h2, estiloTitulo }: { d: DadosPremium; h2: string; estiloTitulo: React.CSSProperties }) {
  const c = d.cfg.choice;
  return (
    <section id="escolha" className="relative scroll-mt-6 px-5 py-20">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_60%)]" />
      <div className="relative mx-auto max-w-md">
        <Revela>
          <h2 className={h2} style={estiloTitulo}>{rich(d.nm(c.title))}</h2>
          {c.subtitle && <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">{rich(d.nm(c.subtitle))}</p>}
        </Revela>

        <div className="mt-9 space-y-5" role="radiogroup">
          {c.options.map((o) => {
            const on = o.key === d.selected;
            return (
              <Revela key={o.key}>
                <m.button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => d.setSelected(o.key)}
                  whileTap={{ scale: 0.98 }}
                  className="relative block w-full overflow-hidden rounded-b-xl rounded-t-[30px] p-[2px] text-left"
                >
                  {/* borda: dourada girando quando selecionado */}
                  {on ? (
                    <m.span
                      aria-hidden
                      className="absolute inset-[-150%] bg-[conic-gradient(from_90deg,var(--primary)_0%,var(--secondary)_18%,transparent_32%,transparent_60%,var(--primary)_78%,var(--primary)_100%)]"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <span aria-hidden className="absolute inset-0 bg-border" />
                  )}
                  <span className={`relative block rounded-b-[10px] rounded-t-[28px] p-5 ${on ? "bg-card" : "bg-background"}`}>
                    {o.key === d.recommended && (
                      <span className="mb-3 inline-block rounded-full border border-primary/60 bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                        {c.recommendLabel ?? "Recomendado para você"}
                      </span>
                    )}
                    <span className="flex items-start gap-3">
                      <span className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-primary" : "border-muted-foreground"}`}>
                        {on && <m.span layoutId="marcado" className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </span>
                      <span className="flex-1">
                        <span className={`block text-[19px] font-semibold leading-snug ${on ? "text-secondary" : "text-foreground"}`} style={estiloTitulo}>
                          {o.label}
                        </span>
                        <span className="mt-2 block">
                          <Preco texto={o.price} estiloTitulo={estiloTitulo} />
                        </span>
                        {o.installments && <span className="block text-xs text-muted-foreground">{o.installments}</span>}
                        <span className="mt-3 block text-sm leading-relaxed text-muted-foreground">{o.desc}</span>
                      </span>
                    </span>
                  </span>
                </m.button>
              </Revela>
            );
          })}
        </div>

        {c.note && <p className="mt-6 text-center text-sm leading-relaxed text-foreground/90">{rich(d.nm(c.note))}</p>}

        <m.a
          href={d.checkoutUrl}
          onClick={d.goCheckout}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="relative mt-7 block overflow-hidden rounded-b-lg rounded-t-[28px] bg-gradient-to-r from-primary via-secondary to-primary px-6 pb-4 pt-5 text-center text-[14px] font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-[0_16px_54px_-10px_var(--primary)]"
        >
          <m.span
            aria-hidden
            className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/40 blur-sm"
            animate={{ x: ["0%", "450%"] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
          />
          <AnimatePresence mode="wait">
            <m.span key={d.option.key} className="relative block" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {d.option.cta}
            </m.span>
          </AnimatePresence>
        </m.a>
        <p className="mt-3 text-center text-xs text-muted-foreground">pagamento seguro · Pix ou cartão em até 12x</p>
      </div>
    </section>
  );
}

/* ---------- roteiro da página no topo ---------- */

const ALVOS = ["#nivel", "#mapa", "#mudar", "#escolha"];

function Roteiro({ itens }: { itens: string[] }) {
  return (
    <m.ol
      initial="h"
      animate="v"
      variants={{ v: { transition: { staggerChildren: 0.12, delayChildren: 0.9 } } }}
      className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-2 text-left"
    >
      {itens.map((t, i) => {
        const ultimo = i === itens.length - 1;
        return (
          <m.li key={t} variants={{ h: { opacity: 0, y: 12 }, v: { opacity: 1, y: 0 } }} className={ultimo ? "col-span-3" : ""}>
            <a
              href={ALVOS[i] ?? ALVOS[ALVOS.length - 1]}
              className={`flex h-full items-center gap-2 rounded-xl border px-2.5 py-2.5 text-[12px] leading-tight transition-colors ${
                ultimo ? "border-primary/70 bg-primary/10 text-secondary" : "border-border bg-card/60 text-foreground hover:border-primary/50"
              }`}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ultimo ? "bg-primary text-primary-foreground" : "border border-primary/50 text-primary"}`}>
                {i + 1}
              </span>
              {t}
            </a>
          </m.li>
        );
      })}
    </m.ol>
  );
}

/* ---------- mapa: radar + lado a lado + o que muda ---------- */

function SecaoMapa({ d, h2, estiloTitulo }: { d: DadosPremium; h2: string; estiloTitulo: React.CSSProperties }) {
  const mapa = d.cfg.mapa!;
  const dims = montarDimensoes(mapa, d.answers);
  return (
    <>
      <section id="mapa" className="scroll-mt-6 px-5 py-16">
        <div className="mx-auto max-w-xl">
          <Revela className="text-center">
            <Rotulo>o seu mapa</Rotulo>
            <h2 className={`${h2} mt-4`} style={estiloTitulo}>{rich(d.nm(mapa.titulo))}</h2>
            {mapa.subtitulo && <p className="mt-3 text-sm text-muted-foreground">{rich(d.nm(mapa.subtitulo))}</p>}
          </Revela>
          <div className="mt-8">
            <Radar dims={dims} rotuloHoje={mapa.rotuloHoje} rotuloMeta={mapa.rotuloMeta} />
          </div>
          <div className="mt-10">
            <LadoALado dims={dims} rotuloHoje={mapa.rotuloHoje} rotuloMeta={mapa.rotuloMeta} />
          </div>
        </div>
      </section>
      <section id="mudar" className="scroll-mt-6 px-5 py-14">
        <div className="mx-auto max-w-xl">
          <Revela className="text-center">
            <Rotulo>o que precisa mudar</Rotulo>
            <h2 className={`${h2} mt-4`} style={estiloTitulo}>{rich(d.nm(mapa.mudarTitulo))}</h2>
          </Revela>
          <div className="mt-8">
            <Mudancas dims={dims} estiloTitulo={estiloTitulo} />
          </div>
        </div>
      </section>
    </>
  );
}

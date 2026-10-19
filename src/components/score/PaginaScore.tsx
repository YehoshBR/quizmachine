import { createElement, Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  animate,
  domAnimation,
  m,
  useInView,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import type { FraseResposta, PaginaScoreConfig, QuizMeta, Screen } from "@/lib/quiz-config";
import { computeDiagnosisScore, computeTopSignals, readPersistedAnswers } from "@/lib/signals";
import { trackEvent } from "@/lib/tracking";

// Oferta do Score da Vida. Identidade própria (não é a da Matilha): medidor de score de crédito,
// prédio (CNPJ) sobre alicerce (CPF), barras da régua, história, 7 dias em carrossel, app no celular
// e preço com selo de garantia girando. Conteúdo em quizMeta.paginaScore; números vêm das respostas.

type Answers = Record<string, string | string[]>;
type Area = { id: string; nome: string; icone: string; cnpj?: boolean; pct: number };

const suave = [0.16, 1, 0.3, 1] as const;
const CORES = ["#E5484D", "#F76B15", "#F5C04A", "#B5CF3A", "#3DD68C"];
const ouro = "bg-gradient-to-r from-[#F0C878] via-[#D4A24C] to-[#F0C878] bg-clip-text text-transparent";

function corDe(pct: number, faixas: PaginaScoreConfig["faixas"]) {
  let i = 0;
  faixas.forEach((f, k) => {
    if (pct >= f.min) i = k;
  });
  return { i, cor: CORES[Math.min(i, CORES.length - 1)], faixa: faixas[i] };
}

/** *texto* → destaque dourado. */
function rich(texto: string): ReactNode {
  const partes: ReactNode[] = [];
  const re = /\*([^*\n]+)\*/g;
  let ultimo = 0;
  let r: RegExpExecArray | null;
  let k = 0;
  while ((r = re.exec(texto)) !== null) {
    if (r.index > ultimo) partes.push(texto.slice(ultimo, r.index));
    partes.push(createElement("span", { key: k++, className: "font-semibold text-[#F0C878]" }, r[1]));
    ultimo = r.index + r[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return createElement(Fragment, null, ...partes);
}

/** value → rótulo (sem o emoji do começo) de cada tela de escolha. */
function indiceRotulos(screens: Screen[]) {
  const idx: Record<string, Record<string, string>> = {};
  const limpa = (t: string) => t.replace(/^[^\p{L}\p{N}"“]+/u, "").trim();
  for (const s of screens) {
    if (s.type === "single") idx[s.id] = Object.fromEntries(s.options.map((o) => [o.value, limpa(o.label)]));
    if (s.type === "intro") idx["intro_first"] = Object.fromEntries(s.firstOptions.map((o) => [o.value, limpa(o.label)]));
  }
  return idx;
}

function Conta({ alvo, ativo, atraso = 0, duracao = 1.6 }: { alvo: number; ativo: boolean; atraso?: number; duracao?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const c = animate(0, alvo, { duration: duracao, delay: atraso, ease: suave, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [ativo, alvo, atraso, duracao]);
  return <>{v}</>;
}

function Revela({ children, className, atraso = 0 }: { children: ReactNode; className?: string; atraso?: number }) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.8, delay: atraso, ease: suave }}
    >
      {children}
    </m.div>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#D4A24C]">{children}</p>;
}

export type DadosScore = {
  quizId?: string | null;
  quizMeta: QuizMeta;
  screens: Screen[];
  scoringMap: Record<string, Record<string, number>>;
  cfg: PaginaScoreConfig;
  buildCheckoutUrl: (base: string, leadName?: string) => string;
};

export function PaginaScore({ quizId, quizMeta, screens, scoringMap, cfg, buildCheckoutUrl }: DadosScore) {
  const [answers, setAnswers] = useState<Answers | null>(null);
  useEffect(() => setAnswers(readPersistedAnswers()), []);

  const nome = (typeof answers?.["name"] === "string" ? (answers["name"] as string) : "").trim().split(/\s+/)[0] ?? "";
  const nm = (t: string) => t.split("{nome}").join(nome || "você").replace(/^você, /, "");
  const produto = quizMeta.product;
  const checkout = produto ? buildCheckoutUrl(produto.checkoutUrl, nome) : "#";
  const fonte = cfg.fonteTitulo ?? "Barlow Condensed";
  const titulo: React.CSSProperties = { fontFamily: `"${fonte}", system-ui, sans-serif` };

  const areas: Area[] = useMemo(() => {
    if (!answers) return [];
    return cfg.areas.flatMap((a) => {
      const v = answers[a.id];
      if (v === undefined || v === "") return [];
      return [{ ...a, pct: Math.round((Number(v) / 4) * 100) }];
    });
  }, [answers, cfg.areas]);
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  const cpf = media(areas.filter((a) => !a.cnpj).map((a) => a.pct));
  const cnpj = media(areas.filter((a) => a.cnpj).map((a) => a.pct));
  const score = answers ? computeDiagnosisScore(scoringMap, answers) : null;
  const sinais = useMemo(
    () => (answers ? computeTopSignals(screens, answers, quizMeta.signalLibrary) : null),
    [answers, screens, quizMeta.signalLibrary],
  );

  const rotulos = useMemo(() => indiceRotulos(screens), [screens]);
  const resposta = (tela: string) => {
    const v = answers?.[tela];
    return typeof v === "string" && v !== "" ? { valor: v, rotulo: rotulos[tela]?.[v] ?? v } : null;
  };
  const frase = (f?: FraseResposta) => {
    const r = f && resposta(f.tela);
    if (!f || !r) return null;
    const t = f.textos?.[r.valor] ?? f.modelo;
    return t ? nm(t.split("{resposta}").join(r.rotulo)) : null;
  };
  const piorCpf = [...areas].filter((a) => !a.cnpj).sort((a, b) => a.pct - b.pct).slice(0, 3);

  const topoRef = useRef<HTMLDivElement>(null);
  const topoVisivel = useInView(topoRef, { margin: "0px 0px -40% 0px" });

  function clicou(origem: string) {
    if (quizId) trackEvent(quizId, "checkout_click", { data: { url: checkout, origem } });
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="never">
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonte)}:wght@500;600;700;800&display=swap`}
          precedence="default"
        />
        <div className="relative min-h-screen overflow-x-clip bg-[#050505] pb-28 text-[#F3EEE4]">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(212,162,76,.18),transparent_70%)]" />

          {/* TOPO: o medidor */}
          <section ref={topoRef} className="relative px-5 pb-10 pt-8 text-center">
            <img src={quizMeta.logo as string} alt={quizMeta.logoAlt} className="mx-auto h-12 w-auto" />
            <Revela className="mx-auto mt-8 max-w-xl">
              <Rotulo>{cfg.topo.rotulo}</Rotulo>
              <h1 className="mt-3 text-[clamp(30px,8.5vw,52px)] font-bold uppercase leading-[1.02]" style={titulo}>
                {rich(nm(cfg.topo.titulo))}
              </h1>
            </Revela>
            <Medidor score={score} faixas={cfg.faixas} estilo={titulo} />
            {cfg.topo.subtitulo && (
              <Revela atraso={0.2} className="mx-auto mt-6 max-w-md">
                <p className="text-[15px] leading-relaxed text-[#B9B2A6]">{rich(nm(cfg.topo.subtitulo))}</p>
              </Revela>
            )}
          </section>

          {/* LAUDO: a ficha com as respostas e os alertas */}
          {answers && cfg.laudo && score !== null && (
            <Laudo
              cfg={cfg}
              nome={nome}
              score={score}
              campos={cfg.laudo.campos.flatMap((c) => {
                const r = resposta(c.tela);
                return r ? [{ rotulo: c.rotulo, valor: r.rotulo }] : [];
              })}
              alertas={cfg.laudo.alertas
                .flatMap((a) => {
                  const r = resposta(a.tela);
                  if (!r || !a.valores.includes(r.valor)) return [];
                  const troca = (t: string) => nm(t.split("{resposta}").join(r.rotulo));
                  return [{ titulo: troca(a.titulo), texto: troca(a.texto) }];
                })
                .slice(0, 4)}
              estilo={titulo}
            />
          )}

          {/* CPF × CNPJ: prédio e alicerce */}
          {areas.length > 0 && <Predio cfg={cfg} cpf={cpf} cnpj={cnpj} estilo={titulo} />}

          {/* AS ÁREAS */}
          {areas.length > 0 && <Areas cfg={cfg} areas={areas} estilo={titulo} />}

          {/* POR ONDE O PLANO COMEÇA */}
          {cfg.plano && piorCpf.length > 0 && <Plano cfg={cfg} areas={piorCpf} nome={nome} estilo={titulo} />}

          {/* O QUE AS RESPOSTAS REVELAM */}
          {sinais?.topPain && (
            <section className="px-5 py-14">
              <div className="mx-auto max-w-xl">
                {cfg.dorTitulo && (
                  <Revela className="text-center">
                    <Rotulo>{nm(cfg.dorTitulo)}</Rotulo>
                  </Revela>
                )}
                <Revela atraso={0.1} className="relative mt-6 overflow-hidden rounded-2xl border border-[#E5484D]/30 bg-[#140909] p-6">
                  <m.span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1 origin-top bg-[#E5484D]"
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, ease: suave }}
                  />
                  <h2 className="text-[26px] font-bold uppercase leading-tight" style={titulo}>{rich(sinais.topPain.headline)}</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#CFC8BC]">{sinais.topPain.body}</p>
                </Revela>
                {sinais.topDesire && (
                  <>
                    <m.div
                      aria-hidden
                      className="mx-auto my-3 h-10 w-px bg-gradient-to-b from-[#E5484D]/60 to-[#D4A24C]"
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      style={{ originY: 0 }}
                    />
                    <Revela atraso={0.2} className="rounded-2xl border border-[#D4A24C]/40 bg-[#120f08] p-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#3DD68C]">o que você quer</p>
                      <h3 className="mt-2 text-[24px] font-bold uppercase leading-tight" style={titulo}>{sinais.topDesire.headline}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-[#CFC8BC]">{sinais.topDesire.body}</p>
                    </Revela>
                  </>
                )}
              </div>
            </section>
          )}

          {/* HISTÓRIA */}
          <Historia cfg={cfg} estilo={titulo} />

          {/* OS 7 DIAS */}
          <Dias cfg={cfg} estilo={titulo} frase={frase(cfg.dias.frase)} />

          {/* O APP */}
          <AppNoCelular cfg={cfg} estilo={titulo} />

          {/* PREÇO */}
          {produto && <Preco cfg={cfg} produto={produto} checkout={checkout} estilo={titulo} onClick={() => clicou("preco")} nome={nome} frase={frase(cfg.preco.frase)} />}

          {/* FECHAMENTO */}
          <section className="relative px-5 pb-16 pt-10 text-center">
            <FraseFinal frase={cfg.fechamento.frase} estilo={titulo} />
            {cfg.fechamento.texto && (
              <Revela atraso={0.3} className="mx-auto mt-6 max-w-md">
                <p className="text-[15px] leading-relaxed text-[#B9B2A6]">{rich(nm(cfg.fechamento.texto))}</p>
              </Revela>
            )}
            {produto && (
              <Revela atraso={0.4} className="mt-8">
                <BotaoOuro href={checkout} onClick={() => clicou("fechamento")} estilo={titulo}>
                  {quizMeta.offerCtaLabel ?? "Quero começar"}
                </BotaoOuro>
              </Revela>
            )}
          </section>

          <footer className="px-5 text-center text-xs text-[#6F695F]">© {new Date().getFullYear()} {quizMeta.productName}</footer>

          {/* barra fixa com o preço, depois que o medidor sai da tela */}
          <AnimatePresence>
            {produto && !topoVisivel && (
              <m.div
                initial={{ y: 110 }}
                animate={{ y: 0 }}
                exit={{ y: 110 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D4A24C]/25 bg-[#0b0a08]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
              >
                <div className="mx-auto flex max-w-md items-center gap-3">
                  <div className="leading-none">
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-[#8F887C]">acesso imediato</span>
                    <span className={`text-2xl font-bold ${ouro}`} style={titulo}>{produto.price}</span>
                  </div>
                  <a
                    href={checkout}
                    onClick={() => clicou("barra")}
                    className="ml-auto flex-1 rounded-xl bg-gradient-to-r from-[#F0C878] to-[#C8923A] py-3.5 text-center text-[15px] font-bold uppercase tracking-wide text-black"
                    style={titulo}
                  >
                    {quizMeta.offerCtaLabel ?? "Quero começar"}
                  </a>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/* ---------- medidor de score (semicírculo, ponteiro varre e para na nota) ---------- */

function Medidor({ score, faixas, estilo }: { score: number | null; faixas: PaginaScoreConfig["faixas"]; estilo: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true });
  const C = 160, R = 128;
  const alvo = score ?? 50;
  const { cor, faixa } = corDe(alvo, faixas);
  const ang = (p: number) => Math.PI - (p / 100) * Math.PI;
  const ponto = (p: number, r: number) => [C + Math.cos(ang(p)) * r, C - Math.sin(ang(p)) * r];
  const arco = (a: number, b: number) => {
    const [x1, y1] = ponto(a, R);
    const [x2, y2] = ponto(b, R);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  };
  const limites = [...faixas.map((f) => f.min), 100];
  const rot = -90 + (alvo / 100) * 180;

  return (
    <div ref={ref} className="relative mx-auto mt-6 w-full max-w-[380px]">
      <svg viewBox="0 0 320 190" className="w-full overflow-visible">
        <defs>
          <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {/* trilho */}
        <path d={arco(0, 100)} stroke="#1c1a17" strokeWidth={26} fill="none" strokeLinecap="round" />
        {/* faixas coloridas, desenhando uma a uma */}
        {faixas.map((f, i) => {
          const a = limites[i] + (i ? 0.8 : 0), b = limites[i + 1] - (i < faixas.length - 1 ? 0.8 : 0);
          return (
            <m.path
              key={f.min}
              d={arco(a, b)}
              stroke={CORES[Math.min(i, CORES.length - 1)]}
              strokeWidth={18}
              fill="none"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={visivel ? { pathLength: 1, opacity: 0.9 } : {}}
              transition={{ duration: 0.45, delay: 0.15 + i * 0.16, ease: "easeOut" }}
            />
          );
        })}
        {/* marcas */}
        {Array.from({ length: 21 }, (_, i) => {
          const p = i * 5;
          const [x1, y1] = ponto(p, R - 18);
          const [x2, y2] = ponto(p, R - (i % 5 === 0 ? 30 : 24));
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5d574e" strokeWidth={i % 5 === 0 ? 2 : 1} />;
        })}
        {/* brilho da faixa da pessoa */}
        {score !== null && (
          <m.circle
            cx={ponto(alvo, R)[0]}
            cy={ponto(alvo, R)[1]}
            r={16}
            fill={cor}
            filter="url(#brilho)"
            initial={{ opacity: 0 }}
            animate={visivel ? { opacity: [0, 0.9, 0.5, 0.9] } : {}}
            transition={{ duration: 2.4, delay: 2.6, repeat: Infinity, repeatType: "reverse" }}
          />
        )}
        {/* ponteiro: varre o medidor inteiro e volta pra nota */}
        <m.g
          style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}
          initial={{ rotate: -90 }}
          animate={
            visivel
              ? score !== null
                ? { rotate: [-90, 88, rot - 6, rot + 3, rot] }
                : { rotate: [-90, 60, -40, 20, -10] }
              : {}
          }
          transition={
            score !== null
              ? { duration: 2.6, delay: 0.9, times: [0, 0.42, 0.75, 0.88, 1], ease: "easeInOut" }
              : { duration: 4, delay: 0.9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
          }
        >
          <path d={`M ${C - 5} ${C} L ${C} ${C - R + 26} L ${C + 5} ${C} Z`} fill="#F3EEE4" />
        </m.g>
        <circle cx={C} cy={C} r={13} fill="#0b0a08" stroke="#D4A24C" strokeWidth={3} />
      </svg>
      <div className="-mt-6">
        {score !== null ? (
          <>
            <p className="text-[64px] font-bold leading-none [font-variant-numeric:tabular-nums]" style={{ ...estilo, color: cor }}>
              <Conta alvo={score} ativo={visivel} atraso={0.9} duracao={2.6} />
            </p>
            <m.p
              className="mt-1 text-[13px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: cor }}
              initial={{ opacity: 0, y: 8 }}
              animate={visivel ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 3.4, duration: 0.6 }}
            >
              {faixa.rotulo}
            </m.p>
            <m.p
              className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-[#CFC8BC]"
              initial={{ opacity: 0 }}
              animate={visivel ? { opacity: 1 } : {}}
              transition={{ delay: 3.7, duration: 0.8 }}
            >
              {faixa.texto}
            </m.p>
          </>
        ) : (
          <p className="text-[54px] font-bold leading-none text-[#5d574e]" style={estilo}>?</p>
        )}
      </div>
    </div>
  );
}

/* ---------- laudo: ficha com as respostas, carimbo da faixa e alertas ---------- */

function Laudo({
  cfg,
  nome,
  score,
  campos,
  alertas,
  estilo,
}: {
  cfg: PaginaScoreConfig;
  nome: string;
  score: number;
  campos: { rotulo: string; valor: string }[];
  alertas: { titulo: string; texto: string }[];
  estilo: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -100px 0px" });
  const { cor, faixa } = corDe(score, cfg.faixas);
  const laudo = cfg.laudo!;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const numero = String(1000 + ((nome.length * 7919 + score * 131 + campos.length * 17) % 9000));
  const fimCampos = 0.35 + campos.length * 0.13;

  return (
    <section className="px-5 py-12">
      <div className="mx-auto max-w-xl">
        <Revela className="text-center">
          <Rotulo>{nm0(laudo.rotulo, nome)}</Rotulo>
          <h2 className="mt-3 text-[clamp(28px,7vw,44px)] font-bold uppercase leading-[1.05]" style={estilo}>{rich(nm0(laudo.titulo, nome))}</h2>
        </Revela>
        <div ref={ref} className="relative mt-8 overflow-hidden rounded-[22px] border border-[#D4A24C]/35 bg-[#0d0c0a] shadow-[0_30px_70px_-35px_rgba(212,162,76,.45)]">
          {/* linha de leitura descendo pela ficha */}
          <m.span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-10 h-16 bg-gradient-to-b from-transparent via-[#F0C878]/15 to-transparent"
            initial={{ top: "-12%" }}
            animate={visivel ? { top: ["-12%", "105%"] } : {}}
            transition={{ duration: fimCampos + 0.4, ease: "linear" }}
          />
          <div className="flex items-center justify-between border-b border-dashed border-[#3a352f] px-5 py-3 text-[10.5px] uppercase tracking-[0.2em] text-[#8F887C]">
            <span>laudo nº {numero}</span>
            <span>{hoje}</span>
          </div>
          <div className="px-5 pb-2 pt-5">
            <p className="text-[10.5px] uppercase tracking-[0.24em] text-[#8F887C]">titular do CPF</p>
            <p className="mt-1 text-[28px] font-bold uppercase leading-none" style={estilo}>{nome || "você"}</p>
          </div>
          <dl className="px-5 pb-5">
            {campos.map((c, i) => (
              <m.div
                key={c.rotulo}
                className="grid grid-cols-[42%_1fr] gap-3 border-b border-dashed border-[#2a2622] py-2.5 last:border-0"
                initial={{ opacity: 0, x: -10 }}
                animate={visivel ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.45, delay: 0.35 + i * 0.13, ease: suave }}
              >
                <dt className="text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-[#8F887C]">{c.rotulo}</dt>
                <dd className="text-[14.5px] leading-snug text-[#F3EEE4]">{c.valor}</dd>
              </m.div>
            ))}
          </dl>
          {/* carimbo da faixa */}
          <m.div
            aria-hidden
            className="absolute right-4 top-14 rounded-lg border-[3px] px-3 py-1.5 text-center"
            style={{ borderColor: cor, color: cor, ...estilo }}
            initial={{ opacity: 0, scale: 2.4, rotate: -24 }}
            animate={visivel ? { opacity: 0.92, scale: 1, rotate: -12 } : {}}
            transition={{ delay: fimCampos, type: "spring", stiffness: 380, damping: 16 }}
          >
            <span className="block text-[11px] font-bold tracking-[0.2em]">SCORE {score}</span>
            <span className="block text-[20px] font-bold uppercase leading-none tracking-wider">{faixa.rotulo}</span>
          </m.div>
        </div>

        {alertas.length > 0 && (
          <div className="mt-8">
            <Revela className="flex items-center gap-2">
              <m.i
                className="block h-2 w-2 rounded-full bg-[#E5484D]"
                animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E5484D]">
                {nm0(laudo.alertasTitulo ?? "alertas encontrados", nome)} · {alertas.length}
              </p>
            </Revela>
            <div className="mt-4 space-y-3">
              {alertas.map((a, i) => (
                <Revela key={a.titulo} atraso={i * 0.08} className="relative overflow-hidden rounded-2xl border border-[#E5484D]/25 bg-[#120909] p-4 pl-5">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[#E5484D]" />
                  <p className="text-[19px] font-bold uppercase leading-tight" style={estilo}>{rich(a.titulo)}</p>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#CFC8BC]">{rich(a.texto)}</p>
                </Revela>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function nm0(t: string, nome: string) {
  return t.split("{nome}").join(nome || "você").replace(/^você, /, "");
}

/* ---------- por onde o plano começa: as 3 áreas mais baixas do CPF ---------- */

function Plano({ cfg, areas, nome, estilo }: { cfg: PaginaScoreConfig; areas: Area[]; nome: string; estilo: React.CSSProperties }) {
  const plano = cfg.plano!;
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -100px 0px" });
  return (
    <section className="px-5 py-14">
      <div className="mx-auto max-w-xl">
        <Revela className="text-center">
          <Rotulo>{nm0(plano.rotulo, nome)}</Rotulo>
          <h2 className="mt-3 text-[clamp(28px,7vw,44px)] font-bold uppercase leading-[1.05]" style={estilo}>{rich(nm0(plano.titulo, nome))}</h2>
          {plano.subtitulo && <p className="mx-auto mt-3 max-w-md text-[15px] text-[#B9B2A6]">{rich(nm0(plano.subtitulo, nome))}</p>}
        </Revela>
        <div ref={ref} className="relative mt-10 pl-12">
          {/* trilho que se desenha ligando os passos */}
          <div aria-hidden className="absolute bottom-6 left-[19px] top-6 w-px bg-[#2a2622]" />
          <m.div
            aria-hidden
            className="absolute bottom-6 left-[19px] top-6 w-px origin-top bg-gradient-to-b from-[#E5484D] via-[#F5C04A] to-[#3DD68C]"
            initial={{ scaleY: 0 }}
            animate={visivel ? { scaleY: 1 } : {}}
            transition={{ duration: 1.6, delay: 0.2, ease: suave }}
          />
          <div className="space-y-5">
            {areas.map((a, i) => {
              const { cor } = corDe(a.pct, cfg.faixas);
              return (
                <m.div
                  key={a.id}
                  className="relative"
                  initial={{ opacity: 0, y: 18 }}
                  animate={visivel ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.35, ease: suave }}
                >
                  <span
                    className="absolute -left-12 top-3 grid h-10 w-10 place-items-center rounded-full border-2 bg-[#050505] text-[17px] font-bold"
                    style={{ borderColor: cor, color: cor, ...estilo }}
                  >
                    {i + 1}º
                  </span>
                  <div className="rounded-2xl border border-[#2a2622] bg-[#0e0d0b] p-5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{a.icone}</span>
                      <span className="flex-1 text-[22px] font-bold uppercase leading-none" style={estilo}>{a.nome}</span>
                      <span className="text-[13px] font-semibold [font-variant-numeric:tabular-nums]" style={{ color: cor }}>
                        hoje: {a.pct}
                      </span>
                    </div>
                    {plano.areas[a.id] && <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#CFC8BC]">{rich(plano.areas[a.id])}</p>}
                  </div>
                </m.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- prédio (CNPJ) sobre o alicerce (CPF) ---------- */

function Predio({ cfg, cpf, cnpj, estilo }: { cfg: PaginaScoreConfig; cpf: number; cnpj: number; estilo: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -120px 0px" });
  const andares = Math.max(3, Math.round(cnpj / 10));
  const blocos = 5, cheios = Math.max(1, Math.round(cpf / 20));
  const racha = cpf + 10 < cnpj;
  const W = 150, A = 17, base = 236;

  return (
    <section className="px-5 py-16">
      <div ref={ref} className="mx-auto max-w-xl">
        <Revela className="text-center">
          <Rotulo>CPF × CNPJ</Rotulo>
          <h2 className="mt-3 text-[clamp(28px,7vw,44px)] font-bold uppercase leading-[1.05]" style={estilo}>{rich(cfg.predio.titulo)}</h2>
        </Revela>
        <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <Medida rotulo={cfg.predio.rotuloCnpj} valor={cnpj} cor="#F0C878" ativo={visivel} estilo={estilo} atraso={0.3} />
          <m.svg
            viewBox="0 0 200 280"
            className="w-[170px] overflow-visible sm:w-[200px]"
            animate={visivel && racha ? { rotate: [0, -1.4, 1, -0.6, 0] } : {}}
            transition={{ duration: 2.2, delay: 2.4, repeat: Infinity, repeatDelay: 2.5 }}
            style={{ transformOrigin: "100px 260px" }}
          >
            {/* andares subindo */}
            {Array.from({ length: andares }, (_, i) => (
              <m.g
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={visivel ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.35, delay: 0.25 + i * 0.12, ease: "easeOut" }}
              >
                <rect x={25} y={base - (i + 1) * A} width={W} height={A - 2} rx={2} fill="#1a1712" stroke="#D4A24C" strokeOpacity={0.55} />
                {[0, 1, 2, 3, 4].map((j) => (
                  <m.rect
                    key={j}
                    x={36 + j * 27}
                    y={base - (i + 1) * A + 4}
                    width={14}
                    height={A - 10}
                    fill="#F0C878"
                    initial={{ opacity: 0.08 }}
                    animate={visivel ? { opacity: [0.08, (i + j) % 3 ? 0.85 : 0.25] } : {}}
                    transition={{ duration: 0.5, delay: 0.5 + i * 0.12 + j * 0.05 }}
                  />
                ))}
              </m.g>
            ))}
            {/* alicerce */}
            {Array.from({ length: blocos }, (_, i) => (
              <m.rect
                key={i}
                x={15 + i * 34}
                y={base + 2}
                width={32}
                height={22}
                rx={2}
                fill={i < cheios ? "#8b8378" : "#2a2622"}
                stroke={i < cheios ? "#b4ab9d" : "#3a352f"}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={visivel ? { opacity: 1, scaleY: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.05 * i }}
                style={{ transformOrigin: `${15 + i * 34}px ${base + 24}px` }}
              />
            ))}
            {/* rachaduras quando o CPF é bem menor que o CNPJ */}
            {racha &&
              ["M 70 238 L 78 248 L 72 255 L 82 262", "M 128 238 L 120 247 L 127 254 L 118 262", "M 100 238 L 104 250 L 98 262"].map((d, i) => (
                <m.path
                  key={d}
                  d={d}
                  stroke="#E5484D"
                  strokeWidth={2.4}
                  fill="none"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={visivel ? { pathLength: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.5, delay: 1.9 + i * 0.25 }}
                />
              ))}
            <line x1={0} y1={base + 26} x2={200} y2={base + 26} stroke="#3a352f" />
          </m.svg>
          <Medida rotulo={cfg.predio.rotuloCpf} valor={cpf} cor={corDe(cpf, cfg.faixas).cor} ativo={visivel} estilo={estilo} atraso={0.1} />
        </div>
        <Revela atraso={0.2} className="mx-auto mt-10 max-w-md text-center">
          <p className="text-[16px] leading-relaxed text-[#CFC8BC]">{rich(cfg.predio.texto)}</p>
        </Revela>
      </div>
    </section>
  );
}

function Medida({ rotulo, valor, cor, ativo, estilo, atraso }: { rotulo: string; valor: number; cor: string; ativo: boolean; estilo: React.CSSProperties; atraso: number }) {
  return (
    <div className="text-center">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-[#8F887C]">{rotulo}</p>
      <p className="mt-1 text-[46px] font-bold leading-none [font-variant-numeric:tabular-nums]" style={{ ...estilo, color: cor }}>
        <Conta alvo={valor} ativo={ativo} atraso={atraso} />
      </p>
    </div>
  );
}

/* ---------- as áreas da régua ---------- */

function Areas({ cfg, areas, estilo }: { cfg: PaginaScoreConfig; areas: Area[]; estilo: React.CSSProperties }) {
  const ordem = [...areas].sort((a, b) => a.pct - b.pct);
  const piores = new Set(ordem.slice(0, 3).map((a) => a.id));
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-xl">
        <Revela className="text-center">
          <Rotulo>a régua da sua vida</Rotulo>
          <h2 className="mt-3 text-[clamp(28px,7vw,44px)] font-bold uppercase leading-[1.05]" style={estilo}>{rich(cfg.areasTitulo)}</h2>
          {cfg.areasSubtitulo && <p className="mx-auto mt-3 max-w-md text-[15px] text-[#B9B2A6]">{cfg.areasSubtitulo}</p>}
        </Revela>
        <div ref={ref} className="mt-10 space-y-2.5">
          {ordem.map((a, i) => {
            const { cor } = corDe(a.pct, cfg.faixas);
            const pior = piores.has(a.id);
            return (
              <m.div
                key={a.id}
                initial={{ opacity: 0, x: -24 }}
                animate={visivel ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.07, ease: suave }}
                className={`rounded-xl border px-4 py-3 ${pior ? "border-[#E5484D]/40 bg-[#140a0a]" : "border-[#2a2622] bg-[#0e0d0b]"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{a.icone}</span>
                  <span className="flex-1 text-[15px] font-semibold">
                    {a.nome}
                    {a.cnpj && <span className="ml-2 rounded bg-[#D4A24C]/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#D4A24C]">CNPJ</span>}
                  </span>
                  {pior && (
                    <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#E5484D]">
                      <m.i
                        className="block h-1.5 w-1.5 rounded-full bg-[#E5484D]"
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                      {cfg.rotuloPior}
                    </span>
                  )}
                  <span className="w-10 text-right text-[18px] font-bold [font-variant-numeric:tabular-nums]" style={{ ...estilo, color: cor }}>
                    <Conta alvo={a.pct} ativo={visivel} atraso={0.2 + i * 0.07} duracao={1.1} />
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1f1c18]">
                  <m.div
                    className="h-full origin-left rounded-full"
                    style={{ background: cor, boxShadow: `0 0 12px ${cor}` }}
                    initial={{ scaleX: 0 }}
                    animate={visivel ? { scaleX: Math.max(0.03, a.pct / 100) } : {}}
                    transition={{ duration: 1.1, delay: 0.2 + i * 0.07, ease: suave }}
                  />
                </div>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- história: foto + antes riscado / hoje ---------- */

function Historia({ cfg, estilo }: { cfg: PaginaScoreConfig; estilo: React.CSSProperties }) {
  const h = cfg.historia;
  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-xl">
        <Revela className="relative overflow-hidden rounded-[28px] border border-[#D4A24C]/30">
          <m.img
            src={h.foto}
            alt=""
            loading="lazy"
            className="aspect-[4/5] w-full object-cover"
            animate={{ scale: [1, 1.08] }}
            transition={{ duration: 14, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
          <h2 className="absolute inset-x-0 bottom-0 p-6 text-[clamp(28px,7vw,42px)] font-bold uppercase leading-[1.05]" style={estilo}>
            {rich(h.titulo)}
          </h2>
        </Revela>
        <div className="mt-8 space-y-4">
          {h.antes.map((antes, i) => (
            <AntesHoje key={antes} antes={antes} hoje={h.hoje[i] ?? ""} atraso={i * 0.05} />
          ))}
        </div>
        <Revela className="mt-8 text-right">
          <p className="text-[22px] italic text-[#F0C878]" style={estilo}>{h.assinatura}</p>
        </Revela>
      </div>
    </section>
  );
}

function AntesHoje({ antes, hoje, atraso }: { antes: string; hoje: string; atraso: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  return (
    <div ref={ref} className="rounded-2xl border border-[#2a2622] bg-[#0e0d0b] p-4">
      <p className="text-[14px] text-[#8F887C]">
        <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#E5484D]">antes</span>
        {/* risco que se desenha, linha por linha */}
        <m.span
          className="bg-[linear-gradient(#E5484D,#E5484D)] bg-no-repeat [background-position:0_56%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
          initial={{ backgroundSize: "0% 1.5px" }}
          animate={visivel ? { backgroundSize: "100% 1.5px" } : {}}
          transition={{ duration: 0.6, delay: 0.5 + atraso }}
        >
          {antes}
        </m.span>
      </p>
      <m.p
        className="mt-2 text-[16px] font-semibold text-[#F3EEE4]"
        initial={{ opacity: 0, y: 8 }}
        animate={visivel ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 1 + atraso }}
      >
        <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3DD68C]">hoje</span>
        {hoje}
      </m.p>
    </div>
  );
}

/* ---------- os 7 dias: carrossel com barra de progresso ---------- */

function Dias({ cfg, estilo, frase }: { cfg: PaginaScoreConfig; estilo: React.CSSProperties; frase: string | null }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const total = cfg.dias.itens.length;
  function rolou() {
    const el = trilho.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const passo = card ? card.offsetWidth + 14 : el.clientWidth;
    setAtual(Math.min(total - 1, Math.round(el.scrollLeft / passo)));
  }
  return (
    <section className="py-16">
      <Revela className="px-5 text-center">
        <Rotulo>a jornada</Rotulo>
        <h2 className="mx-auto mt-3 max-w-xl text-[clamp(28px,7vw,44px)] font-bold uppercase leading-[1.05]" style={estilo}>{rich(cfg.dias.titulo)}</h2>
        {cfg.dias.subtitulo && <p className="mx-auto mt-3 max-w-md text-[15px] text-[#B9B2A6]">{cfg.dias.subtitulo}</p>}
      </Revela>
      {frase && (
        <Revela atraso={0.15} className="mx-auto mt-6 max-w-md px-5">
          <p className="rounded-2xl border border-[#D4A24C]/30 bg-[#120f08] px-5 py-4 text-center text-[15px] leading-relaxed text-[#E6E0D5]">
            <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.26em] text-[#D4A24C]">você respondeu</span>
            {rich(frase)}
          </p>
        </Revela>
      )}
      <div className="mx-auto mt-8 flex max-w-md gap-1.5 px-5">
        {cfg.dias.itens.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-[#2a2622]">
            <m.div className="h-full bg-[#D4A24C]" animate={{ width: i <= atual ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
          </div>
        ))}
      </div>
      <m.div
        ref={trilho}
        onScroll={rolou}
        className="mt-6 flex snap-x snap-mandatory gap-[14px] overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        initial={{ x: 60, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: suave }}
      >
        {cfg.dias.itens.map((d, i) => (
          <article
            key={d.titulo}
            className={`relative w-[78%] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-[22px] border p-6 transition-colors duration-500 ${
              i === atual ? "border-[#D4A24C]/70 bg-[#15120c]" : "border-[#2a2622] bg-[#0e0d0b]"
            }`}
          >
            <span aria-hidden className="absolute -right-2 -top-6 text-[120px] font-bold leading-none text-[#D4A24C]/[0.07]" style={estilo}>
              {i + 1}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4A24C]">dia {i + 1}</p>
            <h3 className="mt-3 text-[24px] font-bold uppercase leading-[1.08]" style={estilo}>{d.titulo}</h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[#B9B2A6]">{d.texto}</p>
          </article>
        ))}
      </m.div>
      <p className="mt-2 text-center text-xs text-[#6F695F]">arraste para o lado →</p>
    </section>
  );
}

/* ---------- o app no celular ---------- */

function AppNoCelular({ cfg, estilo }: { cfg: PaginaScoreConfig; estilo: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const giro = useSpring(useTransform(scrollYProgress, [0, 0.5, 1], [16, 0, -10]), { stiffness: 80, damping: 20 });
  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-xl">
        <Revela className="text-center">
          <Rotulo>o aplicativo</Rotulo>
          <h2 className="mt-3 text-[clamp(28px,7vw,44px)] font-bold uppercase leading-[1.05]" style={estilo}>{rich(cfg.app.titulo)}</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#B9B2A6]">{rich(cfg.app.texto)}</p>
        </Revela>
        <div ref={ref} className="relative mt-12 flex justify-center [perspective:1100px]">
          <div aria-hidden className="absolute top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#D4A24C]/20 blur-3xl" />
          <m.div style={{ rotateX: giro }} className="relative w-[240px] rounded-[42px] border border-[#3a352f] bg-[#111] p-[9px] shadow-[0_40px_80px_-30px_rgba(212,162,76,.45)]">
            <div className="absolute left-1/2 top-[14px] z-10 h-[18px] w-[78px] -translate-x-1/2 rounded-full bg-black" />
            <div className="relative h-[470px] overflow-hidden rounded-[34px] bg-black">
              <m.img
                src={cfg.app.imagem}
                alt="telas do aplicativo Score da Vida"
                loading="lazy"
                className="w-full"
                animate={{ y: ["0%", "-62%", "-62%", "0%"] }}
                transition={{ duration: 16, times: [0, 0.45, 0.6, 1], repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </m.div>
          {/* selos flutuando em volta */}
          {cfg.app.itens.slice(0, 4).map((t, i) => (
            <m.span
              key={t}
              className={`absolute rounded-full border border-[#D4A24C]/40 bg-[#0e0d0b]/95 px-3 py-1.5 text-[11.5px] font-semibold text-[#F0C878] shadow-lg ${
                ["left-0 top-10", "right-0 top-28", "left-0 bottom-36", "right-0 bottom-14"][i]
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              animate={{ y: [0, -7, 0] }}
              transition={{ opacity: { delay: 0.4 + i * 0.15 }, scale: { delay: 0.4 + i * 0.15 }, y: { duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" } }}
            >
              {t}
            </m.span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- preço ---------- */

function Preco({
  cfg,
  produto,
  checkout,
  estilo,
  onClick,
  nome,
  frase,
}: {
  cfg: PaginaScoreConfig;
  produto: NonNullable<QuizMeta["product"]>;
  checkout: string;
  estilo: React.CSSProperties;
  onClick: () => void;
  nome: string;
  frase: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  const numero = Number((produto.price.match(/\d+/g) ?? ["0"]).join("")) || 0;
  return (
    <section id="oferta" className="relative px-5 py-20">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,162,76,.14),transparent_65%)]" />
      <div ref={ref} className="relative mx-auto max-w-md">
        <Revela className="text-center">
          <Rotulo>{nome ? `${nome}, o seu próximo passo` : "o seu próximo passo"}</Rotulo>
          <h2 className="mt-3 text-[clamp(28px,7vw,42px)] font-bold uppercase leading-[1.05]" style={estilo}>{rich(cfg.preco.titulo)}</h2>
          {frase && <p className="mx-auto mt-4 max-w-sm text-[16px] italic leading-relaxed text-[#E6E0D5]">{rich(frase)}</p>}
        </Revela>
        <Revela atraso={0.1} className="relative mt-10">
          {/* selo de garantia girando */}
          {produto.guarantee && (
            <div className="absolute -right-3 -top-12 z-10 h-[92px] w-[92px]">
              <m.svg viewBox="0 0 100 100" className="h-full w-full" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: "linear" }}>
                <defs>
                  <path id="circulo-selo" d="M 50 50 m -38 0 a 38 38 0 1 1 76 0 a 38 38 0 1 1 -76 0" />
                </defs>
                <circle cx={50} cy={50} r={48} fill="#0b0a08" stroke="#D4A24C" strokeWidth={1.5} />
                <text fill="#F0C878" fontSize={9.6} fontWeight={700} letterSpacing={2.2}>
                  <textPath href="#circulo-selo">{cfg.preco.garantiaSelo}</textPath>
                </text>
              </m.svg>
              <span className="absolute inset-0 grid place-items-center text-[30px] font-bold text-[#F0C878]" style={estilo}>7</span>
            </div>
          )}
          <div className="relative overflow-hidden rounded-[26px] border border-[#D4A24C]/50 bg-gradient-to-b from-[#17130b] to-[#0b0a08] px-6 pb-8 pt-9 text-center shadow-[0_30px_80px_-30px_rgba(212,162,76,.5)]">
            {/* reflexo metálico passando pelo card */}
            <m.span
              aria-hidden
              className="pointer-events-none absolute -inset-y-10 -left-1/2 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ["0%", "520%"] }}
              transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
            />
            <span className="inline-block rounded-full bg-[#D4A24C] px-3.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-black">{cfg.preco.selo}</span>
            <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-[#B9B2A6]">{produto.name.split("·")[0].trim()}</p>
            <p className={`mt-3 text-[78px] font-bold leading-none [font-variant-numeric:tabular-nums] ${ouro}`} style={estilo}>
              R$ <Conta alvo={numero} ativo={visivel} duracao={1.4} />
            </p>
            {produto.installments && <p className="mt-2 text-[14px] text-[#B9B2A6]">{produto.installments}</p>}
            <ul className="mt-7 space-y-3 text-left">
              {produto.benefits.map((b, i) => (
                <li key={b} className="flex gap-3 text-[14.5px] leading-snug text-[#E6E0D5]">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none">
                    <circle cx={12} cy={12} r={11} fill="#D4A24C" fillOpacity={0.15} />
                    <m.path
                      d="M7 12.5l3.2 3.2L17 9"
                      stroke="#F0C878"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={visivel ? { pathLength: 1 } : {}}
                      transition={{ duration: 0.4, delay: 0.6 + i * 0.12 }}
                    />
                  </svg>
                  <span>{rich(b)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <BotaoOuro href={checkout} onClick={onClick} estilo={estilo} largo>
                {"Quero o Score da Vida"}
              </BotaoOuro>
            </div>
            {produto.guarantee && <p className="mt-4 text-[12.5px] text-[#8F887C]">🔒 {produto.guarantee}</p>}
          </div>
        </Revela>
      </div>
    </section>
  );
}

function BotaoOuro({ href, onClick, estilo, children, largo }: { href: string; onClick: () => void; estilo: React.CSSProperties; children: ReactNode; largo?: boolean }) {
  return (
    <m.a
      href={href}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`relative inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F0C878] via-[#D4A24C] to-[#C8923A] px-8 py-4 text-[17px] font-bold uppercase tracking-wide text-black ${largo ? "w-full" : ""}`}
      style={estilo}
      animate={{ boxShadow: ["0 0 0 0 rgba(240,200,120,.45)", "0 0 0 14px rgba(240,200,120,0)"] }}
      transition={{ boxShadow: { duration: 1.8, repeat: Infinity, ease: "easeOut" } }}
    >
      {children}
      <m.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>→</m.span>
    </m.a>
  );
}

/* ---------- frase final, palavra por palavra ---------- */

function FraseFinal({ frase, estilo }: { frase: string; estilo: React.CSSProperties }) {
  const palavras = frase.split(" ");
  return (
    <h2 className="mx-auto max-w-xl text-[clamp(32px,9vw,58px)] font-bold uppercase leading-[1.02]" style={estilo}>
      {palavras.map((p, i) => (
        <m.span
          key={i}
          className={`mr-[0.25em] inline-block ${/CPF/i.test(p) ? ouro : ""}`}
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "0px 0px -60px 0px" }}
          transition={{ duration: 0.6, delay: i * 0.09, ease: suave }}
        >
          {p}
        </m.span>
      ))}
    </h2>
  );
}

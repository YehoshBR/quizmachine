import { useEffect, useRef, useState } from "react";
import { animate, m, useInView } from "framer-motion";
import type { SalesPageConfig } from "@/lib/quiz-config";

// Mapa personalizado da página premium: as respostas do quiz viram um radar (hoje → depois),
// barras lado a lado por dimensão e as três maiores mudanças ("de → para").

type Mapa = NonNullable<SalesPageConfig["mapa"]>;
type Answers = Record<string, string | string[]>;

export type Dimensao = { rotulo: string; hoje: number; meta: number; textoHoje: string; textoMeta: string };

const suave = [0.16, 1, 0.3, 1] as const;

/** Lê as respostas e devolve cada dimensão com hoje/meta (meta sempre acima de hoje). */
export function montarDimensoes(mapa: Mapa, answers: Answers): Dimensao[] {
  return mapa.dimensoes.map((d) => {
    const r = String(answers[d.id] ?? "");
    const valores = Object.values(d.hoje);
    const hoje = d.hoje[r] ?? Math.round(valores.reduce((a, b) => a + b, 0) / Math.max(1, valores.length));
    return {
      rotulo: d.rotulo,
      hoje,
      meta: Math.min(96, Math.max(d.meta, hoje + 12)),
      textoHoje: d.textoHoje[r] ?? "",
      textoMeta: d.textoMeta,
    };
  });
}

function pontos(vals: number[], r: number, c: number) {
  return vals
    .map((v, i) => {
      const a = (Math.PI * 2 * i) / vals.length - Math.PI / 2, k = (Math.max(6, v) / 100) * r;
      return `${(c + Math.cos(a) * k).toFixed(1)},${(c + Math.sin(a) * k).toFixed(1)}`;
    })
    .join(" ");
}

/** Radar: o polígono de hoje aparece, depois o dourado cresce até onde a pessoa vai chegar. */
export function Radar({ dims, rotuloHoje, rotuloMeta }: { dims: Dimensao[]; rotuloHoje: string; rotuloMeta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  const C = 160, R = 108;
  const hoje = pontos(dims.map((d) => d.hoje), R, C);
  const meta = pontos(dims.map((d) => d.meta), R, C);
  const zero = pontos(dims.map(() => 0), R, C);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[380px]">
      <svg viewBox="0 0 320 320" className="w-full overflow-visible" aria-label={`${rotuloHoje} e ${rotuloMeta} em ${dims.length} pontos`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={pontos(dims.map(() => f * 100), R, C)} fill="none" stroke="var(--border)" strokeWidth={1} />
        ))}
        {dims.map((_, i) => {
          const a = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
          return <line key={i} x1={C} y1={C} x2={C + Math.cos(a) * R} y2={C + Math.sin(a) * R} stroke="var(--border)" strokeWidth={1} />;
        })}
        {/* depois: dourado crescendo */}
        <m.polygon
          initial={{ points: zero, opacity: 0 }}
          animate={visivel ? { points: meta, opacity: 1 } : {}}
          transition={{ duration: 1.6, delay: 1.3, ease: suave }}
          fill="color-mix(in oklab, var(--primary) 22%, transparent)"
          stroke="var(--secondary)"
          strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 10px var(--primary))" }}
        />
        {/* hoje */}
        <m.polygon
          initial={{ points: zero, opacity: 0 }}
          animate={visivel ? { points: hoje, opacity: 1 } : {}}
          transition={{ duration: 1.1, delay: 0.2, ease: suave }}
          fill="color-mix(in oklab, var(--muted-foreground) 22%, transparent)"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        {dims.map((d, i) => {
          const a = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
          const x = C + Math.cos(a) * (R + 26), y = C + Math.sin(a) * (R + 18);
          const anc = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
          return (
            <text key={d.rotulo} x={x} y={y} textAnchor={anc} dominantBaseline="middle" className="fill-foreground text-[11px] font-semibold">
              {d.rotulo}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-center gap-5 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <i className="block h-0.5 w-5 border-t border-dashed border-muted-foreground" /> {rotuloHoje}
        </span>
        <span className="flex items-center gap-2 text-secondary">
          <i className="block h-1 w-5 rounded bg-gradient-to-r from-primary to-secondary" /> {rotuloMeta}
        </span>
      </div>
    </div>
  );
}

function Numero({ alvo, ativo, atraso }: { alvo: number; ativo: boolean; atraso: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const c = animate(0, alvo, { duration: 1.2, delay: atraso, ease: suave, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [ativo, alvo, atraso]);
  return <span className="[font-variant-numeric:lining-nums_tabular-nums]">{v}%</span>;
}

/** Barras lado a lado: hoje (cinza) × depois (dourado), uma linha por dimensão. */
export function LadoALado({ dims, rotuloHoje, rotuloMeta }: { dims: Dimensao[]; rotuloHoje: string; rotuloMeta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  return (
    <div ref={ref} className="overflow-hidden rounded-b-xl rounded-t-[26px] border border-border bg-card/70">
      <div className="grid grid-cols-2 border-b border-border text-[10.5px] font-semibold uppercase tracking-[0.2em]">
        <p className="p-3 text-center text-muted-foreground">{rotuloHoje}</p>
        <p className="border-l border-border p-3 text-center text-secondary">{rotuloMeta}</p>
      </div>
      {dims.map((d, i) => (
        <div key={d.rotulo} className="border-b border-border px-3 pb-4 pt-3 last:border-b-0">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">{d.rotulo}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <m.div
                    className="h-full origin-left rounded-full bg-muted-foreground/70"
                    initial={{ scaleX: 0 }}
                    animate={visivel ? { scaleX: d.hoje / 100 } : {}}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: suave }}
                  />
                </div>
                <span className="w-9 text-right text-xs text-muted-foreground"><Numero alvo={d.hoje} ativo={visivel} atraso={0.1 + i * 0.08} /></span>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{d.textoHoje}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <m.div
                    className="h-full origin-left rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_10px_var(--secondary)]"
                    initial={{ scaleX: 0 }}
                    animate={visivel ? { scaleX: d.meta / 100 } : {}}
                    transition={{ duration: 1.1, delay: 0.7 + i * 0.1, ease: suave }}
                  />
                </div>
                <span className="w-9 text-right text-xs font-semibold text-secondary"><Numero alvo={d.meta} ativo={visivel} atraso={0.7 + i * 0.1} /></span>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-foreground/85">{d.textoMeta}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** As três maiores distâncias entre hoje e depois, em "de → para". */
export function Mudancas({ dims, estiloTitulo }: { dims: Dimensao[]; estiloTitulo: React.CSSProperties }) {
  const top = [...dims].sort((a, b) => b.meta - b.hoje - (a.meta - a.hoje)).slice(0, 3);
  return (
    <ol className="space-y-3">
      {top.map((d, i) => (
        <m.li
          key={d.rotulo}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          transition={{ duration: 0.6, delay: i * 0.12, ease: suave }}
          className="rounded-b-lg rounded-t-[22px] border border-border bg-card/70 p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{d.rotulo}</p>
            <p className="text-xs text-secondary [font-variant-numeric:lining-nums]">+{d.meta - d.hoje} pontos</p>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <p className="text-[13px] leading-snug text-muted-foreground line-through decoration-primary/50">{d.textoHoje}</p>
            <m.span
              aria-hidden
              className="text-xl text-secondary"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              →
            </m.span>
            <p className="text-[14px] font-semibold leading-snug text-foreground" style={estiloTitulo}>{d.textoMeta}</p>
          </div>
        </m.li>
      ))}
    </ol>
  );
}

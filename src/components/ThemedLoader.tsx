// ============================================================
// ThemedLoader — loading temático configurável por nicho
// ============================================================
// Em vez de uma barra genérica, acende uma sequência de ícones
// conforme o progresso avança (0-100%). As cores vêm do tema
// (--primary/--secondary), então funcionam com a paleta de
// qualquer quiz sem precisar mudar código.
//
// Para usar um conjunto de ícones customizado, passe `glyphs` na
// tela `loading` do quiz-config.ts. Sem isso, usa LOADER_GLYPHS_DEFAULT.
// ============================================================

export type LoaderGlyph = { id: string; d: string };

/** Caixa de desenho: cada path é centrado em (0,0), de -18 a 18. */

/** Conjunto neutro — funciona para qualquer nicho. */
export const LOADER_GLYPHS_DEFAULT: LoaderGlyph[] = [
  { id: "check", d: "M -12 1 L -3 10 L 13 -10" },
  {
    id: "star",
    d: "M 0 -16 L 4.5 -5.5 L 16 -4.5 L 7.5 3 L 10 14.5 L 0 8.5 L -10 14.5 L -7.5 3 L -16 -4.5 L -4.5 -5.5 Z",
  },
  {
    id: "shield",
    d: "M 0 -15 L 13 -9 L 13 2 C 13 10 7 14.5 0 16 C -7 14.5 -13 10 -13 2 L -13 -9 Z M -6 0 L -1 6 L 7 -6",
  },
  {
    id: "bolt",
    d: "M 3 -16 L -10 2 L -1 2 L -3 16 L 11 -3 L 2 -3 Z",
  },
  {
    id: "heart",
    d: "M 0 13 C -14 3 -15 -7 -7 -12 C -2 -15 0 -10 0 -8 C 0 -10 2 -15 7 -12 C 15 -7 14 3 0 13 Z",
  },
  {
    id: "flag",
    d: "M -8 16 L -8 -15 L 12 -10 L 4 -3 L 12 4 L -8 8",
  },
];

/**
 * Cabana / construção / trilha — ícones extraídos do PremiumChainLoader
 * original (projetos de cabana no Lovable). Bom para nichos de
 * imóveis, natureza, construção, trilha, montanha.
 */
export const LOADER_GLYPHS_CABANA: LoaderGlyph[] = [
  { id: "montanha", d: "M -17 12 L -5 -8 L 2 2 L 7 -5 L 17 12 Z M -5 -8 L -1 -2 L -8 -1 Z" },
  {
    id: "cabana",
    d: "M -17 -1 L 0 -14 L 17 -1 M -12 -3 L -12 13 L 12 13 L 12 -3 M -3 13 L -3 3 L 4 3 L 4 13",
  },
  { id: "martelo", d: "M -14 -12 L -2 -12 L 2 -8 L -10 -8 Z M -8 -8 L 12 12 M -12 8 L -4 16" },
  {
    id: "pinheiro",
    d: "M 0 -16 L -8 -4 L -4 -4 L -11 5 L -5 5 L -13 14 L 13 14 L 5 5 L 11 5 L 4 -4 L 8 -4 Z M -2 14 L -2 17 L 2 17 L 2 14",
  },
  { id: "chave", d: "M 10 -14 a 7 7 0 1 0 4 12 L -8 12 a 5 5 0 1 1 -5 -5 L 3 -7 a 7 7 0 0 1 7 -7 Z" },
  {
    id: "regua",
    d: "M -16 -6 L 16 -6 L 16 6 L -16 6 Z M -9 -6 L -9 0 M -2 -6 L -2 0 M 5 -6 L 5 0 M 11 -6 L 11 0",
  },
];

/**
 * Mente / clareza / autoconhecimento — para nichos de mentalidade,
 * espiritualidade, terapia, desenvolvimento pessoal.
 */
export const LOADER_GLYPHS_MIND: LoaderGlyph[] = [
  {
    id: "cerebro",
    d: "M -6 -14 C -14 -14 -16 -4 -11 0 C -16 4 -13 14 -4 13 C -2 16 4 16 6 13 C 15 14 17 4 12 0 C 17 -5 14 -14 6 -14 C 4 -17 -4 -17 -6 -14 Z M 0 -14 L 0 13",
  },
  { id: "lampada", d: "M 0 -15 a 10 10 0 1 0 0.1 0 M -5 8 L -5 13 L 5 13 L 5 8 M -3 16 L 3 16 M 0 -8 L 0 2" },
  { id: "chave", d: "M 10 -14 a 7 7 0 1 0 4 12 L -8 12 a 5 5 0 1 1 -5 -5 L 3 -7 a 7 7 0 0 1 7 -7 Z" },
  { id: "alvo", d: "M 0 0 m -16 0 a 16 16 0 1 0 32 0 a 16 16 0 1 0 -32 0 M 0 0 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0 M -1 -1 L 1 1" },
  {
    id: "bussola",
    d: "M 0 0 m -15 0 a 15 15 0 1 0 30 0 a 15 15 0 1 0 -30 0 M 6 -8 L -2 2 L -6 8 L 2 -2 Z",
  },
  {
    id: "livro",
    d: "M 0 -10 C -4 -13 -12 -13 -16 -11 L -16 11 C -12 9 -4 9 0 12 C 4 9 12 9 16 11 L 16 -11 C 12 -13 4 -13 0 -10 Z M 0 -10 L 0 12",
  },
];

interface ThemedLoaderProps {
  pct?: number;
  glyphs?: LoaderGlyph[];
  className?: string;
}

export function ThemedLoader({ pct = 0, glyphs, className = "" }: ThemedLoaderProps) {
  const set = glyphs && glyphs.length > 0 ? glyphs : LOADER_GLYPHS_DEFAULT;
  const total = set.length;
  const filled = Math.min(total, Math.floor((pct / 100) * total));
  const spacing = 500 / (total + 1);

  return (
    <div className={`relative w-full ${className}`}>
      <svg viewBox="0 0 500 120" className="w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="loaderOff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="loaderOn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
          <radialGradient id="loaderHalo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.6" />
            <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
          <filter id="loaderGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {set.map((glyph, i) => (
          <LoaderIcon
            key={glyph.id}
            cx={spacing * (i + 1)}
            d={glyph.d}
            on={i < filled}
            pulsing={i === filled}
          />
        ))}
      </svg>

      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary/60" />
        <span className="font-mono text-xl font-bold tabular-nums text-primary tracking-widest">
          {String(Math.round(pct)).padStart(2, "0")}%
        </span>
        <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary/60" />
      </div>
    </div>
  );
}

function LoaderIcon({
  cx,
  d,
  on = false,
  pulsing = false,
}: {
  cx: number;
  d: string;
  on?: boolean;
  pulsing?: boolean;
}) {
  const paint = on ? "url(#loaderOn)" : "url(#loaderOff)";
  return (
    <g transform={`translate(${cx} 60)`}>
      {on && <circle r="24" fill="url(#loaderHalo)" filter="url(#loaderGlow)" />}
      <path
        d={d}
        fill="none"
        stroke={paint}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke .6s ease" }}
      >
        {pulsing && (
          <animate attributeName="opacity" values="0.45;1;0.45" dur="1.2s" repeatCount="indefinite" />
        )}
      </path>
    </g>
  );
}

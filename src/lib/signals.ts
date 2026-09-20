// ============================================================
// signals.ts — deriva dores/desejos dominantes a partir das respostas
// ============================================================
// Cada Option do quiz pode carregar `signals: string[]` (chaves de
// quizMeta.signalLibrary). Depois que o visitante termina o quiz, somamos
// quantas vezes cada sinal apareceu nas respostas selecionadas e usamos os
// mais fortes (uma dor + um desejo) pra personalizar a /oferta — sempre o
// MESMO produto, só a ênfase muda.
// ============================================================
import type { Screen, SignalDef } from "./quiz-config";

type Answers = Record<string, string | string[]>;

export type TopSignal = { key: string } & SignalDef;

export type SignalResult = {
  tally: Record<string, number>;
  topPain?: TopSignal;
  topDesire?: TopSignal;
};

/** Constrói um índice value->signals[] por screen id, pra não varrer tudo repetidamente. */
function buildOptionIndex(screens: Screen[]): Record<string, Record<string, string[]>> {
  const index: Record<string, Record<string, string[]>> = {};
  for (const screen of screens) {
    if (screen.type === "intro") {
      const map: Record<string, string[]> = {};
      for (const opt of screen.firstOptions) if (opt.signals?.length) map[opt.value] = opt.signals;
      if (Object.keys(map).length) index["intro_first"] = map;
      continue;
    }
    if (screen.type === "single") {
      const map: Record<string, string[]> = {};
      for (const opt of screen.options) if (opt.signals?.length) map[opt.value] = opt.signals;
      if (Object.keys(map).length) index[screen.id] = map;
    }
  }
  return index;
}

export function computeTopSignals(
  screens: Screen[],
  answers: Answers,
  signalLibrary: Record<string, SignalDef> | undefined
): SignalResult {
  const tally: Record<string, number> = {};
  if (signalLibrary) {
    const optionIndex = buildOptionIndex(screens);
    for (const [screenId, answer] of Object.entries(answers)) {
      const map = optionIndex[screenId];
      if (!map) continue;
      const values = Array.isArray(answer) ? answer : [answer];
      for (const v of values) {
        const signals = map[v];
        if (!signals) continue;
        for (const s of signals) tally[s] = (tally[s] ?? 0) + 1;
      }
    }
  }

  let topPain: TopSignal | undefined;
  let topDesire: TopSignal | undefined;
  if (signalLibrary) {
    for (const [key, count] of Object.entries(tally)) {
      const def = signalLibrary[key];
      if (!def) continue;
      if (def.kind === "pain" && (!topPain || count > tally[topPain.key])) {
        topPain = { key, ...def };
      }
      if (def.kind === "desire" && (!topDesire || count > tally[topDesire.key])) {
        topDesire = { key, ...def };
      }
    }
  }

  return { tally, topPain, topDesire };
}

const STORAGE_KEY = "quiz_answers";

/** Chamar assim que o quiz termina (antes de navegar pra /oferta), no navegador. */
export function persistAnswers(answers: Answers): void {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // sessionStorage indisponível (modo privado etc) — /oferta cai pro conteúdo genérico
  }
}

/** Chamar na /oferta (client-side) pra recuperar as respostas da sessão do quiz. */
export function readPersistedAnswers(): Answers | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Answers;
  } catch {
    return null;
  }
}

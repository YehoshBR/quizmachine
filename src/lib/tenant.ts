// ============================================================
// tenant.ts — resolve qual quiz servir com base no domínio da requisição
// ============================================================
// Server function (roda no servidor mesmo quando chamada a partir do
// cliente, via RPC do TanStack Start). Consulta o Postgres pelo domínio
// atual; se não achar (ou o DB estiver fora do ar), cai pro conteúdo
// estático de src/lib/quiz-config.ts como fallback — nunca deixa o site
// no ar quebrado por causa do banco.
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { getQuizByDomain, listActiveHeadlineVariants } from "./db";
import {
  quizMeta as fallbackQuizMeta,
  screens as fallbackScreens,
  scoringMap as fallbackScoringMap,
  type QuizMeta,
  type Screen,
} from "./quiz-config";

export type HeadlineVariantPick = { id: string; headline: string; subheadline?: string };

export type TenantQuiz = {
  /** null quando veio do fallback estático (sem linha no banco pra esse domínio) */
  id: string | null;
  quizMeta: QuizMeta;
  screens: Screen[];
  scoringMap: Record<string, Record<string, number>>;
  /** Variante de headline sorteada pro teste A/B — null quando não há teste ativo (usa o headline fixo da tela intro). */
  variant: HeadlineVariantPick | null;
};

function fallbackTenant(): TenantQuiz {
  return {
    id: null,
    quizMeta: fallbackQuizMeta,
    screens: fallbackScreens,
    scoringMap: fallbackScoringMap,
    variant: null,
  };
}

export const getTenantQuiz = createServerFn({ method: "GET" }).handler(
  async (): Promise<TenantQuiz> => {
    let hostname = "";
    try {
      const host = getRequestHost() ?? "";
      hostname = host.split(":")[0].toLowerCase();
    } catch {
      // fora de uma requisição real (ex: build) — usa fallback
    }

    if (!hostname) return fallbackTenant();

    try {
      const row = await getQuizByDomain(hostname);
      if (row) {
        let variant: HeadlineVariantPick | null = null;
        try {
          const active = await listActiveHeadlineVariants(row.id);
          if (active.length > 0) {
            const picked = active[Math.floor(Math.random() * active.length)];
            variant = { id: picked.id, headline: picked.headline, subheadline: picked.subheadline ?? undefined };
          }
        } catch (err) {
          console.error("[tenant] falha ao sortear variante de headline, usando o headline fixo:", err);
        }
        return {
          id: row.id,
          quizMeta: row.quiz_meta,
          screens: row.screens,
          scoringMap: row.scoring_map,
          variant,
        };
      }
    } catch (err) {
      console.error("[tenant] falha ao consultar o banco, usando fallback estático:", err);
    }

    return fallbackTenant();
  }
);

// Relatório de abandono por tela: quantas sessões chegaram em cada tela e
// qual % caiu antes da próxima — pra achar a tela que está travando o funil.
import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { getScreenFunnelStats, getQuizById } from "@/lib/db";

export const Route = createFileRoute("/api/admin/funnel-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated()) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        const quizId = new URL(request.url).searchParams.get("quizId");
        if (!quizId) return Response.json({ ok: false, error: "quizId obrigatório" }, { status: 400 });

        const quiz = await getQuizById(quizId);
        if (!quiz) return Response.json({ ok: false, error: "quiz não encontrado" }, { status: 404 });

        const raw = await getScreenFunnelStats(quizId);
        // 1 linha por step_index (o maior "reached" observado, caso o front tenha
        // mandado o mesmo screen_id em steps diferentes por algum motivo).
        const byStep = new Map<number, { screenId: string; reached: number }>();
        for (const r of raw) {
          const existing = byStep.get(r.stepIndex);
          if (!existing || r.reached > existing.reached) byStep.set(r.stepIndex, { screenId: r.screenId, reached: r.reached });
        }
        const steps = [...byStep.entries()].sort((a, b) => a[0] - b[0]);

        const screenLabel = (s: (typeof quiz.screens)[number]): string => {
          switch (s.type) {
            case "intro": return s.headline;
            case "single": return s.question;
            case "scale": return s.question;
            case "content": return s.title;
            case "social-proof": return s.title;
            case "loading": return s.title;
            case "diagnosis": return s.title;
            case "compare": return s.title;
            case "testimonials": return s.title;
            case "mirror-chart": return s.title;
            case "lead": return s.title;
            default: return "";
          }
        };
        const screenById = new Map(quiz.screens.map((s) => [s.id, s]));

        const rows = steps.map(([stepIndex, { screenId, reached }], i) => {
          const nextReached = steps[i + 1]?.[1]?.reached;
          const dropoffPct = nextReached != null && reached > 0 ? Math.round((1 - nextReached / reached) * 1000) / 10 : null;
          const screen = screenById.get(screenId);
          return {
            stepIndex,
            screenId,
            type: screen?.type ?? "?",
            label: screen ? screenLabel(screen) : screenId,
            reached,
            dropoffPct,
          };
        });

        return Response.json({ ok: true, rows });
      },
    },
  },
});

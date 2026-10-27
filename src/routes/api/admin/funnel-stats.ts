// Relatório de abandono por tela: quantas sessões chegaram em cada tela, quantas pararam
// nela (última tela vista sem chegar na oferta) e quanto tempo levam pra responder — pra
// achar a tela que está travando o funil. ?de=&ate= (ISO) filtram pelo início da sessão.
import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { getFunnelReport, getQuizById } from "@/lib/db";

function screenLabel(s: { type: string } & Record<string, unknown>): string {
  const t = s.type === "intro" ? s.headline : s.type === "single" || s.type === "scale" ? s.question : s.title;
  return typeof t === "string" ? t.replace(/<\/?hl>/g, "").replace(/\*/g, "") : "";
}

function data(v: string | null, padrao: Date): Date {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : padrao;
}

export const Route = createFileRoute("/api/admin/funnel-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated()) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        const params = new URL(request.url).searchParams;
        const quizId = params.get("quizId");
        if (!quizId) return Response.json({ ok: false, error: "quizId obrigatório" }, { status: 400 });

        const quiz = await getQuizById(quizId);
        if (!quiz) return Response.json({ ok: false, error: "quiz não encontrado" }, { status: 404 });

        const ate = data(params.get("ate"), new Date(Date.now() + 60_000));
        const de = data(params.get("de"), new Date(0));
        const rel = await getFunnelReport(quizId, de, ate);
        const porTela = new Map(rel.telas.map((t) => [t.screenId, t]));
        const base = rel.totais.sessoes;
        const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

        const linha = (screenId: string, ordem: number | null, type: string, label: string, condicional: boolean) => {
          const t = porTela.get(screenId);
          const chegaram = t?.chegaram ?? 0;
          const saiu = t?.saiu ?? 0;
          return {
            ordem,
            screenId,
            type,
            label,
            condicional,
            chegaram,
            pctInicio: pct(chegaram, base),
            saiu,
            saiuComLead: t?.saiuComLead ?? 0,
            andamento: t?.andamento ?? 0,
            taxaSaida: pct(saiu, chegaram),
            tempoMedianoSeg: t?.tempoMedianoSeg ?? null,
          };
        };

        const conhecidas = new Set<string>();
        const rows = quiz.screens.map((s, i) => {
          conhecidas.add(s.id);
          const sc = s as unknown as { type: string; showIf?: unknown } & Record<string, unknown>;
          return linha(s.id, i + 1, s.type, screenLabel(sc), Boolean(sc.showIf));
        });
        // Telas que tiveram visita mas não existem mais no quiz (foram renomeadas/removidas)
        for (const t of rel.telas) {
          if (!conhecidas.has(t.screenId)) rows.push(linha(t.screenId, null, "?", "(tela removida do quiz)", false));
        }

        const { totais } = rel;
        return Response.json({
          ok: true,
          rows,
          totais: {
            ...totais,
            pctLead: pct(totais.leads, base),
            pctOferta: pct(totais.ofertas, base),
            pctCheckout: pct(totais.checkouts, base),
            pctCheckoutDaOferta: pct(totais.checkouts, totais.ofertas),
          },
          testes: rel.testes,
        });
      },
    },
  },
});

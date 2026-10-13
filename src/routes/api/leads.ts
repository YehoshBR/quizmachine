import { createFileRoute } from "@tanstack/react-router";
import { insertLead, insertQuizEvent, getQuizById, mergeLeadAnswers } from "@/lib/db";

/** Dispara o webhook de leads configurado no painel (se houver). Nunca lança —
 * uma falha do endpoint do cliente não pode derrubar a captura do lead. */
async function fireLeadWebhook(webhookUrl: string, payload: Record<string, unknown>) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[api/leads] falha ao chamar o webhook de leads:", err);
  }
}

export const Route = createFileRoute("/api/leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        if (!body || typeof body !== "object") {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        const b = body as Record<string, unknown>;

        // Etapa extra (ex.: @ do Instagram) depois do lead já salvo: anexa e avisa o webhook.
        if (typeof b.leadId === "string" && b.extra && typeof b.extra === "object") {
          const extra: Record<string, string> = {};
          for (const [k, v] of Object.entries(b.extra as Record<string, unknown>).slice(0, 5)) {
            if (/^[a-z0-9_]{1,40}$/i.test(k) && typeof v === "string" && v.trim()) extra[k] = v.trim().slice(0, 200);
          }
          if (!Object.keys(extra).length || !/^[0-9a-f-]{36}$/i.test(b.leadId)) {
            return Response.json({ ok: true });
          }
          try {
            const lead = await mergeLeadAnswers(b.leadId, extra);
            const quiz = lead?.quiz_id ? await getQuizById(lead.quiz_id).catch(() => null) : null;
            const webhookUrl = quiz?.quiz_meta?.leadWebhookUrl;
            if (lead && webhookUrl) {
              await fireLeadWebhook(webhookUrl, { event: "lead_extra", quizId: lead.quiz_id, ...lead, extra });
            }
          } catch (err) {
            console.error("[api/leads] falha ao anexar etapa extra:", err);
          }
          return Response.json({ ok: true });
        }
        const quizId = typeof b.quizId === "string" ? b.quizId : null;
        const sessionId = typeof b.sessionId === "string" ? b.sessionId.slice(0, 100) : null;
        const name = typeof b.name === "string" ? b.name : undefined;
        const email = typeof b.email === "string" ? b.email : undefined;
        const whatsapp = typeof b.whatsapp === "string" ? b.whatsapp : undefined;
        const answers =
          b.answers && typeof b.answers === "object" ? (b.answers as Record<string, unknown>) : {};
        const utm = b.utm && typeof b.utm === "object" ? (b.utm as Record<string, unknown>) : {};

        try {
          const leadId = await insertLead({ quizId, name, email, whatsapp, answers, utm });

          if (quizId && sessionId) {
            insertQuizEvent({ quizId, sessionId, eventType: "lead_submitted" }).catch((err) =>
              console.error("[api/leads] falha ao registrar evento lead_submitted:", err)
            );
          }

          if (quizId) {
            const quiz = await getQuizById(quizId).catch(() => null);
            const webhookUrl = quiz?.quiz_meta?.leadWebhookUrl;
            if (webhookUrl) {
              await fireLeadWebhook(webhookUrl, {
                quizId,
                name,
                email,
                whatsapp,
                answers,
                utm,
                createdAt: new Date().toISOString(),
              });
            }
          }

          return Response.json({ ok: true, id: leadId });
        } catch (err) {
          console.error("[api/leads] falha ao salvar lead:", err);
          // Não bloqueia o funil do visitante por causa de um erro de banco —
          // o front-end segue pra tela de análise mesmo assim.
          return Response.json({ ok: false, error: "save_failed" }, { status: 200 });
        }
      },
    },
  },
});

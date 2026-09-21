import { createFileRoute } from "@tanstack/react-router";
import { insertLead, insertQuizEvent, getQuizById } from "@/lib/db";

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
        const quizId = typeof b.quizId === "string" ? b.quizId : null;
        const sessionId = typeof b.sessionId === "string" ? b.sessionId.slice(0, 100) : null;
        const name = typeof b.name === "string" ? b.name : undefined;
        const email = typeof b.email === "string" ? b.email : undefined;
        const whatsapp = typeof b.whatsapp === "string" ? b.whatsapp : undefined;
        const answers =
          b.answers && typeof b.answers === "object" ? (b.answers as Record<string, unknown>) : {};
        const utm = b.utm && typeof b.utm === "object" ? (b.utm as Record<string, unknown>) : {};

        try {
          await insertLead({ quizId, name, email, whatsapp, answers, utm });

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

          return Response.json({ ok: true });
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

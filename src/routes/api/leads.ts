import { createFileRoute } from "@tanstack/react-router";
import { insertLead } from "@/lib/db";

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
        const answers =
          b.answers && typeof b.answers === "object" ? (b.answers as Record<string, unknown>) : {};
        const utm = b.utm && typeof b.utm === "object" ? (b.utm as Record<string, unknown>) : {};

        try {
          await insertLead({
            quizId,
            name: typeof b.name === "string" ? b.name : undefined,
            email: typeof b.email === "string" ? b.email : undefined,
            whatsapp: typeof b.whatsapp === "string" ? b.whatsapp : undefined,
            answers,
            utm,
          });
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

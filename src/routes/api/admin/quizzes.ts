import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { listQuizzes, createQuiz } from "@/lib/db";

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export const Route = createFileRoute("/api/admin/quizzes")({
  server: {
    handlers: {
      GET: async () => {
        if (!isAuthenticated()) return unauthorized();
        const quizzes = await listQuizzes();
        return Response.json({ ok: true, quizzes });
      },
      POST: async ({ request }) => {
        if (!isAuthenticated()) return unauthorized();
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const slug = typeof b.slug === "string" ? b.slug.trim() : "";
        const name = typeof b.name === "string" ? b.name.trim() : "";
        if (!slug || !name) {
          return Response.json({ ok: false, error: "slug e name são obrigatórios" }, { status: 400 });
        }
        const tier = (b.tier === "curto" || b.tier === "medio" || b.tier === "longo") ? b.tier : "longo";
        try {
          const quiz = await createQuiz({
            slug,
            name,
            tier,
            quizMeta: (b.quizMeta as never) ?? {
              title: name,
              description: "",
              logo: "",
              logoAlt: name,
              offerUrl: "/oferta",
              leadFields: [
                { id: "name", label: "Nome", placeholder: "Seu nome", type: "text", required: true },
                { id: "email", label: "Email", placeholder: "seu@email.com", type: "email", required: true },
                { id: "whatsapp", label: "WhatsApp", placeholder: "(11) 99999-9999", type: "tel" },
              ],
            },
            screens: (b.screens as never) ?? [],
            scoringMap: (b.scoringMap as never) ?? {},
          });
          return Response.json({ ok: true, quiz });
        } catch (err) {
          console.error("[api/admin/quizzes] create failed:", err);
          const message = err instanceof Error ? err.message : "erro desconhecido";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});

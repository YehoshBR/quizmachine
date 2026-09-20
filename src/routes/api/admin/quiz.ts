// Ações sobre UM quiz específico, via ?id=<uuid> — evita precisar de rota
// dinâmica de arquivo ($id.tsx) só pra isso.
import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { getQuizById, updateQuiz, deleteQuiz } from "@/lib/db";

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export const Route = createFileRoute("/api/admin/quiz")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated()) return unauthorized();
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "id obrigatório" }, { status: 400 });
        const quiz = await getQuizById(id);
        if (!quiz) return Response.json({ ok: false, error: "não encontrado" }, { status: 404 });
        return Response.json({ ok: true, quiz });
      },
      PUT: async ({ request }) => {
        if (!isAuthenticated()) return unauthorized();
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "id obrigatório" }, { status: 400 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const b = (body ?? {}) as Record<string, unknown>;
        try {
          const quiz = await updateQuiz(id, {
            name: typeof b.name === "string" ? b.name : undefined,
            domain: typeof b.domain === "string" ? (b.domain.trim() || null) : undefined,
            tier: b.tier === "curto" || b.tier === "medio" || b.tier === "longo" ? b.tier : undefined,
            status: b.status === "draft" || b.status === "published" ? b.status : undefined,
            quizMeta: b.quizMeta as never,
            screens: b.screens as never,
            scoringMap: b.scoringMap as never,
          });
          return Response.json({ ok: true, quiz });
        } catch (err) {
          console.error("[api/admin/quiz] update failed:", err);
          const message = err instanceof Error ? err.message : "erro desconhecido";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
      DELETE: async ({ request }) => {
        if (!isAuthenticated()) return unauthorized();
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "id obrigatório" }, { status: 400 });
        await deleteQuiz(id);
        return Response.json({ ok: true });
      },
    },
  },
});

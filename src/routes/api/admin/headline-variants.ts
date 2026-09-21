import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { listHeadlineVariants, createHeadlineVariant } from "@/lib/db";

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export const Route = createFileRoute("/api/admin/headline-variants")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated()) return unauthorized();
        const quizId = new URL(request.url).searchParams.get("quizId");
        if (!quizId) return Response.json({ ok: false, error: "quizId obrigatório" }, { status: 400 });
        const variants = await listHeadlineVariants(quizId);
        return Response.json({ ok: true, variants });
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
        const quizId = typeof b.quizId === "string" ? b.quizId : "";
        const label = typeof b.label === "string" ? b.label.trim() : "";
        const headline = typeof b.headline === "string" ? b.headline.trim() : "";
        const subheadline = typeof b.subheadline === "string" ? b.subheadline.trim() : "";
        if (!quizId || !headline) {
          return Response.json({ ok: false, error: "quizId e headline são obrigatórios" }, { status: 400 });
        }
        try {
          const variant = await createHeadlineVariant({
            quizId,
            label: label || `Variante ${new Date().toLocaleDateString("pt-BR")}`,
            headline,
            subheadline: subheadline || undefined,
          });
          return Response.json({ ok: true, variant });
        } catch (err) {
          console.error("[api/admin/headline-variants] create failed:", err);
          return Response.json({ ok: false, error: "falha ao criar variante" }, { status: 500 });
        }
      },
    },
  },
});

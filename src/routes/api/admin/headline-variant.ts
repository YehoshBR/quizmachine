// Ações sobre UMA variante de headline, via ?id=<uuid> — mesmo padrão de api/admin/quiz.ts.
import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { updateHeadlineVariant, deleteHeadlineVariant } from "@/lib/db";

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export const Route = createFileRoute("/api/admin/headline-variant")({
  server: {
    handlers: {
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
          const variant = await updateHeadlineVariant(id, {
            label: typeof b.label === "string" ? b.label : undefined,
            headline: typeof b.headline === "string" ? b.headline : undefined,
            subheadline: typeof b.subheadline === "string" ? b.subheadline || null : undefined,
            isPaused: typeof b.isPaused === "boolean" ? b.isPaused : undefined,
          });
          return Response.json({ ok: true, variant });
        } catch (err) {
          console.error("[api/admin/headline-variant] update failed:", err);
          return Response.json({ ok: false, error: "falha ao atualizar" }, { status: 500 });
        }
      },
      DELETE: async ({ request }) => {
        if (!isAuthenticated()) return unauthorized();
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "id obrigatório" }, { status: 400 });
        await deleteHeadlineVariant(id);
        return Response.json({ ok: true });
      },
    },
  },
});

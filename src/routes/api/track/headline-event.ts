import { createFileRoute } from "@tanstack/react-router";
import { insertHeadlineEvent } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/track/headline-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const variantId = typeof b.variantId === "string" && UUID_RE.test(b.variantId) ? b.variantId : null;
        const sessionId = typeof b.sessionId === "string" ? b.sessionId.slice(0, 100) : null;
        const eventType = b.eventType === "view" || b.eventType === "cta_click" ? b.eventType : null;
        if (!variantId || !sessionId || !eventType) return Response.json({ ok: false }, { status: 400 });

        try {
          await insertHeadlineEvent({ variantId, sessionId, eventType });
        } catch (err) {
          console.error("[api/track/headline-event] falha:", err);
        }
        return Response.json({ ok: true });
      },
    },
  },
});

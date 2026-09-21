import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { getHeadlineStats } from "@/lib/db";

export const Route = createFileRoute("/api/admin/headline-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated()) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        const quizId = new URL(request.url).searchParams.get("quizId");
        if (!quizId) return Response.json({ ok: false, error: "quizId obrigatório" }, { status: 400 });
        const stats = await getHeadlineStats(quizId);
        return Response.json({ ok: true, stats });
      },
    },
  },
});

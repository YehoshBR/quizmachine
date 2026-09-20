import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { provisionDomain } from "@/lib/provisioning";

export const Route = createFileRoute("/api/admin/provision-domain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated()) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const domain = (body as Record<string, unknown> | null)?.domain;
        if (typeof domain !== "string" || !domain.trim()) {
          return Response.json({ ok: false, error: "domínio obrigatório" }, { status: 400 });
        }
        const result = await provisionDomain(domain);
        return Response.json(result);
      },
    },
  },
});

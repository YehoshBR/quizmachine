// Upload de imagem pro painel administrativo. Salva em disco (pasta local,
// servida como estático pelo nginx em produção — ver deploy) e registra em
// media_assets. Sem dependência de S3/Supabase Storage — fica tudo na VPS.
import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAuthenticated } from "@/lib/auth-internal";
import { insertMediaAsset } from "@/lib/db";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), "uploads");
const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

export const Route = createFileRoute("/api/admin/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated()) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ ok: false, error: "invalid_form" }, { status: 400 });
        }

        const file = form.get("file");
        const quizId = form.get("quizId");
        if (!(file instanceof File)) {
          return Response.json({ ok: false, error: "arquivo ausente" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.has(file.type)) {
          return Response.json({ ok: false, error: `tipo não permitido: ${file.type}` }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ ok: false, error: "arquivo maior que 15MB" }, { status: 400 });
        }

        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const filename = `${randomUUID()}.${ext}`;
        await mkdir(UPLOADS_DIR, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(UPLOADS_DIR, filename), buffer);

        const url = `/uploads/${filename}`;
        try {
          await insertMediaAsset({
            quizId: typeof quizId === "string" && quizId ? quizId : null,
            url,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          });
        } catch (err) {
          console.error("[api/admin/upload] falha ao registrar media_asset (arquivo já foi salvo):", err);
        }

        return Response.json({ ok: true, url, filename: file.name });
      },
    },
  },
});

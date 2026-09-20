// Rota de bootstrap: importa o conteúdo estático de quiz-config.ts (o quiz
// DIGITAL START que já existia antes da migração pro banco) pra dentro da
// tabela `quizzes`, publicado no domínio informado. Uso único/manual — chame
// autenticado uma vez por ambiente novo, não faz parte do fluxo normal do
// painel depois disso.
import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { createQuiz, updateQuiz, listQuizzes } from "@/lib/db";
import { quizMeta, screens, scoringMap } from "@/lib/quiz-config";

export const Route = createFileRoute("/api/admin/seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated()) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          /* corpo vazio é aceitável */
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const domain = typeof b.domain === "string" && b.domain ? b.domain : "quiz.joemello.pro";
        const slug = typeof b.slug === "string" && b.slug ? b.slug : "digital-start";

        const existing = (await listQuizzes()).find((q) => q.slug === slug);
        if (existing) {
          const quiz = await updateQuiz(existing.id, {
            domain,
            status: "published",
            quizMeta,
            screens,
            scoringMap,
          });
          return Response.json({ ok: true, quiz, action: "updated" });
        }

        const quiz = await createQuiz({
          slug,
          name: quizMeta.productName ?? slug,
          tier: "longo",
          quizMeta,
          screens,
          scoringMap,
        });
        const published = await updateQuiz(quiz.id, { domain, status: "published" });
        return Response.json({ ok: true, quiz: published, action: "created" });
      },
    },
  },
});

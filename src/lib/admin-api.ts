// Server functions usadas pelos loaders das telas /admin/* — fina camada
// sobre db.ts que também checa autenticação antes de responder.
//
// IMPORTANTE: este arquivo é importado por rotas de PÁGINA (client-bundled),
// então só pode importar outras server functions (createServerFn) pra checar
// auth — nunca auth-internal.ts direto (usa node:crypto, quebra o build do
// cliente). Ver auth.ts para o porquê.
import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { checkAuth } from "./auth";
import { listQuizzes, getQuizById, type QuizRow } from "./db";

async function requireAuthOrRedirect() {
  const { authenticated } = await checkAuth();
  if (!authenticated) {
    throw redirect({ to: "/admin/login" });
  }
}

export const listQuizzesForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuizRow[]> => {
    await requireAuthOrRedirect();
    return listQuizzes();
  }
);

export const getQuizForAdmin = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    if (!data || typeof (data as { id?: unknown }).id !== "string") throw new Error("id obrigatório");
    return data as { id: string };
  })
  .handler(async ({ data }): Promise<QuizRow | null> => {
    await requireAuthOrRedirect();
    return getQuizById(data.id);
  });

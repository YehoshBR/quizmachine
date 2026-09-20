// ============================================================
// db.ts — conexão Postgres da plataforma (server-only)
// ============================================================
// Nunca importe este arquivo de um componente cliente — só de rotas de
// servidor (`server: { handlers }`) ou server functions (`createServerFn`).
// A pool é criada uma única vez e reaproveitada entre requisições.
// ============================================================
import { Pool } from "pg";
import type { QuizMeta, Screen } from "./quiz-config";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

export type QuizRow = {
  id: string;
  slug: string;
  domain: string | null;
  name: string;
  tier: "curto" | "medio" | "longo";
  status: "draft" | "published";
  quiz_meta: QuizMeta;
  screens: Screen[];
  scoring_map: Record<string, Record<string, number>>;
  created_at: string;
  updated_at: string;
};

/** Busca o quiz publicado pra um domínio. Retorna null se não achar ou se o DB estiver fora do ar. */
export async function getQuizByDomain(domain: string): Promise<QuizRow | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query<QuizRow>(
    `select * from quizzes where domain = $1 and status = 'published' limit 1`,
    [domain]
  );
  return rows[0] ?? null;
}

export async function getQuizById(id: string): Promise<QuizRow | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query<QuizRow>(`select * from quizzes where id = $1 limit 1`, [id]);
  return rows[0] ?? null;
}

export async function listQuizzes(): Promise<QuizRow[]> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query<QuizRow>(`select * from quizzes order by updated_at desc`);
  return rows;
}

export async function createQuiz(input: {
  slug: string;
  name: string;
  tier: "curto" | "medio" | "longo";
  quizMeta: QuizMeta;
  screens: Screen[];
  scoringMap: Record<string, Record<string, number>>;
}): Promise<QuizRow> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  const { rows } = await db.query<QuizRow>(
    `insert into quizzes (slug, name, tier, quiz_meta, screens, scoring_map)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [
      input.slug,
      input.name,
      input.tier,
      JSON.stringify(input.quizMeta),
      JSON.stringify(input.screens),
      JSON.stringify(input.scoringMap),
    ]
  );
  return rows[0];
}

export async function updateQuiz(
  id: string,
  patch: Partial<{
    name: string;
    domain: string | null;
    tier: "curto" | "medio" | "longo";
    status: "draft" | "published";
    quizMeta: QuizMeta;
    screens: Screen[];
    scoringMap: Record<string, Record<string, number>>;
  }>
): Promise<QuizRow> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const map: Record<string, unknown> = {
    name: patch.name,
    domain: patch.domain,
    tier: patch.tier,
    status: patch.status,
    quiz_meta: patch.quizMeta !== undefined ? JSON.stringify(patch.quizMeta) : undefined,
    screens: patch.screens !== undefined ? JSON.stringify(patch.screens) : undefined,
    scoring_map: patch.scoringMap !== undefined ? JSON.stringify(patch.scoringMap) : undefined,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    fields.push(`${col} = $${i}`);
    values.push(val);
    i++;
  }
  fields.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await db.query<QuizRow>(
    `update quizzes set ${fields.join(", ")} where id = $${i} returning *`,
    values
  );
  return rows[0];
}

export async function deleteQuiz(id: string): Promise<void> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  await db.query(`delete from quizzes where id = $1`, [id]);
}

export async function insertLead(input: {
  quizId: string | null;
  name?: string;
  email?: string;
  whatsapp?: string;
  answers: Record<string, unknown>;
  utm?: Record<string, unknown>;
}): Promise<void> {
  const db = getPool();
  if (!db) return; // sem DB configurado: não quebra o funil, só não salva
  await db.query(
    `insert into leads (quiz_id, name, email, whatsapp, answers, utm) values ($1,$2,$3,$4,$5,$6)`,
    [
      input.quizId,
      input.name ?? null,
      input.email ?? null,
      input.whatsapp ?? null,
      JSON.stringify(input.answers),
      JSON.stringify(input.utm ?? {}),
    ]
  );
}

export async function insertMediaAsset(input: {
  quizId: string | null;
  url: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `insert into media_assets (quiz_id, url, filename, content_type, size_bytes) values ($1,$2,$3,$4,$5)`,
    [input.quizId, input.url, input.filename, input.contentType ?? null, input.sizeBytes ?? null]
  );
}

export async function listMediaAssets(quizId: string): Promise<
  { id: string; url: string; filename: string; created_at: string }[]
> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query(
    `select id, url, filename, created_at from media_assets where quiz_id = $1 order by created_at desc`,
    [quizId]
  );
  return rows;
}

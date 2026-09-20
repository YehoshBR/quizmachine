-- ============================================================
-- QUIZ PLATFORM — schema Postgres
-- ============================================================
-- Roda num Postgres próprio (Docker na VPS, ver /opt/quiz-platform).
-- Aplicar com: psql "$DATABASE_URL" -f db/schema.sql  (idempotente)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- QUIZZES ----------
-- Cada linha é um quiz completo: meta + telas + tema, tudo em jsonb pra
-- não precisar migration toda vez que o schema de tela muda.
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  domain text unique,                 -- ex: "quiz.joemello.pro" — null = ainda não publicado
  name text not null,                 -- nome interno (não aparece pro visitante)
  tier text not null default 'longo' check (tier in ('curto', 'medio', 'longo')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  quiz_meta jsonb not null default '{}'::jsonb,   -- QuizMeta (title, logo, leadFields, offerUrl...)
  screens jsonb not null default '[]'::jsonb,     -- Screen[]
  scoring_map jsonb not null default '{}'::jsonb, -- Record<string, Record<string, number>>
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_quizzes_domain on quizzes(domain);

-- ---------- LEADS ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  name text,
  email text,
  whatsapp text,
  answers jsonb not null default '{}'::jsonb,
  utm jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_leads_quiz_id on leads(quiz_id);
create index if not exists idx_leads_created_at on leads(created_at desc);

-- ---------- MEDIA (biblioteca de upload do painel) ----------
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  url text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Tabelas abaixo: schema pronto pra quando o agente de monitoramento e o
-- teste A/B de headline forem incorporados (fase futura, combinada com o
-- usuário em set/2026). Nenhuma UI/lógica usa isso ainda — só a captura
-- básica de eventos já fica escrita, pra não perder dado histórico
-- enquanto o resto não é construído.
-- ============================================================

-- ---------- HEADLINE A/B ----------
create table if not exists headline_variants (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  label text not null,
  headline text not null,
  subheadline text,
  is_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_headline_variants_quiz_id on headline_variants(quiz_id);

create table if not exists headline_events (
  id bigserial primary key,
  variant_id uuid references headline_variants(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'cta_click')),
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_headline_events_variant_id on headline_events(variant_id);
create index if not exists idx_headline_events_created_at on headline_events(created_at desc);

-- ---------- ANALYTICS / SESSÕES (base pro heatmap e pro agente) ----------
create table if not exists quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  session_id text not null,
  device_type text,
  user_agent text,
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  variant_id uuid references headline_variants(id),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_quiz_sessions_session_id on quiz_sessions(quiz_id, session_id);

-- Evento genérico: view de tela, clique, tempo na tela, scroll depth — tudo
-- numa tabela só (differenciado por event_type), pra não crescer o schema
-- toda vez que o agente quiser medir uma coisa nova.
create table if not exists quiz_events (
  id bigserial primary key,
  quiz_id uuid references quizzes(id) on delete cascade,
  session_id text not null,
  screen_id text,
  step_index integer,
  event_type text not null, -- 'screen_view' | 'click' | 'screen_time' | 'scroll_depth' | ...
  data jsonb not null default '{}'::jsonb, -- payload livre (x/y relativo, duration_ms, max_scroll_pct, ...)
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_events_quiz_id on quiz_events(quiz_id);
create index if not exists idx_quiz_events_screen_id on quiz_events(quiz_id, screen_id);
create index if not exists idx_quiz_events_created_at on quiz_events(created_at desc);

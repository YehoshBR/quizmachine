import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { getQuizForAdmin } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/quizzes/$quizId")({
  loader: ({ params }) => getQuizForAdmin({ data: { id: params.quizId } }),
  head: () => ({ meta: [{ title: "Painel — Editar quiz" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: EditQuizPage,
});

const TIER_OPTIONS: { value: "curto" | "medio" | "longo"; label: string }[] = [
  { value: "curto", label: "Curto — produto R$17-19,90" },
  { value: "medio", label: "Médio — produto R$27-37" },
  { value: "longo", label: "Longo — produto R$47-67 (até 70 perguntas)" },
];

function EditQuizPage() {
  const quiz = Route.useLoaderData();
  const { quizId } = Route.useParams();

  if (!quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Quiz não encontrado. <Link to="/admin" className="text-primary underline">Voltar</Link></p>
      </div>
    );
  }

  const [name, setName] = useState(quiz.name);
  const [domain, setDomain] = useState(quiz.domain ?? "");
  const [tier, setTier] = useState(quiz.tier);
  const [status, setStatus] = useState(quiz.status);
  const [quizMetaText, setQuizMetaText] = useState(() => JSON.stringify(quiz.quiz_meta, null, 2));
  const [screensText, setScreensText] = useState(() => JSON.stringify(quiz.screens, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState<{ url: string; filename: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setJsonError(null);
    let quizMetaParsed: unknown;
    let screensParsed: unknown;
    try {
      quizMetaParsed = JSON.parse(quizMetaText);
    } catch {
      setJsonError("quizMeta não é um JSON válido.");
      return;
    }
    try {
      screensParsed = JSON.parse(screensText);
    } catch {
      setJsonError("screens não é um JSON válido.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quiz?id=${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain: domain || null,
          tier,
          status,
          quizMeta: quizMetaParsed,
          screens: screensParsed,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setJsonError(json.error ?? "falha ao salvar");
      } else {
        setSavedAt(new Date());
      }
    } catch {
      setJsonError("falha ao salvar (rede)");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("quizId", quizId);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (json.ok) {
        setMedia((m) => [{ url: json.url, filename: json.filename }, ...m]);
      } else {
        alert(json.error ?? "falha no upload");
      }
    } catch {
      alert("falha no upload (rede)");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <Link to="/admin" className="text-xs text-muted-foreground hover:underline">
              ← Todos os quizzes
            </Link>
            <h1 className="text-xl font-bold text-foreground">{name || "Quiz sem nome"}</h1>
          </div>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Ver ao vivo ↗
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {/* ---------- Configurações gerais ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Configurações</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome interno</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Domínio publicado</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="quiz.seudominio.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nível</Label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as typeof tier)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Rascunho (não aparece no domínio)</option>
                <option value="published">Publicado</option>
              </select>
            </div>
          </div>
        </section>

        {/* ---------- Mídia ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Imagens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie uma imagem, copie a URL gerada e cole no campo certo do JSON abaixo (ex: em{" "}
            <code className="rounded bg-muted px-1">logo</code>, <code className="rounded bg-muted px-1">image</code> de
            uma tela, ou <code className="rounded bg-muted px-1">expertImage</code>).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="mt-3 text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
            disabled={uploading}
          />
          {uploading && <p className="mt-2 text-xs text-muted-foreground">Enviando...</p>}
          {media.length > 0 && (
            <ul className="mt-4 space-y-2">
              {media.map((m) => (
                <li key={m.url} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <img src={m.url} alt={m.filename} className="h-12 w-12 rounded object-cover" />
                  <code className="flex-1 truncate text-xs">{m.url}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(m.url)}>
                    Copiar URL
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- quizMeta ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Meta do quiz (título, logo, cores, formulário de lead...)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Campos úteis: <code className="rounded bg-muted px-1">title</code>,{" "}
            <code className="rounded bg-muted px-1">logo</code>,{" "}
            <code className="rounded bg-muted px-1">primaryColor</code> /{" "}
            <code className="rounded bg-muted px-1">secondaryColor</code> (qualquer cor CSS: #hex, oklch(...)),{" "}
            <code className="rounded bg-muted px-1">expertName</code>,{" "}
            <code className="rounded bg-muted px-1">offerUrl</code>.
          </p>
          <textarea
            value={quizMetaText}
            onChange={(e) => setQuizMetaText(e.target.value)}
            spellCheck={false}
            className="mt-3 h-64 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"
          />
        </section>

        {/* ---------- screens ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Telas do quiz (narrativa, perguntas, depoimentos)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Array de telas, na ordem em que aparecem. Cole as URLs de imagem da seção acima nos campos{" "}
            <code className="rounded bg-muted px-1">image</code>. Vídeo é sempre pelo ID do YouTube em{" "}
            <code className="rounded bg-muted px-1">video.youtubeId</code>.
          </p>
          <textarea
            value={screensText}
            onChange={(e) => setScreensText(e.target.value)}
            spellCheck={false}
            className="mt-3 h-[32rem] w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"
          />
        </section>

        {jsonError && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {jsonError}
          </p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {savedAt && (
            <span className="text-xs text-muted-foreground">Salvo às {savedAt.toLocaleTimeString("pt-BR")}</span>
          )}
          <Button onClick={handleSave} disabled={saving} className="ml-auto h-11 px-8 font-bold">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

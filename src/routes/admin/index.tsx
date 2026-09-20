import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { listQuizzesForAdmin } from "@/lib/admin-api";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/")({
  loader: () => listQuizzesForAdmin(),
  head: () => ({ meta: [{ title: "Painel — Quizzes" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminDashboard,
});

const TIER_LABEL: Record<string, string> = {
  curto: "Curto (R$17-19,90)",
  medio: "Médio (R$27-37)",
  longo: "Longo (R$47-67, até 70 perguntas)",
};

function AdminDashboard() {
  const quizzes = Route.useLoaderData();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleLogout() {
    await logout();
    router.navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">Painel do Quiz</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Seus quizzes</h2>
          <Button onClick={() => setCreating(true)}>+ Novo quiz</Button>
        </div>

        <div className="mt-6 grid gap-4">
          {quizzes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum quiz ainda. Crie o primeiro acima.</p>
          )}
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{q.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      q.status === "published"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q.status === "published" ? "publicado" : "rascunho"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {TIER_LABEL[q.tier] ?? q.tier} · slug: {q.slug}
                  {q.domain ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={`https://${q.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {q.domain} ↗
                      </a>
                    </>
                  ) : (
                    " · sem domínio ainda"
                  )}
                </p>
              </div>
              <Link
                to="/admin/quizzes/$quizId"
                params={{ quizId: q.id }}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Editar →
              </Link>
            </div>
          ))}
        </div>
      </main>

      {creating && <CreateQuizModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateQuizModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tier, setTier] = useState<"curto" | "medio" | "longo">("longo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, tier }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "falha ao criar");
        setSaving(false);
        return;
      }
      onClose();
      router.navigate({ to: "/admin/quizzes/$quizId", params: { quizId: json.quiz.id } });
    } catch {
      setError("falha ao criar");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <h3 className="text-lg font-bold text-foreground">Novo quiz</h3>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Nome interno</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cabana Marcelo" className="mt-1" />
          </div>
          <div>
            <Label>Slug (sem espaço, só letras/números/hífen)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="cabana-marcelo"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Nível (define a faixa de perguntas recomendada)</Label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as typeof tier)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="curto">Curto — produto R$17-19,90</option>
              <option value="medio">Médio — produto R$27-37</option>
              <option value="longo">Longo — produto R$47-67 (até 70 perguntas)</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name || !slug}>
            {saving ? "Criando..." : "Criar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

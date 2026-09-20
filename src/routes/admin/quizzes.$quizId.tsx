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

  // Produto — sempre o mesmo produto por quiz, separado do resto do quizMeta
  // porque é a informação que mais muda de importância (é o que a oferta
  // personalizada usa pra montar o pitch). Ver src/routes/oferta.tsx.
  const initialProduct = quiz.quiz_meta.product;
  const [productName, setProductName] = useState(initialProduct?.name ?? "");
  const [productPromise, setProductPromise] = useState(initialProduct?.promise ?? "");
  const [productPrice, setProductPrice] = useState(initialProduct?.price ?? "");
  const [productOriginalPrice, setProductOriginalPrice] = useState(initialProduct?.originalPrice ?? "");
  const [productInstallments, setProductInstallments] = useState(initialProduct?.installments ?? "");
  const [productCheckoutUrl, setProductCheckoutUrl] = useState(initialProduct?.checkoutUrl ?? "");
  const [productBenefitsText, setProductBenefitsText] = useState(
    (initialProduct?.benefits ?? []).join("\n")
  );
  const [productGuarantee, setProductGuarantee] = useState(initialProduct?.guarantee ?? "");

  // Aparência — separado do JSON também, porque é a queixa nº1 de "ficou
  // genérico": sem isso só dava pra trocar a cor de destaque via JSON cru,
  // nunca o modo claro/escuro. Ver src/routes/__root.tsx (buildThemeCss).
  const [backgroundMode, setBackgroundMode] = useState<"light" | "dark">(
    quiz.quiz_meta.backgroundMode ?? "light"
  );
  const [primaryColor, setPrimaryColor] = useState(quiz.quiz_meta.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(quiz.quiz_meta.secondaryColor ?? "");

  const [quizMetaText, setQuizMetaText] = useState(() => {
    const { product: _p, backgroundMode: _bg, primaryColor: _pc, secondaryColor: _sc, ...rest } =
      quiz.quiz_meta as unknown as Record<string, unknown>;
    return JSON.stringify(rest, null, 2);
  });
  const [screensText, setScreensText] = useState(() => JSON.stringify(quiz.screens, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState<{ url: string; filename: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setJsonError(null);
    let quizMetaParsed: Record<string, unknown>;
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

    // Reincorpora o produto (campos estruturados) dentro do quizMeta antes de salvar.
    const benefits = productBenefitsText.split("\n").map((b) => b.trim()).filter(Boolean);
    if (productName || productPrice || productCheckoutUrl) {
      quizMetaParsed.product = {
        name: productName,
        promise: productPromise,
        price: productPrice,
        ...(productOriginalPrice ? { originalPrice: productOriginalPrice } : {}),
        ...(productInstallments ? { installments: productInstallments } : {}),
        checkoutUrl: productCheckoutUrl,
        benefits,
        ...(productGuarantee ? { guarantee: productGuarantee } : {}),
      };
    }

    // Reincorpora a aparência.
    quizMetaParsed.backgroundMode = backgroundMode;
    if (primaryColor) quizMetaParsed.primaryColor = primaryColor;
    else delete quizMetaParsed.primaryColor;
    if (secondaryColor) quizMetaParsed.secondaryColor = secondaryColor;
    else delete quizMetaParsed.secondaryColor;

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

        {/* ---------- Aparência ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Aparência</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            "Escuro" troca fundo/cards pra uma base preta/carvão antes de aplicar as cores abaixo —
            use pra quiz com logo em fundo preto/neon (fica mais parecido com o padrão QBC/Governo
            Mental). As cores aceitam qualquer valor CSS (o seletor abaixo salva em hex).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Modo de fundo</Label>
              <select
                value={backgroundMode}
                onChange={(e) => setBackgroundMode(e.target.value as "light" | "dark")}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
            <div>
              <Label>Cor primária</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#5B8DEF"}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 shrink-0 rounded border border-input bg-background"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#5B8DEF ou oklch(...)" />
              </div>
            </div>
            <div>
              <Label>Cor secundária</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(secondaryColor) ? secondaryColor : "#8B5CF6"}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-12 shrink-0 rounded border border-input bg-background"
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#8B5CF6 ou oklch(...)" />
              </div>
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

        {/* ---------- Produto (sempre o mesmo, usado na /oferta personalizada) ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Produto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O produto é sempre o mesmo, independente da resposta — só a ênfase da oferta muda
            conforme a dor/desejo dominante do visitante (configurado em "Telas", campo{" "}
            <code className="rounded bg-muted px-1">signals</code> de cada opção). Preencha aqui uma
            vez; a página <code className="rounded bg-muted px-1">/oferta</code> usa isso pra montar
            o pitch sozinha, sem precisar editar JSX.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome do produto</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Link de checkout</Label>
              <Input value={productCheckoutUrl} onChange={(e) => setProductCheckoutUrl(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Promessa central (usada quando não há dor/desejo detectado)</Label>
              <Input value={productPromise} onChange={(e) => setProductPromise(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Preço</Label>
              <Input value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="R$ 47,00" className="mt-1" />
            </div>
            <div>
              <Label>Preço original (ancoragem, opcional)</Label>
              <Input value={productOriginalPrice} onChange={(e) => setProductOriginalPrice(e.target.value)} placeholder="R$ 997,00" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Parcelamento (opcional)</Label>
              <Input value={productInstallments} onChange={(e) => setProductInstallments(e.target.value)} placeholder="ou 12x de R$ 4,08" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Benefícios / o que o cliente recebe (um por linha)</Label>
              <textarea
                value={productBenefitsText}
                onChange={(e) => setProductBenefitsText(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Garantia (opcional)</Label>
              <Input value={productGuarantee} onChange={(e) => setProductGuarantee(e.target.value)} placeholder="Garantia incondicional de 7 dias" className="mt-1" />
            </div>
          </div>
        </section>

        {/* ---------- quizMeta ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Meta do quiz (título, logo, cores, formulário de lead, biblioteca de sinais...)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Campos úteis: <code className="rounded bg-muted px-1">title</code>,{" "}
            <code className="rounded bg-muted px-1">logo</code>,{" "}
            <code className="rounded bg-muted px-1">primaryColor</code> /{" "}
            <code className="rounded bg-muted px-1">secondaryColor</code> (qualquer cor CSS: #hex, oklch(...)),{" "}
            <code className="rounded bg-muted px-1">expertName</code>,{" "}
            <code className="rounded bg-muted px-1">offerUrl</code>. O campo{" "}
            <code className="rounded bg-muted px-1">signalLibrary</code> é a biblioteca de dores/desejos
            que a oferta personalizada usa — cada chave precisa de <code className="rounded bg-muted px-1">label</code>,{" "}
            <code className="rounded bg-muted px-1">kind</code> (<code className="rounded bg-muted px-1">"pain"</code> ou{" "}
            <code className="rounded bg-muted px-1">"desire"</code>), <code className="rounded bg-muted px-1">headline</code> e{" "}
            <code className="rounded bg-muted px-1">body</code>. O produto ficou na seção acima.
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
            <code className="rounded bg-muted px-1">video.youtubeId</code>. Pra oferta personalizada:
            marque em <code className="rounded bg-muted px-1">signals</code> de cada opção quais chaves
            do <code className="rounded bg-muted px-1">signalLibrary</code> ela sinaliza — ex:{" "}
            <code className="rounded bg-muted px-1">"signals": ["pain_camera"]</code>.
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

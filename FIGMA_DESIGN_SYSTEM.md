# Regras de design para integrar o Figma (MCP)

Regras para transformar telas do Figma em código neste projeto (e o caminho inverso).
Vale para o quiz-machine e para as peças do **O Caminho do Mentor** (`C:\Users\User\caminho-do-mentor`).

> Conta Figma conectada: JOE MELLO (`team::1578476879551022161`, plano starter, assento **View**).
> Assento View lê arquivos e exporta, mas pode bloquear edição/criação de arquivos de design
> com `use_figma`/`create_new_file`. Se uma escrita falhar por permissão, é isso.

---

## 1. Tokens de design

**Onde:** `src/styles.css` (base) + override por tenant em `src/routes/__root.tsx` (`buildThemeCss`).

- Formato: variáveis CSS em `:root` (oklch ou qualquer cor CSS), expostas ao Tailwind v4 via `@theme inline`
  como `--color-*`. Não há pipeline de transformação de tokens (sem Style Dictionary).
- Cada quiz NÃO edita o CSS: as cores vêm do `quizMeta` (banco/painel) e são injetadas no `<head>`:

```ts
// src/routes/__root.tsx
if (quizMeta.backgroundMode === "dark") tokens.push("--background:oklch(0.09 0 0)", "--card:oklch(0.15 0.003 264)", ...);
if (quizMeta.primaryColor) tokens.push(`--primary:${quizMeta.primaryColor}`, `--ring:${quizMeta.primaryColor}`);
if (quizMeta.secondaryColor) tokens.push(`--secondary:${quizMeta.secondaryColor}`);
```

**Tokens disponíveis** (use as classes do Tailwind, nunca hex solto):
`background, foreground, card, card-foreground, primary, primary-foreground, secondary,
secondary-foreground, muted, muted-foreground, accent, accent-foreground, destructive, border, input, ring`
→ `bg-primary`, `text-muted-foreground`, `border-primary/70`, `bg-primary/8` etc.

**Raio:** `--radius: 0.875rem` → `rounded-sm|md|lg|xl|2xl` derivados.

**Tipografia:** `--font-display: Sora` (títulos, `h1–h3` automático, 600/700/800) e
`--font-body: Inter` (400–700). Carregadas do Google Fonts no topo do `styles.css`.

### Identidade O Caminho do Mentor (tenant `diagnostico.joemello.pro`)
| Papel | Valor |
|---|---|
| Fundo | modo `dark` (≈ `#050505` nas peças estáticas) |
| Primária (dourado) | `#D6B36A` |
| Secundária (dourado claro) | `#F1D79A` |
| Texto claro / off-white | `#F5F2EA` |

Definido em `caminho-do-mentor/05_producao/Q01_diagnostico_caminho_do_mentor/gerar_quiz.py`
(`backgroundMode`, `primaryColor`, `secondaryColor`). **Ao trazer cor do Figma para o quiz, mapeie
para `primary`/`secondary` — não crie cor nova no componente.**

## 2. Componentes

| Arquivo | Papel |
|---|---|
| `src/components/ui/button.tsx` | Botão shadcn (cva). `variant="default"` = `.btn-vivid` (gradiente primary→secondary com brilho) |
| `src/components/ui/input.tsx`, `label.tsx` | Campos shadcn |
| `src/components/QuizCard.tsx` | `OptionCard` + `OptionLabel` (opções de resposta, estado `selected`) |
| `src/components/QuizLayout.tsx` | Cabeçalho com logo (pílula preta), voltar, barra de progresso `from-primary to-secondary`, `max-w-2xl` |
| `src/components/ThemedLoader.tsx` | Telas de carregamento animadas |
| `src/components/DiagnosticSalesPage.tsx` | Página de diagnóstico high ticket (`quizMeta.salesPage`) |
| `src/components/YoutubeFacade.tsx` | Vídeo leve (carrega o iframe só no clique) |

- Arquitetura: componentes funcionais React 19, `cn()` (`src/lib/utils.ts`, clsx + tailwind-merge), variantes com `class-variance-authority`.
- Sem Storybook. Documentação = comentários no topo de cada arquivo + `CLAUDE.md`.
- **Conteúdo não vai em componente:** textos, telas e ofertas vêm de `quiz-config.ts` (tipos) e do JSON
  no banco. Um design novo do Figma vira **tipo de tela/config**, não texto fixo no TSX.
- Destaque de texto: `*texto*` → negrito na cor primária (`rich()` / `emphasize()`); `<hl>` nas perguntas.

```tsx
<OptionCard selected={sel} onClick={pick}><OptionLabel selected={sel}>🙋 Sozinho(a)</OptionLabel></OptionCard>
<Button size="lg" className="w-full h-14 text-base font-bold">Ver meu diagnóstico</Button>
```

## 3. Frameworks e build

- React 19 + **TanStack Start/Router** (rotas por arquivo em `src/routes/`, `routeTree.gen.ts` gerado).
- **Tailwind CSS v4** (`@import "tailwindcss"`, sem `tailwind.config`), `tw-animate-css`, Radix (Slot, Label), sonner.
- Vite 7 via `@lovable.dev/vite-tanstack-config` + Nitro. Produção: `npm run build:node` (preset node-server) na VPS.
- Postgres (`pg`) para quizzes/leads; multi-tenant por domínio (`src/lib/tenant.ts`).

## 4. Assets

- `src/assets/` (importados no código: `homem.jpg`, `mulher.jpg`, `logo.png`) e `public/` (`logo.svg`, fallback do logo).
- Logos e imagens **por quiz** são URLs absolutas no config (ex.: `https://mentoria.joemello.pro/...`),
  servidas pelo nginx da VPS. Sem CDN nem otimização automática: exporte do Figma já no tamanho
  final (PNG/JPG; WebP quando possível) e comprimido.
- Peças da marca: `caminho-do-mentor/01_minha_mentoria/identidade/` (logo, `checkout/` banners e fundos
  desktop 1920×1080 / mobile 1080×10800, `produtos/` logos de cada oferta).
- Imagens do Figma: `download_assets` / `get_screenshot` → salvar no destino certo acima (as URLs do MCP expiram).

## 5. Ícones

- Não há biblioteca de ícones em uso nas telas: as opções usam **emoji** no início do label
  (`"🙋 Sozinho(a)"`). `lucide-react` está instalado e pode ser usado (`import { Check } from "lucide-react"`, `className="size-4"`).
- Ícone vetorial vindo do Figma: preferir equivalente do lucide; se for marca/logo, exportar SVG para `public/`.

## 6. Estilo

- Utilitários Tailwind direto no JSX; classes globais só em `styles.css` (`.btn-vivid`). Sem CSS Modules/styled-components.
- Base global: `body` usa `--font-body`; `h1–h3` usam `--font-display` com `letter-spacing: -0.01em`.
- **Mobile primeiro**: coluna única `max-w-2xl mx-auto px-4`; o tráfego vem do Instagram (celular).
  Breakpoints Tailwind (`sm:`, `md:`) só para ampliar. Testar em iPhone (WebKit) — fundo `fixed` não funciona no iOS.
- `<html class="dark">` sempre; o modo claro/escuro real é decidido pelos tokens do tenant.

## 7. Estrutura

```
quiz-machine/
  src/routes/        index.tsx (quiz), oferta.tsx (oferta/diagnóstico), admin/ (painel), api/ (leads, etc.)
  src/components/    componentes visuais (ver §2)
  src/lib/           quiz-config.ts (tipos + quiz padrão), signals.ts (nível/sinais), db.ts, tenant.ts, tracking.ts
  src/styles.css     tokens + .btn-vivid
caminho-do-mentor/
  05_producao/Q01_*/ gerar_quiz.py + pagina_diagnostico.py → JSON do quiz (publicar_banco.sh)
  04_ferramentas/    carrossel/gerar_carrossel.py (1080×1350, Inter, preto/off-white/dourado), checkout/, imagens/
```

## Fluxo Figma → código (resumo)

1. `get_design_context` (carregar antes a skill `figma-design-to-code`) + `get_screenshot` da tela.
2. Traduzir cores para tokens (`primary`, `secondary`, `muted`…), fontes para `font-display`/`font-body`.
3. Reaproveitar `Button`, `OptionCard`, `QuizLayout`; nada de componente novo se um existente serve.
4. Texto do design → `gerar_quiz.py` / `pagina_diagnostico.py`, não no TSX.
5. Validar no celular (Playwright WebKit, `iPhone 13`) antes do deploy.

**Carrosséis:** o Figma serve de referência visual; quem gera os slides é `gerar_carrossel.py`
(medir margens, tamanhos e cores no Figma e refletir no script/tema).

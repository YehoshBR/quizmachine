# Quiz Machine — Manual do Operador

## O que é este projeto

Motor de quiz funil de vendas com estética idêntica ao SoulBicho. O **único arquivo que muda** para criar um novo quiz é `src/lib/quiz-config.ts`. Nunca modifique outros arquivos para trocar conteúdo.

---

## PROTOCOLO: Como gerar um novo quiz

Quando o usuário enviar perguntas para montar um quiz, siga este protocolo **sempre, sem exceção**:

### Etapa 1 — Coletar contexto (perguntar antes de gerar)

Antes de tocar no código, colete:

1. **Nicho e produto** — "Qual é o nicho, o nome do expert e o nome do produto/método?"
2. **Avatar** — "Quem é o avatar? (ex: mulher 30-45, dona de casa, empreendedor iniciante)"
3. **Páginas de oferta (LPs)** — "Quantas páginas de oferta você precisa? (1 = todos vão para o mesmo lugar; 2+ = segmentado por resposta)"
4. **Cor primária** — "Qual é a cor principal? (ex: #7C3AED, #2563EB, #16A34A)" — se não souber, use `oklch(0.45 0.18 250)` (azul SoulBicho)
5. **Logo** — "Qual o nome do arquivo do logo?" — se não tiver, use `logo.png` como placeholder

### Etapa 2 — Analisar o formato das perguntas

As perguntas chegam em formato livre. Podem vir como texto corrido, lista numerada, JSON, ou output direto da skill. Leia e identifique:
- O tipo de cada tela (ver tabela de mapeamento abaixo)
- A sequência lógica do funil
- Onde há transições narrativas (conteúdo informativo entre perguntas)

### Etapa 3 — Estrutura obrigatória (NUNCA alterar)

**Toda estrutura de quiz segue esta ordem:**

```
[0] intro        ← Headline + 1ª pergunta embutida (gênero/perfil, COM imagens)
[1] single       ← 2ª pergunta (idade/fase, COM imagens se possível)  
[2..N-4] ...     ← Perguntas do funil (single, scale, content, social-proof)
[N-3] diagnosis  ← Diagnóstico animado (nível/score)
[N-2] compare    ← Comparação Antes x Depois
[N-1] lead       ← Formulário de captação (nome + WhatsApp + campo personalizado)
[N]   loading    ← Loading de análise (vai para /oferta automaticamente)
```

**Regras fixas:**
- A tela 0 (`intro`) SEMPRE embute a 1ª pergunta de seleção (gênero/perfil) com imagens
- A tela 1 SEMPRE é seleção de idade ou fase de vida, com imagens quando possível
- **Nunca use múltipla escolha.** Multi-select confunde o usuário sobre quando avançar e trava o funil.
  Se o conteúdo original pedir "selecione tudo que se aplica", **divida em várias telas `single`
  sequenciais** (uma pergunta por atributo/sintoma), cada uma avançando sozinha ao clicar.
- Toda tela `single` avança sozinha ao clicar — nunca tem botão "Continuar". Mantenha no máximo
  ~6 opções sem imagem (ou ~4 com imagem) por tela: o objetivo é o usuário nunca precisar rolar
  a tela pra conseguir ver e tocar numa opção.
- `mirror-chart` aparece 2-3 telas ANTES do diagnóstico (se existir)
- `testimonials` aparecem ANTES do compare ou do diagnóstico
- `social-proof` a cada 4-6 perguntas, nunca logo após formulário — o usuário vai fornecer prints
  e vídeos reais depois; enquanto isso, use `image`/`whatsapp`/`video` como placeholder com TODO
- `lead` é SEMPRE penúltima tela (antes do loading final)
- `loading` é SEMPRE a última tela, com duração 4000ms

### Etapa 4 — Mapeamento de tipos de tela

| Conteúdo recebido | Tipo no quiz-config |
|---|---|
| Headline + 1ª pergunta com fotos de homem/mulher | `intro` |
| Pergunta com 2-6 opções, avança sozinha | `single` |
| "Selecione tudo que se aplica" / vários itens | **dividir em várias `single`** (uma por item) |
| "Avalie o quanto concorda" / frases para avaliar | `scale` |
| Dado de pesquisa / insight / bloco informativo | `content` |
| Depoimento / print de WhatsApp / número impactante | `social-proof` |
| "Preparando seu plano..." / análise progressiva | `loading` |
| Gráfico de nível / score animado | `diagnosis` |
| Comparação antes x depois / com ração x natural | `compare` |
| Bloco de depoimentos em sequência | `testimonials` |
| "Muito esforço, pouco resultado" / gráfico curva | `mirror-chart` |
| Nome + WhatsApp + campo extra | `lead` |

### Etapa 5 — Gerar o arquivo quiz-config.ts

Substitua **TODO** o conteúdo de `src/lib/quiz-config.ts` com o novo quiz. Siga exatamente o schema definido no arquivo. Não omita campos obrigatórios.

**IDs de tela:** use slugs simples e únicos, ex: `"genero"`, `"idade"`, `"situacao_financeira"`, `"diagnostico"`, `"lead"`, `"loading_final"`.

### Etapa 6 — Imagens

Enquanto o usuário não fornece imagens reais:

- **Gênero (intro):** usar `homem.jpg` e `mulher.jpg` (já na pasta `src/assets/`)  
- **Idades masculino:** `homens/19-29.webp`, `homens/30-39.webp`, `homens/40-49.webp`, `homens/50-plus.webp`
- **Idades feminino:** `mulheres/19-29.webp`, `mulheres/30-39.webp`, `mulheres/40-49.webp`, `mulheres/50-plus.webp`
- **Expert:** `expert.jpg` (placeholder)
- **Provas sociais:** `proof-1.webp`, `proof-2.webp`, etc. (o usuário fornece depois)
- **Logo:** `logo.png` (o usuário substitui)

Adicione comentário `// TODO: substituir pela imagem real` em cada imagem placeholder.

### Etapa 7 — Páginas de oferta

Se o usuário pediu 1 LP: usar `/oferta` como `offerUrl` no `quizMeta`.

Se pediu 2+ LPs: criar rotas adicionais e usar `offerRouteByAnswer` no `quizMeta`:
```typescript
offerRouteByAnswer: {
  "resposta_a": "/oferta-basico",
  "resposta_b": "/oferta-premium",
  "_default": "/oferta",  // fallback
}
```

---

## Referência completa dos tipos de tela

### `intro` — Tela de entrada
```typescript
{
  id: "intro",
  type: "intro",
  headline: "HEADLINE EM CAPS LOCK QUE FALA COM A DOR DO AVATAR",
  subheadline: "Subtítulo explicativo com o benefício principal",
  firstQuestion: "Com qual perfil você se identifica?",
  firstOptions: [
    { value: "homem", label: "Homem", image: homemImg },
    { value: "mulher", label: "Mulher", image: mulherImg },
  ],
  badge: "🕐 Leva menos de 3 minutos",
}
```

### `single` — Escolha única (avança sozinha)
```typescript
{
  id: "situacao",
  type: "single",
  question: "Com qual <hl>situação</hl> você mais se identifica?",
  // Use <hl>texto</hl> para destacar palavras-chave
  grid: undefined, // 2 para grid 2 cols, 4 para 4 cols, omitir para lista
  options: [
    { value: "empregado", label: "😤 Tenho emprego mas não cresce" },
    { value: "desempregado", label: "😟 Estou desempregado(a)" },
    { value: "autonomo", label: "🌱 Sou autônomo(a)" },
    { value: "estudante", label: "📚 Estou estudando" },
  ],
}
```

### `scale` — Escala Likert (avança sozinha)
```typescript
{
  id: "escala_medo",
  type: "scale",
  question: "Avalie o quanto você concorda com a frase:",
  statement: "Tenho medo de começar e não conseguir",
}
```

### `content` — Conteúdo informativo (requer botão)
```typescript
{
  id: "insight_mercado",
  type: "content",
  title: "Título do insight ou dado impactante",
  body: "Corpo do texto explicativo.\n\nSuporta múltiplos parágrafos com \\n.",
  image: insightImg,        // opcional
  highlight: "87% dos...", // opcional — frase em destaque antes do body
  quote: {                 // opcional — citação com autor
    author: "Ana Silva",
    text: "Depoimento específico sobre o insight.",
  },
}
```

### `social-proof` — Prova social
```typescript
{
  id: "prova_resultado",
  type: "social-proof",
  title: "Veja o que estão dizendo:",
  body: "Descrição ou contexto da prova social.",
  stat: "2.347",          // opcional — número grande de impacto
  source: "alunos ativos",// opcional — fonte do stat
  image: proofImg,        // opcional — print de WhatsApp ou screenshot
  whatsapp: {             // opcional — mensagem estilo WhatsApp
    author: "Maria C.",
    text: "Finalmente consegui meu primeiro cliente!",
    meta: "hoje às 15:22",
  },
  video: {                // opcional — depoimento em vídeo (capa clicável, nunca autoplay)
    youtubeId: "dQw4w9WgXcQ",
    label: "Depoimento da Maria",
  },
}
```

### `loading` — Loading animado → vai para /oferta
```typescript
{
  id: "loading_final",
  type: "loading",
  title: "Com base nas suas respostas, preparamos um plano personalizado para você.",
  lines: [
    "Analisando seu perfil...",
    "Identificando as maiores oportunidades...",
    "Calculando seu potencial de renda...",
    "Montando seu plano personalizado...",
    "Quase pronto...",
  ],
  durationMs: 4000,
  // opcional — ícones do loading temático. Sem isso usa um conjunto neutro.
  // Import de src/components/ThemedLoader.tsx: LOADER_GLYPHS_CABANA (imóveis/
  // natureza/construção), LOADER_GLYPHS_MIND (mentalidade/espiritualidade),
  // ou passe seu próprio array de { id, d } (path SVG numa caixa -18 a 18).
  glyphs: LOADER_GLYPHS_CABANA,
}
```

### `diagnosis` — Diagnóstico com barra de nível animada
```typescript
{
  id: "diagnostico",
  type: "diagnosis",
  title: "Seu nível de prontidão para o mercado digital:",
  levels: ["Iniciante", "Em Formação", "Crescendo", "Pronto", "Expert"],
  levelColors: ["bg-destructive", "bg-orange-500", "bg-amber-400", "bg-lime-400", "bg-emerald-500"],
  label: "Você",
  targetPct: 78,  // ou "computed" para calcular automaticamente das respostas
  highlightCard: {
    color: "success",
    title: "PRONTO(A) — Aptidão 78%",
    body: "Pelas suas respostas, você tem tudo para começar. O que falta é um método claro.",
  },
  cards: [
    { label: "❤️ Motivação", name: "Alta", desc: "Você quer mudar" },
    { label: "🧠 Consciência", name: "Crescendo", desc: "Já pesquisa sobre o assunto" },
    { label: "🧩 O que falta", name: "Direção", desc: "Um plano estruturado" },
    { label: "🎯 Resultado esperado", name: "Renda Online", desc: "Em 30-60 dias" },
  ],
}
```

### `compare` — Comparação animada Antes x Depois
```typescript
{
  id: "comparacao",
  type: "compare",
  title: "Veja a diferença de quem fica parado x quem age:",
  beforeLabel: "Sem o Método",
  afterLabel: "Com o Método",
  rows: [
    { label: "Renda mensal", beforePct: 15, afterPct: 85 },
    { label: "Horas trabalhadas", beforePct: 90, afterPct: 30 },
    { label: "Liberdade de horário", beforePct: 10, afterPct: 90 },
    { label: "Segurança financeira", beforePct: 20, afterPct: 88 },
    { label: "Satisfação pessoal", beforePct: 18, afterPct: 94 },
  ],
  summaryBefore: { value: "73%", desc: "continuam estagnados após 6 meses" },
  summaryAfter: { value: "91%", desc: "viram mudança real nas primeiras 4 semanas" },
  durationMs: 1800,
}
```

### `testimonials` — Depoimentos
```typescript
{
  id: "depoimentos",
  type: "testimonials",
  title: "Veja quem já transformou a vida com o método:",
  items: [
    { name: "Ana Paula", text: "Em 3 semanas já tinha meu primeiro cliente." },
    { name: "Carlos M.", text: "Saí do emprego em 2 meses. Não me arrependo." },
    { name: "Juliana S.", text: "O método é tão simples que meu marido também quis fazer." },
  ],
  video: { youtubeId: "dQw4w9WgXcQ" }, // opcional — mesmo campo de social-proof
}
```

### `mirror-chart` — Gráfico esforço x resultado
```typescript
{
  id: "espelho",
  type: "mirror-chart",
  intro: "Antes de encontrar a solução, a maioria dos alunos conta a mesma história…",
  title: '"Tentei de tudo. Curso, vídeo no YouTube, seguir perfil de especialista... mas continuava no mesmo lugar."',
  insight: "Era muito esforço. Pouco resultado. E a causa estava na falta de método.",
  effortPct: 83,
  resultPct: 14,
  effortLabel: "Esforço — cursos, tentativas, pesquisas",
  resultLabel: "Resultado percebido após 3 meses",
}
```

### `lead` — Formulário de captação
```typescript
{
  id: "lead",
  type: "lead",
  title: "Última etapa antes de receber seu plano",
  subtitle: "Informe seus dados para receber o plano personalizado.",
  ctaText: "RECEBER MEU PLANO →",
  privacyText: "🔒 Seus dados estão seguros e não serão compartilhados.",
}
```

---

## Regras estéticas — NUNCA alterar o engine para mudar isso

- **Background:** `bg-background` (branco/quase branco)
- **Cards de opção:** `border border-border rounded-lg` com hover `border-primary/60`
- **Barra de progresso:** gradiente `from-primary to-secondary`, altura `h-1.5`, top sticky
- **Logo:** centralizado no header, `h-10 w-auto`
- **Fontes:** `--font-display` (Sora) nos títulos/headlines, `--font-body` (Inter) no resto —
  tokens em `styles.css`. Troque só esses dois tokens se um quiz pedir tipografia diferente;
  nunca hardcode `font-family` direto num componente.
- **Botões principais:** `h-12 w-full font-bold text-base`, variante `default` já vem com
  `.btn-vivid` (gradiente `primary → secondary → primary` + brilho, reage sozinho à paleta do quiz)
- **Tipografia perguntas:** `text-xl font-bold` (mobile) / `sm:text-2xl`
- **Auto-advance (single/scale):** 200ms após clique — nunca colocar botão "Continuar" numa tela `single`
- **Scroll:** sempre volta ao topo ao mudar de tela (window.scrollTo top 0)
- **Loading:** duração 4000ms padrão, ícones temáticos via `ThemedLoader` (ver `glyphs` na tela `loading`)
- **Diagnosis:** animação easeOutCubic, 2200ms, marcador deslizante

---

## Como adicionar uma nova LP (página de oferta)

1. Crie `src/routes/oferta-[nome].tsx` copiando `src/routes/oferta.tsx`
2. Atualize `src/routeTree.gen.ts` adicionando a nova rota
3. No `quizMeta`, defina `offerRouteByAnswer` apontando respostas para as rotas
4. O engine redireciona automaticamente com base na resposta que você definir como chave

---

## Quando o usuário enviar imagens

1. Salvar na pasta `src/assets/`
2. Adicionar o import no `quiz-config.ts`: `import nomeDaImagem from "@/assets/nome.jpg"`
3. Substituir o valor placeholder pela variável importada
4. Remover o comentário `// TODO: substituir`

---

## Infraestrutura futura (ainda não implementada aqui)

Vários quizzes de referência do usuário no Lovable já têm isso pronto e funcionando — a ideia é
portar pra cá como motor genérico numa fase separada, não misturar com edição de estética:

- **Teste A/B de headline** — 4 variantes de `headline`/`subheadline` na intro, split de tráfego,
  painel `/admin` (login Google) com relatório de views/clicks/CTR por variante. Referência:
  `src/lib/headline-ab.ts` + `src/hooks/use-headline.ts` + `src/routes/_authenticated/admin.tsx`
  no projeto Lovable "Novo Operação MCE".
- **Captura de lead real** — hoje o submit do formulário `lead` é um TODO vazio. Vai virar
  Supabase (acesso salvo em memória) e/ou webhook. Referência: `src/routes/api/public/lead.ts`
  (valida com zod, repassa pra webhook) no mesmo projeto.
- **Analytics / heatmap** — sessão, cliques com coordenada relativa, tempo por tela, scroll depth,
  visualizados num canvas de calor por tela no admin. Referência: `src/lib/tracking.ts` +
  `src/components/admin/Heatmap.tsx` no projeto Lovable "Digital Start".
- **Página de resultado personalizada pelas respostas** — hoje `/oferta` é estático. A ideia é ler
  as respostas do quiz (dores/desejos) e montar um "perfil dominante" que personaliza a
  apresentação da oferta (mesmo produto, discurso adaptado). Referência: `src/routes/resultado.tsx`
  no projeto Lovable "Digital Start".

Ao trabalhar na estética agora, não é preciso implementar nada disso — só evitar decisões que
dificultem plugar depois (ex: manter o submit do `lead` numa função única fácil de trocar depois).

---

## Troubleshooting

- **Quiz não compila:** verifique se todos os IDs de tela são únicos
- **Imagem não aparece:** verifique se o arquivo existe em `src/assets/` e o import está correto
- **Animação pula:** verifique se `targetPct` é um número entre 0 e 100
- **Lead não salva:** configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` nas variáveis de ambiente
- **LP errada:** verifique se `offerRouteByAnswer` tem o mesmo valor que a opção respondida no `quiz-config.ts`

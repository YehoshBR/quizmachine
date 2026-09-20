import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Habilita o plugin Nitro fora do sandbox do Lovable, pra dar pra gerar um
  // servidor Node comum (preset "node-server") e rodar em qualquer VPS —
  // sem isso, o build só produz um handler no formato Cloudflare Workers.
  // Preset controlado por NITRO_PRESET no build (padrão continua
  // "cloudflare-module", igual o Lovable espera, quando a env var não é setada).
  nitro: true,
});

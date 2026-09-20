// ============================================================
// provisioning.ts — SEMPRE server-only. Publica um domínio do zero: DNS
// (Hostinger) + nginx + SSL, sozinho.
// ============================================================
// Roda como root (mesmo processo do systemd), então consegue escrever
// config de site no nginx e chamar certbot direto. NUNCA importar isso de
// uma rota de página (client-bundled) — só da rota de API pura
// (src/routes/api/admin/provision-domain.ts). Ver src/lib/auth-internal.ts
// pro mesmo motivo (node:child_process/node:fs/token não podem vazar pro
// bundle do cliente).
//
// HOSTINGER_API_TOKEN (.env.production): token de conta inteira (DNS + VPS),
// decisão explícita do usuário em 2026-09-20 de trocar conveniência por
// risco — ver memória do projeto. Se não tiver domínio na Hostinger (token
// ausente ou API recusa), cai pro fluxo manual (instrui o usuário a criar o
// registro A ele mesmo).
// ============================================================
import { promises as dns } from "node:dns";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const VPS_IP = "85.31.60.46";
const NGINX_SITES_AVAILABLE = "/etc/nginx/sites-available";
const NGINX_SITES_ENABLED = "/etc/nginx/sites-enabled";
const CERTBOT_EMAIL = "joemelloca@gmail.com";
const HOSTINGER_API_BASE = "https://developers.hostinger.com";

export type ProvisionResult =
  | { ok: true; stage: "done"; message: string }
  | { ok: false; stage: "validation" | "dns" | "nginx" | "certbot"; error: string };

export function isValidDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain);
}

export { VPS_IP };

/** Separa "quiz.joemello.pro" em { name: "quiz", rootDomain: "joemello.pro" }.
 * Domínio sem subdomínio (2 labels, ex: "joemello.pro") vira name "@". Não
 * lida com TLDs compostos sem subdomínio (ex: "empresa.com.br" sozinho) —
 * ok pro padrão real de uso aqui (sempre subdomínio.raiz.tld). */
function splitDomain(domain: string): { name: string; rootDomain: string } {
  const parts = domain.split(".");
  if (parts.length <= 2) return { name: "@", rootDomain: domain };
  return { name: parts[0], rootDomain: parts.slice(1).join(".") };
}

async function checkDnsPointsToVps(domain: string): Promise<{ pointing: boolean; found: string[] }> {
  try {
    const addrs = await dns.resolve4(domain);
    return { pointing: addrs.includes(VPS_IP), found: addrs };
  } catch {
    return { pointing: false, found: [] };
  }
}

/** Cria/atualiza o registro A na Hostinger. Retorna false (sem lançar) se o
 * token não estiver configurado ou a API recusar — quem chama cai pro fluxo
 * manual nesse caso. */
async function createHostingerDnsRecord(domain: string): Promise<{ attempted: boolean; ok: boolean; error?: string }> {
  const token = process.env.HOSTINGER_API_TOKEN;
  if (!token) return { attempted: false, ok: false };

  const { name, rootDomain } = splitDomain(domain);
  try {
    const res = await fetch(`${HOSTINGER_API_BASE}/api/dns/v1/zones/${encodeURIComponent(rootDomain)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // overwrite:true pro name+type específico — idempotente (se o registro
      // já existir, ex: de uma tentativa anterior que não confirmou a tempo,
      // substitui em vez de dar conflito). Só afeta esse name+type, não a
      // zona inteira.
      body: JSON.stringify({
        overwrite: true,
        zone: [{ name, type: "A", ttl: 300, records: [{ content: VPS_IP }] }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { attempted: true, ok: false, error: `Hostinger respondeu HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { attempted: true, ok: true };
  } catch (err) {
    return { attempted: true, ok: false, error: (err as Error).message };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espera o DNS propagar depois de criar o registro (a Hostinger publica
 * rápido, mas resolvers públicos como o 8.8.8.8 podem levar um pouco). */
async function waitForDnsPropagation(domain: string, timeoutMs: number, intervalMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { pointing } = await checkDnsPointsToVps(domain);
    if (pointing) return true;
    await sleep(intervalMs);
  }
  return false;
}

function buildNginxConfig(domain: string, port: number, uploadsDir: string): string {
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    location /uploads/ {
        alias ${uploadsDir}/;
        autoindex off;
    }

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
}

/**
 * Publica um domínio do zero: cria o registro A na Hostinger (se o domínio
 * for de lá), espera propagar, configura nginx e emite o certificado SSL.
 * Idempotente: pode chamar de novo sem problema.
 */
export async function provisionDomain(domainInput: string): Promise<ProvisionResult> {
  const domain = domainInput.trim().toLowerCase();

  if (!isValidDomain(domain)) {
    return { ok: false, stage: "validation", error: `"${domainInput}" não parece um domínio válido (ex: quiz.seudominio.com).` };
  }

  let dnsCheck = await checkDnsPointsToVps(domain);

  if (!dnsCheck.pointing) {
    const dnsResult = await createHostingerDnsRecord(domain);
    if (dnsResult.attempted && dnsResult.ok) {
      const propagated = await waitForDnsPropagation(domain, 60_000, 5_000);
      dnsCheck = await checkDnsPointsToVps(domain);
      if (!propagated && !dnsCheck.pointing) {
        return {
          ok: false,
          stage: "dns",
          error: `Criei o registro A de "${domain}" na Hostinger apontando pra ${VPS_IP}, mas ainda não propagou depois de 1 minuto. Isso é normal às vezes — clique em "Publicar domínio" de novo em alguns minutos.`,
        };
      }
    } else if (dnsResult.attempted && !dnsResult.ok) {
      return {
        ok: false,
        stage: "dns",
        error: `Não achei "${domain}" na sua conta Hostinger pra apontar o DNS sozinho (${dnsResult.error}). Se o domínio é de outro registrador, crie um registro tipo A apontando pra ${VPS_IP} manualmente e tente de novo.`,
      };
    } else {
      // sem token configurado — fluxo manual de sempre
      const found = dnsCheck.found.length > 0 ? `Hoje aponta pra: ${dnsCheck.found.join(", ")}.` : "Não consegui resolver o DNS ainda.";
      return {
        ok: false,
        stage: "dns",
        error: `O DNS de "${domain}" ainda não aponta pra esta VPS (${VPS_IP}). ${found} Crie (ou edite) um registro tipo A apontando pra ${VPS_IP} no painel onde você comprou o domínio e tente de novo.`,
      };
    }
  }

  const port = Number(process.env.PORT) || 3001;
  const uploadsDir = process.env.UPLOADS_DIR ?? "/opt/quiz-platform/uploads";
  const configPath = `${NGINX_SITES_AVAILABLE}/${domain}`;
  const enabledPath = `${NGINX_SITES_ENABLED}/${domain}`;

  try {
    await fs.writeFile(configPath, buildNginxConfig(domain, port, uploadsDir), "utf8");
    await fs.chmod(configPath, 0o644);
    await fs.rm(enabledPath, { force: true });
    await fs.symlink(configPath, enabledPath);
    await execFileAsync("nginx", ["-t"]);
    await execFileAsync("systemctl", ["reload", "nginx"]);
  } catch (err) {
    return { ok: false, stage: "nginx", error: `Falha ao configurar o nginx: ${(err as Error).message}` };
  }

  try {
    await execFileAsync(
      "certbot",
      ["--nginx", "-d", domain, "--non-interactive", "--agree-tos", "-m", CERTBOT_EMAIL, "--redirect"],
      { timeout: 90_000 }
    );
  } catch (err) {
    return {
      ok: false,
      stage: "certbot",
      error: `O site já responde em http://${domain}, mas o certificado SSL falhou: ${(err as Error).message}. Tente de novo em alguns minutos (às vezes é só o DNS ainda propagando pros servidores da Let's Encrypt).`,
    };
  }

  return { ok: true, stage: "done", message: `"${domain}" está no ar com HTTPS — DNS, site e certificado configurados automaticamente.` };
}

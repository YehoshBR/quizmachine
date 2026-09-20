// ============================================================
// provisioning.ts — SEMPRE server-only. Configura nginx + SSL sozinho.
// ============================================================
// Roda como root (mesmo processo do systemd), então consegue escrever
// config de site no nginx e chamar certbot direto — sem precisar de SSH
// manual toda vez que um domínio novo entra. NUNCA importar isso de uma
// rota de página (client-bundled) — só da rota de API pura
// (src/routes/api/admin/provision-domain.ts). Ver src/lib/auth-internal.ts
// pro mesmo motivo (node:child_process/node:fs não podem vazar pro bundle
// do cliente).
//
// O que isso NÃO faz: apontar o DNS. Isso é sempre uma ação do usuário no
// lugar onde o domínio foi comprado (ou dele me dar acesso à conta) — a
// Hostinger a gente automatiza via MCP à parte, qualquer outro registrador
// (HostGator etc) precisa do registro A criado manualmente.
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

export type ProvisionResult =
  | { ok: true; stage: "done"; message: string }
  | { ok: false; stage: "validation" | "dns" | "nginx" | "certbot"; error: string };

export function isValidDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain);
}

export { VPS_IP };

async function checkDnsPointsToVps(domain: string): Promise<{ pointing: boolean; found: string[] }> {
  try {
    const addrs = await dns.resolve4(domain);
    return { pointing: addrs.includes(VPS_IP), found: addrs };
  } catch {
    return { pointing: false, found: [] };
  }
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
 * Configura nginx + SSL pra um domínio, do zero, sozinho — desde que o DNS
 * já esteja apontando pra essa VPS. Idempotente: pode chamar de novo sem
 * problema (sobrescreve a config com o mesmo conteúdo, certbot renova).
 */
export async function provisionDomain(domainInput: string): Promise<ProvisionResult> {
  const domain = domainInput.trim().toLowerCase();

  if (!isValidDomain(domain)) {
    return { ok: false, stage: "validation", error: `"${domainInput}" não parece um domínio válido (ex: quiz.seudominio.com).` };
  }

  const dnsCheck = await checkDnsPointsToVps(domain);
  if (!dnsCheck.pointing) {
    const found = dnsCheck.found.length > 0 ? `Hoje aponta pra: ${dnsCheck.found.join(", ")}.` : "Não consegui resolver o DNS ainda.";
    return {
      ok: false,
      stage: "dns",
      error: `O DNS de "${domain}" ainda não aponta pra esta VPS (${VPS_IP}). ${found} Crie (ou edite) um registro tipo A pra "${domain}" apontando pra ${VPS_IP} no painel onde você comprou o domínio, espere alguns minutos propagar, e clique em "Publicar domínio" de novo.`,
    };
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
      error: `O site já responde em http://${domain}, mas o certificado SSL falhou: ${(err as Error).message}. Tente de novo em alguns minutos (às vezes é só o DNS ainda propagando).`,
    };
  }

  return { ok: true, stage: "done", message: `"${domain}" está no ar com HTTPS.` };
}

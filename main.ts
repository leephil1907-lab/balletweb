/**
 * Ballet — static site server for Deno Deploy.
 * Explicit static-file routing keeps the production root reliable on Deno Deploy.
 */
const ROOT = new URL("./", import.meta.url);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
};

const IMMUTABLE = /^\/(static|shop|fonts)\//;
const SHORT_CACHE = /^\/(css\/site\.css|js\/)/;

function injectSiteRuntime(html: string): string {
  const scripts = [
    '<script src="/js/chat-config.js" defer></script>',
    '<script src="/js/live-chat.js" defer></script>',
    '<script src="/js/language.js" defer></script>',
  ];
  let out = html;
  for (const tag of scripts) {
    const src = tag.match(/src="([^"]+)"/)?.[1];
    if (src && !out.includes(src)) {
      out = out.includes("</body>") ? out.replace("</body>", `\n${tag}\n</body>`) : out + `\n${tag}`;
    }
  }
  return out;
}

function cacheFor(pathname: string, isHtml = false): string {
  if (isHtml) return "public, max-age=0, must-revalidate";
  if (IMMUTABLE.test(pathname)) return "public, max-age=31536000, immutable";
  if (SHORT_CACHE.test(pathname)) return "public, max-age=60, must-revalidate";
  if (/\.(css|js|json|svg|png|jpg|jpeg|webp|gif|ico|woff|woff2|ttf)$/.test(pathname)) return "public, max-age=31536000, immutable";
  return "public, max-age=600";
}

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Ballet</title><style>html,body{margin:0;height:100%}body{background:#111f3e;color:#fff;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}.w{max-width:560px}h1{font-size:72px;margin:0 0 8px;color:#eebf29}h2{font-size:22px;margin:0 0 14px}p{color:#b6b6b6;line-height:1.6;margin:0 0 28px}a{display:inline-block;background:#eebf29;color:#0d1526;text-decoration:none;font-weight:700;padding:14px 30px;border-radius:8px}</style></head><body><div class="w"><h1>404</h1><h2>This page could not be found</h2><p>The link may be broken, or the page may have been moved.</p><a href="/">Back to Ballet</a></div></body></html>`;

function notFound(): Response {
  return new Response(NOT_FOUND, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
}

function safeRelativePath(pathname: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes("\0") || decoded.includes("..")) return null;
  return decoded.replace(/^\/+/, "");
}

async function resolveFile(pathname: string): Promise<URL | null> {
  const relative = safeRelativePath(pathname);
  if (relative === null) return null;
  const candidates = relative === "" ? ["index.html"] : [relative, `${relative}/index.html`];
  for (const candidate of candidates) {
    const fileUrl = new URL(candidate, ROOT);
    try {
      const info = await Deno.stat(fileUrl);
      if (info.isFile) return fileUrl;
    } catch {}
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });

  const fileUrl = await resolveFile(pathname);
  if (!fileUrl) return notFound();

  const ext = fileUrl.pathname.match(/\.[^.\/]+$/)?.[0].toLowerCase() ?? "";
  const type = MIME[ext] ?? "application/octet-stream";
  const isHtml = type.startsWith("text/html");

  try {
    const bytes = await Deno.readFile(fileUrl);
    const body = isHtml ? injectSiteRuntime(new TextDecoder().decode(bytes)) : bytes;
    const headers = new Headers({
      "Content-Type": type,
      "Cache-Control": cacheFor(pathname, isHtml),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    return new Response(req.method === "HEAD" ? null : body, { status: 200, headers });
  } catch {
    return notFound();
  }
});

console.log("Ballet production server started");

/**
 * Ballet — static site server for Deno Deploy
 * Serves the pre-rendered site with clean URLs, correct MIME types, caching,
 * site-wide language translation and direct Smartsupp support.
 */
import { serveDir } from "jsr:@std/http@^1.0.0/file-server";

const ROOT = import.meta.dirname ?? ".";
const IMMUTABLE = /^\/(static|shop|fonts)\//;
const SHORT_CACHE = /^(css\/site\.css|js\/)/;

function injectSiteRuntime(html: string): string {
  if (!html) return html;
  const scripts = [
    '<script src="/js/chat-config.js" defer></script>',
    '<script src="/js/live-chat.js" defer></script>',
    '<script src="/js/language.js" defer></script>'
  ];
  let out = html;
  for (const tag of scripts) {
    const src = tag.match(/src="([^"]+)"/)?.[1];
    if (src && !out.includes(src)) out = out.includes("</body>") ? out.replace("</body>", "\n" + tag + "\n</body>") : out + "\n" + tag;
  }
  return out;
}

async function withHeaders(res: Response, pathname: string): Promise<Response> {
  const type = res.headers.get("content-type") || "";
  const isHtml = type.startsWith("text/html");
  let cacheControl = "public, max-age=600";
  let body: BodyInit | null = res.body;
  if (IMMUTABLE.test(pathname)) cacheControl = "public, max-age=31536000, immutable";
  else if (isHtml) { cacheControl = "public, max-age=0, must-revalidate"; body = injectSiteRuntime(await res.text()); }
  else if (SHORT_CACHE.test(pathname)) cacheControl = "public, max-age=60, must-revalidate";
  else if (/\.css$/.test(pathname)) cacheControl = "public, max-age=31536000, immutable";
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", cacheControl);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(body, { status: res.status, headers });
}

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Ballet</title><link rel="stylesheet" href="/fonts/fonts.css"><style>html,body{margin:0;height:100%}body{background:#111f3e;color:#fff;font-family:Inter,"Noto Sans",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}.w{max-width:560px}h1{font-family:Montserrat,Inter,system-ui,sans-serif;font-weight:700;font-size:72px;margin:0 0 8px;color:#eebf29}h2{font-family:Montserrat,Inter,system-ui,sans-serif;font-size:22px;margin:0 0 14px}p{color:#b6b6b6;line-height:1.6;margin:0 0 28px}a{display:inline-block;background:#eebf29;color:#0d1526;text-decoration:none;font-weight:700;padding:14px 30px;border-radius:8px}</style></head><body><div class="w"><h1>404</h1><h2>This page could not be found</h2><p>The link may be broken, or the page may have been moved.</p><a href="/">Back to Ballet</a></div></body></html>`;

function notFound(): Response {
  return new Response(NOT_FOUND, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}

const PORT = Number(Deno.env.get("PORT")) || 8000;
Deno.serve(
  { port: PORT, onListen: ({ port, hostname }) => console.log(`Ballet listening on http://${hostname}:${port}`) },
  async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    if (pathname.includes("..")) return notFound();
    if (pathname.length > 1 && !pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(pathname)) {
      try {
        if ((await Deno.stat(ROOT + pathname)).isDirectory) return new Response(null, { status: 308, headers: { Location: pathname + "/" + url.search, "Cache-Control": "public, max-age=600" } });
      } catch {}
    }
    const res = await serveDir(req, { fsRoot: ROOT, showDirListing: false, showIndex: true, enableCors: false });
    if (res.status === 404) return notFound();
    return withHeaders(res, pathname);
  },
);

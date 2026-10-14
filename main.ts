/**
 * Ballet — static site server for Deno Deploy.
 * Uses explicit static-file routing, safe path resolution, browser caching,
 * and gzip for compressible responses.
 */
const ROOT = new URL("./", import.meta.url);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
};

const IMMUTABLE = /^\/(static|shop|fonts)\//;
const SHORT_CACHE = /^\/(css\/site\.css|js\/)/;

function acceptsGzip(request: Request): boolean {
  const header = request.headers.get("accept-encoding") || "";
  const encodings = header.split(",").map((part) => part.trim().toLowerCase());
  const gzip = encodings.find((part) => part.split(";", 1)[0].trim() === "gzip");
  if (!gzip) return false;
  const q = gzip.split(";").map((part) => part.trim()).find((part) => part.startsWith("q="));
  return !q || Number(q.slice(2)) > 0;
}

function addVary(headers: Headers, value: string): void {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", value);
  } else if (!current.split(",").some((item) => item.trim().toLowerCase() === value.toLowerCase())) {
    headers.set("Vary", `${current}, ${value}`);
  }
}

function withHeaders(res: Response, pathname: string, request: Request): Response {
  const type = res.headers.get("content-type") || "";
  const isHtml = type.startsWith("text/html");
  const compressible = /^(text\/|application\/(?:javascript|json|xml|manifest\+json)|image\/svg\+xml)/i.test(type);

  let cacheControl = "public, max-age=600";
  if (isHtml) {
    cacheControl = "public, max-age=0, must-revalidate";
  } else if (IMMUTABLE.test(pathname)) {
    cacheControl = "public, max-age=31536000, immutable";
  } else if (SHORT_CACHE.test(pathname)) {
    cacheControl = "public, max-age=60, must-revalidate";
  } else if (/\.(css|js|json|svg|png|jpg|jpeg|webp|gif|ico|woff|woff2|ttf)$/.test(pathname)) {
    cacheControl = "public, max-age=31536000, immutable";
  }

  const headers = new Headers(res.headers);
  headers.set("Cache-Control", cacheControl);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  let body = res.body;
  const size = Number(headers.get("Content-Length") || 0);
  const eligible = compressible && res.status === 200 && body !== null &&
    (size === 0 || size >= 1024);
  if (eligible) addVary(headers, "Accept-Encoding");

  const canCompress = eligible && request.method === "GET" &&
    !request.headers.has("range") && !headers.has("Content-Encoding") && acceptsGzip(request);
  if (canCompress && body) {
    headers.set("Content-Encoding", "gzip");
    headers.delete("Content-Length");
    headers.delete("Content-MD5");
    headers.delete("ETag");
    headers.delete("Accept-Ranges");
    body = body.pipeThrough(new CompressionStream("gzip"));
  }

  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Ballet</title><style>html,body{margin:0;height:100%}body{background:#111f3e;color:#fff;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}.w{max-width:560px}h1{font-size:72px;margin:0 0 8px;color:#eebf29}h2{font-size:22px;margin:0 0 14px}p{color:#b6b6b6;line-height:1.6;margin:0 0 28px}a{display:inline-block;background:#eebf29;color:#0d1526;text-decoration:none;font-weight:700;padding:14px 30px;border-radius:8px}</style></head><body><div class="w"><h1>404</h1><h2>This page could not be found</h2><p>The link may be broken, or the page may have been moved.</p><a href="/">Back to Ballet</a></div></body></html>`;

function notFound(): Response {
  return new Response(NOT_FOUND, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
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

const PORT = Number(Deno.env.get("PORT")) || 8000;

Deno.serve(
  { port: PORT, onListen: ({ port, hostname }) => console.log(`Ballet listening on http://${hostname}:${port}`) },
  async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const pathname = url.pathname;
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const fileUrl = await resolveFile(pathname);
    if (!fileUrl) return notFound();

    const ext = fileUrl.pathname.match(/\.[^.\/]+$/)?.[0].toLowerCase() ?? "";
    const type = MIME[ext] ?? "application/octet-stream";
    try {
      const bytes = await Deno.readFile(fileUrl);
      const headers = new Headers({ "Content-Type": type });
      const response = new Response(req.method === "HEAD" ? null : (type.startsWith("text/html") ? new TextDecoder().decode(bytes) : bytes), {
        status: 200,
        headers,
      });
      return withHeaders(response, pathname, req);
    } catch {
      return notFound();
    }
  },
);

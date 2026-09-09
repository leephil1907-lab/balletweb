# balletweb

A 1:1 static replica of [ballet.com](https://www.ballet.com) — structure, fonts, layout,
design and scroll-driven animations — with an enhanced, stable site flow and a
Smartsupp-powered support chat.

Built as pre-rendered static HTML/CSS/JS. No build step, no framework runtime.

## Deploy to Deno Deploy

1. Go to <https://dash.deno.com/new_project>
2. Pick **GitHub** → select `leephil1907-lab/balletweb`
3. Branch `main`, entry point **`main.ts`** (auto-detected)
4. Click **Deploy**

Every push to `main` redeploys automatically.

## Run locally

```bash
deno task start     # http://localhost:8000
deno task dev       # with file watching
deno task check     # type-check
```

Or serve the folder with any static server — the pages are plain HTML.

## Pages

27 routes: `/` plus `/quick-start/`, `/app/`, `/2FKG/`, `/2FKG-graphic/`, `/verify/`,
`/how-it-works/`, `/supported-coins/`, `/swap/`, `/buy/`, `/malca-amit/`,
`/anti-counterfeiting/`, `/crypto-hacks/`, `/company/`, `/about/`, `/press/`,
`/terms/`, `/agreement/`, `/privacy/`, `/money-back-guarantee/`, `/cbc/`,
`/cbc/personalize/`, `/cbc/techspec/`, `/cgc/`, `/cobranded/`, `/collaborations/`,
`/reseller/`.

## Support chat

Live agents are served by **Smartsupp**. The key lives in `js/chat-config.js`:

```js
smartsupp: {
  key: '0f72515f9fb030435a08be49b1610cf6db90dbed',
  options: { },
  timeoutMs: 8000
}
```

`js/chat.js` is provider-agnostic — it also supports tawk, crisp, intercom,
zendesk, freshchat, drift, salesiq, chatwoot, livechat, tidio, gorgias, a custom
embed script, or a webhook. Set `provider` in `chat-config.js` to switch.

If Smartsupp fails to render (blocked, offline, or the domain is not allowed in
the Smartsupp dashboard), the built-in Ballet assistant takes over automatically
after `timeoutMs`, so the chat is never dead.

## Structure

```
main.ts          Deno Deploy entry — clean URLs, MIME types, cache headers, 404
deno.json        tasks + import map
index.html       homepage (pre-rendered)
<slug>/          sub-pages, each as index.html
css/             shared bundles + site.css (our overrides)
js/              main.js (behaviour), chat.js, chat-config.js
fonts/           self-hosted Montserrat / Inter / Noto Sans / Roboto Mono
static/ shop/ images/   image assets
```

## Caching

| Path | Policy |
|---|---|
| `/static/`, `/shop/`, `/fonts/`, hashed `.css` | `max-age=31536000, immutable` |
| `*.html` | `max-age=0, must-revalidate` |
| `/css/site.css`, `/js/*` | `max-age=60, must-revalidate` |

## Notes

- `/swap` redirects (308) to `/swap/` so clean URLs work either way.
- Unknown paths return a themed 404 page rendered by `main.ts`.

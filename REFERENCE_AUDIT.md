# Reference audit — Ballet home page

**Compared:** repository branch `main`, its Deno Deploy build, and `https://www.ballet.com/` on 3 October 2026.

## What the current reference shows

- The security notice and dark hero with the $1B+ trust statement and press logos.
- A pinned three-scene story: no setup, self-custody, and crypto as a gift.
- An animated event/award ribbon, including the 2026 Emmy Awards gift-bag feature.
- Community proof: publication reviews, customer reviews, a swipeable mobile review layout, and the photo wall.
- An FAQ, newsletter sign-up, and the shared navigation/footer.

## Comparison with this repository

The repository already contains the reference's core hero, pinned story, press logos, event ribbon, reviews/mobile layouts, FAQ, newsletter, and footer. It also has additional home-page material not present on the current reference home page: How It Works, card materials, legacy gifting, app management, supported-asset ticker, and a product configurator. Those useful repo-specific sections and their routes were retained rather than removed.

The concrete content gap was the Emmy Awards 2026 announcement. The old event ribbon was also placed after the repository-only product/app material, while the current reference places it immediately after the pinned story. Both the event copy and order have been brought into line, and the review section now follows the ribbon.

## Motion and interaction work

- Kept the scroll-scrubbed cross-fade/parallax intro and made its sticky offset follow the live header height after resize, font load, and header reflow.
- Added a reduced-motion layout that turns the pinned intro into three visible static panels instead of leaving hidden scenes in a long blank scroll.
- Added progressive same-origin View Transitions, with a reduced-motion override; existing smooth anchor scrolling remains the fallback.
- Made the announcement marquee pause on hover/focus and hid its duplicated loop copy from assistive technology.
- Connected FAQ controls to their answer regions, including expanded state and inert collapsed content; improved keyboard/escape/outside-click behavior for navigation.

## Follow-up motion check — 3 October 2026

- Rechecked the card flip: it is a native button, so touch taps, mouse clicks, Enter, and Space all use the same click path. The existing 3D face rotation has a 0.7-second CSS transition; its pressed state and action label now track the visible side. No separate touch handler was added, avoiding double-flips.
- Fixed the How It Works diagram fallback: the desktop diagram now responds to touch/click and keyboard, with `.is_open` styles matching the existing mobile transition. Both diagram variants keep `aria-pressed` and the active image's accessibility state in sync; desktop hover reveal is retained.
- Improved the material radio group's keyboard behavior with arrow-key selection and a single tab stop.
- Final checks: JavaScript syntax, HTML structure, CSS parsing, and local preview HTTP routes passed. A physical-device touch test was not available in this workspace.

## Runtime follow-up — 3 October 2026

- Reproduced the missing chat launcher. Smartsupp mode now keeps a small launcher visible during startup, uses the native Smartsupp conversation UI when its widget appears, and does not render a local message composer, saved transcript, canned replies, or bot answers. If the provider is unavailable, the launcher opens a minimal contact fallback instead.
- The configured Smartsupp bootstrap still returns HTTP 403 on the preview host, so real agent handoff cannot be verified until that hostname is authorized in the Smartsupp dashboard (or the key is corrected). The fallback is intentionally not a chatbot.
- Long same-page jumps now scroll immediately rather than using a slow multi-screen smooth scroll. Existing hero CTA, mobile menu, FAQ, card flip, How It Works diagram, and navigation behavior remain in the regression pass.
- Externalized 38 unique inline image payloads that were repeated throughout the homepage, reducing `index.html` from 1,137,967 bytes to 164,285 bytes. Offscreen images, closed-menu artwork, and the legacy-section background now load on demand; the five visible hero press logos remain eager. Removed duplicate font preloads and the external font CSS; the locally served font files now load once each.
- Added gzip negotiation to the Deno server for text assets. Local Deno verification returned the homepage as 38,178 gzip bytes (164,285 identity bytes) and decompressed byte-for-byte to the source HTML. The local `start`/`dev` tasks now request the narrowly scoped `PORT` environment permission required by Deno.
- The deployed Deno URL is still serving an older build (its homepage, `main.js`, and `site.css` differ from this workspace), and this checkout has no Git remote configured. These fixes are verified in the local preview but have not been deployed to the public URL.

## Interaction and responsive follow-up — 4 October 2026

- Added silver-finish front/back assets and wired the Gold / Stainless Steel radio group to swap both images and their alt text. The existing 3D flip remains independent; Playwright verified switching material while flipped does not reset the flip.
- The language control now navigates instead of merely changing its label. All 11 official locale routes were checked over HTTP and returned 200 with matching document-language tags; preview hosts route to the canonical `www.ballet.com` locale, while ballet.com stays same-origin. Keyboard and pointer selection were both smoke-tested.
- Smartsupp is now explicitly selected in config. The prior custom transcript is removed from local storage; the active UI has no site-side message form, bot greeting, quick replies, or canned responses. The native-widget API uses Smartsupp's documented `chat:open` / `chat:send` commands; the site has no second composer or local transcript. Actual handoff remains unverified because the configured loader/bootstrap returns 403; the preview therefore exposes only a small service/contact fallback. A mocked provider test verified delegation, not a real support session.
- A 320px responsive audit found the newsletter social links caused 27px of page overflow. They now wrap on narrow screens. The full page and chat panel were checked at 320, 360, 390, 768, 1024, and 1440px; no horizontal overflow or off-screen chat UI remained. JavaScript and same-origin image requests passed without runtime errors.
- The current local preview is served by Python on port 8000. Nothing has been deployed; the public URL remains on the older build until an authorized deployment is made.

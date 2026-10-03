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

## Support chat

The existing Smartsupp provider key/configuration and chat loader were left untouched. The widget still uses the configured Smartsupp connection and its existing built-in fallback if the hosted widget is unavailable or not yet allowed for the deployed domain.

/* =========================================================================
   Ballet — site runtime
   Reimplements every behaviour the reference site drives with JS:
   header state, nav, pinned scroll-telling intro, diagram hover/tap,
   card flip, marquees, trust wall, buy-box configurator, FAQ, back-to-top
   and scroll reveals.
   ========================================================================= */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------------------------------------------------------------------
     0. Header geometry variables (mirrors the reference inline script)
  --------------------------------------------------------------------- */
  function measureHeader() {
    var header = $('.ballet-layout-header');
    if (!header) return;
    var nav = header.querySelector('.navbar');
    var h = header.getBoundingClientRect().height;
    var n = nav ? nav.getBoundingClientRect().height : 0;
    var s = document.documentElement.style;
    if (h) {
      s.setProperty('--header-h', h + 'px');
      // The pinned story uses the full alert + navigation stack as its sticky
      // offset. Keep this live instead of relying on the captured 120px value.
      var pin = $('.homepage_pinintro');
      if (pin) pin.style.setProperty('--pin-header', h + 'px');
    }
    if (n) s.setProperty('--nav-h', n + 'px');
  }

  /* ---------------------------------------------------------------------
     1. Header scroll state
        - top of page  -> body.homepage-at-top (transparent header)
        - scrolled     -> header--dark (blurred black bar)
        - scrolling down hides, scrolling up shows (stable flow)
  --------------------------------------------------------------------- */
  function initHeader() {
    var header = $('.ballet-layout-header');
    if (!header) return;
    var ticking = false;

    // Only the homepage carries the hero, so only the homepage uses the dark,
    // fixed (out-of-flow) header. Interior pages keep the default sticky bar.
    var isHome = !!$('.homepage_banner');

    if (isHome) header.classList.add('header--dark', 'ballet-layout-header-show');
    else header.classList.add('ballet-layout-header-show');

    function update() {
      if (isHome) document.body.classList.toggle('homepage-at-top', window.pageYOffset < 24);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; raf(update); }
    }, { passive: true });

    update();
    window.addEventListener('resize', function () { measureHeader(); update(); });
  }

  /* ---------------------------------------------------------------------
     2. Navigation — burger, mobile accordion, dropdown keyboard access
  --------------------------------------------------------------------- */
  function initNav() {
    var burger = $('.navbar-burger');
    var menu = $('#navMenu');
    var header = $('.ballet-layout-header');

    function setMenuOpen(open, returnFocus) {
      if (!burger || !menu) return;
      burger.classList.toggle('is-active', open);
      menu.classList.toggle('is-active', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-controls', menu.id || 'navMenu');
      document.body.style.overflow = open ? 'hidden' : '';
      if (!open && returnFocus) burger.focus();
    }

    function loadMenuImages(container) {
      if (!container) return;
      $$('img[data-lazy-src]', container).forEach(function (img) {
        img.src = img.getAttribute('data-lazy-src');
        img.removeAttribute('data-lazy-src');
      });
    }

    // Dropdown artwork is not needed for the initial viewport. Fetch it only
    // when a visitor opens or focuses the corresponding navigation group.
    $$('.navbar-haveContent').forEach(function (item) {
      if (!item.querySelector('img[data-lazy-src]')) return;
      var loadImages = function () { loadMenuImages(item); };
      item.addEventListener('mouseenter', loadImages, { once: true });
      item.addEventListener('focusin', loadImages, { once: true });
      item.addEventListener('click', loadImages, { once: true });
    });

    if (burger && menu) {
      setMenuOpen(menu.classList.contains('is-active'), false);
      burger.addEventListener('click', function () {
        setMenuOpen(!menu.classList.contains('is-active'), false);
      });
      menu.querySelectorAll('a[href]').forEach(function (link) {
        link.addEventListener('click', function () {
          if (menu.classList.contains('is-active')) setMenuOpen(false, false);
        });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('is-active')) {
          setMenuOpen(false, true);
        }
      });
      document.addEventListener('click', function (e) {
        if (menu.classList.contains('is-active') && header && !header.contains(e.target)) {
          setMenuOpen(false, false);
        }
      });
    }

    // Mobile accordion (Cards / Business groups)
    $$('.ant-collapse-header').forEach(function (head) {
      var item = head.closest('.ant-collapse-item');
      // Plain navigation rows already contain a link; leave those native links
      // alone and only wire actual accordion headings here.
      if (!item || head.querySelector('a[href]')) return;
      if (!head.hasAttribute('role')) head.setAttribute('role', 'button');
      if (!head.hasAttribute('tabindex')) head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', item.classList.contains('ant-collapse-item-active') ? 'true' : 'false');
      // keep the direct link inside a header clickable on its own
      head.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        e.preventDefault();
        var open = item.classList.toggle('ant-collapse-item-active');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
        var icon = item.querySelector('.ant-collapse-arrow');
        if (icon) icon.style.transform = open ? 'rotate(90deg)' : '';
      });
      head.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) {
          e.preventDefault();
          head.click();
        }
      });
    });

    // Desktop dropdowns: CSS :hover handles display, but make it keyboard
    // accessible and tap-friendly on touch devices.
    $$('.navbar-haveContent').forEach(function (item) {
      if (item.closest('.navbar-end.is-hidden-widescreen')) return;
      item.setAttribute('aria-haspopup', 'true');
      if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var open = item.classList.toggle('is-open');
          item.setAttribute('aria-expanded', open ? 'true' : 'false');
        } else if (e.key === 'Escape') {
          item.classList.remove('is-open');
          item.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     3. Pinned "video-like" intro  (hero -> no-account -> self-custody -> gift)
        The section is 400vh tall with a sticky stage; scroll progress
        cross-fades and parallaxes three slides exactly like the reference.
  --------------------------------------------------------------------- */
  function initPinnedIntro() {
    var pin = $('.homepage_pinintro');
    if (!pin) return;
    var stage = $('.homepage_pinintro_stage', pin);
    var slides = $$('.homepage_pinintro_slide', pin);
    if (!stage || slides.length === 0) return;

    var N = slides.length;      // 3
    var T = 0.318;              // pin-progress between consecutive transitions
    var A0 = 0.305;             // pin-progress where the first transition begins
    var TRAVEL = 0.6;           // each slide travels 60% of the stage height
    var lastProgress = null;

    /* Opacity ramps measured off the reference site, expressed against
       u = (p - start_k) / T so they stay correct at any viewport size. */
    var OUT = [[0, 1], [0.040, 0.975], [0.095, 0.690], [0.150, 0.430],
               [0.206, 0.185], [0.262, 0]];
    var IN  = [[0, 0], [0.110, 0], [0.150, 0.070], [0.206, 0.314],
               [0.262, 0.622], [0.318, 0.918], [0.375, 1]];

    function ramp(tbl, u) {
      var n = tbl.length;
      if (u <= tbl[0][0]) return tbl[0][1];
      if (u >= tbl[n - 1][0]) return tbl[n - 1][1];
      for (var i = 1; i < n; i++) {
        if (u <= tbl[i][0]) {
          var a = tbl[i - 1], b = tbl[i];
          return a[1] + (b[1] - a[1]) * ((u - a[0]) / (b[0] - a[0]));
        }
      }
      return tbl[n - 1][1];
    }
    function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    function pinOffset() {
      var v = parseFloat(getComputedStyle(pin).getPropertyValue('--pin-header'));
      if (v) return v;
      var header = $('.ballet-layout-header');
      return header ? header.getBoundingClientRect().height : 110;
    }

    function update() {
      var rect = pin.getBoundingClientRect();
      var stageH = stage.offsetHeight;
      var range = pin.offsetHeight - stageH;
      if (range <= 0) return;
      // sticky range: from when the stage pins to when the pin releases
      var p = clamp01((pinOffset() - rect.top) / range);
      if (p === lastProgress) return;
      lastProgress = p;

      var shift = stageH * TRAVEL;

      // per-transition travel progress (slide k leaves, slide k+1 arrives).
      // Measured off the reference: linear over [start - 0.0232, start + 0.1364].
      var g = [];
      for (var k = 0; k < N - 1; k++) {
        g[k] = clamp01((p - (A0 + k * T - 0.0232)) / 0.1596);
      }

      for (var i = 0; i < N; i++) {
        var slide = slides[i];
        var inOp = i === 0 ? 1 : ramp(IN, (p - (A0 + (i - 1) * T)) / T);
        var outOp = i === N - 1 ? 1 : ramp(OUT, (p - (A0 + i * T)) / T);
        var op = Math.min(inOp, outOp);

        var ty = shift * ((i > 0 ? (1 - g[i - 1]) : 0) - (i < N - 1 ? g[i] : 0));
        slide.style.opacity = op.toFixed(4);
        slide.style.visibility = op > 0.001 ? 'visible' : 'hidden';
        slide.setAttribute('aria-hidden', op > 0.001 ? 'false' : 'true');
        slide.style.transform = 'translate3d(0,' + ty.toFixed(2) + 'px,0)';

        // staggered reveal of the heading + description on the advantage slides
        var top = slide.querySelector('.homepage_advantage_top');
        var desc = slide.querySelector('.homepage_advantage_desc');
        if (top && desc && i > 0) {
          var r = clamp01((p - (A0 + (i - 1) * T + 0.155)) / 0.1232);
          top.style.opacity = r.toFixed(4);
          desc.style.opacity = r.toFixed(4);
          top.style.transform = 'translate3d(0,' + (36 * (1 - r)).toFixed(2) + 'px,0)';
          desc.style.transform = 'translate3d(0,' + (36 * (1 - r)).toFixed(2) + 'px,0)';
        }
      }
    }

    if (REDUCED) {
      // A reduced-motion preference should remove the long pinned scroll, not
      // leave the next two story panels hidden behind a 400vh blank section.
      pin.classList.add('motion-reduced');
      slides.forEach(function (s) {
        s.style.opacity = '1';
        s.style.visibility = 'visible';
        s.style.transform = 'none';
        s.setAttribute('aria-hidden', 'false');
        var top = s.querySelector('.homepage_advantage_top');
        var desc = s.querySelector('.homepage_advantage_desc');
        if (top) { top.style.opacity = '1'; top.style.transform = 'none'; }
        if (desc) { desc.style.opacity = '1'; desc.style.transform = 'none'; }
      });
      return;
    }

    var ticking = false;
    function refreshLayout() {
      measureHeader();
      lastProgress = null;
      update();
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; raf(function () { update(); ticking = false; }); }
    }, { passive: true });
    window.addEventListener('resize', refreshLayout, { passive: true });
    window.addEventListener('load', refreshLayout, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshLayout);
    if ('ResizeObserver' in window) {
      var header = $('.ballet-layout-header');
      if (header) {
        var ro = new ResizeObserver(refreshLayout);
        ro.observe(header);
      }
    }
    update();
  }

  /* ---------------------------------------------------------------------
     4. How it works — diagram reveals the "open" state on hover (desktop)
        and on tap (mobile), matching the reference behaviour.
  --------------------------------------------------------------------- */
  function initHowItWorks() {
    function wireDiagram(wrap, tracksHover) {
      if (!wrap) return;
      var closeImage = wrap.querySelector('.homepage_howitworks_diagram_close, .homepage_howitworks_mdiagram_close');
      var openImage = wrap.querySelector('.homepage_howitworks_diagram_open, .homepage_howitworks_mdiagram_open');
      var pressed = wrap.classList.contains('is_open');
      var hovered = false;

      wrap.setAttribute('role', 'button');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', 'Show or hide the card security details');

      function paint(open) {
        wrap.classList.toggle('is_open', open);
        if (closeImage) closeImage.setAttribute('aria-hidden', open ? 'true' : 'false');
        if (openImage) openImage.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      function toggle() {
        pressed = !pressed;
        wrap.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        paint(pressed || hovered);
      }
      wrap.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      paint(pressed);

      wrap.addEventListener('click', toggle);
      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });

      // Keep the desktop hover reveal and the touch/keyboard toggle in sync.
      if (tracksHover) {
        wrap.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'mouse') {
            hovered = true;
            paint(true);
          }
        });
        wrap.addEventListener('pointerleave', function (e) {
          if (e.pointerType === 'mouse') {
            hovered = false;
            paint(pressed);
          }
        });
      }
    }

    wireDiagram($('.homepage_howitworks_diagram_wrap'), true);
    wireDiagram($('.homepage_howitworks_mdiagram_wrap'), false);
  }

  /* ---------------------------------------------------------------------
     5. "Built to last" — flip card + material switcher
  --------------------------------------------------------------------- */
  function initBuilt() {
    var flip = $('.homepage_built_card_flip');
    if (flip) {
      function setFlipped(flipped) {
        flip.classList.toggle('is_flipped', flipped);
        flip.setAttribute('aria-pressed', flipped ? 'true' : 'false');
        flip.setAttribute('aria-label', flipped ? 'Flip card to see the front' : 'Flip card to see the back');
      }
      setFlipped(flip.classList.contains('is_flipped') || flip.getAttribute('aria-pressed') === 'true');
      // Native button click activation covers touch, mouse, Enter, and Space.
      flip.addEventListener('click', function () {
        setFlipped(!flip.classList.contains('is_flipped'));
      });
    }

    var list = $('.homepage_built_materials');
    var items = list ? $$('.homepage_built_material_item', list) : [];
    var selected = items.findIndex(function (btn) { return btn.getAttribute('aria-checked') === 'true'; });
    if (selected < 0) selected = 0;
    if (list) list.setAttribute('role', 'radiogroup');

    function selectMaterial(index, moveFocus) {
      if (!items.length) return;
      selected = (index + items.length) % items.length;
      items.forEach(function (btn, i) {
        btn.setAttribute('aria-checked', i === selected ? 'true' : 'false');
        btn.setAttribute('role', 'radio');
        btn.setAttribute('tabindex', i === selected ? '0' : '-1');
      });

      // Material selection swaps only the front/back artwork. The flip button
      // and its orientation stay independent so either finish can be flipped.
      var material = items[selected].getAttribute('data-material');
      if (flip && material) {
        $$('.homepage_built_card_img', flip).forEach(function (img) {
          var src = img.getAttribute('data-' + material + '-src');
          var alt = img.getAttribute('data-' + material + '-alt');
          if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
          if (alt) img.setAttribute('alt', alt);
        });
        flip.setAttribute('data-material', material);
      }
      if (moveFocus) items[selected].focus();
    }
    selectMaterial(selected, false);
    items.forEach(function (btn, i) {
      btn.addEventListener('click', function () { selectMaterial(i, false); });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          selectMaterial(selected + 1, true);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          selectMaterial(selected - 1, true);
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     6. Manage section — feature cells swap the phone screenshot
  --------------------------------------------------------------------- */
  function initManage() {
    var right = $('.homepage_manage_right');
    if (!right) return;
    var phone = right.querySelector('.homepage_manage_phone');
    var cells = $$('.homepage_manage_cell');
    var base = phone ? phone.getAttribute('src') : null;

    cells.forEach(function (cell, i) {
      cell.setAttribute('tabindex', '0');
      function activate() {
        cells.forEach(function (c) { c.classList.remove('homepage_manage_cell_active'); });
        cell.classList.add('homepage_manage_cell_active');
        var src = cell.getAttribute('data-phone') || base;
        if (phone && src) {
          phone.classList.remove('homepage_manage_phone_fade');
          // restart the CSS keyframe animation
          void phone.offsetWidth;
          phone.setAttribute('src', src);
          phone.classList.add('homepage_manage_phone_fade');
        }
      }
      if (i === 0) cell.classList.add('homepage_manage_cell_active');
      cell.addEventListener('click', activate);
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });

    /* mobile carousel ---------------------------------------------------- */
    var car = $('.homepage_manage_mcarousel');
    if (!car) return;
    var cphone = car.querySelector('.homepage_manage_mcarousel_phone');
    var cdesc = car.querySelector('.homepage_manage_mcarousel_desc span');
    var pill = car.querySelector('.homepage_manage_mcarousel_pill span');
    var sides = $$('.homepage_manage_mcarousel_side', car);
    var arrows = $$('.homepage_manage_mcarousel_arrow', car);
    var steps = [
      { t: 'Load', d: 'Scan the QR code to load crypto into your Ballet cold storage.' },
      { t: 'Send', d: 'Securely send your crypto assets to another address.' },
      { t: 'Explore', d: 'Buy wallets, activate addresses, contact Customer Support, and more.' },
      { t: 'Buy', d: 'Buy crypto and stack your coins easily.' },
      { t: 'Sell', d: 'Sell your assets effortlessly and earn $.' },
      { t: 'Swap', d: 'Convert funds from one currency to another.' }
    ];
    var idx = 0;
    function render() {
      var s = steps[idx];
      if (pill) pill.textContent = s.t;
      if (cdesc) cdesc.textContent = s.d;
      if (sides[0]) sides[0].querySelector('span').textContent = steps[(idx - 1 + steps.length) % steps.length].t;
      if (sides[1]) sides[1].querySelector('span').textContent = steps[(idx + 1) % steps.length].t;
      if (cphone) {
        cphone.classList.remove('homepage_manage_phone_fade');
        void cphone.offsetWidth;
        cphone.classList.add('homepage_manage_phone_fade');
      }
    }
    if (arrows[0]) arrows[0].addEventListener('click', function () { idx = (idx - 1 + steps.length) % steps.length; render(); });
    if (arrows[1]) arrows[1].addEventListener('click', function () { idx = (idx + 1) % steps.length; render(); });
    sides.forEach(function (b, i) {
      b.addEventListener('click', function () {
        idx = (idx + (i === 0 ? -1 : 1) + steps.length) % steps.length;
        render();
      });
    });
    render();
  }

  /* ---------------------------------------------------------------------
     7. Photo wall marquee (populated from the local photo assets)
  --------------------------------------------------------------------- */
  function initPhotoWall() {
    var wall = $('[data-photowall]');
    if (!wall) return;
    // the reference markup already ships the 18 tiles; only build them if absent
    if (wall.querySelector('.homepage_trust_photowall_track')) return;
    var imgs = [];
    for (var i = 1; i <= 9; i++) {
      imgs.push('/static/photowall-' + i + '-' + [
        'd3ed7c519bb102c741d86fab6d0cf5f2', '5a83ca72dcab25641279f3d8e2992b48',
        '8a4ae898566db89a45b1301e9a539714', '91688b90764f0c2e104382cfa0ef2bd8',
        '9fa531016ab6170b0eec9855659358c8', '665116ea6ea09fbe62162a64dd20cddb',
        'a2f20bd6c2a391aa6f9598fa6467497d', 'e57cc7fdaa93628f652aaed2c65e0d61',
        '06424f588a97a025283c60f2bef9eac9'
      ][i - 1] + '.jpg');
    }
    var track = document.createElement('div');
    track.className = 'homepage_trust_photowall_track';
    track.style.flexWrap = 'nowrap';
    // two passes of the nine photos so the -50% keyframe loops seamlessly
    var html = '';
    for (var pass = 0; pass < 2; pass++) {
      for (var j = 0; j < imgs.length; j++) {
        html += '<div class="homepage_trust_photowall_item" aria-hidden="false">' +
                '<img src="' + imgs[j] + '" alt=""></div>';
      }
    }
    track.innerHTML = html;
    wall.appendChild(track);
  }

  /* ---------------------------------------------------------------------
     8. Buy box — product configurator
  --------------------------------------------------------------------- */
  function initBuyBox() {
    var box = $('#buy-box');
    if (!box) return;

    var rows = $$('.shopify-module--row--53625', box);
    var thumbnailStrip = $('.shopify-module--thumbnailStrip--a318c', box);
    var mainImg = $('.shopify-module--galleryMain--72687 img', box);
    var logos = $$('.shopify-module--logoItem--a339c', box);
    var packs = $$('.shopify-module--packBtn--321f9', box);
    var qtyInput = $('.shopify-module--quantityValue--143b7', box);
    var qtyBtns = $$('.shopify-module--quantityBtn--09524', box);
    var orderBtn = $('.shopify-module--orderBtn--f6a22', box);
    var terms = $('.shopify-module--termsRow--c6880', box);
    var promoToggle = $('.shopify-module--promoToggle--4cdfd', box);
    var prevBtn = $('.shopify-module--galleryArrowPrev--c62e1', box);
    var nextBtn = $('.shopify-module--galleryArrowNext--48a92', box);

    var gallerySets = {
      gold: [
        { src: '/static/product-gallery/gold-front.webp', alt: '24K gold-plated Ballet Bitcoin card, front' },
        { src: '/static/product-gallery/gold-back.webp', alt: '24K gold-plated Ballet Bitcoin card, back' },
        { src: '/static/product-gallery/gold-handheld.webp', alt: '24K gold-plated Ballet card held in hand' }
      ],
      stainless: [
        { src: '/static/product-gallery/stainless-front.webp', alt: 'Stainless steel Ballet Bitcoin card, front' },
        { src: '/static/product-gallery/stainless-back.webp', alt: 'Stainless steel Ballet Bitcoin card, back' },
        { src: '/static/product-gallery/stainless-handheld.webp', alt: 'Stainless steel Ballet card held in hand' }
      ],
      coin: [
        { src: '/static/product-gallery/coin-front.webp', alt: 'Ballet Bitcoin cold storage coin, front' },
        { src: '/static/product-gallery/coin-back.webp', alt: 'Ballet Bitcoin cold storage coin, back' },
        { src: '/static/product-gallery/coin-handheld.webp', alt: 'Ballet Bitcoin cold storage coin held in hand' }
      ],
      gift: [
        { src: '/static/product-gallery/gift-set.webp', alt: 'Ballet Bitcoin gift card set' },
        { src: '/static/product-gallery/gift-front.webp', alt: 'Ballet Bitcoin gift card, front' },
        { src: '/static/product-gallery/gift-back.webp', alt: 'Ballet Bitcoin gift card, back' },
        { src: '/static/product-gallery/gift-handheld.webp', alt: 'Ballet Bitcoin gift card held in hand' }
      ]
    };
    var productGalleryKeys = ['gold', 'stainless', 'coin', 'gift'];
    var thumbs = [];
    var galleryIndex = 0;
    var price = 299;

    /* gallery -------------------------------------------------------- */
    function showImage(i) {
      if (!thumbs.length) return;
      galleryIndex = (i + thumbs.length) % thumbs.length;
      var img = thumbs[galleryIndex].querySelector('img');
      if (mainImg && img) {
        mainImg.setAttribute('src', img.getAttribute('src'));
        mainImg.setAttribute('alt', img.getAttribute('alt') || '');
        mainImg.classList.remove('is_swapping');
        void mainImg.offsetWidth;
        mainImg.classList.add('is_swapping');
      }
      thumbs.forEach(function (t, idx) {
        t.classList.toggle('shopify-module--thumbnailActive--6ea04', idx === galleryIndex);
        t.setAttribute('aria-pressed', idx === galleryIndex ? 'true' : 'false');
      });
    }
    function renderGallery(key) {
      var images = gallerySets[key] || gallerySets.gold;
      if (!thumbnailStrip || !mainImg || !images.length) return;
      thumbnailStrip.textContent = '';
      images.forEach(function (item, index) {
        var thumb = document.createElement('div');
        thumb.className = 'shopify-module--thumbnail--141ee';
        thumb.setAttribute('role', 'button');
        thumb.setAttribute('tabindex', '0');
        thumb.setAttribute('aria-label', 'View ' + item.alt);
        thumb.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
        var img = document.createElement('img');
        img.src = item.src;
        img.alt = item.alt;
        img.width = 100;
        img.height = 100;
        img.loading = 'lazy';
        img.decoding = 'async';
        thumb.appendChild(img);
        thumb.addEventListener('click', function () { showImage(index); });
        thumb.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showImage(index); }
        });
        thumbnailStrip.appendChild(thumb);
      });
      thumbs = $$('.shopify-module--thumbnail--141ee', thumbnailStrip);
      galleryIndex = 0;
      showImage(0);
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { showImage(galleryIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { showImage(galleryIndex + 1); });

    /* product rows --------------------------------------------------- */
    function selectProduct(row, index) {
      rows.forEach(function (r) {
        r.classList.remove('shopify-module--rowActive--8cbaa');
        r.setAttribute('aria-pressed', 'false');
      });
      row.classList.add('shopify-module--rowActive--8cbaa');
      row.setAttribute('aria-pressed', 'true');
      renderGallery(row.getAttribute('data-gallery-key') || productGalleryKeys[index] || 'gold');
      var priceEl = row.querySelector('.shopify-module--rowPrice--c54cf');
      if (priceEl) price = parseFloat(String(priceEl.textContent).replace(/[^0-9.]/g, '')) || price;
      updateOrder();
    }
    rows.forEach(function (row, i) {
      row.addEventListener('click', function () { selectProduct(row, i); });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });
    });
    var initialRow = rows.filter(function (row) {
      return row.classList.contains('shopify-module--rowActive--8cbaa');
    })[0] || rows[0];
    if (initialRow) selectProduct(initialRow, rows.indexOf(initialRow));

    /* logo / address options ----------------------------------------- */
    function selectLogo(el) {
      logos.forEach(function (l) {
        l.classList.remove('shopify-module--logoItemActive--5e327');
        l.setAttribute('aria-pressed', 'false');
      });
      el.classList.add('shopify-module--logoItemActive--5e327');
      el.setAttribute('aria-pressed', 'true');
    }
    logos.forEach(function (l) {
      l.addEventListener('click', function () { selectLogo(l); });
      l.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectLogo(l); }
      });
    });

    /* pack size ------------------------------------------------------ */
    packs.forEach(function (p) {
      p.addEventListener('click', function () {
        packs.forEach(function (x) { x.classList.remove('shopify-module--packBtnActive--92f5e'); });
        p.classList.add('shopify-module--packBtnActive--92f5e');
      });
      p.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.click(); }
      });
    });

    /* quantity ------------------------------------------------------- */
    function setQty(v) {
      if (!qtyInput) return;
      v = Math.max(1, Math.min(99, v || 1));
      qtyInput.value = v;
      if (qtyBtns[0]) qtyBtns[0].disabled = v <= 1;
      if (qtyBtns[1]) qtyBtns[1].disabled = v >= 99;
      updateOrder();
    }
    if (qtyBtns[0]) qtyBtns[0].addEventListener('click', function () { setQty((+qtyInput.value || 1) - 1); });
    if (qtyBtns[1]) qtyBtns[1].addEventListener('click', function () { setQty((+qtyInput.value || 1) + 1); });
    if (qtyInput) qtyInput.addEventListener('change', function () { setQty(+qtyInput.value); });

    /* promo code ----------------------------------------------------- */
    if (promoToggle) {
      promoToggle.addEventListener('click', function () {
        var row = promoToggle.closest('.shopify-module--promoRow--5b74f');
        if (!row) return;
        var open = row.classList.toggle('is_open');
        var input = row.querySelector('input');
        if (open && !input) {
          var wrapEl = document.createElement('div');
          wrapEl.className = 'shopify-module--promoInputWrap';
          wrapEl.innerHTML =
            '<input class="shopify-module--promoInput" type="text" placeholder="Enter promo code" aria-label="Promo code">' +
            '<button class="shopify-module--promoApply" type="button">Apply</button>';
          row.appendChild(wrapEl);
          row.querySelector('input').focus();
        } else if (!open && input) {
          input.closest('.shopify-module--promoInputWrap').remove();
        }
      });
    }

    /* terms checkbox -------------------------------------------------- */
    if (terms) {
      function toggleTerms() {
        var on = terms.getAttribute('aria-checked') !== 'true';
        terms.setAttribute('aria-checked', on ? 'true' : 'false');
        var cb = terms.querySelector('.shopify-module--termsCheckbox--7afc2');
        if (cb) cb.classList.toggle('shopify-module--termsChecked--028f5', on);
        updateOrder();
      }
      terms.addEventListener('click', toggleTerms);
      terms.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleTerms(); }
      });
    }

    /* order button ---------------------------------------------------- */
    function updateOrder() {
      if (!orderBtn) return;
      var qty = qtyInput ? (+qtyInput.value || 1) : 1;
      var total = (price * qty);
      orderBtn.innerHTML = '<span>Order</span> $' + total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      var agreed = terms ? terms.getAttribute('aria-checked') === 'true' : true;
      orderBtn.disabled = !agreed;
      orderBtn.classList.toggle('is_disabled', !agreed);
    }

    if (orderBtn) {
      orderBtn.addEventListener('click', function () {
        var agreed = terms ? terms.getAttribute('aria-checked') === 'true' : true;
        if (!agreed) {
          if (terms) {
            terms.classList.remove('shake');
            void terms.offsetWidth;
            terms.classList.add('shake');
            terms.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        window.open('https://store.ballet.com/', '_blank', 'noopener');
      });
    }

    updateOrder();
  }

  /* ---------------------------------------------------------------------
     9. FAQ accordion — one open at a time, animated max-height
  --------------------------------------------------------------------- */
  function initFaq() {
    var items = $$('.homepage_faq_item');
    items.forEach(function (item, index) {
      var q = $('.homepage_faq_question', item);
      var answer = $('.homepage_faq_answer_wrapper', item);
      if (!q) return;
      q.setAttribute('tabindex', '0');
      q.setAttribute('role', 'button');
      q.setAttribute('aria-expanded', 'false');
      if (answer) {
        if (!answer.id) answer.id = 'homepage-faq-answer-' + (index + 1);
        answer.setAttribute('role', 'region');
        answer.setAttribute('aria-hidden', 'true');
        answer.setAttribute('inert', '');
        q.setAttribute('aria-controls', answer.id);
      }

      function toggle() {
        var shouldOpen = !item.classList.contains('homepage_faq_item_open');
        items.forEach(function (other) {
          var otherQ = $('.homepage_faq_question', other);
          var otherAnswer = $('.homepage_faq_answer_wrapper', other);
          other.classList.remove('homepage_faq_item_open');
          if (otherQ) otherQ.setAttribute('aria-expanded', 'false');
          if (otherAnswer) {
            otherAnswer.setAttribute('aria-hidden', 'true');
            otherAnswer.setAttribute('inert', '');
          }
        });
        if (shouldOpen) {
          item.classList.add('homepage_faq_item_open');
          q.setAttribute('aria-expanded', 'true');
          if (answer) {
            answer.setAttribute('aria-hidden', 'false');
            answer.removeAttribute('inert');
          }
        }
      }
      q.addEventListener('click', toggle);
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---------------------------------------------------------------------
     10. Back to top
  --------------------------------------------------------------------- */
  function initBackToTop() {
    var btn = $('.homepage_backtotop');
    if (!btn) return;
    // CSS keeps this control mobile-only; just drive the visibility class.
    function update() {
      btn.classList.toggle('is_visible', window.pageYOffset > window.innerHeight);
    }
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    });
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------------
     11. Event ticker — keep the marquee accessible and easy to pause
  --------------------------------------------------------------------- */
  function initAwardTicker() {
    var ticker = $('.homepage_award_ticker');
    if (!ticker) return;
    ticker.setAttribute('role', 'region');
    ticker.setAttribute('aria-label', 'Ballet events and awards');
    ticker.setAttribute('tabindex', '0');
    var items = $$('.homepage_award_ticker_item', ticker);
    // The second half is the seamless-loop copy, not new information.
    if (items.length > 1 && items.length % 2 === 0) {
      var firstCopyCount = items.length / 2;
      items.forEach(function (item, i) {
        if (i >= firstCopyCount) item.setAttribute('aria-hidden', 'true');
      });
    }
  }

  /* ---------------------------------------------------------------------
     12. Scroll reveals
  --------------------------------------------------------------------- */
  function initReveal() {
    var els = $$('.scroll-reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || REDUCED) {
      els.forEach(function (e) { e.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) {
      // Captured/static HTML can contain a stale is-visible class from a prior
      // visit. Reset it so the observer owns the reveal timing on this visit.
      e.classList.remove('is-visible');
      io.observe(e);
    });
  }

  /* ---------------------------------------------------------------------
     12b. Lazy background artwork for the lower-page legacy section
  --------------------------------------------------------------------- */
  function initLazyBackgrounds() {
    var els = $$('.homepage_legacy_bg[data-lazy-bg], .homepage_legacy_bg_mo[data-lazy-bg]');
    if (!els.length) return;

    function loadBackground(el) {
      var url = el.getAttribute('data-lazy-bg');
      if (!url) return;
      el.style.setProperty('--legacy-bg-image', 'url("' + url + '")');
      el.classList.add('is-bg-loaded');
    }

    if (!('IntersectionObserver' in window)) {
      els.forEach(loadBackground);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadBackground(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '600px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     13. Anchor links + newsletter
  --------------------------------------------------------------------- */
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        if (!id) return;
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var header = $('.ballet-layout-header');
        var offset = header ? header.getBoundingClientRect().height : 0;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset - 8;
        var distance = Math.abs(top - window.pageYOffset);
        // Long jumps (for example, the hero's Shop Now button to the product
        // configurator) should respond immediately instead of feeling like a
        // click did nothing while a multi-screen smooth scroll is underway.
        var behavior = REDUCED || distance > Math.max(window.innerHeight * 2, 1200) ? 'auto' : 'smooth';
        window.scrollTo({ top: Math.max(0, top), behavior: behavior });
      });
    });
  }

  function initNewsletter() {
    var form = $('#omnisend-embedded-v2-69fd1858802852519965853b');
    if (!form) return;
    var input = form.querySelector('input[type=email]');
    var submit = form.querySelector('button[type=submit], button:not([type])');
    if (!input || !submit) return;
    // The reference posts to Omnisend; without their key we keep the UI
    // fully working locally and surface a clear confirmation message.
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = (input.value || '').trim();
      var err = form.querySelector('#omnisend-form-69fd1858802852519965853b-field-container-6a834bf0c297fcdf67ddcd1a-error');
      if (err) err.style.display = 'none';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        if (err) { err.style.display = 'block'; err.textContent = 'Please enter a valid email address.'; }
        input.focus();
        return;
      }
      var box = document.createElement('p');
      box.className = 'newsletter-ok';
      box.setAttribute('role', 'status');
      box.textContent = 'Thanks — you are subscribed to the Ballet newsletter.';
      form.appendChild(box);
      input.value = '';
      input.disabled = true;
      submit.disabled = true;
      try { window.localStorage.setItem('ballet_newsletter', value); } catch (_) {}
    });
  }

  /* ---------------------------------------------------------------------
     14. Language selector (footer + header)
  --------------------------------------------------------------------- */
  function initLangSelect() {
    var LANGS = [
      ['English', '/'], ['简体中文', '/zh/'], ['繁體中文', '/zh-TW/'], ['Français', '/fr/'],
      ['Español', '/es/'], ['Русский', '/ru/'], ['日本語', '/ja/'], ['Deutsch', '/de/'],
      ['한국어', '/ko/'], ['Italiano', '/it/'], ['Magyar', '/hu/']
    ];
    var host = window.location.hostname.toLowerCase();
    // Preview builds do not contain the locale pages. Send those previews to
    // the verified canonical language routes; on ballet.com stay same-origin.
    var localeOrigin = host === 'ballet.com' || host === 'www.ballet.com'
      ? window.location.origin : 'https://www.ballet.com';

    $$('.footer_languagebar_select, .header_languagebar_select').forEach(function (sel, index) {
      var trigger = sel.querySelector('.ant-select-selector') || sel;
      var item = sel.querySelector('.ant-select-selection-item');
      var dropdown = sel.querySelector('.footer_languagebar_dropdown, .header_languagebar_dropdown');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = sel.classList.contains('footer_languagebar_select')
          ? 'footer_languagebar_dropdown' : 'header_languagebar_dropdown';
        dropdown.style.cssText = 'position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:120;' +
          'max-height:260px;overflow:auto;display:none;';
        sel.appendChild(dropdown);
      }
      dropdown.id = dropdown.id || 'ballet-language-list-' + index;
      dropdown.setAttribute('role', 'listbox');
      if (!dropdown.querySelector('.ant-select-item-option')) {
        dropdown.innerHTML = LANGS.map(function (lang) {
          return '<div class="ant-select-item ant-select-item-option" role="option" data-href="' +
            lang[1] + '">' + lang[0] + '</div>';
        }).join('');
      }

      var options = $$('.ant-select-item-option', dropdown);
      options.forEach(function (opt) {
        opt.setAttribute('tabindex', '-1');
        opt.setAttribute('aria-selected', 'false');
      });
      var path = window.location.pathname.replace(/\/+$/, '') || '/';
      var current = LANGS.find(function (lang) {
        return (lang[1].replace(/\/+$/, '') || '/') === path;
      });
      if (current && item) item.textContent = current[0];
      if (current) {
        var currentOption = options.find(function (opt) { return opt.getAttribute('data-href') === current[1]; });
        if (currentOption) currentOption.setAttribute('aria-selected', 'true');
      }

      trigger.style.cursor = 'pointer';
      trigger.setAttribute('role', 'combobox');
      trigger.setAttribute('tabindex', '0');
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-controls', dropdown.id);
      trigger.setAttribute('aria-expanded', 'false');

      function toggle(force, focusIndex) {
        var open = dropdown.style.display === 'block';
        var next = typeof force === 'boolean' ? force : !open;
        dropdown.style.display = next ? 'block' : 'none';
        sel.classList.toggle('ant-select-open', next);
        trigger.setAttribute('aria-expanded', next ? 'true' : 'false');
        if (next && typeof focusIndex === 'number' && options.length) {
          options[(focusIndex + options.length) % options.length].focus();
        }
      }
      function navigate(opt) {
        if (!opt) return;
        var path = opt.getAttribute('data-href');
        if (!path || path.charAt(0) !== '/') return;
        if (item) item.textContent = opt.textContent;
        toggle(false);
        window.location.assign(localeOrigin + path);
      }

      trigger.addEventListener('click', function () { toggle(); });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          toggle(true, e.key === 'ArrowDown' ? 0 : options.length - 1);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (dropdown.style.display === 'block') {
            navigate(options.find(function (opt) { return opt.getAttribute('aria-selected') === 'true'; }));
          } else {
            toggle(true, 0);
          }
        } else if (e.key === 'Escape') {
          toggle(false);
        }
      });
      dropdown.addEventListener('click', function (e) {
        navigate(e.target.closest('.ant-select-item-option'));
      });
      dropdown.addEventListener('keydown', function (e) {
        var option = e.target.closest('.ant-select-item-option');
        var i = options.indexOf(option);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var step = e.key === 'ArrowDown' ? 1 : -1;
          options[(i + step + options.length) % options.length].focus();
        } else if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          options[e.key === 'Home' ? 0 : options.length - 1].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(option);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          toggle(false);
          trigger.focus();
        }
      });
      document.addEventListener('click', function (e) {
        if (!sel.contains(e.target)) toggle(false);
      });
    });
  }

  /* ---------------------------------------------------------------------
     boot
  --------------------------------------------------------------------- */
  onReady(function () {
    measureHeader();
    initHeader();
    initNav();
    initPinnedIntro();
    initHowItWorks();
    initBuilt();
    initManage();
    initPhotoWall();
    initBuyBox();
    initFaq();
    initBackToTop();
    initAwardTicker();
    initReveal();
    initLazyBackgrounds();
    initAnchors();
    initNewsletter();
    initLangSelect();
    // fonts can shift layout — re-measure once they are ready
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measureHeader(); });
    }
    window.addEventListener('load', measureHeader);
  });
})();

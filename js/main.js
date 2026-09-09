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
    if (h) s.setProperty('--header-h', h + 'px');
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
    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = burger.classList.toggle('is-active');
        menu.classList.toggle('is-active', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
      });
    }

    // Mobile accordion (Cards / Business groups)
    $$('.ant-collapse-header').forEach(function (head) {
      var item = head.closest('.ant-collapse-item');
      if (!item) return;
      // keep the direct link inside a header clickable on its own
      head.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        e.preventDefault();
        var open = item.classList.toggle('ant-collapse-item-active');
        var icon = item.querySelector('.ant-collapse-arrow');
        if (icon) icon.style.transform = open ? 'rotate(90deg)' : '';
      });
    });

    // Desktop dropdowns: CSS :hover handles display, but make it keyboard
    // accessible and tap-friendly on touch devices.
    $$('.navbar-haveContent').forEach(function (item) {
      if (item.closest('.navbar-end.is-hidden-widescreen')) return;
      item.setAttribute('aria-haspopup', 'true');
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.classList.toggle('is-open');
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
      slides.forEach(function (s, i) {
        s.style.opacity = i === 0 ? '1' : '0';
        s.style.visibility = i === 0 ? 'visible' : 'hidden';
      });
      return;
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; raf(function () { update(); ticking = false; }); }
    }, { passive: true });
    window.addEventListener('resize', function () { lastProgress = null; update(); });
    update();
  }

  /* ---------------------------------------------------------------------
     4. How it works — diagram reveals the "open" state on hover (desktop)
        and on tap (mobile), matching the reference behaviour.
  --------------------------------------------------------------------- */
  function initHowItWorks() {
    var wrap = $('.homepage_howitworks_diagram_wrap');
    if (wrap) {
      // desktop uses :hover in CSS; add tap support for touch
      wrap.addEventListener('click', function () {
        if (window.matchMedia('(hover: none)').matches) {
          wrap.classList.toggle('is_open');
        }
      });
    }

    var mwrap = $('.homepage_howitworks_mdiagram_wrap');
    if (mwrap) {
      mwrap.addEventListener('click', function () { mwrap.classList.toggle('is_open'); });
    }
  }

  /* ---------------------------------------------------------------------
     5. "Built to last" — flip card + material switcher
  --------------------------------------------------------------------- */
  function initBuilt() {
    var flip = $('.homepage_built_card_flip');
    if (flip) flip.addEventListener('click', function () { flip.classList.toggle('is_flipped'); });

    var items = $$('.homepage_built_material_item');
    items.forEach(function (btn, i) {
      btn.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
      btn.setAttribute('role', 'radio');
      btn.addEventListener('click', function () {
        items.forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
        btn.setAttribute('aria-checked', 'true');
      });
    });
    var list = $('.homepage_built_materials');
    if (list) list.setAttribute('role', 'radiogroup');
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
    var thumbs = $$('.shopify-module--thumbnail--141ee', box);
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
      });
    }
    thumbs.forEach(function (t, i) {
      t.addEventListener('click', function () { showImage(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showImage(i); }
      });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { showImage(galleryIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { showImage(galleryIndex + 1); });

    /* product rows --------------------------------------------------- */
    rows.forEach(function (row, i) {
      row.addEventListener('click', function () {
        rows.forEach(function (r) { r.classList.remove('shopify-module--rowActive--8cbaa'); });
        row.classList.add('shopify-module--rowActive--8cbaa');
        var priceEl = row.querySelector('.shopify-module--rowPrice--c54cf');
        if (priceEl) {
          price = parseFloat(String(priceEl.textContent).replace(/[^0-9.]/g, '')) || price;
          updateOrder();
        }
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });
    });

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
    items.forEach(function (item) {
      var q = $('.homepage_faq_question', item);
      if (!q) return;
      q.setAttribute('tabindex', '0');
      q.setAttribute('role', 'button');
      q.setAttribute('aria-expanded', 'false');
      function toggle() {
        var open = item.classList.contains('homepage_faq_item_open');
        items.forEach(function (other) {
          other.classList.remove('homepage_faq_item_open');
          var oq = $('.homepage_faq_question', other);
          if (oq) oq.setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          item.classList.add('homepage_faq_item_open');
          q.setAttribute('aria-expanded', 'true');
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
     11. Scroll reveals
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
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------------------------------------------------------------------
     12. Anchor links + newsletter
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
        window.scrollTo({ top: Math.max(0, top), behavior: REDUCED ? 'auto' : 'smooth' });
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
     13. Language selector (footer + header)
  --------------------------------------------------------------------- */
  function initLangSelect() {
    var LANGS = [
      ['English', '/'], ['简体中文', '/zh/'], ['繁體中文', '/zh-TW/'], ['Français', '/fr/'],
      ['Español', '/es/'], ['Русский', '/ru/'], ['日本語', '/ja/'], ['Deutsch', '/de/'],
      ['한국어', '/ko/'], ['Italiano', '/it/'], ['Magyar', '/hu/']
    ];
    $$('.footer_languagebar_select, .header_languagebar_select').forEach(function (sel) {
      var trigger = sel.querySelector('.ant-select-selector') || sel;
      var item = sel.querySelector('.ant-select-selection-item');
      var dropdown = sel.querySelector('.footer_languagebar_dropdown, .header_languagebar_dropdown');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = sel.classList.contains('footer_languagebar_select')
          ? 'footer_languagebar_dropdown' : 'header_languagebar_dropdown';
        dropdown.setAttribute('role', 'listbox');
        dropdown.style.cssText = 'position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:120;' +
          'max-height:260px;overflow:auto;display:none;';
        dropdown.innerHTML = LANGS.map(function (l) {
          return '<div class="ant-select-item ant-select-item-option" role="option" data-href="' + l[1] + '">' + l[0] + '</div>';
        }).join('');
        sel.appendChild(dropdown);
      }
      trigger.style.cursor = 'pointer';
      trigger.setAttribute('role', 'combobox');
      trigger.setAttribute('tabindex', '0');
      function toggle(force) {
        var open = dropdown.style.display === 'block';
        var next = typeof force === 'boolean' ? force : !open;
        dropdown.style.display = next ? 'block' : 'none';
        sel.classList.toggle('ant-select-open', next);
      }
      trigger.addEventListener('click', function () { toggle(); });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        if (e.key === 'Escape') toggle(false);
      });
      dropdown.addEventListener('click', function (e) {
        var opt = e.target.closest('.ant-select-item-option');
        if (!opt) return;
        if (item) item.textContent = opt.textContent;
        toggle(false);
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
    initReveal();
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

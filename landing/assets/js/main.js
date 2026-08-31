/* ══════════════════════════════════════════════
   DzERP landing — تفاعلات الصفحة (بدون مكتبات)
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* الترجمة: i18n.js يوفّرها، وهذه شبكة أمان إن لم يُحمَّل */
  function tr(key) { return window.DzI18n ? window.DzI18n.t(key) : key; }

  /* ─── الوضع الليلي ─── */
  var KEY = 'dzerp-theme';
  var root = document.documentElement;

  function setTheme(mode) {
    root.setAttribute('data-theme', mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#070b16' : '#f7f9fd');
    try { localStorage.setItem(KEY, mode); } catch (e) {}
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  setTheme(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  var themeBtn = $('#themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ─── قائمة الهاتف ─── */
  var menuBtn = $('#menuToggle');
  var nav = $('#nav');
  function closeMenu() {
    if (!nav) return;
    nav.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ─── التمرير: الترويسة، شريط التقدّم، الرابط النشط، الأزرار العائمة ─── */
  var header    = $('#header');
  var progress  = $('#progress');
  var toTop     = $('#toTop');
  var mobileBar = $('#mobileBar');
  var sections  = $$('main section[id]');
  var navLinks  = $$('.nav a');
  var ticking   = false;

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle('is-stuck', y > 8);
    if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    if (toTop) toTop.classList.toggle('is-on', y > 700);
    if (mobileBar) mobileBar.classList.toggle('is-on', y > 600 && y < max - 400);

    var pos = y + 160, current = '';
    sections.forEach(function (sec) { if (sec.offsetTop <= pos) current = sec.id; });
    navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + current); });

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ─── توهّج يتبع المؤشر على البطاقات ─── */
  if (!reduced && window.matchMedia('(hover: hover)').matches) {
    $$('.why-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ─── تبويبات الوحدات ─── */
  var mods = $$('#modGrid .mod');
  $$('#modules .tab').forEach(function (tab, _, all) {
    tab.addEventListener('click', function () {
      var g = tab.dataset.group;
      all.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      mods.forEach(function (m) {
        m.classList.toggle('is-hidden', g !== 'all' && m.dataset.group !== g);
      });
    });
  });

  /* ─── تصفية المعرض ─── */
  var shots = $$('#gallery .shot');
  $$('#showcase .tab').forEach(function (tab, _, all) {
    tab.addEventListener('click', function () {
      var cat = tab.dataset.filter;
      all.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      shots.forEach(function (s) {
        s.classList.toggle('is-hidden', cat !== 'all' && s.dataset.cat !== cat);
      });
    });
  });

  /* ─── عارض الصور ─── */
  var lb      = $('#lightbox');
  var lbImg   = $('#lbImg');
  var lbCap   = $('#lbCap');
  var lbCount = $('#lbCount');
  var index   = 0;
  var opener  = null;

  function visible() { return shots.filter(function (s) { return !s.classList.contains('is-hidden'); }); }

  function show(i) {
    var list = visible();
    if (!list.length) return;
    index = (i + list.length) % list.length;
    var fig = list[index];
    var img = fig.querySelector('img');
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = fig.querySelector('figcaption').firstElementChild.textContent.trim();
    lbCount.textContent = '(' + (index + 1) + ' / ' + list.length + ')';
  }

  function openLb(fig) {
    opener = fig;
    show(visible().indexOf(fig));
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lbClose').focus();
  }

  function closeLb() {
    lb.hidden = true;
    lbImg.src = '';
    document.body.style.overflow = '';
    if (opener) { opener.focus(); opener = null; }
  }

  shots.forEach(function (fig) {
    fig.addEventListener('click', function () { openLb(fig); });
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(fig); }
    });
  });

  if (lb) {
    $('#lbClose').addEventListener('click', closeLb);
    // في RTL، "السابق" على اليمين — لذلك الاتجاهان معكوسان عمدا
    $('#lbPrev').addEventListener('click', function () { show(index - 1); });
    $('#lbNext').addEventListener('click', function () { show(index + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      // اتجاه الأسهم يتبع اتجاه الصفحة / le sens des flèches suit la direction de la page
      var rtl = document.documentElement.getAttribute('dir') !== 'ltr';
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight') show(index + (rtl ? -1 : 1));
      if (e.key === 'ArrowLeft') show(index + (rtl ? 1 : -1));
    });
  }

  /* ─── الأسئلة: فتح واحد في كل مرة ─── */
  var qas = $$('.qa');
  qas.forEach(function (qa) {
    qa.addEventListener('toggle', function () {
      if (!qa.open) return;
      qas.forEach(function (other) { if (other !== qa) other.open = false; });
    });
  });

  /* ─── نموذج الطلب (عرض فقط — يُربط لاحقا بالخادم) ─── */
  var form = $('#demoForm');
  var note = $('#formNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#f-name'), phone = $('#f-phone');
      [name, phone].forEach(function (f) { f.classList.remove('is-invalid'); });
      var bad = [name, phone].filter(function (f) { return !f.value.trim(); });
      bad.forEach(function (f) { f.classList.add('is-invalid'); });

      if (bad.length) {
        note.textContent = tr('form.err');
        note.classList.add('is-error');
        bad[0].focus();
        return;
      }

      note.classList.remove('is-error');
      note.textContent = tr('form.ok');
      form.reset();
    });
  }

  /* ─── عدّاد الأرقام ─── */
  function countUp(el) {
    var target = parseInt(el.dataset.count, 10);
    var prefix = el.dataset.prefix || '';
    var suffix = el.dataset.suffix || '';
    if (reduced) { el.textContent = prefix + target + suffix; return; }
    var start = performance.now(), dur = 1400;
    (function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  /* ─── الظهور التدريجي ─── */
  var targets = $$('.why-card, .mod, .shot, .step, .plan, .qa, .stat, .spot-copy, .spot-media, .section-head');
  targets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = Array.prototype.slice.call(el.parentNode.children).filter(function (n) {
          return n.classList.contains('reveal');
        });
        var i = siblings.indexOf(el);
        el.style.transitionDelay = Math.min(i, 6) * 70 + 'ms';
        el.classList.add('is-in');
        var num = el.querySelector('[data-count]');
        if (num && !num.dataset.done) { num.dataset.done = '1'; countUp(num); }
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    $$('[data-count]').forEach(countUp);
  }

  /* ─── إعادة الحساب عند تغيير اللغة ─── */
  document.addEventListener('dz:lang', function () {
    if (note) note.textContent = '';
    onScroll();
  });

  /* ─── سنة التذييل ─── */
  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();

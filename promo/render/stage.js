/**
 * Draws one frame of a promo video at time t (seconds). render.mjs passes the
 * resolved spec (setup) and then calls draw(t) per frame; draw resolves once all
 * images of the frame are decoded.
 */
(function () {
  let spec = null;
  let L = null; // layout for the format
  const stage = document.getElementById('stage');

  // ---- Layouts (safe zones: brief — 9:16 keeps out of top 270 / bottom 380 / right 120) ----
  const LAYOUTS = {
    '9x16': {
      W: 1080,
      H: 1920,
      safe: { x0: 40, x1: 960, y0: 285, y1: 1540 },
      caption: { x: 60, y: 300, w: 880, h: 270, size: 80 },
      phone: { cx: 500, top: 600, screenW: 525 },
      twoPhones: { cx: [285, 715], top: 650, screenW: 405 },
      timer: { cx: 500, y: 300, size: 120 },
      speedCaption: { x: 60, y: 440, w: 880, h: 170, size: 64 },
      speedPhone: { cx: 500, top: 630, screenW: 500 },
    },
    '4x5': {
      W: 1080,
      H: 1350,
      safe: { x0: 50, x1: 1030, y0: 40, y1: 1310 },
      caption: { x: 60, y: 40, w: 960, h: 220, size: 70 },
      phone: { cx: 540, top: 285, screenW: 560 },
      twoPhones: { cx: [300, 780], top: 300, screenW: 440 },
      timer: { cx: 540, y: 34, size: 100 },
      speedCaption: { x: 60, y: 160, w: 960, h: 120, size: 56 },
      speedPhone: { cx: 540, top: 300, screenW: 545 },
    },
  };

  // ---- Easing (the game's motion: timed, a small "back" overshoot, never wobbly) ----
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const easeOutBack = (x) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  /** A pop-in like the game's popTo(): 0 → 1 over `dur` with a small overshoot. */
  const pop = (t, start, dur = 0.32) => easeOutBack(clamp((t - start) / dur));
  const fade = (t, start, dur = 0.14) => clamp((t - start) / dur);

  // ---- DOM helpers ----
  const pending = [];
  function el(tag, cls, style = {}, parent = stage) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    Object.assign(e.style, style);
    parent.appendChild(e);
    return e;
  }
  function img(src, cls, style, parent) {
    const e = el('img', cls, style, parent);
    e.src = src;
    pending.push(e.decode().catch(() => undefined));
    return e;
  }
  const px = (n) => `${Math.round(n * 100) / 100}px`;

  /** Text with emoji replaced by the game's Twemoji art (same look on every device). */
  function richText(parent, text) {
    const parts = Array.from(text);
    let run = '';
    const flush = () => {
      if (run) parent.appendChild(document.createTextNode(run));
      run = '';
    };
    for (const ch of parts) {
      const cp = ch.codePointAt(0);
      const art = cp >= 0x2300 ? spec.assets.twemoji[cp.toString(16)] : undefined;
      if (art) {
        flush();
        img(art, 'emoji', {}, parent);
      } else if (cp === 0xfe0f || cp === 0xfe0e) {
        // variation selector: nothing to draw
      } else run += ch;
    }
    flush();
  }

  function caption(text, box, t, start) {
    if (!text) return;
    const s = pop(t, start);
    const c = el('div', 'caption', {
      left: px(box.x),
      top: px(box.y),
      width: px(box.w),
      height: px(box.h),
      fontSize: px(box.size),
      opacity: String(fade(t, start)),
      transform: `scale(${0.72 + 0.28 * s})`,
    });
    c.dir = spec.lang === 'he' ? 'rtl' : 'ltr';
    c.lang = spec.lang;
    const span = el('span', '', {}, c);
    richText(span, text);
  }

  function background() {
    stage.innerHTML = '';
    Object.assign(stage.style, { width: px(L.W), height: px(L.H) });
    el('div', 'glow', {
      left: px(-L.W * 0.35),
      top: px(L.H * 0.12),
      width: px(L.W * 1.7),
      height: px(L.W * 1.7),
    });
  }

  // ---- Footage ----
  /** The recorded frame showing absolute time `abs` (the newest frame not after it). */
  function frameAt(clipName, abs) {
    const frames = spec.clips[clipName].frames;
    let lo = 0;
    let hi = frames.length - 1;
    if (abs <= frames[0].t) return frames[0].url;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid].t <= abs) lo = mid;
      else hi = mid - 1;
    }
    return frames[lo].url;
  }

  const URLBAR = 34; // CSS px of the generic browser address bar (at 360-px-wide screen)

  /** A generic phone (no brand) showing a footage frame; returns the screen box. */
  function phone(cx, top, screenW, frameUrl, opts = {}) {
    const scale = screenW / 360;
    const bar = opts.browser ? URLBAR * scale : 0;
    const screenH = 640 * scale + bar;
    const pad = screenW * 0.035;
    const body = el('div', 'phone', {
      left: px(cx - screenW / 2 - pad),
      top: px(top - pad * 1.6),
      width: px(screenW + pad * 2),
      height: px(screenH + pad * 3.2),
      borderRadius: px(screenW * 0.13),
      transform: opts.transform ?? '',
    });
    const screen = el(
      'div',
      'screen',
      {
        left: px(pad),
        top: px(pad * 1.6),
        width: px(screenW),
        height: px(screenH),
        borderRadius: px(screenW * 0.085),
      },
      body,
    );
    if (opts.browser) {
      const barEl = el('div', 'urlbar', { height: px(bar), fontSize: px(13 * scale) }, screen);
      const field = el('div', 'field', {}, barEl);
      richText(field, `🔒 ${spec.webHost}`);
    }
    const holder = el(
      'div',
      'abs',
      { left: '0', top: px(bar), width: px(screenW), height: px(640 * scale), overflow: 'hidden' },
      screen,
    );
    if (frameUrl) {
      img(frameUrl, 'footage', { transform: opts.zoom ? `scale(${opts.zoom})` : '' }, holder);
    }
    return body;
  }

  // ---- Scenes ----
  const scenes = {
    phone(sc, t) {
      const frozen = sc.freezeAfter !== undefined ? Math.min(t, sc.freezeAfter) : t;
      const abs = sc.abs0 + frozen;
      const zoom = sc.zoom ? 1 + (sc.zoom - 1) * easeInOut(clamp(t / sc.dur)) : 0;
      phone(L.phone.cx, L.phone.top, L.phone.screenW, frameAt(sc.clip, abs), {
        browser: sc.browser,
        zoom,
        transform: `scale(${0.96 + 0.04 * pop(t, 0, 0.3)})`,
      });
      captions(sc, t);
    },
    'two-phones'(sc, t) {
      const abs = sc.abs0 + t;
      const p = L.twoPhones;
      phone(p.cx[0], p.top, p.screenW, frameAt(sc.left, abs));
      phone(p.cx[1], p.top, p.screenW, frameAt(sc.right, abs), { browser: true });
      captions(sc, t);
    },
    montage(sc, t) {
      let start = 0;
      for (const part of sc.clips) {
        if (t < start + part.dur || part === sc.clips.at(-1)) {
          const local = t - start;
          phone(L.phone.cx, L.phone.top, L.phone.screenW, frameAt(part.clip, part.abs0 + local), {
            transform: `scale(${0.97 + 0.03 * pop(local, 0, 0.25)})`,
          });
          break;
        }
        start += part.dur;
      }
      captions(sc, t);
    },
    speedrun(sc, t) {
      const runT = sc.abs0 + Math.min(t, sc.runEnd);
      const after = t > sc.runEnd;
      phone(
        L.speedPhone.cx,
        L.speedPhone.top,
        L.speedPhone.screenW,
        frameAt(sc.clip, after ? sc.abs0 + t : runT),
      );
      // The countdown: real elapsed time of the run (it starts at the first tap).
      const elapsed = clamp(t - sc.runStart, 0, sc.runEnd - sc.runStart);
      const left = Math.max(0, sc.limit - elapsed);
      const tm = L.timer;
      const done = t >= sc.runEnd;
      const box = el('div', 'pill', {
        left: px(tm.cx - tm.size * 1.45),
        top: px(tm.y),
        width: px(tm.size * 2.9),
        height: px(tm.size * 1.12),
        fontSize: px(tm.size * 0.78),
        background: done ? '#3ddc97' : left < 5 ? '#f2476f' : '#ffc83d',
        color: done ? '#063d27' : left < 5 ? '#fff' : '#5c3b00',
        boxShadow: '0 10px 0 rgba(0,0,0,0.18), 0 18px 30px rgba(20,10,60,0.35)',
        transform: `scale(${done ? 1 + 0.08 * (1 - clamp((t - sc.runEnd) / 0.4)) : 1})`,
        fontVariantNumeric: 'tabular-nums',
      });
      richText(box, `⏱ ${left.toFixed(1)}`);
      if (t < sc.captionDur) caption(sc.caption[spec.lang], L.speedCaption, t, 0.05);
      if (after) caption(sc.after.caption[spec.lang], L.speedCaption, t, sc.runEnd + 0.15);
    },
    'hook-flip'(sc, t) {
      // A card of the game flips over and shows Grandma — motion from the first frame.
      const size = L.W * 0.56;
      const cx = L.phone.cx;
      const cy = L.format === '9x16' ? 1090 : 760;
      const flipP = easeInOut(clamp((t - 0.35) / 0.55));
      const angle = 180 * flipP;
      const lift = 1 + 0.06 * Math.sin(Math.PI * flipP) + 0.04 * clamp(t / 0.35);
      const drift = t * 10;
      const wrap = el('div', 'abs', {
        left: px(cx - size / 2),
        top: px(cy - size / 2 - drift),
        width: px(size),
        height: px(size),
        perspective: '1800px',
      });
      const inner = el(
        'div',
        'abs',
        {
          inset: '0',
          transformStyle: 'preserve-3d',
          transform: `scale(${lift}) rotateY(${angle}deg) rotateZ(${(1 - flipP) * -6}deg)`,
        },
        wrap,
      );
      const back = el(
        'div',
        'card',
        { inset: '0', border: `${px(size * 0.035)} solid #fff8ec` },
        inner,
      );
      img(spec.assets.cardBack, '', { inset: '0', width: '100%', height: '100%' }, back);
      const face = el(
        'div',
        'card',
        {
          inset: '0',
          transform: 'rotateY(180deg)',
          border: `${px(size * 0.035)} solid #fff8ec`,
          boxShadow:
            flipP > 0.95 ? `0 0 0 ${px(size * 0.03)} #ffc83d, 0 14px 30px rgba(20,10,60,.4)` : '',
        },
        inner,
      );
      img(spec.assets.photos[sc.photo], '', { inset: '0', width: '100%', height: '100%' }, face);
      caption(sc.caption[spec.lang], L.caption, t, 0.05);
    },
    gallery(sc, t) {
      // Choosing photos (checks appear one by one), then they become game cards.
      const names = spec.assets.photoOrder;
      const cols = 3;
      const cell = L.W * 0.255;
      const gap = L.W * 0.02;
      const gridW = cols * cell + (cols - 1) * gap;
      const gx = L.phone.cx - gridW / 2;
      const gy = L.format === '9x16' ? 700 : 330;
      const toCards = easeInOut(clamp((t - 1.45) / 0.8));
      const cardSize = L.W * 0.19;
      names.forEach((name, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x0 = gx + c * (cell + gap);
        const y0 = gy + r * (cell + gap);
        // Target: two rows of four cards, slightly fanned.
        const tr = Math.floor(i / 4);
        const tc = i % 4;
        const x1 = L.phone.cx - (4 * cardSize + 3 * gap) / 2 + tc * (cardSize + gap);
        const y1 = gy + cell * 0.6 + tr * (cardSize + gap * 1.5);
        const size = cell + (cardSize - cell) * toCards;
        const x = x0 + (x1 - x0) * toCards + ((cell - size) / 2) * (1 - toCards);
        const y = y0 + (y1 - y0) * toCards;
        const rot = toCards * ((tc - 1.5) * 4);
        const tile = el('div', toCards > 0 ? 'card' : 'abs', {
          left: px(x),
          top: px(y),
          width: px(size),
          height: px(size),
          borderRadius: px(toCards * size * 0.16 + (1 - toCards) * 10),
          overflow: 'hidden',
          border: toCards > 0 ? `${px(size * 0.05 * toCards)} solid #fff8ec` : '0',
          transform: `rotate(${rot}deg)`,
          opacity: String(fade(t, 0.05 * i, 0.2)),
        });
        img(
          spec.assets.photos[name],
          '',
          { left: '0', top: '0', width: '100%', height: '100%', objectFit: 'cover' },
          tile,
        );
        const checkAt = 0.35 + i * 0.11;
        if (t >= checkAt && toCards < 0.5) {
          const s = pop(t, checkAt, 0.22);
          const check = el(
            'div',
            'pill',
            {
              right: px(size * 0.06),
              top: px(size * 0.06),
              width: px(size * 0.24),
              height: px(size * 0.24),
              background: '#3ddc97',
              color: '#063d27',
              border: `${px(size * 0.025)} solid #fff`,
              fontSize: px(size * 0.15),
              transform: `scale(${s})`,
            },
            tile,
          );
          check.textContent = '✓';
        }
      });
      caption(sc.caption[spec.lang], L.caption, t, 0.05);
    },
    chat(sc, t) {
      // A generic chat (no app branding) with the game's real invite message and link card.
      const w = L.W * 0.78;
      const x = L.phone.cx - w / 2;
      const y =
        (L.format === '9x16' ? 700 : 320) + 60 * (1 - easeOutCubic(clamp((t - 0.15) / 0.4)));
      const bubble = el('div', 'abs', {
        left: px(x),
        top: px(y),
        width: px(w),
        background: '#ffffff',
        borderRadius: px(36),
        borderBottomRightRadius: px(8),
        padding: px(18),
        boxSizing: 'border-box',
        boxShadow: '0 16px 40px rgba(20,10,60,0.35)',
        opacity: String(fade(t, 0.15, 0.2)),
        transform: `scale(${0.9 + 0.1 * pop(t, 0.15, 0.35)})`,
        transformOrigin: '100% 100%',
        color: '#2b2152',
        fontWeight: '600',
        fontSize: px(L.W * 0.03),
        lineHeight: '1.3',
      });
      img(
        spec.assets.ogInvite,
        '',
        { position: 'static', display: 'block', width: '100%', borderRadius: px(22) },
        bubble,
      );
      const title = el(
        'div',
        '',
        { marginTop: px(12), fontWeight: '700', fontSize: px(L.W * 0.032) },
        bubble,
      );
      title.textContent = "You're invited to play Memory Match! 🃏".replace('🃏', '');
      richText(title, '🃏');
      const host = el('div', '', { color: '#7a7299', fontSize: px(L.W * 0.026) }, bubble);
      host.textContent = spec.webHost;
      const text = el('div', '', { marginTop: px(10), direction: 'ltr' }, bubble);
      text.innerHTML = '';
      richText(text, spec.inviteText.before);
      const link = el('span', '', { color: '#178ed3', textDecoration: 'underline' }, text);
      link.textContent = spec.inviteText.link;
      richText(text, spec.inviteText.after);
      const ticks = el(
        'div',
        '',
        { textAlign: 'right', color: '#178ed3', fontSize: px(L.W * 0.026), marginTop: px(6) },
        bubble,
      );
      ticks.textContent = t > 0.9 ? '✓✓' : '✓';
      caption(sc.caption[spec.lang], L.caption, t, 0.05);
    },
    endcard(sc, t) {
      const e = spec.endcard;
      const cx = L.format === '9x16' ? 500 : 540;
      const base = L.format === '9x16' ? 560 : 120;
      const k = L.format === '9x16' ? 1 : 0.88;
      // The logo: two tilted cards with question marks (the app icon's artwork).
      const logo = el('div', 'abs', {
        left: px(cx - 220 * k),
        top: px(base),
        width: px(440 * k),
        height: px(330 * k),
        transform: `scale(${pop(t, 0, 0.4)})`,
      });
      const cardStyle = (left, rot, color) => ({
        left: px(left * k),
        top: px(20 * k),
        width: px(200 * k),
        height: px(260 * k),
        borderRadius: px(40 * k),
        background: color,
        border: `${px(12 * k)} solid #fff8ec`,
        transform: `rotate(${rot}deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: '700',
        fontSize: px(150 * k),
        boxShadow: '0 16px 30px rgba(20,10,60,0.35)',
      });
      el('div', 'abs', cardStyle(40, -13, '#f2476f'), logo).textContent = '?';
      el('div', 'abs', cardStyle(200, 11, '#178ed3'), logo).textContent = '?';
      const sparkle = el(
        'div',
        'abs',
        { left: px(390 * k), top: px(-10 * k), fontSize: px(70 * k), color: '#ffc83d' },
        logo,
      );
      sparkle.textContent = '✦';
      const line = (text, top, size, start, color = '#fff', dir) => {
        const d = el('div', 'caption', {
          left: px(40),
          top: px(top),
          width: px(cx * 2 - 80),
          height: px(size * 1.4),
          fontSize: px(size),
          color,
          opacity: String(fade(t, start)),
          transform: `scale(${0.75 + 0.25 * pop(t, start)})`,
        });
        if (dir) d.dir = dir;
        richText(d, text);
      };
      line('Memory Match', base + 380 * k, 112 * k, 0.2);
      line(e.line1, base + 540 * k, 74 * k, 0.55, '#ffc83d', spec.lang === 'he' ? 'rtl' : 'ltr');
      line(e.line2, base + 640 * k, 58 * k, 0.75, '#fff', spec.lang === 'he' ? 'rtl' : 'ltr');
      const url = el('div', 'pill', {
        left: px(cx - 400 * k),
        top: px(base + 760 * k),
        width: px(800 * k),
        height: px(100 * k),
        fontSize: px(44 * k),
        background: '#ffffff',
        color: '#5b3fd9',
        boxShadow: '0 8px 0 rgba(0,0,0,0.15), 0 16px 30px rgba(20,10,60,0.3)',
        opacity: String(fade(t, 0.95)),
        transform: `scale(${0.8 + 0.2 * pop(t, 0.95)})`,
      });
      url.textContent = e.url;
    },
  };

  function captions(sc, t) {
    if (sc.captions) {
      const current = [...sc.captions].reverse().find((c) => t >= c.at);
      if (current) caption(current[spec.lang], L.caption, t, current.at + 0.05);
    } else if (sc.caption) caption(sc.caption[spec.lang], L.caption, t, 0.05);
  }

  window.setup = function (s) {
    spec = s;
    L = { ...LAYOUTS[s.format], format: s.format };
  };

  window.draw = async function (t) {
    pending.length = 0;
    background();
    const sc = spec.scenes.find((x) => t >= x.start && t < x.start + x.dur) ?? spec.scenes.at(-1);
    scenes[sc.type](sc, t - sc.start);
    await Promise.all(pending);
    await document.fonts.ready;
  };
})();

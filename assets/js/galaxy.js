/* ==========================================================================
   AWeblo — 3D galaxy backdrop
   A perspective-projected starfield and spiral galaxy on a 2D canvas.
   Vanilla JS, no dependencies. Purely decorative: the page reads fine with
   this file missing, blocked, or switched off by prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("galaxy-canvas");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = motionQuery.matches;

  /* ---- Scene constants --------------------------------------------------
     World units are screen pixels measured at z = FOCAL, so a point at
     depth z projects by the factor FOCAL / z. The camera sits at the origin
     looking down +z; everything in front of NEAR gets drawn.
     ---------------------------------------------------------------------- */
  var FOCAL = 900;
  var NEAR = 60;
  var GALAXY_Z = 1450;      /* depth of the galactic core */
  var TILT = 1.12;          /* disc tipped away from the viewer, in radians */
  var ARMS = 2;
  var SWIRL = 4.2;          /* how far the arms wind as they go out */
  /* Core placement as a fraction of the viewport, so it sits clear of the
     centred headline instead of blazing away behind it. A phone has far less
     room either side of the text, so the core rides higher there. */
  var GAL_X = 0.24;
  var GAL_Y = -0.1;
  var galX = GAL_X, galY = GAL_Y;
  var SPIN = 0.052;         /* radians per second, shared by every layer */

  var W = 0, H = 0, cx = 0, cy = 0, dpr = 1;
  var galaxy = [], stars = [], nebulae = [];
  var disc = null, discPx = 0;
  var R = 1200;             /* disc radius in world units */
  var streak = null, nextStreak = 6;

  /* Camera offsets, each eased toward a target every frame. The target is
     the sum of two independent inputs: where the pointer is, and how far
     down the page we are. */
  var cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  var target = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  var point = { x: 0, y: 0, yaw: 0, pitch: 0 };
  var scroll = { y: 0, z: 0 };

  function syncTarget() {
    target.x = point.x;
    target.y = point.y + scroll.y;
    target.z = scroll.z;
    target.yaw = point.yaw;
    target.pitch = point.pitch;
  }

  var clock = 0, last = 0, raf = 0, running = false;
  var quality = 1;          /* trimmed automatically if frames run long */
  var slowFrames = 0, fastFrames = 0;

  /* ---- Small helpers ----------------------------------------------------- */
  function gauss() {
    /* Sum of uniforms: close enough to normal, far cheaper than Box-Muller. */
    return (Math.random() + Math.random() + Math.random() - 1.5) * 0.9;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function nowMs() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  /* A pre-rendered glow. Drawing one sprite beats building a radial gradient
     per particle per frame by a wide margin. */
  function makeGlow(size, core, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var half = size / 2;
    var grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, core);
    grad.addColorStop(0.3, mid);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  /* Purple through white — the core burns pale, the arms stay violet. */
  var PALETTE = [
    makeGlow(64, "rgba(255, 255, 255, 1)", "rgba(216, 199, 255, 0.55)"),
    makeGlow(64, "rgba(236, 226, 255, 1)", "rgba(157, 123, 255, 0.5)"),
    makeGlow(64, "rgba(186, 154, 255, 0.95)", "rgba(124, 77, 255, 0.42)"),
    makeGlow(64, "rgba(142, 98, 255, 0.92)", "rgba(86, 42, 196, 0.4)"),
    makeGlow(64, "rgba(242, 176, 255, 0.95)", "rgba(190, 84, 255, 0.4)")
  ];
  var CORE_GLOW = makeGlow(256, "rgba(243, 236, 255, 0.8)", "rgba(150, 105, 255, 0.34)");
  var NEBULA_SPRITES = [
    makeGlow(256, "rgba(124, 77, 255, 0.5)", "rgba(96, 52, 214, 0.22)"),
    makeGlow(256, "rgba(178, 96, 255, 0.42)", "rgba(112, 48, 200, 0.18)"),
    makeGlow(256, "rgba(74, 46, 180, 0.45)", "rgba(52, 28, 140, 0.2)")
  ];

  /* Where a particle sits in the disc, in polar form. Both the texture and
     the live particle layer call this, which is what keeps the painted arms
     and the moving points on the same spiral. */
  function armAngle(index, t) {
    return (index % ARMS) * (Math.PI * 2 / ARMS) + t * SWIRL + gauss() * (0.24 - 0.12 * t);
  }

  /* ---- The disc texture --------------------------------------------------
     Arms only read as arms at a density no per-frame particle loop can
     afford — tens of thousands of specks. So the dust gets painted once into
     an offscreen canvas, and every frame maps that one image through the
     disc's rotation and tilt. The live particles layer on top for the
     genuine depth and twinkle.
     ---------------------------------------------------------------------- */
  function buildDisc(px) {
    var tex = document.createElement("canvas");
    tex.width = tex.height = px;
    var g = tex.getContext("2d");
    var half = px / 2;
    var unit = half * 0.98;        /* disc radius in texels */
    g.globalCompositeOperation = "lighter";

    /* Nebulous wash, hugging the arms. */
    var clouds = Math.round(px / 9);
    for (var c = 0; c < clouds; c++) {
      var ct = Math.pow(Math.random(), 0.7);
      var ca = armAngle(c, ct) + gauss() * 0.22;
      var cr = unit * ct;
      var csz = unit * (0.05 + Math.random() * 0.14);
      g.globalAlpha = 0.04 + Math.random() * 0.06;
      g.drawImage(
        NEBULA_SPRITES[c % NEBULA_SPRITES.length],
        half + Math.cos(ca) * cr - csz,
        half + Math.sin(ca) * cr - csz,
        csz * 2, csz * 2
      );
    }

    /* Dust. Grouped into colour passes so fillStyle is set a handful of
       times rather than once per speck. */
    var passes = [
      { color: "rgba(255, 255, 255, 0.6)", share: 0.19, spread: 1.0 },
      { color: "rgba(214, 198, 255, 0.5)", share: 0.25, spread: 1.0 },
      { color: "rgba(157, 123, 255, 0.4)", share: 0.3, spread: 1.15 },
      { color: "rgba(112, 62, 232, 0.36)", share: 0.24, spread: 1.4 },
      { color: "rgba(198, 104, 255, 0.3)", share: 0.08, spread: 1.25 }
    ];
    var total = Math.round(px * 18);
    for (var pIdx = 0; pIdx < passes.length; pIdx++) {
      var pass = passes[pIdx];
      g.fillStyle = pass.color;
      g.globalAlpha = 1;
      var n = Math.round(total * pass.share);
      for (var d = 0; d < n; d++) {
        var t = Math.pow(Math.random(), 0.58);
        var a = armAngle(d, t) + gauss() * 0.1 * pass.spread;
        var r = unit * t * (1 + gauss() * 0.03);
        var sz = Math.random() < 0.82 ? 1 : 2;
        g.fillRect(
          half + Math.cos(a) * r,
          half + Math.sin(a) * r,
          sz, sz
        );
      }
    }

    /* Inter-arm haze so the gaps between the arms aren't bare. */
    g.fillStyle = "rgba(124, 77, 255, 0.13)";
    var haze = Math.round(px * 3.5);
    for (var hI = 0; hI < haze; hI++) {
      var ht = Math.pow(Math.random(), 0.8);
      var ha = Math.random() * Math.PI * 2;
      g.fillRect(half + Math.cos(ha) * unit * ht, half + Math.sin(ha) * unit * ht, 1, 1);
    }

    /* Bulge. */
    var bulge = unit * 0.28;
    g.globalAlpha = 0.34;
    g.drawImage(CORE_GLOW, half - bulge, half - bulge, bulge * 2, bulge * 2);

    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    return tex;
  }

  /* ---- Scene construction ------------------------------------------------ */
  function build() {
    var area = W * H;
    /* Plenty of small particles beats a few large ones: the arms only read
       as arms when the points stay points. */
    var discCount = Math.round(clamp(area / 1400, 340, 1300));
    var starCount = Math.round(clamp(area / 3400, 160, 620));

    /* Size the disc so the whole object — core, arms and rim — lands inside
       the viewport once projected, rather than running off every edge. */
    R = Math.max(W, H) * 0.66 * (GALAXY_Z / FOCAL);

    galaxy = new Array(discCount);
    for (var i = 0; i < discCount; i++) {
      /* Three populations: a bright central bulge, the spiral arms, and a
         loose scatter that fills the space between the arms so the disc
         doesn't look like two bare ribbons. */
      var kind = i < discCount * 0.15 ? "bulge" : (i % 10 < 7 ? "arm" : "field");
      var t, ang, rad, thickness;

      if (kind === "bulge") {
        t = Math.pow(Math.random(), 1.8) * 0.18;
        rad = R * t;
        ang = Math.random() * Math.PI * 2;
        thickness = R * 0.05;
      } else if (kind === "arm") {
        t = Math.pow(Math.random(), 0.55);
        rad = R * t * (1 + gauss() * 0.035);
        /* Arm angle winds with radius; the scatter loosens toward the rim. */
        ang = armAngle(i, t);
        thickness = R * 0.032 * (1 - 0.6 * t);
      } else {
        t = Math.pow(Math.random(), 0.75);
        rad = R * t;
        ang = Math.random() * Math.PI * 2;
        thickness = R * 0.05 * (1 - 0.5 * t);
      }

      /* Colour by radius: white heart, lilac mid, violet arms, rare magenta. */
      var tone;
      if (t < 0.12) tone = Math.random() < 0.8 ? 0 : 1;
      else if (t < 0.4) tone = Math.random() < 0.5 ? 1 : 2;
      else tone = Math.random() < 0.1 ? 4 : (Math.random() < 0.5 ? 2 : 3);

      var faint = kind === "field";
      galaxy[i] = {
        r: rad,
        a: ang,
        z: gauss() * thickness,
        size: (kind === "bulge" ? 2.4 : faint ? 1.8 : 2.2) + Math.random() * (faint ? 3 : 5),
        alpha: (kind === "bulge" ? 0.66 : faint ? 0.26 : 0.52) + Math.random() * (faint ? 0.3 : 0.45),
        tone: tone,
        tw: Math.random() * Math.PI * 2,
        twRate: 0.5 + Math.random() * 1.4
      };
    }

    /* The texture is the expensive part of setup, so it is only repainted
       when the viewport change is big enough to matter. */
    var wantPx = Math.round(clamp(Math.max(W, H) * 1.1, 512, 1536));
    if (!disc || Math.abs(wantPx - discPx) > 160) {
      discPx = wantPx;
      disc = buildDisc(wantPx);
    }

    /* Field stars drift toward the camera and recycle out the back. */
    stars = new Array(starCount);
    for (var s = 0; s < starCount; s++) stars[s] = makeStar(true);

    /* A few soft clouds riding in the disc plane, for volume behind the dust. */
    nebulae = [];
    for (var n = 0; n < 7; n++) {
      var na = Math.random() * Math.PI * 2;
      var nr = R * (0.16 + Math.random() * 0.72);
      nebulae.push({
        r: nr,
        a: na,
        z: gauss() * R * 0.05,
        size: R * (0.3 + Math.random() * 0.42),
        alpha: 0.16 + Math.random() * 0.2,
        sprite: NEBULA_SPRITES[n % NEBULA_SPRITES.length]
      });
    }
  }

  function makeStar(spread) {
    var depth = spread ? NEAR + Math.random() * 2600 : 2400 + Math.random() * 260;
    return {
      x: (Math.random() - 0.5) * 3400,
      y: (Math.random() - 0.5) * 2600,
      z: depth,
      size: 0.6 + Math.random() * 1.9,
      alpha: 0.25 + Math.random() * 0.6,
      tw: Math.random() * Math.PI * 2,
      twRate: 0.6 + Math.random() * 1.8,
      tone: Math.random() < 0.16 ? 2 : (Math.random() < 0.3 ? 1 : 0)
    };
  }

  /* ---- Sizing ------------------------------------------------------------ */
  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    /* Cap the pixel ratio: a 3x buffer on a phone costs far more than it adds. */
    dpr = Math.min(window.devicePixelRatio || 1, w > 1400 ? 1.5 : 1.75);

    W = w; H = h; cx = w / 2; cy = h / 2;
    var narrow = w < 720;
    galX = narrow ? 0.3 : GAL_X;
    galY = narrow ? -0.26 : GAL_Y;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    build();
  }

  /* ---- Input ------------------------------------------------------------- */
  function onPointer(e) {
    var nx = (e.clientX / W - 0.5) * 2;
    var ny = (e.clientY / H - 0.5) * 2;
    point.x = nx * 70;
    point.y = ny * 46;
    point.yaw = nx * 0.055;
    point.pitch = ny * 0.035;
    syncTarget();
  }

  function onScroll() {
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - window.innerHeight);
    var p = clamp(window.scrollY / max, 0, 1);
    /* Scrolling pans the camera down the field and eases it back a touch, so
       the sky keeps moving with the page instead of sitting flat behind it. */
    scroll.y = p * 620;
    scroll.z = p * 320;
    syncTarget();
  }

  /* ---- Frame ------------------------------------------------------------- */
  /* Scratch results, reused every call: at ~1800 projections a frame, fresh
     objects would hand the collector a steady stream of garbage. */
  var out = { sx: 0, sy: 0, k: 0, z: 0 };

  function project(x, y, z) {
    var k = FOCAL / z;
    out.sx = cx + x * k;
    out.sy = cy + y * k;
    out.k = k;
    out.z = z;
    return out;
  }

  function draw(dt) {
    clock += dt;

    /* Ease the camera toward its target — pointer and scroll never snap. */
    var e = 1 - Math.pow(0.0016, dt);
    cam.x += (target.x - cam.x) * e;
    cam.y += (target.y - cam.y) * e;
    cam.z += (target.z - cam.z) * e;
    cam.yaw += (target.yaw - cam.yaw) * e;
    cam.pitch += (target.pitch - cam.pitch) * e;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    /* Disc orientation: a fixed tilt, a slow drift, and the pointer's nudge. */
    var tilt = TILT + cam.pitch + Math.sin(clock * 0.06) * 0.02;
    var yaw = cam.yaw + Math.sin(clock * 0.045) * 0.05;
    var cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    var cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    var gz = GALAXY_Z + cam.z;
    /* GAL_X / GAL_Y are viewport fractions, so convert through the
       projection to keep the core in the same spot at any window size. */
    var depthScale = gz / FOCAL;
    var gx = W * galX * depthScale - cam.x * 0.55;
    var gy = H * galY * depthScale - cam.y * 0.55;

    /* Rotate a point in disc space into view space, then project it:
       spin about the disc axis, tip about x, yaw about y, push to depth. */
    function placeDisc(r, a, dz) {
      var x = Math.cos(a) * r;
      var y = Math.sin(a) * r;
      var y1 = y * cosT - dz * sinT;
      var z1 = y * sinT + dz * cosT;
      var x2 = x * cosY + z1 * sinY;
      var z2 = z1 * cosY - x * sinY;
      var z = z2 + gz;
      if (z < NEAR) return null;
      var k = FOCAL / z;
      out.sx = cx + (x2 + gx) * k;
      out.sy = cy + (y1 + gy) * k;
      out.k = k;
      out.z = z;
      return out;
    }

    /* --- Field stars ---
       Every star keeps moving even when quality is trimmed, so thinning the
       field never makes the remaining stars jump. */
    var drawStars = Math.round(stars.length * quality);
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      st.z -= dt * 26;
      if (st.z < NEAR) {
        stars[s] = makeStar(false);
        continue;
      }
      if (s >= drawStars) continue;
      st.tw += dt * st.twRate;
      var pz = st.z + cam.z * 0.4;
      var p = project(st.x - cam.x * 0.8, st.y - cam.y * 0.8, pz);
      if (p.sx < -40 || p.sx > W + 40 || p.sy < -40 || p.sy > H + 40) continue;
      var fade = clamp(1 - st.z / 2900, 0, 1);
      var a = st.alpha * fade * (0.68 + 0.32 * Math.sin(st.tw));
      if (a <= 0.01) continue;
      var sz = st.size * p.k * 3.2;
      ctx.globalAlpha = a;
      var img = PALETTE[st.tone];
      ctx.drawImage(img, p.sx - sz, p.sy - sz, sz * 2, sz * 2);
    }

    /* --- The painted disc ---
       The tilted, spinning plane is a pure affine map on screen: rotate
       within the disc, squash vertically by cos(tilt), then roll slightly
       with the yaw. Applying it to the texture costs one drawImage. */
    var theta = clock * SPIN;
    /* The core is projected once and its numbers copied out, since placeDisc
       hands back a scratch object that the next call overwrites. */
    var core = placeDisc(0, 0, 0);
    var coreX = 0, coreY = 0, coreK = 0, haveCore = false;
    if (core) {
      coreX = core.sx; coreY = core.sy; coreK = core.k; haveCore = true;
    }

    if (disc && haveCore) {
      var roll = yaw * 0.5;
      var cosR = Math.cos(roll), sinR = Math.sin(roll);
      var cosTh = Math.cos(theta), sinTh = Math.sin(theta);
      /* In-disc rotation, then the tilt squash. */
      var a11 = cosTh,         a12 = -sinTh;
      var a21 = sinTh * cosT,  a22 = cosTh * cosT;
      /* Compose the roll on top. */
      var m11 = cosR * a11 - sinR * a21;
      var m12 = cosR * a12 - sinR * a22;
      var m21 = sinR * a11 + cosR * a21;
      var m22 = sinR * a12 + cosR * a22;
      /* One texel of the texture spans this many screen pixels. */
      var texScale = (R / (discPx / 2 * 0.98)) * coreK;

      ctx.globalAlpha = 0.95;
      ctx.setTransform(
        m11 * texScale * dpr, m21 * texScale * dpr,
        m12 * texScale * dpr, m22 * texScale * dpr,
        coreX * dpr, coreY * dpr
      );
      ctx.drawImage(disc, -discPx / 2, -discPx / 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* --- Nebula clouds, riding in the disc plane for a little volume --- */
    for (var n = 0; quality > 0.7 && n < nebulae.length; n++) {
      var neb = nebulae[n];
      var np = placeDisc(neb.r, neb.a + theta, neb.z);
      if (!np) continue;
      var nsz = neb.size * np.k;
      if (nsz < 4) continue;
      ctx.globalAlpha = neb.alpha * clamp(np.k * 1.5, 0, 1);
      ctx.drawImage(neb.sprite, np.sx - nsz, np.sy - nsz, nsz * 2, nsz * 2);
    }

    /* --- Galactic core: a wide halo plus a tight, brighter heart --- */
    if (haveCore) {
      var halo = R * 0.4 * coreK;
      ctx.globalAlpha = 0.16;
      ctx.drawImage(CORE_GLOW, coreX - halo, coreY - halo, halo * 2, halo * 2);
      var heart = R * 0.07 * coreK;
      ctx.globalAlpha = 0.3 + Math.sin(clock * 0.5) * 0.04;
      ctx.drawImage(CORE_GLOW, coreX - heart, coreY - heart, heart * 2, heart * 2);
      /* A small hot point stops the nucleus reading as a soft smudge. */
      var nucleus = R * 0.013 * coreK;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(PALETTE[1], coreX - nucleus, coreY - nucleus, nucleus * 2, nucleus * 2);
    }

    /* --- Disc particles --- */
    var count = Math.round(galaxy.length * quality);
    for (var i = 0; i < count; i++) {
      var g = galaxy[i];
      var gp = placeDisc(g.r, g.a + theta, g.z);
      if (!gp) continue;
      if (gp.sx < -60 || gp.sx > W + 60 || gp.sy < -60 || gp.sy > H + 60) continue;
      g.tw += dt * g.twRate;
      var gsz = g.size * gp.k;
      if (gsz < 0.35) continue;
      /* Nearer arm particles read brighter, which sells the depth. */
      var depthLift = clamp(1.35 - gp.z / (gz + R), 0.35, 1.25);
      ctx.globalAlpha = clamp(g.alpha * depthLift * (0.82 + 0.18 * Math.sin(g.tw)), 0, 1);
      var gimg = PALETTE[g.tone];
      ctx.drawImage(gimg, gp.sx - gsz, gp.sy - gsz, gsz * 2, gsz * 2);
    }

    /* --- Occasional shooting star --- */
    if (!reduceMotion) {
      nextStreak -= dt;
      if (!streak && nextStreak <= 0) {
        var fromLeft = Math.random() < 0.5;
        streak = {
          x: fromLeft ? -80 : W + 80,
          y: Math.random() * H * 0.55,
          vx: (fromLeft ? 1 : -1) * (W * 0.5 + Math.random() * W * 0.3),
          vy: H * (0.12 + Math.random() * 0.16),
          life: 0,
          span: 1.5
        };
      }
      if (streak) {
        streak.life += dt;
        streak.x += streak.vx * dt;
        streak.y += streak.vy * dt;
        var sa = Math.sin((streak.life / streak.span) * Math.PI);
        if (streak.life >= streak.span) {
          streak = null;
          nextStreak = 7 + Math.random() * 12;
        } else if (sa > 0.01) {
          var tailX = streak.x - streak.vx * 0.09;
          var tailY = streak.y - streak.vy * 0.09;
          var grad = ctx.createLinearGradient(tailX, tailY, streak.x, streak.y);
          grad.addColorStop(0, "rgba(157, 123, 255, 0)");
          grad.addColorStop(1, "rgba(238, 230, 255, " + (0.75 * sa).toFixed(3) + ")");
          ctx.globalAlpha = 1;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(streak.x, streak.y);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ---- Loop -------------------------------------------------------------- */
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    var dt = (now - last) / 1000;
    last = now;
    /* A tab that was backgrounded hands back a huge delta — clamp it so the
       galaxy resumes where it was rather than jumping a minute forward. */
    if (!(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;

    draw(dt);

    /* Adaptive detail, measured on the frame interval rather than on our own
       script time: on a weak device the cost usually lands in rasterising,
       which a timer around draw() would never see. Two seconds of frames
       slower than ~38fps thins the scene; ten smooth seconds give it back. */
    if (dt > 0.026) {
      slowFrames++; fastFrames = 0;
      if (slowFrames > 60 && quality > 0.4) { quality -= 0.15; slowFrames = 0; }
    } else {
      fastFrames++; slowFrames = 0;
      if (fastFrames > 600 && quality < 1) { quality = Math.min(1, quality + 0.1); fastFrames = 0; }
    }
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = nowMs();
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---- Wiring ------------------------------------------------------------ */
  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      resize();
      if (reduceMotion) draw(0);
    }, 180);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("mousemove", onPointer, { passive: true });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  function applyMotionPreference() {
    reduceMotion = motionQuery.matches;
    if (reduceMotion) {
      stop();
      draw(0);          /* one still frame — the sky is there, it just holds */
    } else {
      start();
    }
  }
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", applyMotionPreference);
  else if (motionQuery.addListener) motionQuery.addListener(applyMotionPreference);

  resize();
  onScroll();
  canvas.classList.add("is-ready");
  applyMotionPreference();
})();

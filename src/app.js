(function () {
  'use strict';

  // ---- cube constants (cubejs facelet order: U R F D L B, 9 each, row-major as drawn in the net)
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const OFF = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
  const POS = { U: [3, 0], L: [0, 3], F: [3, 3], R: [6, 3], B: [9, 3], D: [3, 6] };
  const COL = { U: '#ffffff', R: '#d62b2b', F: '#1fa34a', D: '#ffd500', L: '#ff8a00', B: '#1f5fd6' };
  const NAME = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
  const FACE_WORD = { U: 'top', D: 'bottom', L: 'left', R: 'right', F: 'front', B: 'back' };
  const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
  // which centre colour sits at the top of the picture when scanning each face
  const TOP_OF = { U: 'B', R: 'U', F: 'U', D: 'F', L: 'U', B: 'U' };

  const $ = id => document.getElementById(id);
  const show = name => {
    for (const s of ['scan', 'review', 'solve', 'busy']) $(s).hidden = s !== name;
    const order = ['scan', 'review', 'solve'];
    $('tabs').innerHTML = order.map((s, i) =>
      `<span class="${s === name ? 'on' : ''}">${i + 1}. ${['Scan', 'Check', 'Solve'][i]}</span>`).join('');
  };

  // ---- state
  const scan = { rgb: Array(6).fill(null), pic: Array(6).fill(null), cur: 0 };
  let stickers = null; // 54 letters
  let solution = null, states = null, step = 0;

  // ---- camera / capture
  let stream = null;
  const video = $('video');

  async function startCam() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      video.srcObject = stream;
      await video.play();
      document.querySelector('.cam').classList.add('camOn');
      $('btnShot').disabled = false;
      $('btnCam').textContent = 'Stop camera';
    } catch (e) {
      $('camMsg').textContent = 'Camera unavailable (' + (e.name || e) + '). Use "Use a photo" instead.';
    }
  }
  function stopCam() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; video.srcObject = null;
    document.querySelector('.cam').classList.remove('camOn');
    $('camMsg').textContent = 'Camera is off';
    $('btnShot').disabled = true;
    $('btnCam').textContent = 'Start camera';
  }

  // Centre-crop the source to a square (same area the on-screen grid covers), sample 9 stickers.
  function grab(src, w, h) {
    const N = 300, c = document.createElement('canvas');
    c.width = c.height = N;
    const side = Math.min(w, h);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, N, N);
    const rgb = [];
    // grid inset is 8% each side, 2% gaps -> cell centres
    const inner = N * 0.84, gap = N * 0.02, cell = (inner - 2 * gap) / 3, o = N * 0.08;
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
      const cx = o + q * (cell + gap) + cell / 2, cy = o + r * (cell + gap) + cell / 2, s = cell * 0.25;
      const d = g.getImageData(Math.round(cx - s), Math.round(cy - s), Math.round(2 * s), Math.round(2 * s)).data;
      const ch = [[], [], []];
      for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
      rgb.push(ch.map(a => { a.sort((x, y) => x - y); return a[a.length >> 1]; }));
    }
    // small preview
    const t = document.createElement('canvas'); t.width = t.height = 200;
    t.getContext('2d').drawImage(c, 0, 0, 200, 200);
    return { rgb, pic: t.toDataURL('image/jpeg', 0.8) };
  }

  function store(res) {
    const i = scan.cur;
    scan.rgb[i] = res.rgb; scan.pic[i] = res.pic;
    const next = scan.rgb.findIndex(v => !v);
    if (next === -1) { stopCam(); classify(); renderReview(); show('review'); return; }
    scan.cur = next; renderScan();
  }

  function renderScan() {
    const f = FACES[scan.cur];
    $('prompt').innerHTML = `Face ${scan.cur + 1}/6: show the <b style="background:${COL[f]}">${NAME[f]}</b> centre to the camera, ` +
      `with the <b style="background:${COL[TOP_OF[f]]}">${NAME[TOP_OF[f]]}</b> centre at the <u>top</u> of the picture.`;
    $('thumbs').innerHTML = FACES.map((k, i) =>
      `<div data-i="${i}" class="${i === scan.cur ? 'cur' : ''}">${scan.pic[i] ? `<img src="${scan.pic[i]}">` : ''}` +
      `<span style="color:${COL[k]}">${k}</span></div>`).join('');
  }

  // ---- colour classification: every sticker goes to the nearest of the six centre colours (Lab space)
  function lab([r, g, b]) {
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const R = lin(r), G = lin(g), B = lin(b);
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B,
      Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  }
  function classify() {
    const ref = FACES.map((_, i) => lab(scan.rgb[i][4]));
    stickers = [];
    FACES.forEach((_, fi) => scan.rgb[fi].forEach((c, j) => {
      if (j === 4) { stickers.push(FACES[fi]); return; }
      const l = lab(c); let best = 0, bd = 1e9;
      ref.forEach((r, k) => {
        const d = (l[0] - r[0]) ** 2 * 0.5 + (l[1] - r[1]) ** 2 + (l[2] - r[2]) ** 2;
        if (d < bd) { bd = d; best = k; }
      });
      stickers.push(FACES[best]);
    }));
  }

  // ---- net drawing
  function netSVG(state, o = {}) {
    const c = 24;
    let s = `<svg viewBox="0 0 ${12 * c} ${9 * c}" xmlns="http://www.w3.org/2000/svg">`;
    for (const f of FACES) {
      const [px, py] = POS[f];
      for (let i = 0; i < 9; i++) {
        const x = (px + i % 3) * c, y = (py + (i / 3 | 0)) * c, k = OFF[f] + i;
        s += `<rect x="${x + 1}" y="${y + 1}" width="${c - 2}" height="${c - 2}" rx="3" fill="${COL[state[k]]}" stroke="#0b0b0d" stroke-width="1.5" data-i="${k}"/>`;
      }
      if (o.hl === f) {
        s += `<rect x="${px * c}" y="${py * c}" width="${3 * c}" height="${3 * c}" rx="4" fill="none" stroke="#ff2d95" stroke-width="3.5" pointer-events="none"/>`;
        if (o.arrow) s += `<text x="${(px + 1.5) * c}" y="${(py + 1.5) * c + 7}" text-anchor="middle" font-size="22" font-weight="800" fill="#ff2d95" stroke="#000" stroke-width=".6" pointer-events="none">${o.arrow}</text>`;
      }
      if (o.labels) s += `<text x="${(px + 1.5) * c}" y="${(py + 1.5) * c + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#000" fill-opacity=".55" pointer-events="none">${f}</text>`;
    }
    return s + '</svg>';
  }

  // ---- review
  function counts() {
    const n = {}; FACES.forEach(f => n[f] = 0);
    stickers.forEach(l => n[l]++);
    return n;
  }
  function renderReview() {
    $('reviewNet').innerHTML = netSVG(stickers, { labels: true });
    const n = counts();
    $('counts').innerHTML = FACES.map(f =>
      `<span class="${n[f] === 9 ? '' : 'bad'}"><b style="color:${COL[f]}">●</b> ${NAME[f]} ${n[f]}/9</span>`).join('');
    const ok = FACES.every(f => n[f] === 9);
    $('btnSolve').disabled = !ok;
    $('reviewMsg').textContent = ok ? '' : 'Each colour must appear exactly 9 times. Fix the stickers marked red, or rescan that face.';
  }

  // ---- solving
  const wait = () => new Promise(r => setTimeout(r, 30));
  let solverReady = false;

  async function solve() {
    show('busy');
    $('busyMsg').textContent = solverReady ? 'Solving…' : 'Preparing solver (first time takes a few seconds)…';
    await wait();
    try {
      if (!solverReady) { Cube.initSolver(); solverReady = true; $('busyMsg').textContent = 'Solving…'; await wait(); }
      const str = stickers.join('');
      const cube = Cube.fromString(str);
      const sol = cube.solve();
      if (typeof sol !== 'string') throw new Error('no solution');
      solution = sol.trim() ? sol.trim().split(/\s+/) : [];
      const c = Cube.fromString(str);
      states = [c.asString()];
      for (const m of solution) { c.move(m); states.push(c.asString()); }
      // cubejs doesn't validate input: an impossible cube gets a bogus solution, so replay it
      if (states[states.length - 1] !== SOLVED) throw new Error('unsolvable');
      step = 0;
      renderStep(); show('solve');
    } catch (e) {
      show('review');
      $('reviewMsg').textContent = 'That colour layout is not a solvable cube (a sticker is probably misread, or the cube was taken apart). Check the stickers and try again.';
    }
  }

  function describe(m) {
    const f = m[0], mod = m[1] || '';
    const w = FACE_WORD[f];
    if (mod === '2') return `Turn the ${w} face a half turn (180°, either direction).`;
    if (mod === "'") return `Turn the ${w} face a quarter turn counter-clockwise (looking straight at that face).`;
    return `Turn the ${w} face a quarter turn clockwise (looking straight at that face).`;
  }

  function renderStep() {
    const n = solution.length;
    const done = step === n && n > 0;
    if (step === 0) {
      $('stepHead').innerHTML = `<span class="mv">Start</span><span class="of">${n} move${n === 1 ? '' : 's'}</span>`;
      $('stepBody').innerHTML =
        `<p class="prompt">Hold the cube with the <b style="background:${COL.U}">white</b> centre on <b>top</b> and the ` +
        `<b style="background:${COL.F}">green</b> centre <b>facing you</b>. Keep it that way for every move: ` +
        `${FACE_WORD.R} = red side, ${FACE_WORD.L} = orange side, back = blue, bottom = yellow.</p>` +
        (n === 0 ? '<p class="prompt">This cube is already solved. 🎉</p>' : '') +
        `<div class="net">${netSVG(states[0], { labels: true })}</div>` +
        `<p class="hint">Your photos:</p><div class="photos">${FACES.map((f, i) =>
          `<img src="${scan.pic[i]}" title="${f}">`).join('')}</div>`;
    } else {
      const m = solution[step - 1], f = m[0], mod = m[1] || '';
      const arrow = mod === "'" ? '↺' : mod === '2' ? '2×↻' : '↻';
      $('stepHead').innerHTML = `<span class="mv">${m}</span><span>${describe(m)}</span><span class="of">${step}/${n}</span>`;
      $('stepBody').innerHTML =
        `<div class="pair"><figure>${netSVG(states[step - 1], { hl: f, arrow })}<figcaption>before</figcaption></figure>` +
        `<figure>${netSVG(states[step], { hl: f })}<figcaption>after</figcaption></figure></div>` +
        `<div class="face-photo"><img src="${scan.pic[FACES.indexOf(f)]}"><span>Your photo of the ${NAME[f]}-centre face (${f}). ` +
        `The pink outline above is the face you turn.</span></div>` +
        (done ? '<p class="prompt">That was the last move. The cube is solved. 🎉</p>' : '');
    }
    $('chips').innerHTML = `<b data-s="0" class="${step === 0 ? 'on' : 'done'}">Start</b>` +
      solution.map((m, i) => `<b data-s="${i + 1}" class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}">${m}</b>`).join('');
    $('btnPrev').disabled = step === 0;
    $('btnNext').disabled = step >= n;
  }

  // ---- wiring
  $('btnCam').onclick = () => stream ? stopCam() : startCam();
  $('btnShot').onclick = () => store(grab(video, video.videoWidth, video.videoHeight));
  $('file').onchange = e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => { store(grab(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(file);
  };
  $('thumbs').onclick = e => {
    const d = e.target.closest('[data-i]'); if (!d) return;
    scan.cur = +d.dataset.i; renderScan();
  };
  $('reviewNet').onclick = e => {
    const r = e.target.closest('rect[data-i]'); if (!r) return;
    const k = +r.dataset.i; if (k % 9 === 4) return;
    stickers[k] = FACES[(FACES.indexOf(stickers[k]) + 1) % 6];
    renderReview();
  };
  $('btnRescan').onclick = () => {
    scan.rgb.fill(null); scan.pic.fill(null); scan.cur = 0;
    renderScan(); show('scan');
  };
  $('btnSolve').onclick = solve;
  $('btnPrev').onclick = () => { if (step > 0) { step--; renderStep(); } };
  $('btnNext').onclick = () => { if (step < solution.length) { step++; renderStep(); } };
  $('chips').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { step = +b.dataset.s; renderStep(); } };
  document.addEventListener('keydown', e => {
    if ($('solve').hidden) return;
    if (e.key === 'ArrowRight') $('btnNext').click();
    if (e.key === 'ArrowLeft') $('btnPrev').click();
  });

  // test hook: feed pre-sampled colours (6 faces x 9 [r,g,b]) as if scanned
  window.RF = {
    load(rgbs) {
      rgbs.forEach((v, i) => { scan.rgb[i] = v; scan.pic[i] = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; });
      classify(); renderReview(); show('review');
    },
    get stickers() { return stickers.join(''); },
  };

  renderScan();
  show('scan');
})();

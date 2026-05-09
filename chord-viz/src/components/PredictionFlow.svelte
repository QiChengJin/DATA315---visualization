<script>
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';

  // ── Step state ───────────────────────────────────────────────────
  let step = 0;
  const TOTAL = 12;

  // ── Auto-play ────────────────────────────────────────────────────
  let playing = false;
  let timer = null;
  const INTERVAL = 1400; // ms per step

  function startPlay() {
    if (step >= TOTAL - 1) step = 0;
    playing = true;
    timer = setInterval(() => {
      step += 1;
      if (step >= TOTAL - 1) {
        playing = false;
        clearInterval(timer);
        timer = null;
      }
    }, INTERVAL);
  }

  function pause() {
    playing = false;
    clearInterval(timer);
    timer = null;
  }

  function togglePlay() {
    if (playing) pause();
    else startPlay();
  }

  // Start playing automatically on mount
  onMount(() => {
    startPlay();
  });

  onDestroy(() => {
    clearInterval(timer);
  });

  // If user manually navigates, pause auto-play
  function manualStep(newStep) {
    pause();
    step = newStep;
  }

  const STEPS = [
    'Audio input (one song)',
    'BERT-style transformer backbone',
    'Token embeddings',
    'Chord Validity Head',
    'Logits → argmax → basic_chord mask',
    'Chord Validity mask',
    'Chord Root Head',
    'Root logits → argmax → root tokens',
    'Chord Type Head → logits → argmax → type tokens',
    'Concatenate features',
    'Key Boundary Head + Key Label Head',
    'Final outputs',
  ];

  const DESCS = [
    'A short audio chunk — a few seconds of music — enters the pipeline. Everything the model will "hear" is contained in this window.',
    'BERT processes the audio features and produces one contextual vector per beat, capturing local and global harmonic patterns.',
    'Each beat is now a rich embedding. These token vectors feed every downstream head — and are also held in reserve for the final concatenation.',
    'The Validity Head classifies each beat into one of 4 categories: basic_chord, complex_chord, inharmonic_or_noise, or no_chord.',
    'Raw logits over the 4 validity classes, one distribution per beat. Argmax collapses each to a single class — only basic_chord beats continue downstream.',
    'A binary mask: 1 for basic_chord beats, 0 for everything else. The Root Head uses this to skip invalid beats.',
    'The Root Head predicts the chord root (C, D♯, G…) for every unmasked beat.',
    'Root logits (12 classes) → argmax → root tokens. One pitch class per valid beat.',
    'The Type Head predicts chord quality (major, minor, dim7…) conditioned on root tokens. Logits → argmax → type tokens.',
    'Root logits (B,L,12) and type logits (B,L,15) — zeroed by vmask for non-basic_chord beats — are concatenated with the original BERT token vectors (B,L,H), forming a unified feature tensor (B,L,H+12+15). This single tensor feeds both final heads.',
    'Two parallel heads share the concatenated input. The Boundary Head detects key-change beats (binary T/F). The Key Label Head predicts the global key per segment.',
    'Boundary marks (from the Boundary Head) and raw key tokens (from the Key Label Head) both flow into cut & stitch. Padded beats are discarded, and per-segment key labels are assembled into the final key sequence for the whole song.',
  ];

  // ── Validity class descriptions (shown on hover over logits [4]) ──
  const VALIDITY_CLASSES = [
    {
      name: 'basic_chord',
      color: '#059669',
      desc: 'A simple chord the model can label — mostly triads and seventh chords. Only these beats continue to the Root and Type heads.',
    },
    {
      name: 'complex_chord',
      color: '#d97706',
      desc: 'A complex chord outside the model\'s Type vocabulary (e.g. jazz extensions). Root and Type heads are skipped for these beats.',
    },
    {
      name: 'inharmonic_or_noise',
      color: '#dc2626',
      desc: 'Sounds like noise — likely a corrupted audio file (e.g. a drum loop mislabeled as a piano recording).',
    },
    {
      name: 'no_chord',
      color: '#64748b',
      desc: 'Genuine silence, or a file with only drums and no harmonic content.',
    },
  ];

  // Delayed-hide so mouse can move from node into tooltip without it closing
  let hoveredVlog = false;
  let hoveredVlogTimer = null;
  function showVlog() { clearTimeout(hoveredVlogTimer); hoveredVlog = true; }
  function hideVlog() { hoveredVlogTimer = setTimeout(() => hoveredVlog = false, 80); }

  // ── Root class descriptions (shown on hover over logits [12]) ────
  const ROOT_CLASSES = [
    { name:'C',      color:'hsl(0,70%,55%)'   },
    { name:'C#/Db',  color:'hsl(30,70%,55%)'  },
    { name:'D',      color:'hsl(60,70%,55%)'  },
    { name:'D#/Eb',  color:'hsl(90,70%,55%)'  },
    { name:'E',      color:'hsl(120,70%,55%)' },
    { name:'F',      color:'hsl(150,70%,55%)' },
    { name:'F#/Gb',  color:'hsl(180,70%,55%)' },
    { name:'G',      color:'hsl(210,70%,55%)' },
    { name:'G#/Ab',  color:'hsl(240,70%,55%)' },
    { name:'A',      color:'hsl(270,70%,55%)' },
    { name:'A#/Bb',  color:'hsl(300,70%,55%)' },
    { name:'B',      color:'hsl(330,70%,55%)' },
  ];

  // ── Chord-type class descriptions (shown on hover over logits [15]) ─
  const TYPE_CLASSES = [
    {
      group: 'Triads',
      color: '#059669',
      items: [
        { name:'maj',  desc:'Major triad. Bright, stable, happy — the "default" chord. (C-E-G)' },
        { name:'m',    desc:'Minor triad. Darker, more somber version of major. (C-E♭-G)' },
        { name:'dim',  desc:'Diminished. Tense, unstable. (C-E♭-G♭)' },
        { name:'aug',  desc:'Augmented. Dreamy, unsettled, floaty. (C-E-G#)' },
        { name:'5',    desc:'Power chord. Root + fifth only — ambiguous major/minor, heavy in rock.' },
        { name:'sus2', desc:'Suspended 2nd. Third replaced by a major 2nd — open, airy. (C-D-G)' },
        { name:'sus4', desc:'Suspended 4th. Third replaced by a perfect 4th — wants to resolve. (C-F-G)' },
      ],
    },
    {
      group: 'Sevenths',
      color: '#2563eb',
      items: [
        { name:'maj7',  desc:'Major 7th. Lush, sophisticated, jazzy. (C-E-G-B)' },
        { name:'m7',    desc:'Minor 7th. Smooth, melancholic — very common in jazz/R&B. (C-E♭-G-B♭)' },
        { name:'7',     desc:'Dominant 7th. Bluesy, tense, strongly wants to resolve. (C-E-G-B♭)' },
        { name:'m7b5',  desc:'Half-diminished. Dark and jazzy — common in minor ii-V-I. (C-E♭-G♭-B♭)' },
        { name:'dim7',  desc:'Fully diminished. Maximum tension, symmetric, eerily ambiguous. (C-E♭-G♭-B♭♭)' },
        { name:'mMaj7', desc:'Minor-major 7th. Haunting — minor feel with a major 7th on top. (C-E♭-G-B)' },
      ],
    },
    {
      group: 'Added-note',
      color: '#7c3aed',
      items: [
        { name:'add9',  desc:'Major triad + major 9th (no 7th). Fuller than major, less jazzy than maj7. (C-E-G-D)' },
        { name:'madd9', desc:'Minor triad + major 9th (no 7th). Bittersweet, emotionally rich. (C-E♭-G-D)' },
      ],
    },
  ];

  let hoveredTlog = false;
  let hoveredTlogTimer = null;
  function showTlog() { clearTimeout(hoveredTlogTimer); hoveredTlog = true; }
  function hideTlog() { hoveredTlogTimer = setTimeout(() => hoveredTlog = false, 80); }

  let hoveredRlog = false;
  let hoveredRlogTimer = null;
  function showRlog() { clearTimeout(hoveredRlogTimer); hoveredRlog = true; }
  function hideRlog() { hoveredRlogTimer = setTimeout(() => hoveredRlog = false, 80); }

  // ── Key label tooltip ─────────────────────────────────────────────
  // 12 roots × 2 modes + Other = 25 classes
  // Show as a compact grid instead of a 25-row list
  const KEY_ROOTS = ['C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','A','A#/Bb','B'];
  const KEY_ROOT_COLORS = KEY_ROOTS.map((_, i) => `hsl(${Math.round((i / 12) * 360)}, 65%, 52%)`);

  let hoveredKlog = false;
  let hoveredKlogTimer = null;
  function showKlog() { clearTimeout(hoveredKlogTimer); hoveredKlog = true; }
  function hideKlog() { hoveredKlogTimer = setTimeout(() => hoveredKlog = false, 80); }

  // ── Mock probability distributions (simulate a C major beat) ────────
  const MOCK_PROBS = {
    vlog: [0.76, 0.12, 0.07, 0.05],
    rlog: [0.38, 0.04, 0.07, 0.03, 0.04, 0.05, 0.10, 0.11, 0.04, 0.07, 0.03, 0.04],
    tlog: [0.44, 0.21, 0.04, 0.03, 0.01, 0.05, 0.04, 0.08, 0.05, 0.02, 0.01, 0.005, 0.005, 0.005, 0.005],
    blog: [0.88, 0.12],
    klog: KEY_ROOTS.flatMap((_, i) => i === 0 ? [0.48, 0.04] : i === 6 ? [0.06, 0.02] : [
      parseFloat((0.03 / (i + 1)).toFixed(3)),
      parseFloat((0.02 / (i + 1)).toFixed(3)),
    ]).concat([0.03]),
  };

  // ── Colors per class for each logit node ─────────────────────────
  const BAR_COLORS = {
    vlog: ['#059669', '#d97706', '#dc2626', '#64748b'],
    rlog: KEY_ROOT_COLORS,
    tlog: [
      ...Array(7).fill(0).map((_, i) => `hsl(${155 + i * 4}, 58%, ${50 + i}%)`),
      ...Array(6).fill(0).map((_, i) => `hsl(${215 + i * 4}, 62%, ${50 + i}%)`),
      ...Array(2).fill(0).map((_, i) => `hsl(${272 + i * 8}, 58%, 55%)`),
    ],
    blog: ['#64748b', '#dc2626'],
    klog: KEY_ROOT_COLORS.flatMap(c => [c, c + '99']).concat(['#94a3b8']),
  };

  // Precompute argmax for highlighting
  const ARGMAX = Object.fromEntries(
    Object.entries(MOCK_PROBS).map(([k, p]) => [k, p.indexOf(Math.max(...p))])
  );

  // Bar chart geometry per logit node
  const BAR_CFG = {
    vlog: { barH: 8,   gap: 3   },
    rlog: { barH: 5.5, gap: 2   },
    tlog: { barH: 5,   gap: 2   },
    blog: { barH: 10,  gap: 4   },
    klog: { barH: 4,   gap: 1.5 },
  };
  const BAR_MAX_W = 82;

  // ── Boundary logit descriptions ───────────────────────────────────
  const BOUNDARY_CLASSES = [
    { name:'no_change', color:'#64748b', desc:'No key change at this beat — the song stays in the same key region.' },
    { name:'key_change', color:'#dc2626', desc:'A key change occurs at this beat — marks the start of a new key region. Used to segment the song before the Key Label Head.' },
  ];

  let hoveredBlog = false;
  let hoveredBlogTimer = null;
  function showBlog() { clearTimeout(hoveredBlogTimer); hoveredBlog = true; }
  function hideBlog() { hoveredBlogTimer = setTimeout(() => hoveredBlog = false, 80); }

  // ── Node map ─────────────────────────────────────────────────────
  // sub: second line shown inside node (e.g. "argmax")
  const N = {
    chunk:  { label:'Song',               type:'data',    x:350, y:55,   w:100, h:36, at:0  },
    bert:   { label:'Music Tokenizer',   type:'process', x:350, y:155,  w:150, h:36, at:1  },
    toks:   { label:'Token Embeddings',  type:'data',    x:350, y:265,  w:138, h:36, at:2  },

    // ── Validity Head ───────────────────────────────────────────────
    h1:     { label:'Chord Validity Head', type:'head',  x:350, y:390,  w:148, h:36, at:3  },
    vlog:   { label:'logits [4]',  sub:'argmax', type:'data', x:574, y:390, w:102, h:44, at:4 },
    vmask:  { label:'basic_chord mask', type:'data',    x:574, y:490,  w:118, h:28, at:5  },

    // ── Root Head ───────────────────────────────────────────────────
    h2:     { label:'Chord Root Head',   type:'head',    x:350, y:590,  w:140, h:36, at:6  },
    rlog:   { label:'logits [12]', sub:'argmax', type:'data', x:574, y:590, w:102, h:44, at:7 },
    rtok:   { label:'root tokens',       type:'data',    x:574, y:692,  w:110, h:28, at:7  },

    // ── Type Head ───────────────────────────────────────────────────
    h3:     { label:'Chord Type Head',   type:'head',    x:350, y:782,  w:138, h:36, at:8  },
    tlog:   { label:'logits [15]', sub:'argmax', type:'data', x:574, y:782, w:102, h:44, at:9 },
    ttok:   { label:'type tokens',       type:'data',    x:574, y:884,  w:110, h:28, at:9  },

    // ── Concat ──────────────────────────────────────────────────────
    cat:    { label:'concat (H+12+15)', type:'process', x:350, y:978,  w:138, h:30, at:10 },

    // ── Boundary Head (left) & Key Label Head (right) — parallel ───
    h4:     { label:'Key Boundary Head', type:'head',    x:118, y:1068, w:138, h:36, at:11 },
    h5:     { label:'Key Label Head',    type:'keyhead', x:582, y:1068, w:128, h:36, at:11 },

    blog:   { label:'logits [2]',  sub:'argmax', type:'data', x:118, y:1160, w:102, h:44, at:11 },
    bmrk:   { label:'boundary marks',  type:'data',    x:118, y:1260, w:115, h:28, at:11 },

    klog:   { label:'logits [25]', sub:'argmax', type:'data', x:582, y:1160, w:102, h:44, at:11 },
    ktok:   { label:'raw key tokens',  type:'data',    x:582, y:1260, w:116, h:28, at:11 },

    cut:    { label:'cut & stitch',     type:'process', x:350, y:1348, w:108, h:30, at:11 },
    kseq:   { label:'Key Sequence',     type:'data',    x:350, y:1438, w:130, h:36, at:11 },
  };

  // ── Edges ────────────────────────────────────────────────────────
  const EDGES = [
    { from:'chunk',  to:'bert'  },
    { from:'bert',   to:'toks'  },
    { from:'toks',   to:'h1'   },
    // BERT token vectors bypass the chord heads and go directly into concat (H dims)
    { from:'toks',   to:'cat',   bypass:'left'  },
    { from:'h1',     to:'vlog',  horiz:true },
    { from:'vlog',   to:'vmask' },
    // vmask zeros rlog/tlog for non-basic_chord beats before concat
    { from:'vmask',  to:'cat',   bypass:'right', dashed:true },
    { from:'vmask',  to:'h2'   },
    { from:'h2',     to:'rlog',  horiz:true },
    { from:'rlog',   to:'rtok'  },
    { from:'rtok',   to:'h3'   },
    { from:'h3',     to:'tlog',  horiz:true },
    { from:'tlog',   to:'ttok'  },
    { from:'rlog',   to:'cat'  },
    { from:'tlog',   to:'cat'  },
    { from:'cat',    to:'h4'  },
    { from:'cat',    to:'h5'  },
    { from:'h4',     to:'blog'  },
    { from:'blog',   to:'bmrk'  },
    // Boundary marks feed cut & stitch to define segment boundaries
    { from:'bmrk',   to:'cut'  },
    { from:'h5',     to:'klog'  },
    { from:'klog',   to:'ktok'  },
    { from:'ktok',   to:'cut'  },
    { from:'cut',    to:'kseq'  },
  ].map(e => ({ ...e, at: Math.max(N[e.from].at, N[e.to].at) }));

  // ── Color palette ────────────────────────────────────────────────
  // Active: solid fill + white text so nodes clearly "light up"
  // Inactive: desaturated gray so unlit nodes clearly recede
  const TYPE_STYLE = {
    data:    { fill:'#f59e0b', stroke:'#b45309', text:'white'   },  // amber
    process: { fill:'#8b5cf6', stroke:'#5b21b6', text:'white'   },  // violet
    head:    { fill:'#10b981', stroke:'#065f46', text:'white'   },  // emerald
    keyhead: { fill:'#3b82f6', stroke:'#1d4ed8', text:'white'   },  // blue
  };
  const OFF = { fill:'#f1f5f9', stroke:'#cbd5e1', text:'#94a3b8' };


  // ── Edge path ────────────────────────────────────────────────────
  function edgePath(e) {
    const s = N[e.from], t = N[e.to];

    // Long-range bypass: route outside the main column to avoid overlap
    if (e.bypass === 'left') {
      // toks → cat: travel down the left margin (x ≈ 50) into the left side of cat
      const sx = s.x, sy = s.y + s.h / 2;
      const tx = t.x - t.w / 2, ty = t.y;
      return `M ${sx},${sy} C 50,${sy} 50,${ty} ${tx},${ty}`;
    }
    if (e.bypass === 'right') {
      // vmask → cat: travel down the right margin (x ≈ 710) into the right side of cat
      const sx = s.x + s.w / 2, sy = s.y;
      const tx = t.x + t.w / 2, ty = t.y;
      return `M ${sx},${sy} C 715,${sy} 715,${ty} ${tx},${ty}`;
    }

    if (e.horiz) {
      const right = t.x > s.x;
      const sx = s.x + (right ?  1 : -1) * s.w / 2;
      const tx = t.x + (right ? -1 :  1) * t.w / 2;
      return `M ${sx},${s.y} L ${tx},${t.y}`;
    }
    const sx = s.x, sy = s.y + s.h / 2;
    const tx = t.x, ty = t.y - t.h / 2;
    if (Math.abs(tx - sx) < 4) return `M ${sx},${sy} L ${tx},${ty}`;
    const my = (sy + ty) / 2;
    return `M ${sx},${sy} C ${sx},${my} ${tx},${my} ${tx},${ty}`;
  }

  // ── Scroll container ─────────────────────────────────────────────
  let scrollEl;
  $: if (scrollEl) {
    const nodes = Object.values(N).filter(n => n.at === step);
    if (nodes.length) {
      const minY = Math.min(...nodes.map(n => n.y - n.h / 2));
      const maxY = Math.max(...nodes.map(n => n.y + n.h / 2));
      scrollEl.scrollTo({ top: (minY + maxY) / 2 - 200, behavior: 'smooth' });
    }
  }

  const SVG_W = 750;
  const SVG_H = 1520;

  // ── D3 bar chart transitions ─────────────────────────────────────
  let svgEl;
  const LOGIT_IDS = ['vlog', 'rlog', 'tlog', 'blog', 'klog'];

  function updateBars(currentStep) {
    if (!svgEl) return;
    for (const id of LOGIT_IDS) {
      const nd = N[id];
      const active = nd.at <= currentStep;
      const probs  = MOCK_PROBS[id];
      const colors = BAR_COLORS[id];
      const cfg    = BAR_CFG[id];
      const mx     = ARGMAX[id];
      const cx     = nd.x + nd.w / 2 + 10;
      const cy     = nd.y - nd.h / 2 + 4;

      d3.select(svgEl).select(`.bars-${id}`)
        .selectAll('rect')
        .data(probs)
        .join(enter =>
          enter.append('rect')
            .attr('x',       cx)
            .attr('y',       (_, pi) => cy + pi * (cfg.barH + cfg.gap))
            .attr('height',  cfg.barH)
            .attr('rx',      1.5)
            .attr('fill',    (_, pi) => colors[pi] ?? '#94a3b8')
            .attr('opacity', (_, pi) => pi === mx ? 1 : 0.3)
            .attr('width',   0)
        )
        .transition()
        .duration(550)
        .ease(d3.easeCubicOut)
        .attr('width', active ? (d => d * BAR_MAX_W) : 0);
    }
  }

  $: if (svgEl) updateBars(step);
</script>

<div class="wrap">

  <!-- ── Step card ──────────────────────────────────────────────────── -->
  <div class="step-card">
    <div class="step-tag">Step {step + 1} / {TOTAL} · {STEPS[step]}</div>
    <div class="step-desc">{DESCS[step]}</div>
  </div>

  <!-- ── Legend ─────────────────────────────────────────────────────── -->
  <div class="legend">
    <span class="leg-item data">Data</span>
    <span class="leg-item process">Transform</span>
    <span class="leg-item head">Chord Head</span>
    <span class="leg-item keyhead">Key Head</span>
  </div>

  <!-- ── Navigation ─────────────────────────────────────────────────── -->
  <div class="nav">
    <button class="nav-btn" on:click={() => manualStep(Math.max(0, step - 1))} disabled={step === 0}>
      ← Prev
    </button>
    <div class="pips">
      {#each Array(TOTAL) as _, i}
        <button
          class="pip"
          class:on={i <= step}
          class:cur={i === step}
          on:click={() => manualStep(i)}
          aria-label="Go to step {i + 1}"
        ></button>
      {/each}
    </div>
    <button class="nav-btn" on:click={() => manualStep(Math.min(TOTAL - 1, step + 1))} disabled={step === TOTAL - 1}>
      Next →
    </button>
    <button class="play-btn" on:click={togglePlay} title={playing ? 'Pause' : step >= TOTAL - 1 ? 'Replay' : 'Play'}>
      {#if playing}
        ⏸
      {:else if step >= TOTAL - 1}
        ↺
      {:else}
        ▶
      {/if}
    </button>
  </div>

  <!-- ── Flowchart SVG ───────────────────────────────────────────────── -->
  <div class="svg-wrap" bind:this={scrollEl}>

    <!-- Boundary logits tooltip -->
    {#if hoveredBlog && N.blog.at <= step}
      <div
        class="validity-tooltip"
        style="left:{N.blog.x + N.blog.w / 2 + 10}px; top:{N.blog.y - 20}px; border-color:#dc2626"
        on:mouseenter={showBlog}
        on:mouseleave={hideBlog}
      >
        <div class="vt-title" style="color:#dc2626">Key Boundary · 2 classes</div>
        <div class="rt-note" style="color:#7f1d1d">Per beat: does a key change start here?</div>
        {#each BOUNDARY_CLASSES as bc}
          <div class="vt-row">
            <span class="vt-dot" style="background:{bc.color}"></span>
            <div>
              <div class="vt-name">{bc.name}</div>
              <div class="vt-desc">{bc.desc}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Key label tooltip -->
    {#if hoveredKlog && N.klog.at <= step}
      <div
        class="validity-tooltip kl-tooltip"
        style="left:{N.klog.x - N.klog.w / 2 - 210}px; top:{N.klog.y - 30}px; border-color:#2563eb"
        on:mouseenter={showKlog}
        on:mouseleave={hideKlog}
      >
        <div class="vt-title" style="color:#2563eb">Key Label · 25 classes</div>
        <div class="rt-note" style="color:#1e3a8a">
          12 roots × (Major | Minor) + "Other"
        </div>
        <div class="kl-grid">
          <div class="kl-header"></div>
          <div class="kl-header kl-mode">Maj</div>
          <div class="kl-header kl-mode">Min</div>
          {#each KEY_ROOTS as root, i}
            <div class="kl-root" style="color:{KEY_ROOT_COLORS[i]}">{root}</div>
            <div class="kl-cell kl-maj" style="background:{KEY_ROOT_COLORS[i]}">▲</div>
            <div class="kl-cell kl-min" style="background:{KEY_ROOT_COLORS[i]}99">▽</div>
          {/each}
        </div>
        <div class="kl-other">+ <strong>Other</strong> — ambiguous or out-of-vocabulary key</div>
      </div>
    {/if}

    <!-- Validity class tooltip -->
    {#if hoveredVlog && N.vlog.at <= step}
      <div
        class="validity-tooltip"
        style="left:{N.vlog.x - 140}px; top:{N.vlog.y + N.vlog.h / 2 + 10}px"
        on:mouseenter={showVlog}
        on:mouseleave={hideVlog}
      >
        <div class="vt-title">Validity classes</div>
        {#each VALIDITY_CLASSES as vc}
          <div class="vt-row">
            <span class="vt-dot" style="background:{vc.color}"></span>
            <div>
              <div class="vt-name">{vc.name}</div>
              <div class="vt-desc">{vc.desc}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Chord-type class tooltip -->
    {#if hoveredTlog && N.tlog.at <= step}
      <div
        class="validity-tooltip type-tooltip"
        style="left:{N.tlog.x - N.tlog.w / 2 - 290}px; top:{N.tlog.y - 160}px"
        on:mouseenter={showTlog}
        on:mouseleave={hideTlog}
      >
        <div class="vt-title" style="color:#7c3aed">Chord Type · 15 classes</div>
        {#each TYPE_CLASSES as grp}
          <div class="tg-group-header" style="color:{grp.color}">{grp.group}</div>
          {#each grp.items as item}
            <div class="vt-row tg-row">
              <span class="tg-name">{item.name}</span>
              <span class="vt-desc">{item.desc}</span>
            </div>
          {/each}
        {/each}
      </div>
    {/if}

    <!-- Root class tooltip -->
    {#if hoveredRlog && N.rlog.at <= step}
      <div
        class="validity-tooltip root-tooltip"
        style="left:{N.rlog.x - N.rlog.w / 2 - 220}px; top:{N.rlog.y - 20}px"
        on:mouseenter={showRlog}
        on:mouseleave={hideRlog}
      >
        <div class="vt-title" style="color:#b45309">Chord Root · 12 classes</div>
        <div class="rt-note">The pitch class of the chord, ignoring octave.</div>
        <div class="rt-grid">
          {#each ROOT_CLASSES as rc}
            <div class="rt-chip" style="background:{rc.color}">
              {rc.name}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <svg width={SVG_W} height={SVG_H} bind:this={svgEl}>

      <defs>
        <marker id="arr-on"  viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8"/>
        </marker>
        <marker id="arr-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#e2e8f0"/>
        </marker>
      </defs>

      <!-- Edges (drawn first so nodes appear on top) -->
      {#each EDGES as e}
        {@const eOn = e.at <= step}
        <path
          d={edgePath(e)}
          fill="none"
          stroke={eOn ? '#64748b' : '#e2e8f0'}
          stroke-width="1.5"
          stroke-dasharray={e.dashed ? '6,4' : 'none'}
          marker-end={eOn ? 'url(#arr-on)' : 'url(#arr-off)'}
        />
      {/each}

      <!-- Nodes -->
      {#each Object.entries(N) as [id, nd]}
        {@const active = nd.at <= step}
        {@const style = active ? TYPE_STYLE[nd.type] : OFF}
        {@const isVlog = id === 'vlog'}
        {@const isRlog = id === 'rlog'}
        {@const isTlog = id === 'tlog'}
        {@const isBlog = id === 'blog'}
        {@const isKlog = id === 'klog'}
        {@const hoverable = (isVlog || isRlog || isTlog || isBlog || isKlog) && active}
        {@const isHovered = (isVlog && hoveredVlog) || (isRlog && hoveredRlog) || (isTlog && hoveredTlog) || (isBlog && hoveredBlog) || (isKlog && hoveredKlog)}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <g
          role={hoverable ? 'button' : undefined}
          on:mouseenter={hoverable ? () => { if (isVlog) showVlog(); if (isRlog) showRlog(); if (isTlog) showTlog(); if (isBlog) showBlog(); if (isKlog) showKlog(); } : undefined}
          on:mouseleave={isVlog || isRlog || isTlog || isBlog || isKlog ? () => { hideVlog(); hideRlog(); hideTlog(); hideBlog(); hideKlog(); } : undefined}
          style={hoverable ? 'cursor:help' : ''}
        >
          <rect
            x={nd.x - nd.w / 2}   y={nd.y - nd.h / 2}
            width={nd.w}           height={nd.h}
            rx={6}
            fill={isHovered ? '#fcd34d' : style.fill}
            stroke={isHovered ? '#b45309' : style.stroke}
            stroke-width={active ? 1.5 : 1}
          />
          <!-- Bar chart — D3-managed, transitions driven by updateBars() -->
          {#if nd.sub && MOCK_PROBS[id]}
            <g class="bars-{id}"></g>
          {/if}

          {#if nd.sub}
            <!-- Two-line node: label on top half, sub on bottom half -->
            <text
              x={nd.x} y={nd.y - 8}
              text-anchor="middle" dominant-baseline="middle"
              font-size="11" font-weight="500"
              font-family="Inter, sans-serif"
              fill={isHovered ? '#78350f' : style.text}
            >{nd.label}{hoverable ? ' ⓘ' : ''}</text>
            <line
              x1={nd.x - nd.w / 2 + 8} y1={nd.y}
              x2={nd.x + nd.w / 2 - 8} y2={nd.y}
              stroke={isHovered ? '#b45309' : style.text}
              stroke-width="0.5" opacity="0.4"
            />
            <text
              x={nd.x} y={nd.y + 10}
              text-anchor="middle" dominant-baseline="middle"
              font-size="10" font-weight="400"
              font-family="Inter, sans-serif"
              opacity="0.75"
              fill={isHovered ? '#78350f' : style.text}
            >{nd.sub}</text>
          {:else}
            <text
              x={nd.x} y={nd.y}
              text-anchor="middle" dominant-baseline="middle"
              font-size={nd.type === 'head' || nd.type === 'keyhead' ? 12 : 11}
              font-weight={nd.type === 'head' || nd.type === 'keyhead' ? '600' : '400'}
              font-family="Inter, sans-serif"
              fill={isHovered ? '#78350f' : style.text}
            >{nd.label}{hoverable ? ' ⓘ' : ''}</text>
          {/if}
        </g>
      {/each}

    </svg>
  </div>

</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: 'Inter', sans-serif;
  }

  /* Step card */
  .step-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .step-tag {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }
  .step-desc { font-size: 14px; color: #334155; line-height: 1.5; }

  /* Legend */
  .legend {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .leg-item {
    font-size: 11px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1.5px solid;
  }
  .leg-item.data    { background:#f59e0b; border-color:#b45309; color:white; }
  .leg-item.process { background:#8b5cf6; border-color:#5b21b6; color:white; }
  .leg-item.head    { background:#10b981; border-color:#065f46; color:white; }
  .leg-item.keyhead { background:#3b82f6; border-color:#1d4ed8; color:white; }

  /* Navigation */
  .nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .nav-btn {
    padding: 6px 14px;
    background: #1e293b;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
  }
  .nav-btn:disabled { background: #e2e8f0; color: #94a3b8; cursor: default; }
  .nav-btn:not(:disabled):hover { background: #334155; }

  .pips { display: flex; gap: 5px; }
  .pip {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: #e2e8f0;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: background 0.25s, transform 0.15s;
  }
  .pip.on  { background: #94a3b8; }
  .pip.cur { background: #4e79a7; transform: scale(1.3); }

  .play-btn {
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 1.5px solid #4e79a7;
    background: white;
    color: #4e79a7;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.2s, color 0.2s;
  }
  .play-btn:hover { background: #4e79a7; color: white; }

  /* SVG container */
  .svg-wrap {
    position: relative;   /* anchor for the absolute tooltip */
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    height: 560px;
    background: white;
    scroll-behavior: smooth;
  }

  /* Validity tooltip */
  .validity-tooltip {
    position: absolute;
    z-index: 10;
    width: 280px;
    background: white;
    border: 1.5px solid #059669;
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }
  .vt-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #059669;
    margin-bottom: 10px;
  }
  .vt-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .vt-row:last-child { margin-bottom: 0; }
  .vt-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .vt-name {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
    font-family: 'Courier New', monospace;
  }
  .vt-desc {
    font-size: 11px;
    color: #64748b;
    line-height: 1.45;
    margin-top: 1px;
  }

  /* Root tooltip overrides */
  .root-tooltip { border-color: #b45309; width: 210px; }
  .rt-note {
    font-size: 11px;
    color: #78350f;
    margin-bottom: 10px;
    line-height: 1.4;
  }
  .rt-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
  }
  .rt-chip {
    border-radius: 5px;
    padding: 4px 2px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: white;
    font-family: 'Inter', sans-serif;
    text-shadow: 0 1px 2px rgba(0,0,0,0.25);
  }

  /* Type tooltip */
  .type-tooltip { border-color: #7c3aed; width: 280px; max-height: 420px; overflow-y: auto; }
  .tg-group-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 8px 0 4px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e2e8f0;
  }
  .tg-group-header:first-of-type { margin-top: 2px; }
  .tg-row { align-items: baseline; gap: 6px; margin-bottom: 4px; flex-wrap: nowrap; }
  .tg-name {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #1e293b;
    min-width: 48px;
    flex-shrink: 0;
  }

  /* Key label tooltip */
  .kl-tooltip { border-color: #2563eb; width: 200px; }
  .kl-grid {
    display: grid;
    grid-template-columns: 62px 1fr 1fr;
    gap: 3px 4px;
    margin-bottom: 8px;
  }
  .kl-header {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    padding-bottom: 2px;
  }
  .kl-mode { text-align: center; }
  .kl-root {
    font-size: 11px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    display: flex;
    align-items: center;
  }
  .kl-cell {
    border-radius: 3px;
    font-size: 9px;
    text-align: center;
    color: white;
    padding: 2px 0;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }
  .kl-other {
    font-size: 11px;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
  }

  /* Animate SVG elements via CSS transitions */
  :global(.svg-wrap rect)  { transition: fill 0.35s ease, stroke 0.35s ease, stroke-width 0.25s; }
  :global(.svg-wrap text)  { transition: fill 0.35s ease; }
  :global(.svg-wrap path)  { transition: stroke 0.35s ease; }
</style>

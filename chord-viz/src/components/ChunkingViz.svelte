<script>
  import * as d3 from 'd3';

  // ── Controls ────────────────────────────────────────────────────
  let numerator   = 4;
  let denominator = 4;
  let numBars     = 20;

  const DENOMS         = [2, 4, 8];
  const MAX_BEATS      = 12;
  const BARS_PER_CHUNK = 8;

  // ── Derived ─────────────────────────────────────────────────────
  $: numChunks    = Math.ceil(numBars / BARS_PER_CHUNK);
  $: lastRealBars = numBars % BARS_PER_CHUNK === 0 ? BARS_PER_CHUNK : numBars % BARS_PER_CHUNK;
  $: lastPadBars  = BARS_PER_CHUNK - lastRealBars;

  // ── Colors ───────────────────────────────────────────────────────
  const COLORS = ['#4e79a7','#f28e2b','#e15759','#76b7b2',
                  '#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac'];
  const cc = i => COLORS[i % COLORS.length];

  // ── Node geometry ────────────────────────────────────────────────
  // NW / NH = width / height of each node type
  const NW = { song: 90, chunk: 80, bar: 64, beat: 52, ell: 28 };
  const NH = { song: 36, chunk: 34, bar: 32, beat: 28, ell: 24 };

  // ── Tree data builder ────────────────────────────────────────────
  // Pass all reactive vars as args so Svelte tracks them correctly
  $: treeRoot = buildTree(numChunks, lastRealBars, lastPadBars, numerator);

  function buildBeatChildren(chunkIdx, numer) {
    const bPad = MAX_BEATS - numer;
    const c = [];
    c.push({ n: 'beat 1', type: 'beat', chunkIdx, isPad: false });
    if (numer > 2) c.push({ n: '···', type: 'ell', count: numer - 2, label2: '' });
    if (numer > 1) c.push({ n: `beat ${numer}`, type: 'beat', chunkIdx, isPad: false });
    if (bPad > 0)  c.push({ n: '[0]', type: 'beat', chunkIdx, isPad: true, count: bPad });
    return c;
  }

  function buildTree(nChunks, nLastReal, nLastPad, numer) {
    const bc0 = buildBeatChildren(0, numer);
    const bcN = buildBeatChildren(nChunks - 1, numer);

    // ── Chunk 1 bars ─────────────────────────────────────────────
    let c1Bars;
    if (nChunks === 1) {
      // Single chunk — may have padded bars
      c1Bars = [{ n: 'bar 1', type: 'bar', chunkIdx: 0, children: bc0 }];
      if (nLastReal > 2) c1Bars.push({ n: '···', type: 'ell', count: nLastReal - 2, label2: 'real' });
      if (nLastReal > 1) c1Bars.push({ n: `bar ${nLastReal}`, type: 'bar', chunkIdx: 0 });
      if (nLastPad  > 0) c1Bars.push({ n: '[0]', type: 'bar', isPad: true,  count: nLastPad });
    } else {
      // Multiple chunks — chunk 1 always has 8 real bars
      c1Bars = [
        { n: 'bar 1', type: 'bar', chunkIdx: 0, children: bc0 },
        { n: '···',   type: 'ell', count: 6, label2: 'bars' },
        { n: 'bar 8', type: 'bar', chunkIdx: 0 },
      ];
    }

    // ── Chunk N bars (only when nChunks > 1) ─────────────────────
    const cNBars = [];
    if (nChunks > 1) {
      cNBars.push({ n: 'bar 1',          type: 'bar', chunkIdx: nChunks - 1, children: bcN });
      if (nLastReal > 2) cNBars.push({ n: '···',           type: 'ell', count: nLastReal - 2, label2: 'real' });
      if (nLastReal > 1) cNBars.push({ n: `bar ${nLastReal}`, type: 'bar', chunkIdx: nChunks - 1 });
      if (nLastPad  > 0) cNBars.push({ n: '[0]',           type: 'bar', isPad: true, count: nLastPad });
    }

    // ── Song children (chunks) ────────────────────────────────────
    const chunkChildren = [
      { n: 'chunk 1', type: 'chunk', chunkIdx: 0, children: c1Bars },
    ];
    if (nChunks > 2) {
      chunkChildren.push({ n: '···', type: 'ell', count: nChunks - 2, label2: 'chunks' });
    }
    if (nChunks > 1) {
      chunkChildren.push({
        n: `chunk ${nChunks}`,
        type: 'chunk',
        chunkIdx: nChunks - 1,
        isPad: nLastPad > 0,
        children: cNBars,
      });
    }

    return { n: 'Song', type: 'song', children: chunkChildren };
  }

  // ── D3 tree layout ───────────────────────────────────────────────
  const DY  = 120; // vertical distance between levels
  const PAD = 90;  // svg padding (top + sides)

  $: layoutRoot = (() => {
    const hier = d3.hierarchy(treeRoot, d => d.children);
    const layout = d3.tree()
      .nodeSize([1, DY])  // x-size=1, will scale by separation
      .separation((a, b) => {
        // Keep siblings at least (halfA + halfB + gap) apart
        const gap = 12;
        return (NW[a.data.type] + NW[b.data.type]) / 2 + gap;
      });
    return layout(hier);
  })();

  // Compute SVG bounds from layout
  let svgW = 600, svgH = 400, offsetX = 300;

  $: {
    const nodes = layoutRoot.descendants();
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    offsetX = -minX + PAD + NW.song / 2;
    svgW    = maxX - minX + PAD * 2 + NW.song;
    svgH    = maxY + PAD * 2 + NH.beat;
  }

  // Bezier link: bottom-center of parent → top-center of child
  function linkPath(link) {
    const sx = link.source.x + offsetX;
    const sy = link.source.y + PAD + NH[link.source.data.type] / 2;
    const tx = link.target.x + offsetX;
    const ty = link.target.y + PAD - NH[link.target.data.type] / 2;
    const my = (sy + ty) / 2;
    return `M ${sx},${sy} C ${sx},${my} ${tx},${my} ${tx},${ty}`;
  }

  // Node fill / stroke / text color
  function getFill(d) {
    if (d.type === 'song')               return '#1e293b';
    if (d.type === 'chunk')              return cc(d.chunkIdx ?? 0);
    if (d.type === 'ell')                return 'none';
    if (d.type === 'bar'  && d.isPad)   return '#f1f5f9';
    if (d.type === 'bar')                return cc(d.chunkIdx ?? 0) + '20';
    if (d.type === 'beat' && d.isPad)   return '#e2e8f0';
    if (d.type === 'beat')               return cc(d.chunkIdx ?? 0);
    return '#eee';
  }
  function getStroke(d) {
    if (d.type === 'bar' && d.isPad)  return '#cbd5e1';
    if (d.type === 'bar')             return cc(d.chunkIdx ?? 0) + '55';
    return 'none';
  }
  function getTextFill(d) {
    if (d.type === 'song')                   return 'white';
    if (d.type === 'chunk')                  return 'white';
    if (d.type === 'beat' && !d.isPad)       return 'white';
    if (d.type === 'ell')                    return '#94a3b8';
    if (d.isPad)                             return '#94a3b8';
    return '#334155';
  }

  // Denominator cycling
  function cycleDenom(dir) {
    const i = DENOMS.indexOf(denominator);
    denominator = DENOMS[(i + dir + DENOMS.length) % DENOMS.length];
  }
</script>

<div class="wrap">

  <!-- ── CONTROLS ─────────────────────────────────────────────────── -->
  <div class="controls">

    <div class="ctrl-block">
      <div class="ctrl-label">Time signature</div>
      <div class="timesig">
        <div class="tsig-col">
          <button class="sp" on:click={() => numerator = Math.min(12, numerator + 1)}>▲</button>
          <span class="tsig-digit">{numerator}</span>
          <button class="sp" on:click={() => numerator = Math.max(1,  numerator - 1)}>▼</button>
        </div>
        <div class="tsig-sep"></div>
        <div class="tsig-col">
          <button class="sp" on:click={() => cycleDenom(+1)}>▲</button>
          <span class="tsig-digit">{denominator}</span>
          <button class="sp" on:click={() => cycleDenom(-1)}>▼</button>
        </div>
      </div>
      <div class="ctrl-hint">
        {numerator} beat{numerator !== 1 ? 's' : ''}/bar · each bar padded to {MAX_BEATS} slots
      </div>
    </div>

    <div class="ctrl-block song-ctrl">
      <div class="ctrl-label">
        Song length —
        <strong>{numBars} bar{numBars !== 1 ? 's' : ''}</strong>
        → {numChunks} chunk{numChunks !== 1 ? 's' : ''}
      </div>
      <input type="range" min="1" max="64" bind:value={numBars} />
    </div>

  </div>

  <!-- ── TREE SVG ───────────────────────────────────────────────────── -->
  <div class="svg-scroll">
    <svg width={svgW} height={svgH}>

      <!-- Links -->
      {#each layoutRoot.links() as link}
        <path
          d={linkPath(link)}
          fill="none"
          stroke="#cbd5e1"
          stroke-width="1.5"
        />
      {/each}

      <!-- Nodes -->
      {#each layoutRoot.descendants() as node}
        {@const d   = node.data}
        {@const w   = NW[d.type]}
        {@const h   = NH[d.type]}
        {@const cx  = node.x + offsetX}
        {@const cy  = node.y + PAD}
        {@const fs  = d.type === 'song' ? 14 : d.type === 'chunk' ? 13 : d.type === 'bar' ? 12 : 11}

        <g>
          <!-- Box (skip for ellipsis) -->
          {#if d.type !== 'ell'}
            <rect
              x={cx - w / 2}  y={cy - h / 2}
              width={w}        height={h}
              rx={5}
              fill={getFill(d)}
              stroke={getStroke(d)}
              stroke-dasharray={d.isPad && d.type === 'bar' ? '4,3' : 'none'}
            />
          {/if}

          <!-- Main label -->
          <text
            x={cx} y={cy}
            text-anchor="middle" dominant-baseline="middle"
            font-size={fs}
            font-weight={d.type === 'song' || d.type === 'chunk' ? '600' : '400'}
            fill={getTextFill(d)}
            font-family="Inter, sans-serif"
          >{d.n}</text>

          <!-- Sub-label for ellipsis (count + label2) -->
          {#if d.type === 'ell' && d.count !== undefined}
            <text
              x={cx} y={cy + 14}
              text-anchor="middle"
              font-size="9"
              fill="#94a3b8"
              font-family="Inter, sans-serif"
            >{d.count}{d.label2 ? ' ' + d.label2 : ''}</text>
          {/if}

          <!-- Count badge for pad bar/beat -->
          {#if d.isPad && d.count !== undefined && d.type !== 'ell'}
            <text
              x={cx} y={cy + h / 2 + 11}
              text-anchor="middle"
              font-size="9"
              fill="#94a3b8"
              font-family="Inter, sans-serif"
            >×{d.count}</text>
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
    gap: 24px;
    font-family: 'Inter', sans-serif;
  }

  /* Controls */
  .controls {
    display: flex;
    gap: 40px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .ctrl-block { display: flex; flex-direction: column; gap: 6px; }
  .ctrl-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }
  .ctrl-hint { font-size: 11px; color: #94a3b8; }

  /* Time signature widget */
  .timesig {
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 14px;
  }
  .tsig-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .tsig-sep {
    width: 1.5px;
    height: 50px;
    background: #e2e8f0;
    margin: 0 12px;
  }
  .tsig-digit {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    min-width: 22px;
    text-align: center;
    line-height: 1;
  }
  .sp {
    background: none;
    border: none;
    font-size: 9px;
    color: #cbd5e1;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
  }
  .sp:hover { color: #4e79a7; }

  /* Song length slider */
  .song-ctrl input[type=range] {
    width: 240px;
    accent-color: #4e79a7;
  }

  /* SVG container */
  .svg-scroll {
    overflow-x: auto;
    padding-bottom: 4px;
  }
</style>

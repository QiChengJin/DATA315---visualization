<script>
  import ChunkingViz from './components/ChunkingViz.svelte';
  import PredictionFlow from './components/PredictionFlow.svelte';
</script>

<main>

  <!-- ══ INTRO ═════════════════════════════════════════════════════════ -->
  <section class="intro">
    <h1>How AI Hears Harmony</h1>
    <p class="lead">
      When a music app tells you a song is in C major, 
      or shows you live chord names as you strum — some model did that work. 
      But how? This article walks through one answer: a chord-and-key detection pipeline I designed. 
      We'll see how a song gets sliced and padded into digestible chunks, and 
      how five specialised classification heads answer progressively harder 
      questions about the music — from "is there even a chord here?" 
      all the way to "what key is this, and when does it change?"


      No machine‑learning background needed.
    </p>
  </section>

  <!-- ══ SECTION 1: CHUNKING ══════════════════════════════════════════ -->
  <section>
    <h2>1 · Slicing the Song</h2>
    <p>
      A song is too long to hand to a neural network all at once. Instead, it is
      cut into short, fixed‑length <strong>chunks</strong> — think of them as pages in a book.
      Each chunk is exactly <strong>8 bars</strong>.
    </p>
    <p>
      But songs rarely divide evenly into 8‑bar pages. The last chunk almost always
      comes up short, so the model pads the remaining slots with <strong>zeros</strong>
      — silent beats that carry no musical information. The tree below shows how
      a song of any length maps onto chunks, bars, and beats, with zero‑padding
      marked in gray.
    </p>
    <p class="hint">
      Use the time‑signature spinner and the song‑length slider to see how the
      tree changes.
    </p>
    <div class="viz-card">
      <ChunkingViz />
    </div>
    <p>
      One detail matters for later: each bar is also padded <em>at the beat level</em>
      to a fixed width of 12 slots, regardless of the actual time signature. A bar
      in 3/4 gets 9 empty beat slots; a bar in 4/4 gets 8. This lets the model
      receive every chunk as a perfectly rectangular grid — a requirement for
      BERT‑style batch processing.
    </p>
  </section>

  <!-- ══ SECTION 2: PREDICTION PIPELINE ══════════════════════════════ -->
  <section>
    <h2>2 · The Cascade of Heads</h2>
    <p>
      Once the audio is chunked and padded, it passes through a
      <strong>BERT backbone</strong> that reads every beat in context and
      produces a rich embedding vector for each one. These vectors then feed
      five specialised <em>classification heads</em> — small networks, each
      trained to answer one question about the music.
    </p>
    <p>
      The heads don't all run independently. They form a <strong>cascade</strong>:
      the answer from an earlier head is fed as an extra input to later heads,
      letting each one build on what came before. Step through the pipeline below
      to see how each piece fits together.
    </p>
    <div class="viz-card">
      <PredictionFlow />
    </div>
    <p>
      The last step — <em>cut &amp; stitch</em> — reverses the zero‑padding.
      Padded beats are discarded, and the per‑beat key predictions are assembled
      back into a clean sequence aligned with the original song timeline.
      With this cascade design, the machine builds up a complete harmonic picture: the chord on every beat, the key at every moment, and — if the key shifts mid-song — exactly where and what it changes to.
At the end of this pipeline, the machine knows quite a lot. All the quiet work, made explicit.
    </p>
  </section>

  <!-- ══ FOOTER ════════════════════════════════════════════════════════ -->
  <footer>
    <p>
      Built for DATA 31500 · Spring 2026 ·
      <a href="https://github.com/QiChengJin" target="_blank" rel="noopener">QiChengJin</a>
    </p>
  </footer>

</main>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    font-family: 'Inter', sans-serif;
    background: #f9f9f7;
    color: #222;
    line-height: 1.6;
  }

  main {
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 24px 64px;
    display: flex;
    flex-direction: column;
    gap: 48px;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .intro { gap: 12px; }

  h1 {
    font-size: 32px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
  }

  h2 {
    font-size: 22px;
    font-weight: 600;
    color: #1e293b;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
  }

  p {
    font-size: 16px;
    color: #374151;
    line-height: 1.75;
  }

  .lead {
    font-size: 18px;
    color: #4b5563;
    line-height: 1.7;
  }

  .hint {
    font-size: 13px;
    color: #94a3b8;
    font-style: italic;
  }

  .viz-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 28px 24px;
  }

  footer {
    border-top: 1px solid #e2e8f0;
    padding-top: 20px;
    font-size: 13px;
    color: #94a3b8;
  }

  footer a { color: #64748b; text-decoration: none; }
  footer a:hover { text-decoration: underline; }
</style>

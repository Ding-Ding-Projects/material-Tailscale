// Hardware fit for a model tag: a conservative verdict with the evidence and assumptions behind
// it. Inputs are facts only: the tag's published download size and context window, this
// computer's memory, video memory and free disk, and the context settings the person chose.
// Nothing is inferred from a model's name, missing facts are never treated as zero, and doubt
// gives Unknown or a more cautious verdict.

const GB = 1e9;
const VERDICTS = ['Runs well', 'Runs with limits', 'Unlikely', 'Unknown'];
const gb = (n) => `${(n / GB).toFixed(n >= 10 * GB ? 0 : 1)} GB`;

/**
 * tag: { size (bytes), context (tokens) }
 * hw: { ram: { total, free }, gpu: { known, vram, free, name }, disk: { free } }
 * opts: { numCtx (tokens the person will use, default 4096), perK (bytes of overhead per 1,024
 * tokens, default 0.125 GB), runtime (bytes for the runtime itself, default 0.5 GB) }
 */
function fit(tag, hw, opts = {}) {
  const numCtxWanted = opts.numCtx || 4096;
  const perK = opts.perK ?? 0.125 * GB;
  const runtime = opts.runtime ?? 0.5 * GB;
  const evidence = [], assumptions = [];
  const at = new Date().toISOString();
  if (!tag || !Number.isFinite(tag.size) || tag.size <= 0) {
    return { verdict: 'Unknown', need: null, evidence: ['The catalogue gives no download size for this tag, so its memory need cannot be worked out.'], assumptions, at };
  }
  if (!hw || !Number.isFinite(hw.ram?.total) || hw.ram.total <= 0) {
    return { verdict: 'Unknown', need: null, evidence: ['This computer\'s memory could not be read.'], assumptions, at };
  }
  const ctx = Number.isFinite(tag.context) && tag.context > 0 ? Math.min(numCtxWanted, tag.context) : numCtxWanted;
  if (!Number.isFinite(tag.context)) assumptions.push(`The catalogue does not give a context window; ${ctx.toLocaleString('en-US')} tokens is assumed.`);
  const ctxBytes = (ctx / 1024) * perK;
  const need = tag.size + ctxBytes + runtime;
  evidence.push(`Needs about ${gb(need)}: ${gb(tag.size)} of weights, ${gb(ctxBytes)} for a ${ctx.toLocaleString('en-US')}-token context and ${gb(runtime)} for the runtime.`);
  assumptions.push(`Context overhead is ${gb(perK)} per 1,024 tokens and the runtime takes ${gb(runtime)}; both can be changed in the store's settings.`);

  const disk = hw.disk?.free;
  if (Number.isFinite(disk)) {
    if (tag.size > disk) return { verdict: 'Unlikely', need, evidence: [...evidence, `The download is ${gb(tag.size)} but only ${gb(disk)} is free where models are kept.`], assumptions, at };
    evidence.push(`Disk: ${gb(disk)} free where models are kept.`);
  } else assumptions.push('Free disk space could not be read.');

  const ramFree = Number.isFinite(hw.ram.free) ? hw.ram.free : null;
  const gpu = hw.gpu || {};
  if (gpu.known && Number.isFinite(gpu.vram) && gpu.vram > 0) {
    const vram = Number.isFinite(gpu.free) ? Math.min(gpu.vram, gpu.free + 0.5 * GB) : gpu.vram;
    if (need <= 0.9 * vram) return { verdict: 'Runs well', need, evidence: [...evidence, `That fits in 90% of the ${gb(vram)} of video memory on ${gpu.name || 'the graphics card'}.`], assumptions, at };
    const spill = need - 0.9 * vram;
    if (ramFree !== null && spill <= 0.7 * ramFree) return { verdict: 'Runs with limits', need, evidence: [...evidence, `That is more than 90% of the ${gb(vram)} of video memory, so about ${gb(spill)} runs on the processor, which is slower.`, `Memory: ${gb(ramFree)} free covers that part.`], assumptions, at };
    return { verdict: 'Unlikely', need, evidence: [...evidence, `Video memory (${gb(vram)}) plus free memory (${ramFree === null ? 'unknown' : gb(ramFree)}) is not enough with room to spare.`], assumptions, at };
  }
  // No usable graphics card facts: memory alone, and never better than "with limits".
  evidence.push(gpu.name ? `${gpu.name}: its video memory could not be read, so only system memory is counted.` : 'No graphics card with readable video memory was found, so the model would run on the processor.');
  if (ramFree !== null && need <= 0.8 * ramFree) return { verdict: 'Runs with limits', need, evidence: [...evidence, `Memory: ${gb(ramFree)} free of ${gb(hw.ram.total)}; the model fits, but replies are slower without a graphics card.`], assumptions, at };
  if (need <= 0.6 * hw.ram.total) return { verdict: 'Runs with limits', need, evidence: [...evidence, `Memory: it fits in the ${gb(hw.ram.total)} installed, but only if other programs are closed first.`], assumptions, at };
  return { verdict: 'Unlikely', need, evidence: [...evidence, `Memory: ${gb(hw.ram.total)} installed is not enough with room to spare.`], assumptions, at };
}

module.exports = { fit, VERDICTS, GB };

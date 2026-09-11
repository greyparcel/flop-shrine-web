// Decode once and loop the PCM buffer without compressed-audio padding.
const button = document.querySelector('#sound');
let context, gain, source, buffer;
let enabled = false;
let pending = false;
let bellBuffer, bellSource, bellLoading;
let atShrine = false;
function prepareBell() {
  if (bellBuffer) return Promise.resolve();
  if (bellLoading) return bellLoading;
  bellLoading = fetch(new URL('./audio/arrival.mp3', import.meta.url))
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(data => context.decodeAudioData(data))
    .then(decoded => { bellBuffer = decoded; })
    .finally(() => { bellLoading = null; });
  return bellLoading;
}
document.addEventListener('shrine-arrival', event => {
  const entering = event.detail.arrived && !atShrine;
  atShrine = event.detail.arrived;
  if (!entering) return;
  // Never play a late bell when sound is enabled or finishes loading after arrival.
  if (!enabled || !bellBuffer || context.state !== 'running') return;
  const node = context.createBufferSource();
  const volume = context.createGain();
  volume.gain.value = 0.55;
  node.buffer = bellBuffer;
  node.connect(volume).connect(context.destination);
  node.onended = () => { node.disconnect(); volume.disconnect(); if (bellSource === node) bellSource = null; };
  bellSource = node;
  node.start();
});
function paint(label = enabled ? 'ON' : 'OFF') {
  button.querySelector('span').textContent = label;
  button.setAttribute('aria-pressed', String(enabled));
}
button.addEventListener('click', async () => {
  if (pending) return;
  if (enabled) {
    enabled = false;
    if (bellSource) { bellSource.stop(); bellSource = null; }
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(0, context.currentTime, 0.12);
    const old = source;
    source = null;
    old.stop(context.currentTime + 0.7);
    paint();
    return;
  }
  pending = true;
  paint('…');
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    await context.resume();
    await prepareBell();
    if (!buffer) {
      const response = await fetch(new URL('./audio/deep-sanctuary-loop.wav', import.meta.url));
      if (!response.ok) throw new Error(`Audio: ${response.status}`);
      buffer = await context.decodeAudioData(await response.arrayBuffer());
    }
    gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.connect(gain);
    const nodeGain = gain;
    node.onended = () => { node.disconnect(); nodeGain.disconnect(); };
    node.start();
    gain.gain.setTargetAtTime(0.55, context.currentTime, 0.6);
    source = node;
    enabled = true;
    button.removeAttribute('title');
  } catch (error) {
    enabled = false;
    button.title = 'Sound could not load. Tap to retry.';
    console.warn('Shrine sound unavailable', error);
  } finally {
    pending = false;
    paint();
  }
});

const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d");
const fileInput = document.querySelector("#audioFile");
const cityImageInput = document.querySelector("#cityImage");
const playButton = document.querySelector("#playPause");
const controlsPanel = document.querySelector(".controls");
const advancedToggle = document.querySelector("#advancedToggle");
const analysisModeToggle = document.querySelector("#analysisModeToggle");
const detectBeatButton = document.querySelector("#detectBeat");
const beatRows = [...document.querySelectorAll("[data-beat-track]")];
const boostInput = document.querySelector("#lightningBoost");
const lightningFrequencyInput = document.querySelector("#lightningFrequency");
const lightningFrequencyValue = document.querySelector("#lightningFrequencyValue");
const backgroundBrightnessInput = document.querySelector("#backgroundBrightness");
const cloudVisibilityInput = document.querySelector("#cloudVisibility");
const vizzySensitivityInput = document.querySelector("#vizzySensitivity");
const vizzyBandsInput = document.querySelector("#vizzyBands");
const skyTitleEnabledInput = document.querySelector("#skyTitleEnabled");
const skyTitleTextInput = document.querySelector("#skyTitleText");
const skyTitleBeatTrackInput = document.querySelector("#skyTitleBeatTrack");
const bandInputs = [...document.querySelectorAll("input[name='lightningBand']")];
const meterEls = {
  bass: document.querySelector("#bassMeter"),
  mid: document.querySelector("#midMeter"),
  treble: document.querySelector("#trebleMeter"),
};

const audio = new Audio();
audio.crossOrigin = "anonymous";

let audioContext;
let analyser;
let sourceNode;
let frequencyData = new Uint8Array(0);
let timeData = new Uint8Array(0);
let isPlaying = false;
let lightningBand = "treble";
let buildings = [];
let clouds = [];
let bolts = [];
let flash = 0;
let lastTime = performance.now();
let analysisMode = "classic";
let smoothed = { bass: 0, mid: 0, treble: 0 };
let previousBandEnergy = 0;
let vizzyState = createVizzyState(0);
let selectedAudioFile = null;
let beatTracks = {};
let skyTitleHueOffset = 0;

const skylineImage = new Image();
const skyTitlePatternCanvas = document.createElement("canvas");
const skyTitlePatternCtx = skyTitlePatternCanvas.getContext("2d");
skyTitlePatternCanvas.width = 720;
skyTitlePatternCanvas.height = 4;

const beatTrackDefinitions = [
  {
    id: "main",
    label: "Main",
    filters: [
      { type: "lowpass", frequency: 180, q: 0.85, weight: 0.68 },
      { type: "bandpass", frequency: 1200, q: 1.2, weight: 0.32 },
    ],
  },
  {
    id: "kick",
    label: "Kick",
    filters: [
      { type: "lowpass", frequency: 140, q: 0.9, weight: 1 },
    ],
  },
  {
    id: "backbeat",
    label: "Backbeat",
    filters: [
      { type: "bandpass", frequency: 650, q: 1.1, weight: 0.55 },
      { type: "bandpass", frequency: 2200, q: 1.35, weight: 0.45 },
    ],
  },
  {
    id: "hats",
    label: "Hats",
    filters: [
      { type: "highpass", frequency: 3600, q: 0.75, weight: 1 },
    ],
  },
];

beatTracks = Object.fromEntries(beatTrackDefinitions.map((definition) => {
  const row = beatRows.find((candidate) => candidate.dataset.beatTrack === definition.id);

  return [definition.id, {
    ...definition,
    buildingInput: row?.querySelector("[data-role='building']"),
    bpmInput: row?.querySelector("[data-role='bpm']"),
    offsetInput: row?.querySelector("[data-role='offset']"),
    statusEl: row?.querySelector("[data-role='status']"),
    bpm: 0,
    offset: 0,
    pulse: 0,
  }];
}));

function createVizzyState(bandCount) {
  return {
    bandCount,
    ranges: [],
    centers: [],
    energies: new Float32Array(bandCount),
    previous: new Float32Array(bandCount),
    baselines: new Float32Array(bandCount),
    hits: new Float32Array(bandCount),
  };
}

// x,y are the building rectangle's bottom-left coordinates in image-relative units.
const imageBuildings = [
  { name: "1", x: 0.04, y: 0.820, width: 0.025, height: 0.23, cols: 5, rows: 10 },
  { name: "2", x: 0.057, y: 0.820, width: 0.05, height: 0.23, cols: 5, rows: 10 },
  { name: "3", x: 0.105, y: 0.815, width: 0.073, height: 0.161, cols: 6, rows: 18 },
  { name: "4", x: 0.175, y: 0.812, width: 0.055, height: 0.13, cols: 4, rows: 16 },
  { name: "5", x: 0.221, y: 0.810, width: 0.070, height: 0.10, cols: 3, rows: 16 },
  { name: "6", x: 0.292, y: 0.810, width: 0.048, height: 0.10, cols: 4, rows: 10 },
  
  // BHP
  { name: "7", x: 0.348, y: 0.818, width: 0.099, height: 0.34, cols: 8, rows: 16 },
  { name: "8", x: 0.442, y: 0.72, width: 0.058, height: 0.232, cols: 5, rows: 24 },
  { name: "9", x: 0.445, y: 0.833, width: 0.052, height: 0.14, cols: 10, rows: 8 },
  
  { name: "10", x: 0.495, y: 0.825, width: 0.037, height: 0.14, cols: 5, rows: 9 },
  { name: "11", x: 0.523, y: 0.820, width: 0.052, height: 0.18, cols: 4, rows: 12 },
  { name: "12", x: 0.570, y: 0.834, width: 0.029, height: 0.14, cols: 4, rows: 10 },
  
  // small pillars
  { name: "13", x: 0.866, y: 0.827, width: 0.020, height: 0.13, cols: 4, rows: 8 },
  { name: "14", x: 0.639, y: 0.743, width: 0.004, height: 0.28, cols: 1, rows: 18 },
  { name: "15", x: 0.437, y: 0.813, width: 0.006, height: 0.34, cols: 1, rows: 16 },
  
  // right sides
  { name: "16", x: 0.597, y: 0.829, width: 0.048, height: 0.33, cols: 8, rows: 20 },
  { name: "17", x: 0.632, y: 0.832, width: 0.053, height: 0.13, cols: 5, rows: 6 },
  { name: "18", x: 0.639, y: 0.826, width: 0.065, height: 0.17, cols: 6, rows: 18 },
  { name: "19", x: 0.711, y: 0.826, width: 0.060, height: 0.22, cols: 5, rows: 20 },
  { name: "20", x: 0.779, y: 0.827, width: 0.070, height: 0.23, cols: 6, rows: 15 },

  // no use
  { name: "21", x: 0.777, y: 0.827, width: 0.01, height: 0.01, cols: 1, rows: 1 },
  { name: "22", x: 0.777, y: 0.827, width: 0.01, height: 0.01, cols: 1, rows: 1 },
  { name: "23", x: 0.842, y: 0.831, width: 0.024, height: 0.21, cols: 3, rows: 13 },
];

skylineImage.addEventListener("load", () => {
  buildSkyline();
});

skylineImage.src = "city-skyline.gpt.png";

function setupAudio() {
  if (audioContext) return;

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = isVizzyMode() ? 0.18 : 0.72;

  sourceNode = audioContext.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);

  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
}

function resize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildSkyline();
  buildClouds();
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeBuildingName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function normalizeImageBuilding(building, index) {
  const x = toFiniteNumber(building.x, Number.NaN);
  const baseY = toFiniteNumber(building.y, Number.NaN);
  const width = toFiniteNumber(building.width ?? building.w, Number.NaN);
  const height = toFiniteNumber(building.height ?? building.h, Number.NaN);

  if (![x, baseY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    ...building,
    name: String(building.name ?? index + 1),
    x,
    y: baseY,
    width,
    height,
    cols: Math.max(1, Math.round(toFiniteNumber(building.cols, Math.max(2, width * 90)))),
    rows: Math.max(1, Math.round(toFiniteNumber(building.rows, Math.max(3, height * 42)))),
    seed: toFiniteNumber(building.seed, Math.random() * 1000),
    bandIndex: index,
    source: "image",
  };
}

function buildSkyline() {
  if (skylineImage.complete && skylineImage.naturalWidth) {
    buildings = imageBuildings.map(normalizeImageBuilding).filter(Boolean);
    return;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  buildings = [];
  let x = -20;
  let index = 0;

  while (x < w + 40) {
    const width = randomRange(24, 62);
    const height = randomRange(h * 0.22, h * 0.72);
    const rows = Math.max(4, Math.floor(height / randomRange(14, 22)));
    const cols = Math.max(2, Math.floor(width / randomRange(8, 13)));
    const crown = Math.random() > 0.7 ? randomRange(8, 36) : 0;
    buildings.push({
      name: String(index + 1),
      x,
      y: h - height,
      width,
      height,
      rows,
      cols,
      crown,
      seed: Math.random() * 1000,
      bandIndex: index,
      depth: randomRange(0.65, 1),
    });
    x += width + randomRange(2, 9);
    index += 1;
  }
}

function buildClouds() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  clouds = Array.from({ length: Math.max(7, Math.floor(w / 180)) }, () => ({
    x: randomRange(-w * 0.25, w),
    y: randomRange(16, h * 0.36),
    width: randomRange(160, 360),
    height: randomRange(28, 76),
    speed: randomRange(3, 12),
    alpha: randomRange(0.22, 0.58),
  }));
}

function getEnergy(startHz, endHz) {
  if (!analyser || !frequencyData.length) return 0;

  const nyquist = audioContext.sampleRate / 2;
  const start = Math.max(0, Math.floor((startHz / nyquist) * frequencyData.length));
  const end = Math.min(frequencyData.length - 1, Math.ceil((endHz / nyquist) * frequencyData.length));
  let sum = 0;
  let count = 0;

  for (let i = start; i <= end; i += 1) {
    sum += frequencyData[i];
    count += 1;
  }

  return count ? sum / count / 255 : 0;
}

function ensureVizzyState() {
  const bandCount = getVizzyBandCount();

  if (vizzyState.bandCount === bandCount) return;

  const minHz = 35;
  const maxHz = 12000;
  const minLog = Math.log(minHz);
  const maxLog = Math.log(maxHz);
  vizzyState = createVizzyState(bandCount);

  for (let i = 0; i < bandCount; i += 1) {
    const startRatio = i / bandCount;
    const endRatio = (i + 1) / bandCount;
    const centerRatio = (i + 0.5) / bandCount;
    const startHz = Math.exp(minLog + (maxLog - minLog) * startRatio);
    const endHz = Math.exp(minLog + (maxLog - minLog) * endRatio);
    const centerHz = Math.exp(minLog + (maxLog - minLog) * centerRatio);
    vizzyState.ranges.push([startHz, endHz]);
    vizzyState.centers.push(centerHz);
  }
}

function getFrequencySliceEnergy(startHz, endHz) {
  if (!audioContext || !frequencyData.length) return 0;

  const nyquist = audioContext.sampleRate / 2;
  const start = clamp(Math.floor((startHz / nyquist) * frequencyData.length), 0, frequencyData.length - 1);
  const end = clamp(Math.ceil((endHz / nyquist) * frequencyData.length), start, frequencyData.length - 1);
  let sum = 0;
  let count = 0;

  for (let i = start; i <= end; i += 1) {
    sum += Math.pow(frequencyData[i] / 255, 1.18);
    count += 1;
  }

  return count ? sum / count : 0;
}

function summarizeVizzyRange(minHz, maxHz) {
  let energySum = 0;
  let hitSum = 0;
  let count = 0;

  for (let i = 0; i < vizzyState.bandCount; i += 1) {
    const center = vizzyState.centers[i];
    if (center < minHz || center > maxHz) continue;

    energySum += vizzyState.energies[i];
    hitSum += vizzyState.hits[i];
    count += 1;
  }

  if (!count) return { energy: 0, hit: 0 };

  return {
    energy: energySum / count,
    hit: hitSum / count,
  };
}

function analyzeVizzyBands() {
  ensureVizzyState();

  const sensitivity = getVizzySensitivity();
  let globalHit = 0;

  for (let i = 0; i < vizzyState.bandCount; i += 1) {
    const [startHz, endHz] = vizzyState.ranges[i];
    const centerHz = vizzyState.centers[i];
    const tilt = Math.pow(centerHz / 1000, -0.08);
    const current = clamp(getFrequencySliceEnergy(startHz, endHz) * tilt, 0, 1);
    const flux = Math.max(0, current - vizzyState.previous[i]);
    const baseline = vizzyState.baselines[i] * 0.965 + flux * 0.035;
    const threshold = baseline * (1.65 / sensitivity) + 0.0035 / sensitivity;
    const hit = clamp((flux - threshold) * sensitivity * 18, 0, 1);

    vizzyState.energies[i] = current;
    vizzyState.previous[i] = current;
    vizzyState.baselines[i] = baseline;
    vizzyState.hits[i] = Math.max(hit, vizzyState.hits[i] * 0.74);
    globalHit = Math.max(globalHit, vizzyState.hits[i]);
  }

  const bass = summarizeVizzyRange(40, 180);
  const mid = summarizeVizzyRange(180, 2800);
  const treble = summarizeVizzyRange(2800, 12000);

  return {
    bass: clamp(bass.energy * 0.62 + bass.hit * 0.85, 0, 1),
    mid: clamp(mid.energy * 0.5 + mid.hit * 0.9, 0, 1),
    treble: clamp(treble.energy * 0.4 + treble.hit, 0, 1),
    onset: {
      bass: bass.hit,
      mid: mid.hit,
      treble: treble.hit,
      global: globalHit,
    },
  };
}

async function renderFilteredMonoBuffer(audioBuffer, filterType, frequency, q = 1) {
  const offline = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const source = offline.createBufferSource();
  const filter = offline.createBiquadFilter();
  const gain = offline.createGain();

  source.buffer = audioBuffer;
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  gain.gain.value = 0.9;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(offline.destination);
  source.start(0);

  return offline.startRendering();
}

function createEnergyEnvelope(audioBuffer, hopSize) {
  const samples = audioBuffer.getChannelData(0);
  const frameSize = hopSize * 2;
  const frameCount = Math.max(1, Math.floor((samples.length - frameSize) / hopSize));
  const envelope = new Float32Array(frameCount);
  let previous = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    let sum = 0;

    for (let i = 0; i < frameSize; i += 1) {
      const sample = samples[start + i] || 0;
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / frameSize);
    envelope[frame] = Math.max(0, rms - previous);
    previous = rms;
  }

  return envelope;
}

function normalizeEnvelope(envelope) {
  let max = 0;

  for (const value of envelope) {
    if (value > max) max = value;
  }

  if (!max) return envelope;

  for (let i = 0; i < envelope.length; i += 1) {
    envelope[i] /= max;
  }

  return envelope;
}

function combineWeightedEnvelopes(weightedEnvelopes) {
  const length = Math.min(...weightedEnvelopes.map((item) => item.envelope.length));
  const combined = new Float32Array(length);
  const totalWeight = weightedEnvelopes.reduce((sum, item) => sum + item.weight, 0) || 1;
  let baseline = 0;

  for (let i = 0; i < length; i += 1) {
    let value = 0;

    for (const item of weightedEnvelopes) {
      value += item.envelope[i] * item.weight;
    }

    value /= totalWeight;
    baseline = baseline * 0.985 + value * 0.015;
    combined[i] = Math.max(0, value - baseline * 0.65);
  }

  return normalizeEnvelope(combined);
}

function estimateBpmFromEnvelope(envelope, sampleRate, hopSize) {
  const fps = sampleRate / hopSize;
  const minBpm = 70;
  const maxBpm = 180;
  const minLag = Math.floor((60 / maxBpm) * fps);
  const maxLag = Math.ceil((60 / minBpm) * fps);
  let bestLag = minLag;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    let count = 0;

    for (let i = lag; i < envelope.length; i += 1) {
      score += envelope[i] * envelope[i - lag];
      count += 1;
    }

    const normalized = count ? score / count : 0;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestLag = lag;
    }
  }

  return 60 / (bestLag / fps);
}

function findBeatOffset(envelope, sampleRate, hopSize, bpm) {
  const fps = sampleRate / hopSize;
  const lag = Math.max(1, Math.round((60 / bpm) * fps));
  const searchFrames = Math.min(envelope.length, lag * 8);
  let bestOffsetFrame = 0;
  let bestScore = -Infinity;

  for (let offset = 0; offset < lag; offset += 1) {
    let score = 0;

    for (let frame = offset; frame < searchFrames; frame += lag) {
      score += envelope[frame] || 0;
    }

    if (score > bestScore) {
      bestScore = score;
      bestOffsetFrame = offset;
    }
  }

  return bestOffsetFrame / fps;
}

async function detectBeatTracksFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const DecodeContext = window.AudioContext || window.webkitAudioContext;
  const decodeContext = new DecodeContext();
  const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
  const hopSize = 1024;
  const envelopeCache = new Map();
  const results = {};

  async function getFilteredEnvelope(filterSpec) {
    const key = `${filterSpec.type}:${filterSpec.frequency}:${filterSpec.q}`;
    if (!envelopeCache.has(key)) {
      const buffer = await renderFilteredMonoBuffer(
        audioBuffer,
        filterSpec.type,
        filterSpec.frequency,
        filterSpec.q,
      );
      envelopeCache.set(key, createEnergyEnvelope(buffer, hopSize));
    }

    return envelopeCache.get(key);
  }

  for (const definition of beatTrackDefinitions) {
    const weightedEnvelopes = [];

    for (const filterSpec of definition.filters) {
      weightedEnvelopes.push({
        envelope: await getFilteredEnvelope(filterSpec),
        weight: filterSpec.weight,
      });
    }

    const envelope = combineWeightedEnvelopes(weightedEnvelopes);
    const bpm = estimateBpmFromEnvelope(envelope, audioBuffer.sampleRate, hopSize);
    const offset = findBeatOffset(envelope, audioBuffer.sampleRate, hopSize, bpm);
    results[definition.id] = { bpm, offset };
  }

  if (decodeContext.close) {
    await decodeContext.close();
  }

  return results;
}

function getBaseBrightness() {
  return Number(backgroundBrightnessInput.value);
}

function getCloudVisibility() {
  return Number(cloudVisibilityInput.value);
}

function getLightningFrequencyMultiplier() {
  return Math.pow(2, Number(lightningFrequencyInput.value));
}

function updateLightningFrequencyLabel() {
  const multiplier = getLightningFrequencyMultiplier();
  lightningFrequencyValue.textContent = multiplier >= 1 ? `${multiplier}x` : `1/${1 / multiplier}x`;
}

function getVizzySensitivity() {
  return Number(vizzySensitivityInput.value);
}

function getVizzyBandCount() {
  return Number(vizzyBandsInput.value);
}

function isSkyTitleEnabled() {
  return skyTitleEnabledInput.checked;
}

function getSkyTitleText() {
  return skyTitleTextInput.value.trim() || "Music Wave Visualization With Skyline";
}

function getSkyTitleBeatEnergy() {
  const track = beatTracks[skyTitleBeatTrackInput.value] || beatTracks.main;
  return clamp(track?.pulse || 0, 0, 1);
}

function getTrackBpm(track) {
  return Number(track.bpmInput?.value) || 0;
}

function getTrackOffset(track) {
  return Number(track.offsetInput?.value) || 0;
}

function setTrackStatus(track, text) {
  if (track.statusEl) track.statusEl.textContent = text;
}

function updateBeatTrack(track, nextBeatInfo) {
  track.bpm = nextBeatInfo.bpm || 0;
  track.offset = nextBeatInfo.offset || 0;

  if (track.bpmInput) track.bpmInput.value = track.bpm ? track.bpm.toFixed(1) : "0";
  if (track.offsetInput) track.offsetInput.value = track.offset ? track.offset.toFixed(2) : "0";

  setTrackStatus(track, track.bpm ? `${track.bpm.toFixed(1)} BPM` : "Not detected");
}

function getBeatPulseForTrack(track) {
  const bpm = getTrackBpm(track);
  if (!bpm || !audio.duration) return 0;

  const interval = 60 / bpm;
  const elapsed = audio.currentTime - getTrackOffset(track);
  if (elapsed < 0) return 0;

  const phase = (elapsed % interval) / interval;
  return Math.exp(-phase * 16);
}

function updateBeatPulses() {
  for (const track of Object.values(beatTracks)) {
    track.pulse = getBeatPulseForTrack(track);
  }
}

function getBuildingBeatBoost(buildingName) {
  const normalizedBuildingName = normalizeBuildingName(buildingName);
  let boost = 0;

  for (const track of Object.values(beatTracks)) {
    const targetName = normalizeBuildingName(track.buildingInput?.value);
    if (!targetName || targetName !== normalizedBuildingName) continue;
    boost = Math.max(boost, track.pulse);
  }

  return boost;
}

function isVizzyMode() {
  return analysisMode === "vizzy";
}

function setAnalysisMode(mode) {
  analysisMode = mode;
  const enabled = isVizzyMode();
  analysisModeToggle.textContent = enabled ? "Vizzy-like" : "Classic";
  analysisModeToggle.classList.toggle("is-vizzy", enabled);
  analysisModeToggle.setAttribute("aria-pressed", String(enabled));
  controlsPanel.classList.toggle("is-vizzy", enabled);

  if (analyser) {
    analyser.smoothingTimeConstant = enabled ? 0.18 : 0.72;
  }

  previousBandEnergy = 0;
}

function setPlayButtonState(playing) {
  const label = playing ? "Pause" : "Play";
  playButton.classList.toggle("is-playing", playing);
  playButton.setAttribute("aria-label", label);
  playButton.title = label;
}

function setAdvancedCollapsed(collapsed) {
  controlsPanel.classList.toggle("is-collapsed", collapsed);
  advancedToggle.setAttribute("aria-expanded", String(!collapsed));
  advancedToggle.setAttribute("aria-label", collapsed ? "Expand settings" : "Collapse settings");
  advancedToggle.title = collapsed ? "Expand settings" : "Collapse settings";
}

function analyzeAudio() {
  if (!analyser) return { bass: 0, mid: 0, treble: 0, onset: { bass: 0, mid: 0, treble: 0, global: 0 } };

  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeData);

  const classic = {
    bass: getEnergy(35, 250),
    mid: getEnergy(250, 2600),
    treble: getEnergy(2600, 12000),
  };
  const raw = isVizzyMode() ? analyzeVizzyBands() : classic;
  const smoothing = isVizzyMode() ? 0.46 : 0.78;
  const incoming = 1 - smoothing;

  for (const band of ["bass", "mid", "treble"]) {
    smoothed[band] = smoothed[band] * smoothing + raw[band] * incoming;
    meterEls[band].style.setProperty("--level", smoothed[band].toFixed(3));
  }

  return {
    ...smoothed,
    onset: raw.onset || { bass: 0, mid: 0, treble: 0, global: 0 },
  };
}

function drawBackground(energy) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const base = getBaseBrightness();
  const bright = Math.min(0.95, base * 0.25 + flash * 0.78);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, `rgb(${3 + bright * 118} ${8 + bright * 146} ${16 + bright * 192})`);
  sky.addColorStop(0.58, `rgb(${5 + bright * 106} ${12 + bright * 124} ${20 + bright * 150})`);
  sky.addColorStop(1, `rgb(${2 + bright * 82} ${6 + bright * 92} ${11 + bright * 104})`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.06 + energy.mid * 0.08 + flash * 0.32;
  ctx.fillStyle = "#9fc7dd";
  for (let y = h * 0.16; y < h * 0.72; y += 46) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;
}

function drawClouds(dt) {
  const w = window.innerWidth;
  const visibility = getCloudVisibility();

  if (visibility <= 0) {
    return;
  }

  for (const cloud of clouds) {
    cloud.x += cloud.speed * dt;
    if (cloud.x > w + cloud.width) cloud.x = -cloud.width * 1.2;

    const gradient = ctx.createRadialGradient(
      cloud.x + cloud.width * 0.5,
      cloud.y,
      10,
      cloud.x + cloud.width * 0.5,
      cloud.y,
      cloud.width * 0.6,
    );
    const alpha = Math.min(0.9, (cloud.alpha + flash * 0.25) * visibility);
    gradient.addColorStop(0, `rgb(128 145 158 / ${alpha})`);
    gradient.addColorStop(1, "rgb(28 39 50 / 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.width * 0.45, cloud.height * 0.52, 0, 0, Math.PI * 2);
    ctx.ellipse(
      cloud.x + cloud.width * 0.34,
      cloud.y - cloud.height * 0.1,
      cloud.width * 0.38,
      cloud.height * 0.58,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      cloud.x + cloud.width * 0.68,
      cloud.y + cloud.height * 0.06,
      cloud.width * 0.46,
      cloud.height * 0.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function updateSkyTitlePattern(lightness) {
  for (let hue = 0; hue < 360; hue += 1) {
    skyTitlePatternCtx.fillStyle = `hsl(${hue} 92% ${lightness}%)`;
    skyTitlePatternCtx.fillRect(hue * 2, 0, 2, skyTitlePatternCanvas.height);
  }
}

function drawSkyTitle(dt) {
  if (!isSkyTitleEnabled()) return;

  const text = getSkyTitleText();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const beatEnergy = getSkyTitleBeatEnergy();
  const speedScale = 1 + beatEnergy * 7;
  const lightness = clamp(56 + beatEnergy * 10 + flash * 8, 48, 76);
  const fontSize = clamp(w * 0.052, 28, 78);
  const y = Math.max(fontSize * 1.55, h * 0.16);

  skyTitleHueOffset = (skyTitleHueOffset + dt * 120 * speedScale) % skyTitlePatternCanvas.width;
  updateSkyTitlePattern(lightness);

  const pattern = ctx.createPattern(skyTitlePatternCanvas, "repeat");
  if (!pattern) return;

  ctx.save();
  ctx.font = `900 ${fontSize}px "Inter", "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const x = w * 0.5;
  ctx.shadowColor = "rgb(255 255 255 / 0.92)";
  ctx.shadowBlur = 18 + beatEnergy * 12;
  ctx.strokeStyle = "rgb(255 255 255 / 0.96)";
  ctx.lineWidth = Math.max(3, fontSize * 0.08);
  ctx.strokeText(text, x, y);

  ctx.shadowBlur = 0;
  ctx.fillStyle = pattern;
  ctx.translate(-skyTitleHueOffset, 0);
  ctx.fillText(text, x + skyTitleHueOffset, y);
  ctx.restore();
}

function drawSkyline(energy) {
  if (skylineImage.complete && skylineImage.naturalWidth) {
    drawImageSkyline(energy);
    return;
  }

  drawGeneratedSkyline(energy);
}

function drawImageSkyline(energy) {
  const placement = getSkylinePlacement();
  const { dx, dy, dw, dh, sx, sy, sw, sh } = placement;
  const base = getBaseBrightness();
  const brightness = Math.min(1.12, base + flash * 0.7);

  ctx.save();
  ctx.filter = `brightness(${brightness}) saturate(${0.7 + flash * 0.35}) contrast(1.08)`;
  ctx.drawImage(skylineImage, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();

  const night = Math.max(0, 0.82 - base * 0.8 - flash * 0.48);
  ctx.fillStyle = `rgb(0 5 12 / ${night})`;
  ctx.fillRect(dx, dy, dw, dh);

  for (const building of buildings) {
    const towerEnergy = getTowerEnergy(building.bandIndex, buildings.length);
    drawImageBuildingWindows(building, placement, towerEnergy, energy);
  }

  const waterGlow = ctx.createLinearGradient(0, dy + dh * 0.78, 0, dy + dh);
  waterGlow.addColorStop(0, `rgb(5 14 22 / ${0.08 + energy.mid * 0.08})`);
  waterGlow.addColorStop(1, `rgb(1 4 8 / ${Math.max(0.08, 0.72 - base * 0.72 - flash * 0.32)})`);
  ctx.fillStyle = waterGlow;
  ctx.fillRect(dx, dy + dh * 0.72, dw, dh * 0.28);
}

function getSkylinePlacement() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const imageRatio = skylineImage.naturalWidth / skylineImage.naturalHeight;
  const targetHeight = Math.max(h * 0.62, w / imageRatio);
  const dw = Math.max(w, targetHeight * imageRatio);
  const dh = dw / imageRatio;
  const dx = (w - dw) / 2;
  const dy = h - dh;

  return {
    dx,
    dy,
    dw,
    dh,
    sx: 0,
    sy: 0,
    sw: skylineImage.naturalWidth,
    sh: skylineImage.naturalHeight,
  };
}

function drawImageBuildingWindows(building, placement, towerEnergy, energy) {
  const rows = Math.max(1, Math.round(toFiniteNumber(building.rows, 6)));
  const cols = Math.max(1, Math.round(toFiniteNumber(building.cols, 3)));
  const beatBoost = getBuildingBeatBoost(building.name);
  const isBeatBuilding = beatBoost > 0;
  const combinedEnergy = Math.max(towerEnergy, beatBoost);
  const topY = building.y - building.height;
  const rect = {
    x: placement.dx + building.x * placement.dw,
    y: placement.dy + topY * placement.dh,
    width: building.width * placement.dw,
    height: building.height * placement.dh,
  };
  const litRows = Math.round(rows * Math.min(1, combinedEnergy * 1.45 + energy.bass * 0.12));
  const padX = Math.max(2, rect.width * 0.12);
  const padY = Math.max(3, rect.height * 0.05);
  const gapX = Math.max(1, rect.width * 0.045);
  const gapY = Math.max(1, rect.height * 0.025);
  const windowW = Math.max(1.5, (rect.width - padX * 2 - gapX * (cols - 1)) / cols);
  const windowH = Math.max(1.5, (rect.height - padY * 2 - gapY * (rows - 1)) / rows);

  ctx.save();
  ctx.shadowColor = isBeatBuilding ? "#fff1b8" : "#ffe6a6";
  ctx.shadowBlur = 7 + combinedEnergy * 12 + flash * 8 + beatBoost * 18;

  for (let row = 0; row < rows; row += 1) {
    const isLitFloor = row >= rows - litRows;
    for (let col = 0; col < cols; col += 1) {
      const noise = Math.sin(building.seed + row * 4.7 + col * 8.3 + performance.now() * 0.0012);
      const sparkle = noise > 0.2 || combinedEnergy > 0.58;
      if (!isLitFloor && !sparkle) continue;

      const floorStrength = isLitFloor ? 0.5 + combinedEnergy * 0.75 : combinedEnergy * 0.2;
      const alpha = Math.min(0.96, floorStrength + flash * 0.18 + Math.max(0, noise) * 0.14 + beatBoost * 0.25);
      ctx.fillStyle = isBeatBuilding
        ? `rgb(255 236 170 / ${alpha})`
        : `rgb(255 217 143 / ${alpha})`;
      ctx.fillRect(
        rect.x + padX + col * (windowW + gapX),
        rect.y + padY + row * (windowH + gapY),
        windowW,
        windowH,
      );
    }
  }

  ctx.restore();
}

function drawGeneratedSkyline(energy) {
  const h = window.innerHeight;

  for (const building of buildings) {
    const towerEnergy = getTowerEnergy(building.bandIndex, buildings.length);
    const x = building.x;
    const y = building.y;
    const width = building.width;
    const height = building.height;

    ctx.fillStyle = `rgb(${7 + building.depth * 7} ${15 + building.depth * 10} ${22 + building.depth * 16})`;
    ctx.fillRect(x, y, width, height + 4);

    if (building.crown) {
      ctx.beginPath();
      ctx.moveTo(x + width * 0.5, y - building.crown);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = `rgb(${20 + towerEnergy * 38} ${34 + towerEnergy * 50} ${48 + towerEnergy * 66})`;
    ctx.fillRect(x + width - 2, y, 2, height);

    drawWindows(building, y, height, towerEnergy, energy);
  }

  const ground = ctx.createLinearGradient(0, h - 120, 0, h);
  ground.addColorStop(0, "rgb(3 8 12 / 0)");
  ground.addColorStop(1, "rgb(1 4 7 / 0.95)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h - 140, window.innerWidth, 150);
}

function getTowerEnergy(index, total = buildings.length) {
  if (!frequencyData.length || total <= 0) return 0;

  const safeIndex = clamp(Math.round(toFiniteNumber(index, 0)), 0, total - 1);

  if (isVizzyMode() && vizzyState.bandCount > 0) {
    const bandsPerTower = Math.max(1, Math.ceil(vizzyState.bandCount / total));
    const start = clamp(Math.floor((safeIndex / total) * vizzyState.bandCount), 0, vizzyState.bandCount - 1);
    const end = Math.min(vizzyState.bandCount - 1, start + bandsPerTower - 1);
    let sum = 0;
    let count = 0;

    for (let i = start; i <= end; i += 1) {
      sum += vizzyState.energies[i] * 0.45 + vizzyState.hits[i] * 0.95;
      count += 1;
    }

    return count ? clamp(sum / count, 0, 1) : 0;
  }

  const usableBins = Math.max(1, Math.floor(frequencyData.length * 0.85));
  const span = Math.max(2, Math.ceil(usableBins / total));
  const start = Math.min(usableBins - 1, Math.floor((safeIndex / total) * usableBins));
  const end = Math.min(frequencyData.length - 1, start + span - 1);
  let sum = 0;
  let count = 0;

  for (let i = start; i <= end; i += 1) {
    sum += frequencyData[i];
    count += 1;
  }

  return count ? sum / count / 255 : 0;
}

function drawWindows(building, topY, height, towerEnergy, energy) {
  const rows = Math.max(1, Math.round(toFiniteNumber(building.rows, 6)));
  const cols = Math.max(1, Math.round(toFiniteNumber(building.cols, 3)));
  const padX = Math.max(4, building.width * 0.12);
  const padY = 10;
  const gapX = 4;
  const gapY = 6;
  const windowW = Math.max(2, (building.width - padX * 2 - gapX * (cols - 1)) / cols);
  const windowH = Math.max(3, (height - padY * 2 - gapY * (rows - 1)) / rows);
  const litRows = Math.round(rows * Math.min(1, towerEnergy * 1.4 + energy.bass * 0.16));

  for (let row = 0; row < rows; row += 1) {
    const isLitFloor = row >= rows - litRows;
    for (let col = 0; col < cols; col += 1) {
      const noise = Math.sin(building.seed + row * 7.1 + col * 3.9 + performance.now() * 0.0015);
      const on = isLitFloor || (towerEnergy > 0.55 && noise > 0.35);
      const glow = Math.max(0, towerEnergy + noise * 0.1);
      ctx.fillStyle = on
        ? `rgb(${130 + glow * 95} ${164 + glow * 70} ${188 + glow * 48})`
        : "rgb(19 31 42)";
      ctx.globalAlpha = on ? 0.42 + glow * 0.56 + flash * 0.25 : 0.34;
      ctx.fillRect(
        building.x + padX + col * (windowW + gapX),
        topY + padY + row * (windowH + gapY),
        windowW,
        windowH,
      );
    }
  }
  ctx.globalAlpha = 1;
}

function maybeCreateLightning(energy) {
  const frequencyMultiplier = getLightningFrequencyMultiplier();
  const onset = energy.onset?.[lightningBand] || 0;
  const chosen = isVizzyMode() ? clamp(onset * 0.9 + energy[lightningBand] * 0.18, 0, 1) : energy[lightningBand];
  const jump = chosen - previousBandEnergy;
  const baseThreshold = isVizzyMode()
    ? lightningBand === "bass"
      ? 0.055
      : lightningBand === "mid"
        ? 0.048
        : 0.04
    : lightningBand === "bass"
      ? 0.1
      : lightningBand === "mid"
        ? 0.085
        : 0.065;
  const threshold = baseThreshold / Math.sqrt(frequencyMultiplier);
  const chance = Math.min(0.9, chosen * (isVizzyMode() ? 0.42 : 0.35) * frequencyMultiplier);

  if ((jump > threshold || Math.random() < chance * 0.018) && bolts.length < 4) {
    bolts.push(makeBolt(chosen));
    flash = Math.min(1, flash + chosen * Number(boostInput.value));
  }

  previousBandEnergy = chosen;
}

function makeBolt(power) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const startX = randomRange(w * 0.08, w * 0.92);
  const endY = randomRange(h * 0.34, h * 0.76);
  const segments = Math.floor(randomRange(7, 13));
  const points = [{ x: startX, y: -20 }];
  let x = startX;

  for (let i = 1; i <= segments; i += 1) {
    const progress = i / segments;
    x += randomRange(-42, 42) * (0.55 + power);
    points.push({ x, y: progress * endY });
  }

  const branches = [];
  const branchCount = Math.floor(randomRange(2, 5 + power * 5));
  for (let i = 0; i < branchCount; i += 1) {
    const root = points[Math.floor(randomRange(2, points.length - 2))];
    const branch = [root];
    let bx = root.x;
    let by = root.y;
    for (let j = 0; j < randomRange(2, 5); j += 1) {
      bx += randomRange(-60, 60);
      by += randomRange(18, 54);
      branch.push({ x: bx, y: by });
    }
    branches.push(branch);
  }

  return { points, branches, life: 0.18 + power * 0.18, maxLife: 0.18 + power * 0.18 };
}

function drawLightning(dt) {
  const boost = Number(boostInput.value);

  for (const bolt of bolts) {
    const alpha = Math.max(0, bolt.life / bolt.maxLife);
    drawBoltPath(bolt.points, 5.5 * boost, `rgb(169 221 255 / ${0.22 * alpha})`);
    drawBoltPath(bolt.points, 2.2 * boost, `rgb(228 248 255 / ${0.88 * alpha})`);
    drawBoltPath(bolt.points, 0.8, `rgb(255 255 255 / ${alpha})`);

    for (const branch of bolt.branches) {
      drawBoltPath(branch, 2.2 * boost, `rgb(178 225 255 / ${0.55 * alpha})`);
      drawBoltPath(branch, 0.7, `rgb(250 253 255 / ${0.72 * alpha})`);
    }

    bolt.life -= dt;
  }

  bolts = bolts.filter((bolt) => bolt.life > 0);
}

function drawBoltPath(points, width, strokeStyle) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = strokeStyle;
  ctx.shadowColor = "#cfeeff";
  ctx.shadowBlur = width * 3;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
}

function drawFlashOverlay() {
  if (flash <= 0.01) return;

  const boost = Number(boostInput.value);
  ctx.fillStyle = `rgb(205 230 248 / ${Math.min(0.48, flash * 0.2 * boost)})`;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawIdleWave() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const t = performance.now() * 0.001;

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#6ba4c0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 10) {
    const y = h * 0.58 + Math.sin(x * 0.018 + t) * 24 + Math.sin(x * 0.044 - t * 1.6) * 8;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const energy = analyzeAudio();
  updateBeatPulses();
  maybeCreateLightning(energy);
  flash = Math.max(0, flash - dt * 2.7);

  drawBackground(energy);
  drawSkyline(energy);
  drawClouds(dt);
  drawSkyTitle(dt);
  drawLightning(dt);
  drawFlashOverlay();
  if (!isPlaying) drawIdleWave();

  requestAnimationFrame(frame);
}

async function togglePlayback() {
  if (!audio.src) return;

  setupAudio();
  if (audioContext.state === "suspended") await audioContext.resume();

  if (audio.paused) {
    await audio.play();
    isPlaying = true;
    setPlayButtonState(true);
  } else {
    audio.pause();
    isPlaying = false;
    setPlayButtonState(false);
  }
}

function shouldIgnoreSpaceToggle(event) {
  const tagName = event.target?.tagName;
  return ["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(tagName);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  selectedAudioFile = file;
  audio.src = URL.createObjectURL(file);
  playButton.disabled = false;
  detectBeatButton.disabled = false;
  setPlayButtonState(false);
  isPlaying = false;
  requestAnimationFrame(() => playButton.focus());
});

cityImageInput.addEventListener("change", () => {
  const file = cityImageInput.files?.[0];
  if (!file) return;

  skylineImage.src = URL.createObjectURL(file);
});

playButton.addEventListener("click", () => {
  togglePlayback();
});

advancedToggle.addEventListener("click", () => {
  setAdvancedCollapsed(!controlsPanel.classList.contains("is-collapsed"));
});

analysisModeToggle.addEventListener("click", () => {
  setAnalysisMode(isVizzyMode() ? "classic" : "vizzy");
});

detectBeatButton.addEventListener("click", async () => {
  if (!selectedAudioFile) return;

  detectBeatButton.disabled = true;
  detectBeatButton.textContent = "Detecting...";

  for (const track of Object.values(beatTracks)) {
    setTrackStatus(track, "Detecting...");
  }

  try {
    const detectedTracks = await detectBeatTracksFromFile(selectedAudioFile);

    for (const track of Object.values(beatTracks)) {
      updateBeatTrack(track, detectedTracks[track.id] || { bpm: 0, offset: 0 });
    }
  } catch (error) {
    console.error(error);
    for (const track of Object.values(beatTracks)) {
      setTrackStatus(track, "Detection failed");
    }
  } finally {
    detectBeatButton.textContent = "Detect Beats";
    detectBeatButton.disabled = false;
  }
});

for (const track of Object.values(beatTracks)) {
  track.bpmInput?.addEventListener("input", () => {
    track.bpm = getTrackBpm(track);
    setTrackStatus(track, track.bpm ? `${track.bpm.toFixed(1)} BPM` : "Not detected");
  });

  track.offsetInput?.addEventListener("input", () => {
    track.offset = getTrackOffset(track);
  });
}

lightningFrequencyInput.addEventListener("input", updateLightningFrequencyLabel);

vizzyBandsInput.addEventListener("input", () => {
  vizzyState = createVizzyState(0);
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat || shouldIgnoreSpaceToggle(event)) return;

  event.preventDefault();
  togglePlayback();
});

audio.addEventListener("ended", () => {
  isPlaying = false;
  setPlayButtonState(false);
});

for (const input of bandInputs) {
  input.addEventListener("change", () => {
    lightningBand = document.querySelector("input[name='lightningBand']:checked").value;
    previousBandEnergy = 0;
  });
}

window.addEventListener("resize", resize);
updateLightningFrequencyLabel();
setAnalysisMode("classic");
setAdvancedCollapsed(false);
resize();
requestAnimationFrame(frame);

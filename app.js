const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d");
const fileInput = document.querySelector("#audioFile");
const cityImageInput = document.querySelector("#cityImage");
const playButton = document.querySelector("#playPause");
const boostInput = document.querySelector("#lightningBoost");
const backgroundBrightnessInput = document.querySelector("#backgroundBrightness");
const cloudVisibilityInput = document.querySelector("#cloudVisibility");
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
let smoothed = { bass: 0, mid: 0, treble: 0 };
let previousBandEnergy = 0;

const skylineImage = new Image();

// x,y are the building rectangle's bottom-left coordinates in image-relative units.
const imageBuildings = [
  { x: 0.04, y: 0.820, width: 0.025, height: 0.23, cols: 5, rows: 10 },
  { x: 0.057, y: 0.820, width: 0.05, height: 0.23, cols: 5, rows: 10 },
  { x: 0.105, y: 0.815, width: 0.073, height: 0.161, cols: 6, rows: 18 },
  { x: 0.175, y: 0.812, width: 0.055, height: 0.13, cols: 4, rows: 16 },
  { x: 0.221, y: 0.810, width: 0.070, height: 0.10, cols: 3, rows: 16 },
  { x: 0.292, y: 0.810, width: 0.048, height: 0.10, cols: 4, rows: 10 },
  
  // BHP
  { x: 0.348, y: 0.818, width: 0.099, height: 0.34, cols: 8, rows: 16 },
  { x: 0.442, y: 0.72, width: 0.058, height: 0.232, cols: 5, rows: 24 },
  { x: 0.445, y: 0.833, width: 0.052, height: 0.14, cols: 10, rows: 8 },
  
  { x: 0.495, y: 0.825, width: 0.037, height: 0.14, cols: 5, rows: 9 },
  { x: 0.523, y: 0.820, width: 0.052, height: 0.18, cols: 4, rows: 12 },
  { x: 0.570, y: 0.834, width: 0.029, height: 0.14, cols: 4, rows: 10 },
  
  // small pillars
  { x: 0.866, y: 0.827, width: 0.020, height: 0.13, cols: 4, rows: 8 },
  { x: 0.639, y: 0.743, width: 0.004, height: 0.28, cols: 1, rows: 18 },
  { x: 0.437, y: 0.813, width: 0.006, height: 0.34, cols: 1, rows: 16 },
  
  // right sides
  { x: 0.597, y: 0.829, width: 0.048, height: 0.33, cols: 8, rows: 20 },
  { x: 0.632, y: 0.832, width: 0.053, height: 0.13, cols: 5, rows: 6 },
  { x: 0.639, y: 0.826, width: 0.065, height: 0.17, cols: 6, rows: 18 },
  { x: 0.711, y: 0.826, width: 0.060, height: 0.22, cols: 5, rows: 20 },
  { x: 0.779, y: 0.827, width: 0.070, height: 0.23, cols: 6, rows: 15 },

  // no use
  { x: 0.777, y: 0.827, width: 0.01, height: 0.01, cols: 1, rows: 1 },
  { x: 0.777, y: 0.827, width: 0.01, height: 0.01, cols: 1, rows: 1 },
  { x: 0.842, y: 0.831, width: 0.024, height: 0.21, cols: 3, rows: 13 },
];

skylineImage.addEventListener("load", () => {
  buildSkyline();
});

skylineImage.src = "city-skyline.png";

function setupAudio() {
  if (audioContext) return;

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;

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

function getBaseBrightness() {
  return Number(backgroundBrightnessInput.value);
}

function getCloudVisibility() {
  return Number(cloudVisibilityInput.value);
}

function setPlayButtonState(playing) {
  const label = playing ? "Pause" : "Play";
  playButton.classList.toggle("is-playing", playing);
  playButton.setAttribute("aria-label", label);
  playButton.title = label;
}

function analyzeAudio() {
  if (!analyser) return { bass: 0, mid: 0, treble: 0 };

  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeData);

  const raw = {
    bass: getEnergy(35, 250),
    mid: getEnergy(250, 2600),
    treble: getEnergy(2600, 12000),
  };

  for (const band of Object.keys(raw)) {
    smoothed[band] = smoothed[band] * 0.78 + raw[band] * 0.22;
    meterEls[band].style.setProperty("--level", smoothed[band].toFixed(3));
  }

  return smoothed;
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
  const topY = building.y - building.height;
  const rect = {
    x: placement.dx + building.x * placement.dw,
    y: placement.dy + topY * placement.dh,
    width: building.width * placement.dw,
    height: building.height * placement.dh,
  };
  const litRows = Math.round(rows * Math.min(1, towerEnergy * 1.45 + energy.bass * 0.12));
  const padX = Math.max(2, rect.width * 0.12);
  const padY = Math.max(3, rect.height * 0.05);
  const gapX = Math.max(1, rect.width * 0.045);
  const gapY = Math.max(1, rect.height * 0.025);
  const windowW = Math.max(1.5, (rect.width - padX * 2 - gapX * (cols - 1)) / cols);
  const windowH = Math.max(1.5, (rect.height - padY * 2 - gapY * (rows - 1)) / rows);

  ctx.save();
  ctx.shadowColor = "#ffe6a6";
  ctx.shadowBlur = 7 + towerEnergy * 12 + flash * 8;

  for (let row = 0; row < rows; row += 1) {
    const isLitFloor = row >= rows - litRows;
    for (let col = 0; col < cols; col += 1) {
      const noise = Math.sin(building.seed + row * 4.7 + col * 8.3 + performance.now() * 0.0012);
      const sparkle = noise > 0.2 || towerEnergy > 0.58;
      if (!isLitFloor && !sparkle) continue;

      const floorStrength = isLitFloor ? 0.5 + towerEnergy * 0.75 : towerEnergy * 0.2;
      const alpha = Math.min(0.92, floorStrength + flash * 0.18 + Math.max(0, noise) * 0.14);
      ctx.fillStyle = `rgb(255 217 143 / ${alpha})`;
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
  const chosen = energy[lightningBand];
  const jump = chosen - previousBandEnergy;
  const threshold = lightningBand === "bass" ? 0.1 : lightningBand === "mid" ? 0.085 : 0.065;
  const chance = Math.min(0.55, chosen * 0.35);

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
  maybeCreateLightning(energy);
  flash = Math.max(0, flash - dt * 2.7);

  drawBackground(energy);
  drawSkyline(energy);
  drawClouds(dt);
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

  audio.src = URL.createObjectURL(file);
  playButton.disabled = false;
  setPlayButtonState(false);
  isPlaying = false;
});

cityImageInput.addEventListener("change", () => {
  const file = cityImageInput.files?.[0];
  if (!file) return;

  skylineImage.src = URL.createObjectURL(file);
});

playButton.addEventListener("click", () => {
  togglePlayback();
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
resize();
requestAnimationFrame(frame);

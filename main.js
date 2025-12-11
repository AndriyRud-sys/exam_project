// --------- ГЛОБАЛЬНИЙ СТАН ---------
let currentDepth = 6;          // поточна глибина рекурсії (2..9)
let currentMode = 'none';      // none | both | tree | carpet
let detector = null;           // ML детектор рук
let video = null;              // <video> з вебкамери
let stackVisualizer = null;    // візуалізація стеку

let treeRoot = null;
let carpetRoot = null;
let fractalRoot = null;
let cameraRig = null;

let currentScale = 1.0;
let currentRotationY = 0;      // кут обертання сцени навколо центру

// --------------------------------------------------
// 1. ВІЗУАЛІЗАЦІЯ СТЕКУ ВИКЛИКІВ
// --------------------------------------------------
class CallStackVisualizer {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.stack = [];
  }

  push(functionName, args) {
    this.stack.push({ functionName, args });
    this.render();
  }

  pop() {
    this.stack.pop();
    this.render();
  }

  clear() {
    this.stack = [];
    this.render();
  }

  render() {
    while (this.rootEl.firstChild) {
      this.rootEl.removeChild(this.rootEl.firstChild);
    }

    this.stack.forEach((frame, i) => {
      const box = document.createElement('a-box');
      box.setAttribute('width', 1.1);
      box.setAttribute('height', 0.26);
      box.setAttribute('depth', 0.26);
      box.setAttribute('color', '#4CAF50');
      box.setAttribute('position', { x: 0, y: i * 0.3 + 0.2, z: 0 });

      const text = document.createElement('a-entity');
      text.setAttribute('text', {
        value: `${frame.functionName}(${frame.args.join(',')})`,
        width: 3,
        color: '#ffffff'
      });
      text.setAttribute('position', { x: -0.8, y: 0, z: 0.18 });

      box.appendChild(text);
      this.rootEl.appendChild(box);
    });
  }
}

// --------------------------------------------------
// 2. РЕКУРСИВНА ФУНКЦІЯ factorial З ВІЗУАЛІЗАЦІЄЮ СТЕКУ
// --------------------------------------------------
function factorial(n, stackVis) {
  stackVis.push('factorial', [n]);
  if (n <= 1) {
    stackVis.pop();
    return 1;
  }
  const result = n * factorial(n - 1, stackVis);
  stackVis.pop();
  return result;
}

// --------------------------------------------------
// 3. ДЕРЕВО ПІФАГОРА (3D фрактал)
// --------------------------------------------------
function createPythagorasTree(rootEl, maxDepth) {
  if (!rootEl) return;

  while (rootEl.firstChild) {
    rootEl.removeChild(rootEl.firstChild);
  }

  function addSquare(parent, x, y, size, angleDeg, level) {
    if (level > maxDepth) return;

    const square = document.createElement('a-box');
    square.setAttribute('width', size);
    square.setAttribute('height', size);
    square.setAttribute('depth', 0.18);
    const hue = 205 + level * 8;
    square.setAttribute('color', `hsl(${hue}, 75%, 55%)`);
    square.setAttribute('position', { x, y, z: 0 });
    square.setAttribute('rotation', { x: 0, y: 0, z: angleDeg });
    parent.appendChild(square);

    if (level === maxDepth) return;

    const newSize = size * Math.sqrt(2) / 2;
    const offset = size / 2 + newSize / 2;

    const leftAngle = angleDeg + 45;
    const leftRad = leftAngle * Math.PI / 180;
    const lx = x - offset * Math.cos(leftRad);
    const ly = y + offset * Math.sin(leftRad);
    addSquare(parent, lx, ly, newSize, leftAngle, level + 1);

    const rightAngle = angleDeg - 45;
    const rightRad = rightAngle * Math.PI / 180;
    const rx = x + offset * Math.cos(rightRad);
    const ry = y + offset * Math.sin(rightRad);
    addSquare(parent, rx, ry, newSize, rightAngle, level + 1);
  }

  addSquare(rootEl, 0, 0.6, 1.4, 0, 0);
}

// --------------------------------------------------
// 4. КОВЕР СЕРПІНСЬКОГО (3D плитки)
// --------------------------------------------------
function createSierpinskiCarpet(rootEl, maxDepth) {
  if (!rootEl) return;

  const depth = Math.min(maxDepth, 5); // не вище 5 рівня

  while (rootEl.firstChild) {
    rootEl.removeChild(rootEl.firstChild);
  }

  function addSquareCarpet(parent, cx, cz, size, level, maxLevel) {
    if (level === maxLevel) {
      const box = document.createElement('a-box');
      box.setAttribute('width', size);
      box.setAttribute('height', 0.18);
      box.setAttribute('depth', size);
      const hue = 40 + level * 10;
      box.setAttribute('color', `hsl(${hue}, 80%, 55%)`);
      box.setAttribute('position', { x: cx, y: 0.09, z: cz + level * 0.02 });
      parent.appendChild(box);
      return;
    }

    const newSize = size / 3;

    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        if (ix === 0 && iz === 0) continue;

        const nx = cx + ix * newSize;
        const nz = cz + iz * newSize;
        addSquareCarpet(parent, nx, nz, newSize, level + 1, maxLevel);
      }
    }
  }

  addSquareCarpet(rootEl, 0, 0, 4, 0, depth);
}

// --------------------------------------------------
// 5. МАСШТАБ ФІГУР
// --------------------------------------------------
function applyScale(scale) {
  currentScale = scale;
  if (!fractalRoot) return;
  const s = { x: scale, y: scale, z: scale };
  fractalRoot.setAttribute('scale', s);
}

// --------------------------------------------------
// 6. ПЕРЕМАЛЮВАННЯ ФІГУР ЗА ПОТОЧНИМ РЕЖИМОМ/ГЛИБИНОЮ
// --------------------------------------------------
function redrawFractals() {
  if (currentMode === 'none') return;

  if (currentMode === 'both' || currentMode === 'tree') {
    createPythagorasTree(treeRoot, currentDepth);
  } else if (treeRoot) {
    while (treeRoot.firstChild) treeRoot.removeChild(treeRoot.firstChild);
  }

  if (currentMode === 'both' || currentMode === 'carpet') {
    createSierpinskiCarpet(carpetRoot, currentDepth);
  } else if (carpetRoot) {
    while (carpetRoot.firstChild) carpetRoot.removeChild(carpetRoot.firstChild);
  }

  applyScale(currentScale);
}

// --------------------------------------------------
// 7. ОНОВЛЕННЯ ГЛИБИНИ РЕКУРСІЇ
// --------------------------------------------------
function updateDepth(newDepth) {
  const clamped = Math.max(2, Math.min(9, Math.round(newDepth)));
  if (clamped === currentDepth) return;

  currentDepth = clamped;

  const hudText = document.querySelector('#hud-text');
  if (hudText) {
    hudText.setAttribute('text', 'value: depth: ' + currentDepth + '; color: #333; width: 4');
  }

  redrawFractals();
}

// --------------------------------------------------
// 8. РЕЖИМИ (які фігури показувати + розміщення в центрі)
// --------------------------------------------------
function applyMode(mode) {
  currentMode = mode;

  const sceneModeLabel = document.getElementById('scene-mode-label');
  if (sceneModeLabel) {
    let label = '—';
    if (mode === 'both') label = 'Дерево Піфагора + Ковер Серпінського';
    if (mode === 'tree') label = 'Дерево Піфагора';
    if (mode === 'carpet') label = 'Ковер Серпінського';
    sceneModeLabel.textContent = label;
  }

  const showTree = (mode === 'both' || mode === 'tree');
  const showCarpet = (mode === 'both' || mode === 'carpet');

  if (treeRoot) {
    treeRoot.setAttribute('visible', showTree);
    if (mode === 'tree') treeRoot.setAttribute('position', { x: 0, y: 0, z: 0 });
    if (mode === 'both') treeRoot.setAttribute('position', { x: -2.2, y: 0, z: 0 });
  }

  if (carpetRoot) {
    carpetRoot.setAttribute('visible', showCarpet);
    if (mode === 'carpet') carpetRoot.setAttribute('position', { x: 0, y: 0, z: 0 });
    if (mode === 'both') carpetRoot.setAttribute('position', { x: 2.2, y: 0, z: 0 });
  }

  // при зміні режиму скинемо поворот сцени
  currentRotationY = 0;
  if (fractalRoot) {
    fractalRoot.setAttribute('rotation', { x: 0, y: 0, z: 0 });
  }

  redrawFractals();
}

// --------------------------------------------------
// 9. ML: ВЕБКАМЕРА + ДЕТЕКТОР РУКИ
// --------------------------------------------------
async function initWebcamAndML() {
  video = document.getElementById('webcam');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      initHandDetector();
    };
  } catch (err) {
    console.error('Помилка доступу до вебкамери:', err);
  }
}

async function initHandDetector() {
  if (typeof handPoseDetection === 'undefined') {
    console.error('handPoseDetection не знайдено. Перевір підключення скриптів у index.html');
    return;
  }

  const model = handPoseDetection.SupportedModels.MediaPipeHands;
  const detectorConfig = {
    runtime: 'mediapipe',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
    modelType: 'lite',
    maxHands: 1
  };

  detector = await handPoseDetection.createDetector(model, detectorConfig);
  requestAnimationFrame(detectHandsLoop);
}

// --------------------------------------------------
// 10. ЦИКЛ ДЕТЕКЦІЇ РУКИ (глибина + обертання)
// --------------------------------------------------
async function detectHandsLoop() {
  if (!detector || !video || video.readyState < 2) {
    requestAnimationFrame(detectHandsLoop);
    return;
  }

  try {
    const hands = await detector.estimateHands(video, { flipHorizontal: true });

    if (hands.length > 0) {
      const hand = hands[0];
      const keypoints = hand.keypoints || [];

      const thumbTip = keypoints.find(k => k.name === 'thumb_tip');
      const indexTip = keypoints.find(k => k.name === 'index_finger_tip');

      if (thumbTip && indexTip) {
        // ---- ГЛИБИНА (щипок) ----
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const minD = 20;
        const maxD = 260;
        let t = (dist - minD) / (maxD - minD);
        t = Math.max(0, Math.min(1, t)); // 0..1

        const depthMin = 2;
        const depthMax = (currentMode === 'carpet') ? 5 : 9;
        const depth = depthMin + t * (depthMax - depthMin);
        updateDepth(depth);

        // ---- ОБЕРТАННЯ (горизонтальне положення руки як "швидкість") ----
        const cx = (thumbTip.x + indexTip.x) / 2;
        const videoWidth = video.videoWidth || 640;
        const normX = (cx - videoWidth / 2) / (videoWidth / 2); // -1..1

        // normX < 0 — рука ліворуч: крутимо в один бік, normX > 0 — вправо
        const rotationSpeed = normX * 2.0; // чутливість, можна підкрутити (2..4)

        // накопичуємо кут — не привʼязуємося до центру
        currentRotationY += rotationSpeed;

        // нормалізуємо кут, щоб не ріс до безкінечності
        if (currentRotationY > 180) currentRotationY -= 360;
        if (currentRotationY < -180) currentRotationY += 360;

        if (fractalRoot) {
          fractalRoot.setAttribute('rotation', { x: 0, y: currentRotationY, z: 0 });
        }

        // оновимо значення слайдера, якщо є
        const rotSlider = document.getElementById('rot-slider');
        const rotValue  = document.getElementById('rot-value');
        if (rotSlider && rotValue) {
          rotSlider.value = currentRotationY.toFixed(0);
          rotValue.textContent = currentRotationY.toFixed(0) + '°';
        }
      }
    }

  } catch (e) {
    console.error('Помилка при детекції руки:', e);
  }

  requestAnimationFrame(detectHandsLoop);
}

// --------------------------------------------------
// 11. ОНОВЛЕННЯ ПОЗИЦІЇ КАМЕРИ
// --------------------------------------------------
function updateCameraPosition(x, y, z) {
  if (!cameraRig) return;
  cameraRig.setAttribute('position', { x, y, z });
}

// --------------------------------------------------
// 12. СТАРТ ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ
// --------------------------------------------------
window.addEventListener('load', () => {
  treeRoot    = document.querySelector('#pythagoras-root');
  carpetRoot  = document.querySelector('#sierpinski-root');
  fractalRoot = document.querySelector('#fractal-root');
  cameraRig   = document.querySelector('#cameraRig');
  const stackRoot = document.querySelector('#call-stack');

  stackVisualizer = new CallStackVisualizer(stackRoot);

  const homeScreen   = document.getElementById('home-screen');
  const sceneUi      = document.getElementById('scene-ui');
  const backBtn      = document.getElementById('back-to-menu');
  const hudText      = document.querySelector('#hud-text');

  const rotSlider    = document.getElementById('rot-slider');
  const rotValue     = document.getElementById('rot-value');
  const camXSlider   = document.getElementById('camx-slider');
  const camYSlider   = document.getElementById('camy-slider');
  const camZSlider   = document.getElementById('camz-slider');
  const camXValue    = document.getElementById('camx-value');
  const camYValue    = document.getElementById('camy-value');
  const camZValue    = document.getElementById('camz-value');

  if (hudText) {
    hudText.setAttribute('text', 'value: depth: -; color: #333; width: 4');
  }

  // Кнопки на головному екрані
  const buttons = document.querySelectorAll('#home-screen .mode-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;

      if (homeScreen) homeScreen.style.display = 'none';
      if (sceneUi) sceneUi.classList.remove('hidden');

      if (hudText) {
        hudText.setAttribute('text', 'value: depth: ' + currentDepth + '; color: #333; width: 4');
      }

      applyMode(mode);
    });
  });

  // Кнопка "Назад до меню"
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      applyMode('none');
      if (treeRoot) {
        treeRoot.setAttribute('visible', false);
        while (treeRoot.firstChild) treeRoot.removeChild(treeRoot.firstChild);
      }
      if (carpetRoot) {
        carpetRoot.setAttribute('visible', false);
        while (carpetRoot.firstChild) carpetRoot.removeChild(carpetRoot.firstChild);
      }

      if (hudText) {
        hudText.setAttribute('text', 'value: depth: -; color: #333; width: 4');
      }

      if (homeScreen) homeScreen.style.display = 'flex';
      if (sceneUi) sceneUi.classList.add('hidden');
    });
  }

  // Слайдер обертання
  if (rotSlider && rotValue) {
    rotSlider.addEventListener('input', () => {
      const angle = parseFloat(rotSlider.value);
      currentRotationY = angle;
      rotValue.textContent = angle.toFixed(0) + '°';
      if (fractalRoot) {
        fractalRoot.setAttribute('rotation', { x: 0, y: currentRotationY, z: 0 });
      }
    });
  }

  // Масштаб колесиком миші (коли вже не на головному екрані)
  window.addEventListener('wheel', (e) => {
    if (homeScreen && homeScreen.style.display !== 'none') return;

    e.preventDefault();
    const delta = e.deltaY;
    let newScale = currentScale - delta * 0.0015;
    newScale = Math.max(0.5, Math.min(2.0, newScale));
    currentScale = newScale;

    applyScale(newScale);
  }, { passive: false });

  // Слайдери камери
  function updateCamFromSliders() {
    const x = parseFloat(camXSlider.value);
    const y = parseFloat(camYSlider.value);
    const z = parseFloat(camZSlider.value);
    camXValue.textContent = x.toString();
    camYValue.textContent = y.toString();
    camZValue.textContent = z.toString();
    updateCameraPosition(x, y, z);
  }

  if (camXSlider && camYSlider && camZSlider) {
    camXSlider.addEventListener('input', updateCamFromSliders);
    camYSlider.addEventListener('input', updateCamFromSliders);
    camZSlider.addEventListener('input', updateCamFromSliders);
    updateCamFromSliders();
  }

  // Показуємо рекурсію factorial кожні 4 секунди
  setInterval(() => {
    stackVisualizer.clear();
    const n = 5;
    const result = factorial(n, stackVisualizer);
    console.log('factorial(' + n + ') = ' + result);
  }, 4000);

  // Запуск вебкамери + ML
  initWebcamAndML();
});

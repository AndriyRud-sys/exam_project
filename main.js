// --------- ГЛОБАЛЬНИЙ СТАН ---------
let currentDepth = 6;          // поточна глибина рекурсії (2..9)
let currentMode = 'none';      // none | both | tree | carpet
let detector = null;           // ML детектор рук
let video = null;              // <video> з вебкамери
let stackVisualizer = null;    // візуалізація стеку

let treeRoot = null;
let carpetRoot = null;

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
// 3. ДЕРЕВО ПІФАГОРА (чіткіший фрактал)
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
    square.setAttribute('depth', 0.12); // трохи товще
    const hue = 205 + level * 8;        // синьо-блакитна гамма
    square.setAttribute('color', `hsl(${hue}, 75%, 55%)`);
    square.setAttribute('position', { x, y, z: 0 });
    square.setAttribute('rotation', { x: 0, y: 0, z: angleDeg });
    parent.appendChild(square);

    if (level === maxDepth) return;

    const newSize = size * Math.sqrt(2) / 2;
    const offset = size / 2 + newSize / 2;

    // Ліва гілка (+45°)
    const leftAngle = angleDeg + 45;
    const leftRad = leftAngle * Math.PI / 180;
    const lx = x - offset * Math.cos(leftRad);
    const ly = y + offset * Math.sin(leftRad);
    addSquare(parent, lx, ly, newSize, leftAngle, level + 1);

    // Права гілка (-45°)
    const rightAngle = angleDeg - 45;
    const rightRad = rightAngle * Math.PI / 180;
    const rx = x + offset * Math.cos(rightRad);
    const ry = y + offset * Math.sin(rightRad);
    addSquare(parent, rx, ry, newSize, rightAngle, level + 1);
  }

  // Трохи більше стартове дерево для “чіткості”
  addSquare(rootEl, 0, 0.6, 1.3, 0, 0);
}

// --------------------------------------------------
// 4. КОВЕР СЕРПІНСЬКОГО (чіткіший)
// --------------------------------------------------
function createSierpinskiCarpet(rootEl, maxDepth) {
  if (!rootEl) return;

  const depth = Math.min(maxDepth, 5); // не вище 5 — інакше дуже багато блоків

  while (rootEl.firstChild) {
    rootEl.removeChild(rootEl.firstChild);
  }

  function addSquareCarpet(parent, cx, cz, size, level, maxLevel) {
    if (level === maxLevel) {
      const box = document.createElement('a-box');
      box.setAttribute('width', size);
      box.setAttribute('height', 0.12);
      box.setAttribute('depth', size);
      const hue = 40 + level * 10; // теплі відтінки
      box.setAttribute('color', `hsl(${hue}, 80%, 55%)`);
      box.setAttribute('position', { x: cx, y: 0.06, z: cz });
      parent.appendChild(box);
      return;
    }

    const newSize = size / 3;

    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        if (ix === 0 && iz === 0) continue; // центральна дірка

        const nx = cx + ix * newSize;
        const nz = cz + iz * newSize;
        addSquareCarpet(parent, nx, nz, newSize, level + 1, maxLevel);
      }
    }
  }

  // Трохи більший ковер
  addSquareCarpet(rootEl, 0, 0, 4, 0, depth);
}

// --------------------------------------------------
// 5. ПЕРЕМАЛЮВАННЯ ФІГУР ЗА ПОТОЧНИМ РЕЖИМОМ/ГЛИБИНОЮ
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
}

// --------------------------------------------------
// 6. ОНОВЛЕННЯ ГЛИБИНИ РЕКУРСІЇ
// --------------------------------------------------
function updateDepth(newDepth) {
  const clamped = Math.max(2, Math.min(9, Math.round(newDepth)));
  if (clamped === currentDepth) return;

  currentDepth = clamped;

  const hudText = document.querySelector('#hud-text');
  if (hudText) {
    hudText.setAttribute('text', `value: depth: ${currentDepth}; color: #333; width: 4`);
  }

  redrawFractals();
}

// --------------------------------------------------
// 7. РЕЖИМИ (які фігури показувати)
// --------------------------------------------------
function applyMode(mode) {
  currentMode = mode;

  const sceneModeLabel = document.getElementById('scene-mode-label');
  if (sceneModeLabel) {
    let label = '—';
    if (mode === 'both') label = 'Дерево + Ковер';
    if (mode === 'tree') label = 'Тільки дерево Піфагора';
    if (mode === 'carpet') label = 'Тільки ковер Серпінського';
    sceneModeLabel.textContent = label;
  }

  const showTree = (mode === 'both' || mode === 'tree');
  const showCarpet = (mode === 'both' || mode === 'carpet');

  if (treeRoot) {
    treeRoot.setAttribute('visible', showTree);
  }
  if (carpetRoot) {
    carpetRoot.setAttribute('visible', showCarpet);
  }

  redrawFractals();
}

// --------------------------------------------------
// 8. ML: ВЕБКАМЕРА + ДЕТЕКТОР РУКИ
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
// 9. ЦИКЛ ДЕТЕКЦІЇ РУКИ (жест "щипок" для глибини)
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
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Мапимо відстань (20..260) → глибина (2..9)
        const minD = 20;
        const maxD = 260;
        let t = (dist - minD) / (maxD - minD);
        t = Math.max(0, Math.min(1, t)); // 0..1

        const depth = 2 + t * 7;
        updateDepth(depth);
      }
    }

  } catch (e) {
    console.error('Помилка при детекції руки:', e);
  }

  requestAnimationFrame(detectHandsLoop);
}

// --------------------------------------------------
// 10. СТАРТ ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ
// --------------------------------------------------
window.addEventListener('load', () => {
  treeRoot   = document.querySelector('#pythagoras-root');
  carpetRoot = document.querySelector('#sierpinski-root');
  const stackRoot = document.querySelector('#call-stack');

  stackVisualizer = new CallStackVisualizer(stackRoot);

  // Головний екран + UI сцени
  const homeScreen   = document.getElementById('home-screen');
  const sceneUi      = document.getElementById('scene-ui');
  const backBtn      = document.getElementById('back-to-menu');
  const hudText      = document.querySelector('#hud-text');

  if (hudText) {
    hudText.setAttribute('text', 'value: depth: -; color: #333; width: 4');
  }

  // Кнопки на головному екрані
  const buttons = document.querySelectorAll('#home-screen .mode-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      // перейти до сцени
      if (homeScreen) homeScreen.style.display = 'none';
      if (sceneUi) sceneUi.classList.remove('hidden');

      // оновити HUD з поточною глибиною
      if (hudText) {
        hudText.setAttribute('text', `value: depth: ${currentDepth}; color: #333; width: 4`);
      }

      applyMode(mode);
    });
  });

  // Кнопка "Назад до меню"
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // зупиняємо показ фігур
      applyMode('none');
      if (treeRoot) {
        treeRoot.setAttribute('visible', false);
        while (treeRoot.firstChild) treeRoot.removeChild(treeRoot.firstChild);
      }
      if (carpetRoot) {
        carpetRoot.setAttribute('visible', false);
        while (carpetRoot.firstChild) carpetRoot.removeChild(carpetRoot.firstChild);
      }

      // HUD повертаємо в "–"
      if (hudText) {
        hudText.setAttribute('text', 'value: depth: -; color: #333; width: 4');
      }

      // показуємо знову головний екран
      if (homeScreen) homeScreen.style.display = 'flex';
      if (sceneUi) sceneUi.classList.add('hidden');
    });
  }

  // Показуємо рекурсію factorial з візуалізацією стеку кожні 4 секунди
  setInterval(() => {
    stackVisualizer.clear();
    const n = 5;
    const result = factorial(n, stackVisualizer);
    console.log(`factorial(${n}) = ${result}`);
  }, 4000);

  // Запуск вебкамери + ML
  initWebcamAndML();
});

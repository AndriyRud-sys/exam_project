// --------- ГЛОБАЛЬНИЙ СТАН ---------
let currentDepth = 4;          // поточна глибина рекурсії для фракталів
let currentMode = 'both';      // both | tree | carpet
let detector = null;           // ML детектор рук
let video = null;              // елемент <video> з вебкамери
let stackVisualizer = null;    // візуалізація стеку

// Посилання на елементи сцени (заповнимо після load)
let treeRoot = null;
let carpetRoot = null;

// --------------------------------------------------
// 1. КЛАС ДЛЯ ВІЗУАЛІЗАЦІЇ СТЕКУ ВИКЛИКІВ
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
      box.setAttribute('width', 1);
      box.setAttribute('height', 0.25);
      box.setAttribute('depth', 0.25);
      box.setAttribute('color', '#4CAF50');
      box.setAttribute('position', { x: 0, y: i * 0.3 + 0.2, z: 0 });

      const text = document.createElement('a-entity');
      text.setAttribute('text', {
        value: `${frame.functionName}(${frame.args.join(',')})`,
        width: 3,
        color: '#000'
      });
      text.setAttribute('position', { x: -0.8, y: 0, z: 0.15 });

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
// 3. РЕКУРСИВНИЙ ФРАКТАЛ: ДЕРЕВО ПІФАГОРА
// --------------------------------------------------
function createPythagorasTree(rootEl, maxDepth) {
  if (!rootEl) return;

  // Очистити попереднє дерево
  while (rootEl.firstChild) {
    rootEl.removeChild(rootEl.firstChild);
  }

  function addSquare(parent, x, y, size, angleDeg, level) {
    if (level > maxDepth) return;

    const square = document.createElement('a-box');
    square.setAttribute('width', size);
    square.setAttribute('height', size);
    square.setAttribute('depth', 0.05);
    square.setAttribute('color', `hsl(${level * 30}, 80%, 50%)`);
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

  // Стартовий квадрат
  addSquare(rootEl, 0, 0.5, 1, 0, 0);
}

// --------------------------------------------------
// 4. РЕКУРСИВНИЙ ФРАКТАЛ: КОВЕР СЕРПІНСЬКОГО
// --------------------------------------------------
function createSierpinskiCarpet(rootEl, maxDepth) {
  if (!rootEl) return;

  // Щоб не вбити FPS, обмежимо глибину килима до 4
  const depth = Math.min(maxDepth, 4);

  while (rootEl.firstChild) {
    rootEl.removeChild(rootEl.firstChild);
  }

  // Рекурсивна функція: ділимо квадрат на 3×3, середній пропускаємо
  function addSquareCarpet(parent, cx, cz, size, level, maxLevel) {
    if (level === maxLevel) {
      const box = document.createElement('a-box');
      box.setAttribute('width', size);
      box.setAttribute('height', 0.05);
      box.setAttribute('depth', size);
      box.setAttribute('color', `hsl(${200 + level * 20}, 70%, 50%)`);
      box.setAttribute('position', { x: cx, y: 0.05, z: cz });
      parent.appendChild(box);
      return;
    }

    const newSize = size / 3;

    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        // Центральний квадрат (дірка) – пропускаємо
        if (ix === 0 && iz === 0) continue;

        const nx = cx + ix * newSize;
        const nz = cz + iz * newSize;
        addSquareCarpet(parent, nx, nz, newSize, level + 1, maxLevel);
      }
    }
  }

  // Стартовий квадрат
  addSquareCarpet(rootEl, 0, 0, 3, 0, depth);
}

// --------------------------------------------------
// 5. ОНОВЛЕННЯ ГЛИБИНИ РЕКУРСІЇ
// --------------------------------------------------
function updateDepth(newDepth) {
  const clamped = Math.max(1, Math.min(8, Math.round(newDepth)));
  if (clamped === currentDepth) return;

  currentDepth = clamped;

  const hudText = document.querySelector('#hud-text');
  if (hudText) {
    hudText.setAttribute('text', `value: depth: ${currentDepth}; color: #FFF; width: 4`);
  }

  // Перемальовуємо тільки те, що зараз увімкнено
  if (currentMode === 'both' || currentMode === 'tree') {
    createPythagorasTree(treeRoot, currentDepth);
  }
  if (currentMode === 'both' || currentMode === 'carpet') {
    createSierpinskiCarpet(carpetRoot, currentDepth);
  }
}

// --------------------------------------------------
// 6. ЗАСТОСУВАННЯ РЕЖИМУ (ЯКІ ФІГУРИ ПОКАЗУВАТИ)
// --------------------------------------------------
function applyMode(mode) {
  currentMode = mode;

  const buttons = document.querySelectorAll('.mode-btn');
  buttons.forEach(btn => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle('active', isActive);
  });

  const showTree = (mode === 'both' || mode === 'tree');
  const showCarpet = (mode === 'both' || mode === 'carpet');

  if (treeRoot) {
    treeRoot.setAttribute('visible', showTree);
    if (showTree) createPythagorasTree(treeRoot, currentDepth);
  }

  if (carpetRoot) {
    carpetRoot.setAttribute('visible', showCarpet);
    if (showCarpet) createSierpinskiCarpet(carpetRoot, currentDepth);
  }
}

// --------------------------------------------------
// 7. ML: НАЛАШТУВАННЯ ВЕБКАМЕРИ ТА ДЕТЕКТОРА РУКИ
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
// 8. ЦИКЛ ДЕТЕКЦІЇ РУКИ + ЖЕСТ ДЛЯ КЕРУВАННЯ ГЛИБИНОЮ
// --------------------------------------------------
async function detectHandsLoop() {
  if (!detector || video.readyState < 2) {
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
        const dx = (thumbTip.x - indexTip.x);
        const dy = (thumbTip.y - indexTip.y);
        const dist = Math.sqrt(dx * dx + dy * dy); // у пікселях

        const minD = 10;   // майже разом
        const maxD = 200;  // дуже розведені
        let t = (dist - minD) / (maxD - minD);
        t = Math.max(0, Math.min(1, t)); // 0..1

        const depth = 1 + t * 7; // 1..8
        updateDepth(depth);
      }
    }

  } catch (e) {
    console.error('Помилка при детекції руки:', e);
  }

  requestAnimationFrame(detectHandsLoop);
}

// --------------------------------------------------
// 9. СТАРТ УСЬОГО ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ
// --------------------------------------------------
window.addEventListener('load', () => {
  treeRoot   = document.querySelector('#pythagoras-root');
  carpetRoot = document.querySelector('#sierpinski-root');
  const stackRoot = document.querySelector('#call-stack');

  // Ініціалізація стеку
  stackVisualizer = new CallStackVisualizer(stackRoot);

  // Початкові фрактали
  createPythagorasTree(treeRoot, currentDepth);
  createSierpinskiCarpet(carpetRoot, currentDepth);

  const hudText = document.querySelector('#hud-text');
  if (hudText) {
    hudText.setAttribute('text', `value: depth: ${currentDepth}; color: #FFF; width: 4`);
  }

  // Обробка кнопок режимів
  const buttons = document.querySelectorAll('.mode-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      applyMode(mode);
    });
  });

  // Періодично показуємо рекурсію factorial з візуалізацією стеку
  setInterval(() => {
    stackVisualizer.clear();
    const n = 5;
    const result = factorial(n, stackVisualizer);
    console.log(`factorial(${n}) = ${result}`);
  }, 4000);

  // Запуск вебкамери + ML
  initWebcamAndML();

  // Застосувати початковий режим
  applyMode(currentMode);
});

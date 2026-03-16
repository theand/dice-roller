# Cosmic Dice Roller Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10~60 범위의 3D 주사위를 최대 4개까지 동시에 굴릴 수 있는 코스믹 테마 웹앱 구현

**Architecture:** 바닐라 HTML/CSS/JS + Three.js(CDN) 단일 페이지 앱. Dice 클래스가 3D 메시/애니메이션/텍스처를 캡슐화하고, main.js가 씬 세팅과 UI 이벤트를 관리한다.

**Tech Stack:** HTML5, CSS3, JavaScript (ES Modules), Three.js r170+ (CDN)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `index.html` | 페이지 구조, Three.js CDN 로드, 모듈 진입점 |
| `css/style.css` | 레이아웃, 코스믹 배경, 컨트롤 스타일, 반응형 |
| `js/dice.js` | Dice 클래스 — 3D 메시 생성, 굴림 애니메이션, 결과 텍스처 |
| `js/main.js` | Three.js 씬/카메라/조명 세팅, 다중 주사위 관리, UI 이벤트 |
| `tests/dice.test.html` | Dice 로직 단위 테스트 (결과 범위, 개수 관리) |

---

**Note:** `dice-roller/` 디렉토리에 `git init`은 이미 완료됨. 디자인 문서가 최초 커밋으로 존재.

---

## Chunk 1: 프로젝트 기반 + Dice 클래스

### Task 1: HTML 뼈대 + CSS 스타일링

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: index.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cosmic Dice</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="title">COSMIC DICE</div>
  <canvas id="dice-canvas"></canvas>
  <div id="controls">
    <div id="dice-count">
      <span class="dice-label">DICE</span>
      <button data-count="1" class="count-btn active">1</button>
      <button data-count="2" class="count-btn">2</button>
      <button data-count="3" class="count-btn">3</button>
      <button data-count="4" class="count-btn">4</button>
    </div>
    <button id="roll-btn">ROLL</button>
  </div>
  <div id="webgl-error" hidden>
    <p>WebGL을 지원하지 않는 브라우저입니다.</p>
  </div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"
    }
  }
  </script>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: css/style.css 작성**

```css
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #2d1b69, #11998e);
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #fff;
}

#title {
  position: absolute;
  top: 24px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  letter-spacing: 4px;
  text-shadow: 0 0 20px rgba(102, 126, 234, 0.6);
  z-index: 10;
  pointer-events: none;
}

#dice-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

#controls {
  position: absolute;
  bottom: 32px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  z-index: 10;
}

#dice-count {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dice-label {
  font-size: 12px;
  opacity: 0.7;
  letter-spacing: 2px;
}

.count-btn {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.count-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.count-btn.active {
  background: rgba(102, 126, 234, 0.6);
  border-color: rgba(255, 255, 255, 0.4);
  font-weight: bold;
}

#roll-btn {
  padding: 14px 56px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 30px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 4px;
  cursor: pointer;
  box-shadow: 0 4px 24px rgba(102, 126, 234, 0.4);
  transition: all 0.2s;
  text-transform: uppercase;
}

#roll-btn:hover {
  box-shadow: 0 6px 32px rgba(102, 126, 234, 0.6);
  transform: translateY(-1px);
}

#roll-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

#webgl-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
  font-size: 18px;
}

@media (max-width: 480px) {
  #title { font-size: 18px; top: 16px; }
  #controls { bottom: 20px; gap: 12px; }
  .count-btn { width: 32px; height: 32px; }
  #roll-btn { padding: 12px 40px; font-size: 14px; }
}
```

- [ ] **Step 3: 브라우저에서 열어 레이아웃 확인**

Run: 브라우저에서 `index.html` 열기
Expected: 코스믹 그라디언트 배경, 상단 타이틀, 하단 컨트롤 표시 (캔버스는 아직 비어 있음)

- [ ] **Step 4: 커밋**

```bash
git add index.html css/style.css
git commit -m "feat: add HTML structure and cosmic theme CSS"
```

---

### Task 2: Dice 클래스 — 3D 메시 생성

**Files:**
- Create: `js/dice.js`

- [ ] **Step 1: 테스트 파일 작성 — Dice 생성 검증**

Create: `tests/dice.test.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Dice Tests</title>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"
    }
  }
  </script>
  <style>
    body { font-family: monospace; padding: 20px; background: #1a1a2e; color: #fff; }
    .pass { color: #4caf50; }
    .fail { color: #f44336; }
    #results { white-space: pre-line; }
  </style>
</head>
<body>
  <h2>Dice Tests</h2>
  <div id="results"></div>
  <script type="module">
    import * as THREE from 'three';
    import { Dice } from '../js/dice.js';

    const results = document.getElementById('results');
    let passed = 0;
    let failed = 0;

    function assert(condition, name) {
      if (condition) {
        results.innerHTML += `<span class="pass">✓ ${name}</span>\n`;
        passed++;
      } else {
        results.innerHTML += `<span class="fail">✗ ${name}</span>\n`;
        failed++;
      }
    }

    // Setup
    const scene = new THREE.Scene();

    // Test: Dice 생성
    const dice = new Dice(scene, new THREE.Vector3(0, 0, 0));
    assert(dice.mesh instanceof THREE.Mesh, 'Dice.mesh is a THREE.Mesh');
    assert(dice.mesh.geometry instanceof THREE.IcosahedronGeometry, 'Geometry is IcosahedronGeometry');
    assert(scene.children.includes(dice.mesh), 'Mesh added to scene');

    // Helper: drive update() until roll resolves
    function completeRoll(dice) {
      return new Promise((resolve) => {
        const promise = dice.roll();
        const interval = setInterval(() => {
          dice.update(0.1); // simulate 100ms steps
          if (!dice.rolling) {
            clearInterval(interval);
            promise.then(resolve);
          }
        }, 0);
      });
    }

    // Test: 결과 범위
    const rollResults = [];
    for (let i = 0; i < 20; i++) {
      const r = await completeRoll(dice);
      rollResults.push(r);
    }
    const allInRange = rollResults.every(r => r >= 10 && r <= 60 && Number.isInteger(r));
    assert(allInRange, 'All roll results are integers in [10, 60]');

    const uniqueValues = new Set(rollResults);
    assert(uniqueValues.size > 1, 'Roll produces varied results');

    // Test: dispose
    dice.dispose();
    assert(!scene.children.includes(dice.mesh), 'Mesh removed from scene after dispose');

    // Summary
    results.innerHTML += `\n--- ${passed} passed, ${failed} failed ---\n`;
  </script>
</body>
</html>
```

- [ ] **Step 2: 테스트를 브라우저에서 열어 실패 확인**

Run: 브라우저에서 `tests/dice.test.html` 열기
Expected: `dice.js` 모듈 없어서 import 에러

- [ ] **Step 3: js/dice.js — Dice 클래스 구현**

```javascript
import * as THREE from 'three';

export class Dice {
  constructor(scene, position) {
    this.scene = scene;
    this.rolling = false;
    this.result = null;

    // Geometry: high-detail icosahedron ≈ sphere with subtle facets
    const geometry = new THREE.IcosahedronGeometry(1, 4);

    // Material: cosmic purple with glow
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x667eea,
      metalness: 0.3,
      roughness: 0.4,
      emissive: 0x2d1b69,
      emissiveIntensity: 0.3,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    // Roll animation state
    this.angularVelocity = new THREE.Vector3();
    this.rollDuration = 0;
    this.rollElapsed = 0;
    this.rollResolve = null;

    // Result texture
    this.resultSprite = null;
  }

  roll() {
    if (this.rolling) return Promise.resolve(this.result);

    // Clear previous result
    this._clearResult();

    this.rolling = true;
    this.rollDuration = 1.5 + Math.random() * 0.5; // 1.5~2s
    this.rollElapsed = 0;

    // Random rotation axis and speed
    this.angularVelocity.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
    );

    return new Promise((resolve) => {
      this.rollResolve = resolve;
    });
  }

  update(deltaTime) {
    if (!this.rolling) return;

    this.rollElapsed += deltaTime;
    const progress = Math.min(this.rollElapsed / this.rollDuration, 1);

    // Ease-out: slow down over time
    const easeFactor = 1 - progress * progress;

    this.mesh.rotation.x += this.angularVelocity.x * easeFactor * deltaTime;
    this.mesh.rotation.y += this.angularVelocity.y * easeFactor * deltaTime;
    this.mesh.rotation.z += this.angularVelocity.z * easeFactor * deltaTime;

    if (progress >= 1) {
      this.rolling = false;
      this.result = Math.floor(Math.random() * 51) + 10;
      this.setResult(this.result);
      if (this.rollResolve) {
        this.rollResolve(this.result);
        this.rollResolve = null;
      }
    }
  }

  setResult(number) {
    this._clearResult();

    // Create canvas texture with number
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Transparent background with number
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(102, 126, 234, 0.8)';
    ctx.shadowBlur = 20;
    ctx.fillText(String(number), 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    this.resultSprite = new THREE.Sprite(spriteMaterial);
    this.resultSprite.scale.set(1.5, 1.5, 1);
    this.resultSprite.position.copy(this.mesh.position);
    this.resultSprite.position.z += 1.2;
    this.scene.add(this.resultSprite);
  }

  _clearResult() {
    if (this.resultSprite) {
      this.scene.remove(this.resultSprite);
      this.resultSprite.material.map.dispose();
      this.resultSprite.material.dispose();
      this.resultSprite = null;
    }
  }

  dispose() {
    this._clearResult();
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
```

- [ ] **Step 4: 테스트를 브라우저에서 열어 통과 확인**

Run: 브라우저에서 `tests/dice.test.html` 열기
Expected: 모든 테스트 통과 (✓ 5개)

- [ ] **Step 5: 커밋**

```bash
git add js/dice.js tests/dice.test.html
git commit -m "feat: implement Dice class with 3D mesh, roll animation, and result display"
```

---

## Chunk 2: 씬 통합 + UI 인터랙션

### Task 3: Three.js 씬 세팅 + 다중 주사위 관리

**Files:**
- Create: `js/main.js`

- [ ] **Step 1: js/main.js 작성**

```javascript
import * as THREE from 'three';
import { Dice } from './dice.js';

// --- WebGL check ---
const canvas = document.getElementById('dice-canvas');
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
if (!gl) {
  document.getElementById('webgl-error').hidden = false;
  throw new Error('WebGL not supported');
}

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Scene ---
const scene = new THREE.Scene();

// --- Camera ---
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0x8866aa, 0.6);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0x667eea, 1.5, 50);
pointLight1.position.set(-5, 5, 5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x11998e, 1.2, 50);
pointLight2.position.set(5, -3, 5);
scene.add(pointLight2);

// --- Dice Management ---
const POSITIONS = {
  1: [new THREE.Vector3(0, 0, 0)],
  2: [new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3(1.5, 0, 0)],
  3: [new THREE.Vector3(-3, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 0, 0)],
  4: [new THREE.Vector3(-4.5, 0, 0), new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3(1.5, 0, 0), new THREE.Vector3(4.5, 0, 0)],
};

let diceArray = [];
let diceCount = 1;
let isRolling = false;

function setDiceCount(count) {
  // Remove existing dice
  diceArray.forEach(d => d.dispose());
  diceArray = [];

  // Create new dice at correct positions
  const positions = POSITIONS[count];
  positions.forEach(pos => {
    diceArray.push(new Dice(scene, pos));
  });
  diceCount = count;
}

// Initialize with 1 die
setDiceCount(1);

// --- UI: Dice count buttons ---
const countButtons = document.querySelectorAll('.count-btn');
countButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRolling) return;
    const count = parseInt(btn.dataset.count);
    countButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setDiceCount(count);
  });
});

// --- UI: Roll button ---
const rollBtn = document.getElementById('roll-btn');
rollBtn.addEventListener('click', async () => {
  if (isRolling) return;
  isRolling = true;
  rollBtn.disabled = true;

  const promises = diceArray.map(d => d.roll());
  await Promise.all(promises);

  isRolling = false;
  rollBtn.disabled = false;
});

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  diceArray.forEach(d => d.update(delta));

  renderer.render(scene, camera);
}

animate();

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

- [ ] **Step 2: 브라우저에서 전체 앱 확인**

Run: 브라우저에서 `index.html` 열기
Expected:
- 코스믹 배경 위에 보라색 3D 주사위 1개 표시
- 하단 컨트롤(개수 선택 + ROLL 버튼) 작동
- ROLL 클릭 시 주사위 회전 후 숫자 표시

- [ ] **Step 3: 개수 변경 테스트**

Run: 브라우저에서 개수 버튼 (1→2→3→4) 클릭
Expected: 주사위 개수가 변경되며 균등 배치

- [ ] **Step 4: 다중 주사위 동시 굴림 테스트**

Run: 주사위 3~4개 상태에서 ROLL 클릭
Expected: 모든 주사위가 동시에 회전, 각각 다른 결과 표시, 버튼 비활성화→활성화

- [ ] **Step 5: 커밋**

```bash
git add js/main.js
git commit -m "feat: add Three.js scene with multi-dice management and UI controls"
```

---

### Task 4: 최종 검증 + 모바일 테스트

**Files:**
- Modify: (필요 시 css/style.css, js/main.js, js/dice.js 미세 조정)

- [ ] **Step 1: WebGL 미지원 시 에러 메시지 확인**

Run: 개발자 도구에서 WebGL 컨텍스트 강제 실패시키거나, 에러 div의 `hidden` 속성 제거하여 표시 확인
Expected: "WebGL을 지원하지 않는 브라우저입니다." 메시지 표시

- [ ] **Step 2: 반응형 확인**

Run: 브라우저 개발자 도구에서 모바일 뷰포트(375x667) 설정
Expected: 타이틀/버튼 크기 조정되어 정상 표시

- [ ] **Step 3: 전체 테스트 재실행**

Run: `tests/dice.test.html` 브라우저에서 열기
Expected: 모든 테스트 통과

- [ ] **Step 4: 최종 커밋**

```bash
git add css/style.css js/main.js js/dice.js
git commit -m "fix: final adjustments for Cosmic Dice Roller app"
```

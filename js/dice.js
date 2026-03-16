import * as THREE from 'three';

const DICE_MIN = 10;
const DICE_RANGE = 51; // 10..60 inclusive
const DICE_RADIUS = 2;
const SPRITE_Z_OFFSET = 2.6;
const CANVAS_SIZE = 256;
const CANVAS_CENTER = CANVAS_SIZE / 2;
const SCALE_THRESHOLD = 0.001;

const FACE_COLORS = [
  '#ff6b6b', '#667eea', '#feca57', '#11998e', '#ff9ff3',
  '#f7971e', '#56ccf2', '#a8e063', '#764ba2', '#00b4db',
  '#e94560', '#1dd1a1', '#fc5c7d', '#6a3093', '#f0932b',
  '#48dbfb', '#c7ecee', '#b8e994', '#fdcb6e', '#00cec9',
];

const FACE_NUMBERS = [
  10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
  60, 12, 18, 22, 28, 33, 38, 42, 48, 53,
];

export class Dice {
  constructor(scene, position) {
    this.scene = scene;
    this.rolling = false;
    this.result = null;
    this.basePosition = position.clone();

    const geometry = new THREE.IcosahedronGeometry(DICE_RADIUS, 0);
    this._setupFaceGroups(geometry);
    this.materials = this._createFaceMaterials(geometry);

    this.mesh = new THREE.Mesh(geometry, this.materials);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    this.angularVelocity = new THREE.Vector3();
    this.rollDuration = 0;
    this.rollElapsed = 0;
    this.rollResolve = null;

    this.bounceHeight = 0;
    this.bounceSpeed = 0;

    this._canvas = document.createElement('canvas');
    this._canvas.width = CANVAS_SIZE;
    this._canvas.height = CANVAS_SIZE;
    this._ctx = this._canvas.getContext('2d');

    this.rollingSprite = null;
    this._rollingTexture = null;
    this._lastRollingFrame = -1;

    this.resultSprite = null;

    this.targetScale = 1;
    this.currentScale = 1;
  }

  roll() {
    if (this.rolling) return Promise.resolve(this.result);

    this._clearResult();
    this._clearRollingSprite();

    this.rolling = true;
    this.rollDuration = 2.0 + Math.random() * 0.5;
    this.rollElapsed = 0;
    this._lastRollingFrame = -1;

    this.angularVelocity.set(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
    );

    this.bounceSpeed = 4 + Math.random() * 2;
    this.targetScale = 0.85;

    this._createRollingSprite();

    return new Promise((resolve) => {
      this.rollResolve = resolve;
    });
  }

  update(deltaTime) {
    const scaleDiff = this.targetScale - this.currentScale;
    if (Math.abs(scaleDiff) > SCALE_THRESHOLD) {
      this.currentScale += scaleDiff * 0.1;
      this.mesh.scale.setScalar(this.currentScale);
    }

    if (!this.rolling) return;

    this.rollElapsed += deltaTime;
    const progress = Math.min(this.rollElapsed / this.rollDuration, 1);
    const easeFactor = 1 - progress * progress;

    this.mesh.rotation.x += this.angularVelocity.x * easeFactor * deltaTime;
    this.mesh.rotation.y += this.angularVelocity.y * easeFactor * deltaTime;
    this.mesh.rotation.z += this.angularVelocity.z * easeFactor * deltaTime;

    this.bounceSpeed -= 15 * deltaTime;
    this.bounceHeight += this.bounceSpeed * deltaTime;
    if (this.bounceHeight <= 0) {
      this.bounceHeight = 0;
      if (Math.abs(this.bounceSpeed) > 0.5) {
        this.bounceSpeed = -this.bounceSpeed * 0.5;
      } else {
        this.bounceSpeed = 0;
      }
    }
    this.mesh.position.y = this.basePosition.y + this.bounceHeight;

    if (this.rollingSprite) {
      this.rollingSprite.position.copy(this.mesh.position);
      this.rollingSprite.position.z += SPRITE_Z_OFFSET;

      const frame = Math.floor(this.rollElapsed * 30);
      const changeRate = Math.max(1, Math.floor((1 - progress) * 15));
      if (frame !== this._lastRollingFrame && frame % changeRate === 0) {
        this._lastRollingFrame = frame;
        const alpha = 0.3 + (1 - progress) * 0.5;
        this._renderNumber(this._randomResult(), alpha);
        this._rollingTexture.needsUpdate = true;
      }
    }

    const wobble = 1 + Math.sin(this.rollElapsed * 12) * 0.03 * easeFactor;
    this.mesh.scale.setScalar(this.currentScale * wobble);

    if (progress >= 1) {
      this._finishRoll();
    }
  }

  setResult(number) {
    this._clearResult();

    this._renderNumber(number, 1.0, 120, 20);
    const texture = new THREE.CanvasTexture(this._canvas);
    this.resultSprite = this._createResultSprite(texture, 3.2);
  }

  dispose() {
    this._clearResult();
    this._clearRollingSprite();
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.materials.forEach(m => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
    this._canvas = null;
    this._ctx = null;
  }

  // --- Private: geometry setup ---

  _setupFaceGroups(geometry) {
    geometry.clearGroups();
    const faceCount = geometry.getAttribute('position').count / 3;

    // Assign each face to its own material group
    for (let i = 0; i < faceCount; i++) {
      geometry.addGroup(i * 3, 3, i);
    }

    // Remap UVs so each face covers full [0,1] texture range
    const uvs = new Float32Array(faceCount * 3 * 2);
    for (let i = 0; i < faceCount; i++) {
      const base = i * 6;
      // Triangle UV: top-center, bottom-left, bottom-right
      uvs[base] = 0.5; uvs[base + 1] = 1.0;
      uvs[base + 2] = 0.0; uvs[base + 3] = 0.0;
      uvs[base + 4] = 1.0; uvs[base + 5] = 0.0;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  _createFaceMaterials(geometry) {
    const faceCount = geometry.getAttribute('position').count / 3;
    const materials = [];

    for (let i = 0; i < faceCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Fill with face color
      ctx.fillStyle = FACE_COLORS[i % FACE_COLORS.length];
      ctx.fillRect(0, 0, 256, 256);

      // Subtle edge shading for depth
      const grad = ctx.createRadialGradient(128, 100, 20, 128, 128, 140);
      grad.addColorStop(0, 'rgba(255,255,255,0.15)');
      grad.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // White number centered in the triangle area
      const num = FACE_NUMBERS[i % FACE_NUMBERS.length];
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 100px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 6;
      ctx.fillText(String(num), 128, 120);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;

      materials.push(new THREE.MeshPhysicalMaterial({
        map: texture,
        metalness: 0.05,
        roughness: 0.5,
      }));
    }

    return materials;
  }

  // --- Private: animation helpers ---

  _randomResult() {
    return Math.floor(Math.random() * DICE_RANGE) + DICE_MIN;
  }

  _renderNumber(number, alpha, fontSize = 100, shadowBlur = 15) {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `rgba(102, 126, 234, ${alpha})`;
    ctx.shadowBlur = shadowBlur;
    ctx.fillText(String(number), CANVAS_CENTER, CANVAS_CENTER);
  }

  _createResultSprite(texture, scale) {
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    sprite.position.copy(this.mesh.position);
    sprite.position.z += SPRITE_Z_OFFSET;
    this.scene.add(sprite);
    return sprite;
  }

  _createRollingSprite() {
    this._rollingTexture = new THREE.CanvasTexture(this._canvas);
    const mat = new THREE.SpriteMaterial({ map: this._rollingTexture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.5, 2.5, 1);
    sprite.position.copy(this.mesh.position);
    sprite.position.z += SPRITE_Z_OFFSET;
    this.scene.add(sprite);
    this.rollingSprite = sprite;
  }

  _clearRollingSprite() {
    if (this.rollingSprite) {
      this.scene.remove(this.rollingSprite);
      this.rollingSprite.material.dispose();
      this.rollingSprite = null;
    }
    if (this._rollingTexture) {
      this._rollingTexture.dispose();
      this._rollingTexture = null;
    }
  }

  _clearResult() {
    if (this.resultSprite) {
      this.scene.remove(this.resultSprite);
      this.resultSprite.material.map.dispose();
      this.resultSprite.material.dispose();
      this.resultSprite = null;
    }
  }

  _finishRoll() {
    this.rolling = false;
    this.result = this._randomResult();

    this.mesh.position.y = this.basePosition.y;
    this.bounceHeight = 0;
    this.bounceSpeed = 0;

    this.currentScale = 1.3;
    this.targetScale = 1;

    this._clearRollingSprite();
    this.setResult(this.result);

    if (this.rollResolve) {
      this.rollResolve(this.result);
      this.rollResolve = null;
    }
  }
}

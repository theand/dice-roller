import * as THREE from 'three';

const DICE_MIN = 10;
const DICE_RANGE = 51; // 10..60 inclusive
const SPRITE_Z_OFFSET = 1.3;
const CANVAS_SIZE = 256;
const CANVAS_CENTER = CANVAS_SIZE / 2;
const SCALE_THRESHOLD = 0.001;

const FACE_COLORS = [
  new THREE.Color(0x667eea), // indigo
  new THREE.Color(0x764ba2), // purple
  new THREE.Color(0x11998e), // teal
  new THREE.Color(0xe94560), // pink
  new THREE.Color(0xf7971e), // orange
  new THREE.Color(0x56ccf2), // sky blue
  new THREE.Color(0xa8e063), // lime
  new THREE.Color(0xfc5c7d), // rose
  new THREE.Color(0x6a3093), // deep purple
  new THREE.Color(0x00b4db), // cyan
];

export class Dice {
  constructor(scene, position) {
    this.scene = scene;
    this.rolling = false;
    this.result = null;
    this.basePosition = position.clone();

    const geometry = new THREE.IcosahedronGeometry(1, 1);
    this._applyFaceColors(geometry);

    this.material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.3,
      roughness: 0.35,
      emissive: 0x2d1b69,
      emissiveIntensity: 0.3,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    this.angularVelocity = new THREE.Vector3();
    this.rollDuration = 0;
    this.rollElapsed = 0;
    this.rollResolve = null;

    this.bounceHeight = 0;
    this.bounceSpeed = 0;

    // Shared canvas for both rolling numbers and result display
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

    // Bounce with decreasing energy
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

    // Slot machine number cycling (frame-rate independent)
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

    this.material.emissiveIntensity = 0.3 + Math.sin(this.rollElapsed * 10) * 0.2 * easeFactor;

    if (progress >= 1) {
      this._finishRoll();
    }
  }

  setResult(number) {
    this._clearResult();

    this._renderNumber(number, 1.0, 120, 20);
    const texture = new THREE.CanvasTexture(this._canvas);
    this.resultSprite = this._createSprite(texture, 1.8);
  }

  dispose() {
    this._clearResult();
    this._clearRollingSprite();
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this._canvas = null;
    this._ctx = null;
  }

  // --- Private helpers ---

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

  _createSprite(texture, scale) {
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    sprite.position.copy(this.mesh.position);
    sprite.position.z += SPRITE_Z_OFFSET;
    this.scene.add(sprite);
    return sprite;
  }

  _applyFaceColors(geometry) {
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 3) {
      const color = FACE_COLORS[Math.floor(i / 3) % FACE_COLORS.length];
      for (let v = 0; v < 3; v++) {
        colors[(i + v) * 3] = color.r;
        colors[(i + v) * 3 + 1] = color.g;
        colors[(i + v) * 3 + 2] = color.b;
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  _createRollingSprite() {
    this._rollingTexture = new THREE.CanvasTexture(this._canvas);
    this.rollingSprite = this._createSprite(this._rollingTexture, 1.5);
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
    this.material.emissiveIntensity = 0.3;

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

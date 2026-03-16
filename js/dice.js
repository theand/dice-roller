import * as THREE from 'three';

const DICE_MIN = 10;
const DICE_RANGE = 51; // 10..60 inclusive
const DICE_RADIUS = 2;
const SPRITE_Z_OFFSET = 2.6;
const CANVAS_SIZE = 256;
const CANVAS_CENTER = CANVAS_SIZE / 2;
const SCALE_THRESHOLD = 0.001;

const FACE_COLORS = [
  new THREE.Color(0xff6b6b), // red
  new THREE.Color(0x667eea), // indigo
  new THREE.Color(0xfeca57), // yellow
  new THREE.Color(0x11998e), // teal
  new THREE.Color(0xff9ff3), // pink
  new THREE.Color(0xf7971e), // orange
  new THREE.Color(0x56ccf2), // sky blue
  new THREE.Color(0xa8e063), // lime
  new THREE.Color(0x764ba2), // purple
  new THREE.Color(0x00b4db), // cyan
  new THREE.Color(0xe94560), // crimson
  new THREE.Color(0x1dd1a1), // mint
  new THREE.Color(0xfc5c7d), // rose
  new THREE.Color(0x6a3093), // deep purple
  new THREE.Color(0xf0932b), // tangerine
  new THREE.Color(0x48dbfb), // light blue
  new THREE.Color(0xc7ecee), // ice
  new THREE.Color(0xdfe6e9), // silver
  new THREE.Color(0xfdcb6e), // gold
  new THREE.Color(0x00cec9), // aqua
];

// Numbers to display on each face (decorative d20-style)
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
    this._applyFaceColors(geometry);

    this.material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.1,
      roughness: 0.4,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    // Face number labels
    this._faceLabels = [];
    this._createFaceLabels(geometry);

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

    this._setFaceLabelsVisible(false);
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

    // Scale pulse during roll for visual feedback
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
    this.resultSprite = this._createSprite(texture, 3.2);
  }

  dispose() {
    this._clearResult();
    this._clearRollingSprite();
    this._disposeFaceLabels();
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

  _createFaceLabels(geometry) {
    const positions = geometry.getAttribute('position');
    const faceCount = positions.count / 3;

    for (let i = 0; i < faceCount; i++) {
      const i0 = i * 3, i1 = i * 3 + 1, i2 = i * 3 + 2;
      const cx = (positions.getX(i0) + positions.getX(i1) + positions.getX(i2)) / 3;
      const cy = (positions.getY(i0) + positions.getY(i1) + positions.getY(i2)) / 3;
      const cz = (positions.getZ(i0) + positions.getZ(i1) + positions.getZ(i2)) / 3;

      const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
      const offset = 1.02;

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 3;
      ctx.fillText(String(FACE_NUMBERS[i % FACE_NUMBERS.length]), 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      plane.position.set(
        (cx / len) * DICE_RADIUS * offset,
        (cy / len) * DICE_RADIUS * offset,
        (cz / len) * DICE_RADIUS * offset,
      );
      // Orient plane to face outward along face normal
      const normal = new THREE.Vector3(cx, cy, cz).normalize();
      plane.lookAt(normal.multiplyScalar(DICE_RADIUS * 2));

      this.mesh.add(plane);
      this._faceLabels.push({ sprite: plane, texture, canvas });
    }
  }

  _setFaceLabelsVisible(visible) {
    this._faceLabels.forEach(({ sprite }) => {
      sprite.visible = visible;
    });
  }

  _disposeFaceLabels() {
    this._faceLabels.forEach(({ sprite, texture }) => {
      this.mesh.remove(sprite);
      sprite.material.dispose();
      texture.dispose();
    });
    this._faceLabels = [];
  }

  _createRollingSprite() {
    this._rollingTexture = new THREE.CanvasTexture(this._canvas);
    this.rollingSprite = this._createSprite(this._rollingTexture, 2.5);
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
    this._setFaceLabelsVisible(true);
    this.setResult(this.result);

    if (this.rollResolve) {
      this.rollResolve(this.result);
      this.rollResolve = null;
    }
  }
}

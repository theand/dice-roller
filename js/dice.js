import * as THREE from 'three';

export class Dice {
  constructor(scene, position) {
    this.scene = scene;
    this.rolling = false;
    this.result = null;
    this.basePosition = position.clone();

    // Geometry: low detail so facets are clearly visible during rotation
    const geometry = new THREE.IcosahedronGeometry(1, 1);

    // Per-face colors: cosmic rainbow palette
    const faceColors = [
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

    const posAttr = geometry.getAttribute('position');
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 3) {
      const faceIndex = Math.floor(i / 3);
      const color = faceColors[faceIndex % faceColors.length];
      for (let v = 0; v < 3; v++) {
        colors[(i + v) * 3] = color.r;
        colors[(i + v) * 3 + 1] = color.g;
        colors[(i + v) * 3 + 2] = color.b;
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material: vertex colors + glow
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

    // Roll animation state
    this.angularVelocity = new THREE.Vector3();
    this.rollDuration = 0;
    this.rollElapsed = 0;
    this.rollResolve = null;

    // Bounce animation state
    this.bounceHeight = 0;
    this.bounceSpeed = 0;

    // Rolling number sprite (slot machine effect)
    this.rollingSprite = null;
    this._rollingCanvas = document.createElement('canvas');
    this._rollingCanvas.width = 256;
    this._rollingCanvas.height = 256;
    this._rollingCtx = this._rollingCanvas.getContext('2d');
    this._rollingTexture = null;

    // Result texture
    this.resultSprite = null;

    // Scale animation
    this.targetScale = 1;
    this.currentScale = 1;
  }

  roll() {
    if (this.rolling) return Promise.resolve(this.result);

    this._clearResult();
    this._clearRollingSprite();

    this.rolling = true;
    this.rollDuration = 2.0 + Math.random() * 0.5; // 2~2.5s
    this.rollElapsed = 0;

    // Random rotation axis and speed (faster!)
    this.angularVelocity.set(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
    );

    // Initial bounce upward
    this.bounceSpeed = 4 + Math.random() * 2;

    // Shrink dice slightly during roll for punch effect
    this.targetScale = 0.85;

    // Create rolling number sprite
    this._createRollingSprite();

    return new Promise((resolve) => {
      this.rollResolve = resolve;
    });
  }

  update(deltaTime) {
    // Smooth scale transition
    this.currentScale += (this.targetScale - this.currentScale) * 0.1;
    this.mesh.scale.setScalar(this.currentScale);

    if (!this.rolling) return;

    this.rollElapsed += deltaTime;
    const progress = Math.min(this.rollElapsed / this.rollDuration, 1);

    // Ease-out: slow down over time
    const easeFactor = 1 - progress * progress;

    // Rotation (clearly visible on low-poly icosahedron)
    this.mesh.rotation.x += this.angularVelocity.x * easeFactor * deltaTime;
    this.mesh.rotation.y += this.angularVelocity.y * easeFactor * deltaTime;
    this.mesh.rotation.z += this.angularVelocity.z * easeFactor * deltaTime;

    // Bounce: multiple bounces with decreasing height
    this.bounceSpeed -= 15 * deltaTime; // gravity
    this.bounceHeight += this.bounceSpeed * deltaTime;
    if (this.bounceHeight <= 0) {
      this.bounceHeight = 0;
      // Bounce back up with less energy
      if (Math.abs(this.bounceSpeed) > 0.5) {
        this.bounceSpeed = -this.bounceSpeed * 0.5;
      } else {
        this.bounceSpeed = 0;
      }
    }
    this.mesh.position.y = this.basePosition.y + this.bounceHeight;

    // Update rolling number sprite (slot machine effect)
    if (this.rollingSprite) {
      this.rollingSprite.position.copy(this.mesh.position);
      this.rollingSprite.position.z += 1.3;

      // Update number rapidly, slowing down as progress increases
      const changeRate = Math.max(1, Math.floor((1 - progress) * 15));
      if (Math.floor(this.rollElapsed * 30) % changeRate === 0) {
        const tempNum = Math.floor(Math.random() * 51) + 10;
        this._updateRollingNumber(tempNum, 1 - progress);
      }
    }

    // Emissive pulse during roll
    const pulse = 0.3 + Math.sin(this.rollElapsed * 10) * 0.2 * easeFactor;
    this.material.emissiveIntensity = pulse;

    if (progress >= 1) {
      this.rolling = false;
      this.result = Math.floor(Math.random() * 51) + 10;

      // Reset position and emissive
      this.mesh.position.y = this.basePosition.y;
      this.bounceHeight = 0;
      this.bounceSpeed = 0;
      this.material.emissiveIntensity = 0.3;

      // Pop scale effect for result reveal
      this.currentScale = 1.3;
      this.targetScale = 1;

      // Clear rolling sprite and show final result
      this._clearRollingSprite();
      this.setResult(this.result);

      if (this.rollResolve) {
        this.rollResolve(this.result);
        this.rollResolve = null;
      }
    }
  }

  _createRollingSprite() {
    this._rollingTexture = new THREE.CanvasTexture(this._rollingCanvas);
    const mat = new THREE.SpriteMaterial({
      map: this._rollingTexture,
      transparent: true,
    });
    this.rollingSprite = new THREE.Sprite(mat);
    this.rollingSprite.scale.set(1.5, 1.5, 1);
    this.rollingSprite.position.copy(this.mesh.position);
    this.rollingSprite.position.z += 1.3;
    this.scene.add(this.rollingSprite);
  }

  _updateRollingNumber(number, intensity) {
    const ctx = this._rollingCtx;
    ctx.clearRect(0, 0, 256, 256);

    // Faded number with varying opacity based on intensity
    const alpha = 0.3 + intensity * 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = 'bold 100px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `rgba(102, 126, 234, ${alpha})`;
    ctx.shadowBlur = 15;
    ctx.fillText(String(number), 128, 128);

    if (this._rollingTexture) {
      this._rollingTexture.needsUpdate = true;
    }
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

  setResult(number) {
    this._clearResult();

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

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
    this.resultSprite.scale.set(1.8, 1.8, 1);
    this.resultSprite.position.copy(this.mesh.position);
    this.resultSprite.position.z += 1.3;
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
    this._clearRollingSprite();
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

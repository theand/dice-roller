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

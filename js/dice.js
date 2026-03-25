import * as THREE from 'three';

const DICE_RADIUS = 2;
const CUBE_SIZE = 2.8;
const DEFAULT_DICE_SIDES = 20;
const SPRITE_Z_OFFSET = 2.6;
const CANVAS_SIZE = 256;
const CANVAS_CENTER = CANVAS_SIZE / 2;
const SCALE_THRESHOLD = 0.001;
const DROP_HEIGHT = 14;
const GRAVITY = 22;
const RESTITUTION = 0.6;
const BOUNCE_STOP_SPEED = 1.2;
const ROLL_DURATION_MIN = 3.2;
const ROLL_DURATION_VARIATION = 0.8;
const ANGULAR_DAMPING = 1.45;
const GROUND_ANGULAR_DAMPING = 3.1;
const ANGULAR_STOP_SPEED = 0.7;
const GROUND_ALIGN_RATE = 5.5;
const GROUND_ALIGN_SPIN_MAX = 2.2;
const MIN_BOUNCE_COUNT = 2;
const STOP_ALIGNMENT_DOT = 0.997;
const BOUNCE_SPIN_TRANSFER = 0.18;
const BOUNCE_RANDOM_SPIN = 2.2;
const INITIAL_SPIN_MAG_MIN = 34;
const INITIAL_SPIN_MAG_MAX = 52;
const INITIAL_Y_SPIN_BONUS_MIN = 10;
const INITIAL_Y_SPIN_BONUS_MAX = 18;
const FACE_CLUSTER_DOT_THRESHOLD = 0.999;
const FACE_LABEL_OFFSET = 0.03;
const FACE_LABEL_SIZE_BY_SIDES = {
  6: 1.45,
  8: 1.2,
  12: 0.95,
  20: 0.78,
};
const DOWN_AXIS = new THREE.Vector3(0, -1, 0);
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const LABEL_FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
const SETTLE_ROTATION_SPEED = 4.8;
const SETTLE_ANGLE_EPSILON = 0.005;

const FACE_COLORS = [
  '#ff6b6b', '#667eea', '#feca57', '#11998e', '#ff9ff3',
  '#f7971e', '#56ccf2', '#a8e063', '#764ba2', '#00b4db',
  '#e94560', '#1dd1a1', '#fc5c7d', '#6a3093', '#f0932b',
  '#48dbfb', '#c7ecee', '#b8e994', '#fdcb6e', '#00cec9',
];

const GEOMETRY_BY_SIDES = {
  6: () => new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
  8: () => new THREE.OctahedronGeometry(DICE_RADIUS, 0),
  12: () => new THREE.DodecahedronGeometry(DICE_RADIUS, 0),
  20: () => new THREE.IcosahedronGeometry(DICE_RADIUS, 0),
};

export const SUPPORTED_DICE_SIDES = Object.keys(GEOMETRY_BY_SIDES).map(Number);

function createGeometryForSides(sides) {
  const geometryFactory = GEOMETRY_BY_SIDES[sides];
  if (!geometryFactory) {
    throw new Error(`Unsupported dice sides: ${sides}`);
  }
  return geometryFactory();
}

export class Dice {
  constructor(scene, position, sides = DEFAULT_DICE_SIDES) {
    this.scene = scene;
    this.rolling = false;
    this.settling = false;
    this.result = null;
    this.basePosition = position.clone();
    this.sides = SUPPORTED_DICE_SIDES.includes(sides) ? sides : DEFAULT_DICE_SIDES;

    this._colorOffset = Math.floor(Math.random() * FACE_COLORS.length);

    const baseGeometry = createGeometryForSides(this.sides);
    const geometry = baseGeometry.index ? baseGeometry.toNonIndexed() : baseGeometry.clone();
    baseGeometry.dispose();

    const { faceData, triangleToFaceIndices } = this._extractFaceData(geometry);
    this._faceData = faceData;

    this._setupFaceGroups(geometry, triangleToFaceIndices);
    this.materials = this._createFaceMaterials(this._faceData.length);

    this.mesh = new THREE.Mesh(geometry, this.materials);
    this.mesh.position.copy(position);
    this.faceLabelGroup = new THREE.Group();
    this.mesh.add(this.faceLabelGroup);
    this._createFaceLabels();

    this.mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    );
    this.scene.add(this.mesh);

    this.angularVelocity = new THREE.Vector3();
    this.rollDuration = 0;
    this.rollElapsed = 0;
    this._settleTargetQuaternion = new THREE.Quaternion();
    this.rollResolve = null;

    this.bounceHeight = 0;
    this.bounceSpeed = 0;
    this.bounceCount = 0;

    this._canvas = document.createElement('canvas');
    this._canvas.width = CANVAS_SIZE;
    this._canvas.height = CANVAS_SIZE;
    this._ctx = this._canvas.getContext('2d');

    // Persistent result sprite + texture (reused across rolls)
    this._resultTexture = new THREE.CanvasTexture(this._canvas);
    this.resultSprite = null;

    this.targetScale = 1;
    this.currentScale = 1;
  }

  roll() {
    if (this.rolling || this.settling) return Promise.resolve(this.result);

    this._clearResult();

    this.rolling = true;
    this.settling = false;
    this.rollDuration = ROLL_DURATION_MIN + Math.random() * ROLL_DURATION_VARIATION;
    this.rollElapsed = 0;

    const spinAxis = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.3) * 2,
      (Math.random() - 0.5) * 2,
    );
    if (spinAxis.lengthSq() === 0) {
      spinAxis.set(1, 1, 0);
    }
    spinAxis.normalize();

    const spinMagnitude = INITIAL_SPIN_MAG_MIN + Math.random() * (INITIAL_SPIN_MAG_MAX - INITIAL_SPIN_MAG_MIN);
    this.angularVelocity.copy(spinAxis.multiplyScalar(spinMagnitude));

    const ySpinBonus = INITIAL_Y_SPIN_BONUS_MIN + Math.random() * (INITIAL_Y_SPIN_BONUS_MAX - INITIAL_Y_SPIN_BONUS_MIN);
    this.angularVelocity.y += (Math.random() < 0.5 ? -1 : 1) * ySpinBonus;

    this.bounceHeight = DROP_HEIGHT;
    this.bounceSpeed = 0;
    this.bounceCount = 0;
    this.mesh.position.y = this.basePosition.y + DROP_HEIGHT;
    this.targetScale = 0.9;

    return new Promise((resolve) => {
      this.rollResolve = resolve;
    });
  }

  update(deltaTime) {
    if (this.rolling) {
      this._updateRolling(deltaTime);
      return;
    }

    if (this.settling) {
      this._updateSettling(deltaTime);
      return;
    }

    this._updateIdleScale();
  }

  setResult(number) {
    this._clearResult();
    this._renderNumber(number, 1.0, 120, 20);
    this._resultTexture = new THREE.CanvasTexture(this._canvas);
    this.resultSprite = this._createSprite(this._resultTexture, 3.2);
  }

  dispose() {
    this._clearResult();
    this._clearFaceLabels();

    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.materials.forEach((m) => {
      if (m.map) {
        m.map.dispose();
      }
      m.dispose();
    });
    if (this._resultTexture) {
      this._resultTexture.dispose();
      this._resultTexture = null;
    }
    this._canvas = null;
    this._ctx = null;
  }

  _updateRolling(deltaTime) {
    this.rollElapsed += deltaTime;
    const progress = Math.min(this.rollElapsed / this.rollDuration, 1);
    const easeFactor = 1 - progress * progress * progress;

    const scaleDiff = this.targetScale - this.currentScale;
    if (Math.abs(scaleDiff) > SCALE_THRESHOLD) {
      this.currentScale += scaleDiff * 0.1;
    }
    const wobble = 1 + Math.sin(this.rollElapsed * 12) * 0.03 * easeFactor;
    this.mesh.scale.setScalar(this.currentScale * wobble);

    this.mesh.rotation.x += this.angularVelocity.x * deltaTime;
    this.mesh.rotation.y += this.angularVelocity.y * deltaTime;
    this.mesh.rotation.z += this.angularVelocity.z * deltaTime;

    const airborneDamping = Math.exp(-ANGULAR_DAMPING * deltaTime);
    this.angularVelocity.multiplyScalar(airborneDamping);

    this.bounceSpeed -= GRAVITY * deltaTime;
    this.bounceHeight += this.bounceSpeed * deltaTime;
    if (this.bounceHeight <= 0) {
      this.bounceHeight = 0;
      const impactSpeed = Math.abs(this.bounceSpeed);
      if (impactSpeed > BOUNCE_STOP_SPEED) {
        this.bounceSpeed = -this.bounceSpeed * RESTITUTION;
        this.bounceCount += 1;
        this._applyBounceSpin(impactSpeed);
      } else {
        this.bounceSpeed = 0;
      }
    }
    this.mesh.position.y = this.basePosition.y + this.bounceHeight;

    if (this.bounceHeight === 0) {
      const groundDamping = Math.exp(-GROUND_ANGULAR_DAMPING * deltaTime);
      this.angularVelocity.multiplyScalar(groundDamping);
      this._alignToGround(deltaTime);
    }

    const enoughBounces = this.bounceCount >= MIN_BOUNCE_COUNT;
    const spinStopped = this.angularVelocity.lengthSq() <= ANGULAR_STOP_SPEED * ANGULAR_STOP_SPEED;
    const minRollElapsed = this.rollElapsed >= this.rollDuration;
    const bounceStopped = this.bounceHeight === 0 && this.bounceSpeed === 0;
    const alignedToFloor = this._getBottomFaceAlignment() >= STOP_ALIGNMENT_DOT;
    if (minRollElapsed && enoughBounces && bounceStopped && spinStopped && alignedToFloor) {
      this._startSettling();
    }
  }

  _updateSettling(deltaTime) {
    this.mesh.quaternion.rotateTowards(this._settleTargetQuaternion, SETTLE_ROTATION_SPEED * deltaTime);

    this.mesh.position.y = this.basePosition.y;
    this._updateIdleScale();

    if (this.resultSprite) {
      this.resultSprite.position.copy(this.mesh.position);
      this.resultSprite.position.z += SPRITE_Z_OFFSET;
    }

    if (this.mesh.quaternion.angleTo(this._settleTargetQuaternion) <= SETTLE_ANGLE_EPSILON) {
      this.settling = false;
      this.mesh.quaternion.copy(this._settleTargetQuaternion);
      this._resolveRoll();
    }
  }

  _updateIdleScale() {
    const scaleDiff = this.targetScale - this.currentScale;
    if (Math.abs(scaleDiff) > SCALE_THRESHOLD) {
      this.currentScale += scaleDiff * 0.1;
      this.mesh.scale.setScalar(this.currentScale);
    }
  }

  _extractFaceData(geometry) {
    const faceData = [];
    const triangleToFaceIndices = [];
    const position = geometry.getAttribute('position');
    const triangleCount = position.count / 3;

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const centroid = new THREE.Vector3();

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
      const vertexOffset = triangleIndex * 3;
      a.fromBufferAttribute(position, vertexOffset);
      b.fromBufferAttribute(position, vertexOffset + 1);
      c.fromBufferAttribute(position, vertexOffset + 2);

      ab.subVectors(b, a);
      ac.subVectors(c, a);
      normal.crossVectors(ab, ac).normalize();

      centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);

      let faceIndex = -1;
      for (let i = 0; i < faceData.length; i++) {
        if (faceData[i].normal.dot(normal) > FACE_CLUSTER_DOT_THRESHOLD) {
          faceIndex = i;
          break;
        }
      }

      if (faceIndex === -1) {
        faceIndex = faceData.length;
        faceData.push({
          normal: normal.clone(),
          centerSum: centroid.clone(),
          centerCount: 1,
        });
      } else {
        faceData[faceIndex].centerSum.add(centroid);
        faceData[faceIndex].centerCount += 1;
      }

      triangleToFaceIndices.push(faceIndex);
    }

    this._faceData = faceData.map((face, index) => ({
      index,
      value: index + 1,
      normal: face.normal.clone().normalize(),
      center: face.centerSum.multiplyScalar(1 / face.centerCount),
    }));

    return {
      faceData: this._faceData,
      triangleToFaceIndices,
    };
  }

  _setupFaceGroups(geometry, triangleToFaceIndices) {
    geometry.clearGroups();
    for (let triangleIndex = 0; triangleIndex < triangleToFaceIndices.length; triangleIndex++) {
      geometry.addGroup(triangleIndex * 3, 3, triangleToFaceIndices[triangleIndex]);
    }
  }

  _createFaceMaterials(faceCount) {
    const materials = [];

    for (let i = 0; i < faceCount; i++) {
      materials.push(new THREE.MeshPhysicalMaterial({
        color: FACE_COLORS[(i + this._colorOffset) % FACE_COLORS.length],
        metalness: 0.08,
        roughness: 0.45,
        clearcoat: 0.2,
        clearcoatRoughness: 0.35,
      }));
    }

    return materials;
  }

  _createFaceLabels() {
    const labelSize = FACE_LABEL_SIZE_BY_SIDES[this.sides] ?? 1;

    this._faceData.forEach((face) => {
      const labelTexture = this._createFaceLabelTexture(face.value);
      const labelMaterial = new THREE.MeshBasicMaterial({
        map: labelTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(labelSize, labelSize), labelMaterial);
      labelMesh.position.copy(face.center);
      labelMesh.position.addScaledVector(face.normal, FACE_LABEL_OFFSET);
      labelMesh.quaternion.setFromUnitVectors(LABEL_FORWARD_AXIS, face.normal);
      this.faceLabelGroup.add(labelMesh);
    });
  }

  _createFaceLabelTexture(value) {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.font = 'bold 140px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.strokeText(String(value), CANVAS_CENTER, CANVAS_CENTER);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(value), CANVAS_CENTER, CANVAS_CENTER);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  _clearFaceLabels() {
    if (!this.faceLabelGroup) {
      return;
    }

    while (this.faceLabelGroup.children.length > 0) {
      const labelMesh = this.faceLabelGroup.children[0];
      this.faceLabelGroup.remove(labelMesh);
      labelMesh.geometry.dispose();
      if (labelMesh.material.map) {
        labelMesh.material.map.dispose();
      }
      labelMesh.material.dispose();
    }

    this.mesh.remove(this.faceLabelGroup);
    this.faceLabelGroup = null;
  }

  _alignToGround(deltaTime) {
    const bottomFaceIndex = this._getBottomFaceIndex();
    const targetQuaternion = this._computeSettledQuaternion(bottomFaceIndex);
    const spin = this.angularVelocity.length();
    const alignStrength = THREE.MathUtils.clamp(1 - spin / GROUND_ALIGN_SPIN_MAX, 0, 1);
    if (alignStrength <= 0) {
      return;
    }

    this.mesh.quaternion.rotateTowards(targetQuaternion, GROUND_ALIGN_RATE * alignStrength * deltaTime);
  }

  _applyBounceSpin(impactSpeed) {
    const torqueScale = impactSpeed * BOUNCE_SPIN_TRANSFER;
    const randomTorque = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 0.7,
      (Math.random() - 0.5) * 2,
    );

    if (randomTorque.lengthSq() > 0) {
      randomTorque.normalize();
      randomTorque.multiplyScalar(torqueScale + Math.random() * BOUNCE_RANDOM_SPIN);
      this.angularVelocity.add(randomTorque);
    }
  }

  _randomResult() {
    return Math.floor(Math.random() * this.sides) + 1;
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

  _clearResult() {
    if (this.resultSprite) {
      this.scene.remove(this.resultSprite);
      this.resultSprite.material.map.dispose();
      this.resultSprite.material.dispose();
      this.resultSprite = null;
    }
  }

  _startSettling() {
    this.rolling = false;
    this.settling = true;

    const topFaceIndex = this._getTopFaceIndex();
    const bottomFaceIndex = this._getBottomFaceIndex();
    this.result = this._faceData[topFaceIndex].value;

    this.mesh.position.y = this.basePosition.y;
    this.bounceHeight = 0;
    this.bounceSpeed = 0;

    this.currentScale = Math.max(this.currentScale, 1.2);
    this.targetScale = 1;

    this.setResult(this.result);

    this._settleTargetQuaternion.copy(this._computeSettledQuaternion(bottomFaceIndex));

    if (this.mesh.quaternion.angleTo(this._settleTargetQuaternion) <= SETTLE_ANGLE_EPSILON) {
      this.settling = false;
      this.mesh.quaternion.copy(this._settleTargetQuaternion);
      this._resolveRoll();
    }
  }

  _getBottomFaceIndex() {
    let bestFaceIndex = 0;
    let bestDot = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < this._faceData.length; i++) {
      const worldNormal = this._faceData[i].normal.clone().applyQuaternion(this.mesh.quaternion).normalize();
      const dot = worldNormal.dot(DOWN_AXIS);
      if (dot > bestDot) {
        bestDot = dot;
        bestFaceIndex = i;
      }
    }

    return bestFaceIndex;
  }

  _getBottomFaceAlignment() {
    let bestDot = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < this._faceData.length; i++) {
      const worldNormal = this._faceData[i].normal.clone().applyQuaternion(this.mesh.quaternion).normalize();
      const dot = worldNormal.dot(DOWN_AXIS);
      if (dot > bestDot) {
        bestDot = dot;
      }
    }

    return bestDot;
  }

  _getTopFaceIndex() {
    let bestFaceIndex = 0;
    let bestDot = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < this._faceData.length; i++) {
      const worldNormal = this._faceData[i].normal.clone().applyQuaternion(this.mesh.quaternion).normalize();
      const dot = worldNormal.dot(UP_AXIS);
      if (dot > bestDot) {
        bestDot = dot;
        bestFaceIndex = i;
      }
    }

    return bestFaceIndex;
  }

  _computeSettledQuaternion(faceIndex) {
    if (!this._faceData || this._faceData.length === 0) {
      return this.mesh.quaternion.clone();
    }

    const normalizedFaceIndex = Math.min(Math.max(faceIndex, 0), this._faceData.length - 1);
    const faceNormalWorld = this._faceData[normalizedFaceIndex].normal.clone().applyQuaternion(this.mesh.quaternion).normalize();

    const alignToGround = new THREE.Quaternion().setFromUnitVectors(faceNormalWorld, DOWN_AXIS);
    const settledQuaternion = alignToGround.multiply(this.mesh.quaternion.clone());
    settledQuaternion.normalize();
    return settledQuaternion;
  }

  _resolveRoll() {
    if (this.rollResolve) {
      this.rollResolve(this.result);
      this.rollResolve = null;
    }
  }
}

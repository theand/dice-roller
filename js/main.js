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

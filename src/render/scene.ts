import * as THREE from 'three';
import type { TrackTheme } from '../track';

export interface SceneContext {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  ambientLight: THREE.AmbientLight;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  fillLight: THREE.DirectionalLight;
  groundMesh: THREE.Mesh;
}

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Céu Pôr do Sol de Las Vegas / Deserto dos EUA (Púrpura / Laranja retrô)
  const skyColor = new THREE.Color(0x2a1435);
  scene.background = skyColor;

  // Fog suave com densidade equilibrada (0.0016) para não ofuscar o asfalto próximo
  scene.fog = new THREE.FogExp2(0x2a1435, 0.0016);

  // 1. Iluminação Ambiente Vibrante e Clara (leve tom dourado/azulado)
  const ambientLight = new THREE.AmbientLight(0xffeedd, 1.15);
  scene.add(ambientLight);

  // 2. Hemisphere Light para iluminação natural e contraste céu vs solo
  const hemiLight = new THREE.HemisphereLight(0xb8d0ff, 0x664433, 0.9);
  scene.add(hemiLight);

  // 3. Luz solar direcional principal (ilumina asfalto, zebras e montanhas com nitidez)
  const sunLight = new THREE.DirectionalLight(0xffa550, 1.8);
  sunLight.position.set(120, 160, 100);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 500;
  const d = 200;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  scene.add(sunLight);

  // 4. Luz direcional de preenchimento suave oposta para evitar zonas escuras
  const fillLight = new THREE.DirectionalLight(0x7090c0, 0.65);
  fillLight.position.set(-120, 100, -100);
  scene.add(fillLight);

  // Terreno Deserto / Areia Vermelha (Nevada / Las Vegas)
  const groundGeo = new THREE.PlaneGeometry(3000, 3000, 32, 32);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x8a4526, // Terra ocre / areia avermelhada do deserto
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  // Mesas e montanhas rochosas do deserto no horizonte
  createDesertMesas(scene);

  return {
    scene,
    renderer,
    ambientLight,
    sunLight,
    hemiLight,
    fillLight,
    groundMesh: ground,
  };
}

export function updateSceneTheme(ctx: SceneContext, theme: TrackTheme): void {
  if (ctx.scene.background instanceof THREE.Color) {
    ctx.scene.background.setHex(theme.skyColor);
  }
  if (ctx.scene.fog instanceof THREE.FogExp2) {
    ctx.scene.fog.color.setHex(theme.fogColor ?? theme.skyColor);
    ctx.scene.fog.density = 0.0016;
  }
  if (ctx.ambientLight) {
    if (theme.ambientColor !== undefined) {
      ctx.ambientLight.color.setHex(theme.ambientColor);
    }
    ctx.ambientLight.intensity = 1.1;
  }
  if (ctx.sunLight) {
    if (theme.sunColor !== undefined) {
      ctx.sunLight.color.setHex(theme.sunColor);
    }
    ctx.sunLight.intensity = 1.7;
  }
  if (ctx.hemiLight) {
    ctx.hemiLight.color.setHex(theme.sunColor ?? 0xb8d0ff);
    ctx.hemiLight.groundColor.setHex(theme.groundColor);
    ctx.hemiLight.intensity = 0.85;
  }
  if (ctx.fillLight) {
    ctx.fillLight.color.setHex(theme.ambientColor ?? 0x7090c0);
    ctx.fillLight.intensity = 0.65;
  }
  if (ctx.groundMesh && ctx.groundMesh.material instanceof THREE.MeshStandardMaterial) {
    ctx.groundMesh.material.color.setHex(theme.groundColor);
  }
}

function createDesertMesas(scene: THREE.Scene): void {
  const mesaMat = new THREE.MeshStandardMaterial({
    color: 0x4a1e2f,
    roughness: 0.9,
    flatShading: true,
  });

  const count = 20;
  const radius = 750;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const height = 90 + Math.sin(i * 4) * 45;
    const topRadius = 40 + Math.cos(i * 3) * 20;
    const botRadius = topRadius + 60;

    // Mesas rochosas com topo reto típicas do deserto de Nevada
    const mesaGeo = new THREE.CylinderGeometry(topRadius, botRadius, height, 6);
    const mesa = new THREE.Mesh(mesaGeo, mesaMat);

    mesa.position.set(
      Math.cos(angle) * radius,
      height / 2 - 10,
      Math.sin(angle) * radius
    );
    scene.add(mesa);
  }
}

// El mundo de la fase 1: un prado plano con un camino en círculo.
// Adentro solo hay cosas que se pueden pisar (flores y pasto); los árboles
// están en la orilla, donde el carro ya no llega. Los choques son de la fase 2.

import * as THREE from '../vendor/three/three.module.js';

export const RADIO_MANEJO = 95;        // el carro no pasa de aquí
export const RADIO_CAMINO = 45;
const ANCHO_CAMINO = 8;
const CIELO = 0x9fd8ff;
const DESDE_EL_SOL = new THREE.Vector3(25, 45, 18);

// Números al azar que salen siempre iguales: así el mundo no cambia de una partida a otra.
function azarFijo(semilla) {
  return () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };
}

export function crearMundo(escena) {
  const azar = azarFijo(20261117);
  const quieto = new THREE.Object3D();   // ayuda para acomodar las copias de cada objeto

  escena.background = new THREE.Color(CIELO);
  escena.fog = new THREE.Fog(CIELO, 90, 210);

  // ---------- Luz ----------
  escena.add(new THREE.HemisphereLight(0xe8f6ff, 0x5c8a3a, 1.7));

  const sol = new THREE.DirectionalLight(0xfff2d9, 2.0);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 5, far: 120 });
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.04;
  escena.add(sol, sol.target);

  // ---------- Piso ----------
  const piso = new THREE.Mesh(
    new THREE.CircleGeometry(230, 64),
    new THREE.MeshLambertMaterial({ color: 0x7ccf5a }),
  );
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  escena.add(piso);

  // ---------- Camino en círculo ----------
  const camino = new THREE.Mesh(
    new THREE.RingGeometry(RADIO_CAMINO - ANCHO_CAMINO / 2, RADIO_CAMINO + ANCHO_CAMINO / 2, 128),
    new THREE.MeshLambertMaterial({ color: 0x8d99ae }),
  );
  camino.rotation.x = -Math.PI / 2;
  camino.position.y = 0.02;
  camino.receiveShadow = true;
  escena.add(camino);

  const N_RAYAS = 44;
  const rayas = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.45, 0.02, 2.8),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    N_RAYAS,
  );
  for (let i = 0; i < N_RAYAS; i++) {
    const a = (i / N_RAYAS) * Math.PI * 2;
    quieto.position.set(Math.cos(a) * RADIO_CAMINO, 0.04, Math.sin(a) * RADIO_CAMINO);
    quieto.rotation.set(0, -a, 0);
    quieto.scale.set(1, 1, 1);
    quieto.updateMatrix();
    rayas.setMatrixAt(i, quieto.matrix);
  }
  rayas.receiveShadow = true;
  escena.add(rayas);

  // Un lugar al azar en el prado, sin caer sobre el camino.
  function lugarEnElPrado(radioMax) {
    for (;;) {
      const r = Math.sqrt(azar()) * radioMax;
      if (Math.abs(r - RADIO_CAMINO) < ANCHO_CAMINO / 2 + 1.5) continue;
      const a = azar() * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r];
    }
  }

  // ---------- Pasto ----------
  const N_PASTO = 500;
  const pasto = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.22, 0.7, 4),
    new THREE.MeshLambertMaterial({ color: 0x4f9d3a, flatShading: true }),
    N_PASTO,
  );
  for (let i = 0; i < N_PASTO; i++) {
    const [x, z] = lugarEnElPrado(RADIO_MANEJO + 10);
    const s = 0.7 + azar() * 0.7;
    quieto.position.set(x, 0.35 * s, z);
    quieto.rotation.set(0, azar() * Math.PI, 0);
    quieto.scale.set(s, s, s);
    quieto.updateMatrix();
    pasto.setMatrixAt(i, quieto.matrix);
  }
  escena.add(pasto);

  // ---------- Flores ----------
  const COLORES_FLOR = [0xff5d8f, 0xffd60a, 0xffffff, 0xb388eb, 0xff8c42];
  const N_FLORES = 260;
  const flores = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.28, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    N_FLORES,
  );
  const color = new THREE.Color();
  for (let i = 0; i < N_FLORES; i++) {
    const [x, z] = lugarEnElPrado(RADIO_MANEJO + 10);
    quieto.position.set(x, 0.3, z);
    quieto.rotation.set(azar() * 3, azar() * 3, 0);
    quieto.scale.set(1, 1, 1);
    quieto.updateMatrix();
    flores.setMatrixAt(i, quieto.matrix);
    flores.setColorAt(i, color.setHex(COLORES_FLOR[i % COLORES_FLOR.length]));
  }
  escena.add(flores);

  // ---------- Árboles en la orilla ----------
  const N_ARBOLES = 110;
  const tipos = [];
  for (let i = 0; i < N_ARBOLES; i++) tipos.push(azar() < 0.5 ? 'redondo' : 'pino');
  const nRedondos = tipos.filter((t) => t === 'redondo').length;

  const troncos = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: true }),
    N_ARBOLES,
  );
  const copasRedondas = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(2.4, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    nRedondos,
  );
  const copasPino = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.2, 5.5, 7),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    N_ARBOLES - nRedondos,
  );
  const VERDES = [0x2d6a4f, 0x40916c, 0x52b788, 0x3a7d44];

  let iRedondo = 0;
  let iPino = 0;
  for (let i = 0; i < N_ARBOLES; i++) {
    const a = (i / N_ARBOLES) * Math.PI * 2 + azar() * 0.05;
    const r = RADIO_MANEJO + 8 + azar() * 30;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const s = 0.85 + azar() * 0.6;

    quieto.position.set(x, 1.2 * s, z);
    quieto.rotation.set(0, azar() * Math.PI, 0);
    quieto.scale.set(s, s, s);
    quieto.updateMatrix();
    troncos.setMatrixAt(i, quieto.matrix);

    color.setHex(VERDES[Math.floor(azar() * VERDES.length)]);
    if (tipos[i] === 'redondo') {
      quieto.position.y = (2.4 + 1.8) * s;
      quieto.updateMatrix();
      copasRedondas.setMatrixAt(iRedondo, quieto.matrix);
      copasRedondas.setColorAt(iRedondo, color);
      iRedondo++;
    } else {
      quieto.position.y = (2.4 + 2.2) * s;
      quieto.updateMatrix();
      copasPino.setMatrixAt(iPino, quieto.matrix);
      copasPino.setColorAt(iPino, color);
      iPino++;
    }
  }
  for (const m of [troncos, copasRedondas, copasPino]) {
    m.castShadow = true;
    m.computeBoundingSphere();
    escena.add(m);
  }

  // ---------- Nubes ----------
  const N_NUBES = 14;
  const nubes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false }),
    N_NUBES * 3,
  );
  for (let i = 0; i < N_NUBES; i++) {
    const a = azar() * Math.PI * 2;
    const r = 40 + azar() * 110;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const cy = 38 + azar() * 14;
    for (let j = 0; j < 3; j++) {
      const s = 3 + azar() * 2.5;
      quieto.position.set(cx + (j - 1) * 4.5, cy + azar() * 1.5, cz + azar() * 2);
      quieto.rotation.set(azar(), azar(), azar());
      quieto.scale.set(s * 1.3, s * 0.8, s);
      quieto.updateMatrix();
      nubes.setMatrixAt(i * 3 + j, quieto.matrix);
    }
  }
  nubes.computeBoundingSphere();
  escena.add(nubes);

  return {
    // La sombra solo se calcula cerca del carro; el sol lo sigue.
    seguir(posicion) {
      sol.position.copy(posicion).add(DESDE_EL_SOL);
      sol.target.position.copy(posicion);
    },
  };
}

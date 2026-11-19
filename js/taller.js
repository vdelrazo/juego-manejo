// El taller por dentro: un cuarto con piso brillante, plataforma que gira, herramientas en la pared
// y luz de estudio para que la pintura luzca. El vehículo se ve en la parte izquierda de la pantalla
// (unos dos tercios) y el panel de la derecha tiene los módulos.
//
// Módulos: 🔧 reparación (tocar las llaves que flotan sobre lo dañado), 🧽 lavado (tallar el lodo),
// 🎨 pintura (colores y calcomanías) y 🔩 piezas (el panel las cambia directo en el vehículo).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as tex from './texturas.js';

export const COLORES_PINTURA = [
  { nombre: 'rojo', hex: '#ef233c' },
  { nombre: 'azul', hex: '#1d7ff2' },
  { nombre: 'amarillo', hex: '#ffc300' },
  { nombre: 'verde', hex: '#2dc653' },
  { nombre: 'naranja', hex: '#ff7b00' },
  { nombre: 'morado', hex: '#8e44ec' },
  { nombre: 'rosa', hex: '#ff5fa2' },
  { nombre: 'negro', hex: '#24272e' },
  { nombre: 'blanco', hex: '#f4f5f7' },
];
export const CALCOMANIAS = ['⭐', '❤️', '🔥', '⚡', '🌈', '🦖', '🐶', '🚀'];

const PANEL = 0.34;   // fracción de la pantalla que ocupa el panel de la derecha

function emojiEnLienzo(emoji, tam = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const g = c.getContext('2d');
  g.font = `${tam * 0.78}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, tam / 2, tam * 0.55);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Pared de herramientas (tablero con agujeritos y siluetas de herramientas).
function texturaHerramientas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a77c';
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = 'rgba(80,55,30,0.35)';
  for (let y = 16; y < 512; y += 32) for (let x = 16; x < 1024; x += 32) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
  g.font = '150px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ['🔧', '🔨', '🪛', '🪚', '🔩', '🧰'].forEach((e, i) => g.fillText(e, 100 + i * 165, i % 2 ? 330 : 190));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crearTaller(renderer, ui) {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xd7e6f4);
  escena.fog = new THREE.Fog(0xd7e6f4, 18, 40);
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.95;
  pmrem.dispose();

  // ---------- Luz ----------
  escena.add(new THREE.HemisphereLight(0xffffff, 0x9aa6b4, 0.7));
  const luz = new THREE.DirectionalLight(0xffffff, 2.3);
  luz.position.set(4, 9, 6);
  luz.castShadow = true;
  luz.shadow.mapSize.set(1024, 1024);
  Object.assign(luz.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  luz.shadow.radius = 5;
  luz.shadow.bias = -0.0005;
  escena.add(luz, luz.target);

  // ---------- Cuarto ----------
  const texPiso = tex.banqueta();
  texPiso.repeat.set(12, 12);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0xdde4ec, map: texPiso, roughness: 0.28, metalness: 0.05 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  escena.add(piso);

  const pared = (ancho, alto, color) => new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  const fondo = pared(40, 12, 0xbcd7ee);
  fondo.position.set(0, 6, -8);
  escena.add(fondo);
  const lado = pared(40, 12, 0xc9e0f3);
  lado.position.set(-10, 6, 0);
  lado.rotation.y = Math.PI / 2;
  escena.add(lado);
  // Franja naranja abajo.
  for (const [m, x, z, ry] of [[40, 0, -7.98, 0], [40, -9.98, 0, Math.PI / 2]]) {
    const franja = new THREE.Mesh(new THREE.PlaneGeometry(m, 1.4), new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.7 }));
    franja.position.set(x, 0.7, z);
    franja.rotation.y = ry;
    escena.add(franja);
  }
  const tablero = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: texturaHerramientas(), roughness: 0.8 }));
  tablero.position.set(-2.5, 4.2, -7.95);
  escena.add(tablero);
  // Gabinete rojo de herramientas.
  const gabinete = new THREE.Group();
  const cuerpoGab = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.8, 0.9, 3, 0.06), new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.35, metalness: 0.2 }));
  cuerpoGab.position.y = 0.9;
  gabinete.add(cuerpoGab);
  for (let i = 0; i < 4; i++) {
    const manija = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xe8ecf1, metalness: 1, roughness: 0.2 }));
    manija.position.set(0, 0.4 + i * 0.4, 0.47);
    gabinete.add(manija);
  }
  gabinete.position.set(4.5, 0, -7.2);
  gabinete.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  escena.add(gabinete);
  // Llantas apiladas.
  for (let i = 0; i < 4; i++) {
    const llanta = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.2, 14, 28), new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.85 }));
    llanta.rotation.x = Math.PI / 2;
    llanta.position.set(7.6, 0.2 + i * 0.38, -6.4);
    llanta.castShadow = true;
    escena.add(llanta);
  }
  // Letrero redondo con una llave.
  const letrero = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshStandardMaterial({ map: emojiEnLienzo('🔧'), transparent: true, roughness: 0.5 }));
  const aro = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  aro.position.set(5.5, 5, -7.96);
  letrero.position.set(5.5, 5, -7.94);
  escena.add(aro, letrero);

  // Plataforma que gira, con aro amarillo.
  const plataforma = new THREE.Group();
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.4, 0.18, 72), new THREE.MeshStandardMaterial({ color: 0x4a5059, metalness: 0.6, roughness: 0.35 }));
  disco.position.y = 0.09;
  disco.receiveShadow = true;
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.07, 10, 90).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffc300, emissive: 0xffa000, emissiveIntensity: 0.4 }));
  anillo.position.y = 0.19;
  plataforma.add(disco, anillo);
  escena.add(plataforma);

  // ---------- Partículas: pintura en aerosol, burbujas y brillitos ----------
  const MAX = 140;
  const particulas = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0, transparent: true, opacity: 0.75, depthWrite: false }),
    MAX,
  );
  particulas.count = 0;
  particulas.frustumCulled = false;
  escena.add(particulas);
  const vivas = [];
  const quieto = new THREE.Object3D();
  const colorP = new THREE.Color();
  function soltar(pos, vel, color, tam, vida) {
    if (vivas.length >= MAX) vivas.shift();
    vivas.push({ pos: pos.clone(), vel: vel.clone(), color: new THREE.Color(color), tam, vida, total: vida });
  }

  const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiEnLienzo('✨'), transparent: true, depthWrite: false }));
  brillo.visible = false;
  escena.add(brillo);
  let tiempoBrillo = 0;

  // Llaves que flotan sobre lo que hay que reparar (pestaña 🔧).
  // Llave sobre un círculo amarillo con borde blanco, para que se vea bien.
  const texLlave = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffc300';
    g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.fill();
    g.font = '150px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🔧', 128, 140);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  let llaves = [];   // { pendiente, sprite, girando }
  function quitarLlaves() {
    for (const l of llaves) escena.remove(l.sprite);
    llaves = [];
  }
  function ponerLlaves() {
    quitarLlaves();
    if (!vehiculo || pestana !== 'reparacion') return;
    for (const pendiente of vehiculo.apariencia.pendientes()) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLlave, transparent: true, depthTest: false }));
      sprite.renderOrder = 5;
      escena.add(sprite);
      llaves.push({ pendiente, sprite, girando: -1 });
    }
  }
  function tocarLlave(e) {
    let mejor = null;
    let dMejor = 90;   // píxeles: generoso para dedos chicos
    const p = new THREE.Vector3();
    for (const l of llaves) {
      if (l.girando >= 0) continue;
      p.copy(l.sprite.position).project(camara);
      const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
      const d = Math.hypot(x - e.clientX, y - e.clientY);
      if (d < dMejor) { dMejor = d; mejor = l; }
    }
    if (!mejor) return false;
    mejor.girando = 0;
    ui.sonidoClanc();
    return true;
  }

  // ---------- Cámara ----------
  const camara = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  function ajustar() {
    const ancho = innerWidth, alto = innerHeight;
    camara.aspect = ancho / alto;
    // El vehículo se centra en la parte izquierda (lo que no tapa el panel).
    camara.setViewOffset(ancho, alto, ancho * PANEL / 2, 0, ancho, alto);
    camara.updateProjectionMatrix();
  }
  addEventListener('resize', ajustar);
  ajustar();

  // ---------- Estado ----------
  let vehiculo = null;
  let angulo = 0.6;
  let quietoDesde = 0;
  let pestana = 'pintura';
  let calcomania = null;     // la que se va a pegar con el siguiente toque
  let reloj = 0;
  let limpioAvisado = false;

  // La cámara se aleja según el tamaño del vehículo (el camión de bomberos es más largo).
  function colocarCamara() {
    const b = new THREE.Box3();
    vehiculo.objeto.updateMatrixWorld(true);
    vehiculo.objeto.traverse((o) => {
      if (o.isMesh && o.visible && !(o.material.transparent)) b.expandByObject(o, true);
    });
    const t = b.getSize(new THREE.Vector3());
    const largo = Math.max(t.x, t.z);
    const alto = t.y;
    const d = Math.max(6.8, largo * 2.3 + alto * 0.5);
    camara.position.set(d * 0.15, alto * 1.15 + 0.7, d);
    camara.lookAt(0, alto * 0.42, 0);
  }

  // ---------- Toques en la parte del vehículo ----------
  const rayo = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let arrastre = null;   // { x, inicioX, anguloInicio, movio, tallando }

  function tocarVehiculo(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    return rayo.intersectObjects(vehiculo.apariencia.superficies, false)[0] ?? null;
  }

  function tallar(golpe) {
    for (let i = 0; i < 4; i++) {
      soltar(golpe.point, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6), 0xffffff, 0.06 + Math.random() * 0.08, 1.4);
    }
    if (vehiculo.apariencia.tallarEn(golpe.point)) {
      ui.sonidoBurbujas();
      if (vehiculo.apariencia.manchasVisibles === 0 && !limpioAvisado) {
        limpioAvisado = true;
        ui.festejoChico();
        ui.decir('¡Quedó limpio y brillante!');
        tiempoBrillo = 1.6;
      }
    } else if (Math.random() < 0.15) {
      ui.sonidoBurbujas();
    }
  }

  function alBajar(e) {
    if (!vehiculo) return;
    arrastre = { x: e.clientX, inicioX: e.clientX, anguloInicio: angulo, movio: false, tallando: false };
    if (pestana === 'lavado') {
      const golpe = tocarVehiculo(e);
      if (golpe) {
        arrastre.tallando = true;
        tallar(golpe);
      }
    }
  }
  function alMover(e) {
    if (!arrastre) return;
    if (Math.abs(e.clientX - arrastre.inicioX) > 12) arrastre.movio = true;
    if (arrastre.tallando) {
      const golpe = tocarVehiculo(e);
      if (golpe) tallar(golpe);
      return;
    }
    // Arrastrar fuera del vehículo hace girar la plataforma.
    angulo = arrastre.anguloInicio + (e.clientX - arrastre.inicioX) * 0.012;
    quietoDesde = reloj;
  }
  function alSubir(e) {
    if (!arrastre) return;
    const fueToque = !arrastre.movio && !arrastre.tallando;
    arrastre = null;
    if (fueToque && pestana === 'reparacion') {
      tocarLlave(e);
      return;
    }
    if (fueToque && pestana === 'pintura' && calcomania) {
      const golpe = tocarVehiculo(e);
      if (golpe && vehiculo.apariencia.pegarEn(golpe, calcomania)) {
        ui.sonidoPegar();
        for (let i = 0; i < 10; i++) {
          soltar(golpe.point, new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5), 0xffd60a, 0.04, 0.6);
        }
      }
    }
  }

  return {
    escena,
    camara,
    get pestana() { return pestana; },
    get calcomania() { return calcomania; },

    abrir(v) {
      vehiculo = v;
      escena.add(v.objeto);
      v.objeto.position.set(0, 0.18, 0);
      v.velocidad = 0;
      v.giro = 0;
      for (const p of v.pivotesDelanteros) p.rotation.y = 0;
      v.cuerpo.rotation.set(0, 0, 0);
      angulo = 0.6;
      quietoDesde = 0;
      reloj = 0;
      calcomania = null;
      limpioAvisado = vehiculo.apariencia.manchasVisibles === 0;
      colocarCamara();
      renderer.shadowMap.needsUpdate = true;
    },

    cerrar() {
      quitarLlaves();
      if (vehiculo) escena.remove(vehiculo.objeto);
      vehiculo = null;
      arrastre = null;
      vivas.length = 0;
      particulas.count = 0;
    },

    ponerPestana(nombre) {
      pestana = nombre;
      calcomania = null;
      ponerLlaves();
    },

    // Volver a poner las llaves (por ejemplo, después de un cambio de piezas).
    ponerLlaves,

    elegirCalcomania(emoji) {
      calcomania = emoji;
    },

    pintar(color) {
      vehiculo.apariencia.pintar(color);
      // Nube de pintura alrededor del vehículo.
      const r = vehiculo.tipo === 'moto' ? 1.2 : 2.4;
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const pos = new THREE.Vector3(Math.cos(a) * r * 1.6, 0.4 + Math.random() * 1.4, Math.sin(a) * r * 1.6);
        const vel = pos.clone().multiplyScalar(-0.55).setY((Math.random() - 0.3) * 0.4);
        soltar(pos, vel, color, 0.05 + Math.random() * 0.06, 0.9 + Math.random() * 0.4);
      }
    },

    // Eventos de puntero del lienzo (solo cuando el taller está abierto).
    alBajar, alMover, alSubir,

    actualizar(dt) {
      if (!vehiculo) return;
      reloj += dt;
      // La plataforma gira sola si nadie la mueve.
      if (!arrastre && reloj - quietoDesde > 1.5) angulo += dt * 0.25;
      plataforma.rotation.y = angulo;
      vehiculo.objeto.rotation.y = angulo;
      vehiculo.apariencia.actualizar(dt);
      vehiculo.reloj += dt;
      vehiculo.animarHumo(dt);
      vehiculo.animarLuces(dt);
      renderer.shadowMap.needsUpdate = true;

      // Llaves: flotan sobre lo dañado; al tocarlas giran, suenan y lo reparan.
      for (let i = llaves.length - 1; i >= 0; i--) {
        const l = llaves[i];
        const pos = l.pendiente.posicion();
        const sube = vehiculo.tipo === 'moto' ? 0.35 : 0.5;
        l.sprite.position.set(pos.x, pos.y + sube + Math.sin(reloj * 3 + i) * 0.08, pos.z);
        let tam = vehiculo.tipo === 'moto' ? 0.5 : 0.75;
        if (l.girando >= 0) {
          l.girando += dt;
          l.sprite.material.rotation = l.girando * 14;
          tam *= 1 + Math.sin(l.girando * 12) * 0.25;
          if (l.girando > 0.35 && !l.segundoClanc) { l.segundoClanc = true; ui.sonidoClanc(); }
          if (l.girando > 0.75) {
            vehiculo.apariencia.reparar(l.pendiente);
            for (let k = 0; k < 14; k++) {
              soltar(pos, new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2), 0xffd60a, 0.04, 0.7);
            }
            escena.remove(l.sprite);
            llaves.splice(i, 1);
            if (llaves.length === 0) {
              ui.festejoChico();
              ui.decir('¡Quedó como nuevo!');
              tiempoBrillo = 1.6;
            }
            continue;
          }
        }
        l.sprite.scale.set(tam, tam, tam);
      }

      // Partículas.
      for (let i = vivas.length - 1; i >= 0; i--) {
        const p = vivas[i];
        p.vida -= dt;
        if (p.vida <= 0) { vivas.splice(i, 1); continue; }
        p.pos.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - dt * 0.8);
      }
      particulas.count = vivas.length;
      vivas.forEach((p, i) => {
        quieto.position.copy(p.pos);
        quieto.scale.setScalar(p.tam * Math.min(1, p.vida / p.total * 2.5));
        quieto.updateMatrix();
        particulas.setMatrixAt(i, quieto.matrix);
        particulas.setColorAt(i, colorP.copy(p.color));
      });
      particulas.instanceMatrix.needsUpdate = true;
      if (particulas.instanceColor) particulas.instanceColor.needsUpdate = true;

      // Brillito cuando queda limpio.
      if (tiempoBrillo > 0) {
        tiempoBrillo -= dt;
        brillo.visible = true;
        const s = Math.sin((1.6 - tiempoBrillo) / 1.6 * Math.PI) * 1.6;
        brillo.scale.set(s, s, s);
        brillo.position.set(Math.sin(reloj * 3) * 1.2, 1.6, Math.cos(reloj * 3) * 1.2);
      } else {
        brillo.visible = false;
      }
    },

    ajustar,
  };
}

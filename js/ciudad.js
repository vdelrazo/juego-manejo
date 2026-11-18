// La ciudad: calles en cuadrícula, edificios de colores, banquetas, pasos de cebra
// y un parque con fuente en el centro. La orilla está cerrada por edificios.
//
// Para que el iPad vaya ligero, los edificios no son objetos sueltos: todas sus caras
// se juntan en unas pocas geometrías grandes (ver Juntador).

import * as THREE from '../vendor/three/three.module.js';
import { Obstaculos } from './choques.js';

const N = 5;                                  // manzanas por lado
const ANCHO_CALLE = 12;
const MANZANA = 36;                           // incluye la banqueta
const BANQUETA = 3;
const PASO = MANZANA + ANCHO_CALLE;           // de una calle a la siguiente
const BORDE = (N * PASO + ANCHO_CALLE) / 2;   // del centro a la orilla de la última calle
const LIMITE = BORDE + BANQUETA;              // aquí empiezan los edificios de la orilla
const ALTO_BANQUETA = 0.15;
const ALTO_PISO = 3;

const CIELO = 0x9fd8ff;
const DESDE_EL_SOL = new THREE.Vector3(30, 55, 20);

// Los colores del reto del paquete ("lleva el paquete a la casa azul").
// No hay turquesa en la ciudad para que no se confunda con el azul.
export const COLORES_CASA = [
  { nombre: 'azul', hex: 0x4ea8de },
  { nombre: 'roja', hex: 0xef476f },
  { nombre: 'amarilla', hex: 0xffd166 },
  { nombre: 'verde', hex: 0x06d6a0 },
];
const COLORES = [
  ...COLORES_CASA.map((c) => c.hex),
  0xf78c6b, // naranja
  0xb388eb, // morado
  0xff99c8, // rosa
  0xf4f1de, // crema
];

// Centros de las calles y de las manzanas, a lo largo de un eje.
const CALLES = Array.from({ length: N + 1 }, (_, i) => -BORDE + ANCHO_CALLE / 2 + i * PASO);
const MANZANAS = Array.from({ length: N }, (_, i) => CALLES[i] + PASO / 2);

// El estacionamiento ocupa la manzana al este del parque, junto a la calle de salida.
const LOTE = { x: MANZANAS[3], z: MANZANAS[2] };
const ANCHO_CAJON = 5;
const LARGO_CAJON = 7;

const lambertPlano = (hex) => new THREE.MeshLambertMaterial({ color: hex, flatShading: true });

// Números al azar que salen siempre iguales: la ciudad no cambia de una partida a otra.
function azarFijo(semilla) {
  return () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };
}

// Junta muchas caras (rectángulos) de colores en una sola geometría.
class Juntador {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
  }

  // Rectángulo con centro c, medio-ancho u (hacia la derecha) y medio-alto v (hacia arriba).
  // Se ve de frente desde el lado al que apunta u × v.
  cara(cx, cy, cz, ux, uy, uz, vx, vy, vz, color) {
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const largo = Math.hypot(nx, ny, nz) || 1;
    nx /= largo; ny /= largo; nz /= largo;
    const i = this.pos.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      this.pos.push(cx + su * ux + sv * vx, cy + su * uy + sv * vy, cz + su * uz + sv * vz);
      this.nor.push(nx, ny, nz);
      this.col.push(color.r, color.g, color.b);
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  caja(x0, y0, z0, x1, y1, z1, color, conPiso = false) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, hz = (z1 - z0) / 2;
    this.cara(x1, cy, cz, 0, 0, -hz, 0, hy, 0, color);
    this.cara(x0, cy, cz, 0, 0, hz, 0, hy, 0, color);
    this.cara(cx, cy, z1, hx, 0, 0, 0, hy, 0, color);
    this.cara(cx, cy, z0, -hx, 0, 0, 0, hy, 0, color);
    this.cara(cx, y1, cz, hx, 0, 0, 0, 0, -hz, color);
    if (conPiso) this.cara(cx, y0, cz, hx, 0, 0, 0, 0, hz, color);
  }

  malla(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

export function crearCiudad(escena) {
  const azar = azarFijo(20261117);
  const entre = (a, b) => a + azar() * (b - a);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  const obstaculos = new Obstaculos();
  const color = (hex) => new THREE.Color(hex);

  escena.background = new THREE.Color(CIELO);
  escena.fog = new THREE.Fog(CIELO, 110, 280);

  // ---------- Luz ----------
  escena.add(new THREE.HemisphereLight(0xe8f6ff, 0x8a8f99, 1.6));
  const sol = new THREE.DirectionalLight(0xfff2d9, 2.1);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 5, far: 180 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.05;
  escena.add(sol, sol.target);

  // ---------- Piso: pasto lejano y asfalto ----------
  const pasto = new THREE.Mesh(new THREE.CircleGeometry(700, 48), new THREE.MeshLambertMaterial({ color: 0x7ccf5a }));
  pasto.rotation.x = -Math.PI / 2;
  pasto.position.y = -0.05;
  escena.add(pasto);

  const asfalto = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * LIMITE + 60, 2 * LIMITE + 60),
    new THREE.MeshLambertMaterial({ color: 0x5c6370 }),
  );
  asfalto.rotation.x = -Math.PI / 2;
  asfalto.receiveShadow = true;
  escena.add(asfalto);

  // ---------- Banquetas y parque (no proyectan sombra, solo la reciben) ----------
  const suelo = new Juntador();
  const GRIS_BANQUETA = color(0xd3d6db);
  const VERDE_PARQUE = color(0x74c95a);
  for (const bx of MANZANAS) {
    for (const bz of MANZANAS) {
      suelo.caja(bx - MANZANA / 2, 0, bz - MANZANA / 2, bx + MANZANA / 2, ALTO_BANQUETA, bz + MANZANA / 2, GRIS_BANQUETA);
    }
  }
  // Pasto del parque, en la manzana del centro.
  const lp = MANZANA / 2 - BANQUETA;
  suelo.caja(-lp, ALTO_BANQUETA, -lp, lp, ALTO_BANQUETA + 0.03, lp, VERDE_PARQUE);
  // Banqueta de la orilla, por debajo de los edificios de afuera.
  const F = LIMITE + 40;
  suelo.caja(-F, 0, BORDE, F, ALTO_BANQUETA, F, GRIS_BANQUETA);
  suelo.caja(-F, 0, -F, F, ALTO_BANQUETA, -BORDE, GRIS_BANQUETA);
  suelo.caja(BORDE, 0, -BORDE, F, ALTO_BANQUETA, BORDE, GRIS_BANQUETA);
  suelo.caja(-F, 0, -BORDE, -BORDE, ALTO_BANQUETA, BORDE, GRIS_BANQUETA);
  const mallaSuelo = suelo.malla(new THREE.MeshLambertMaterial({ vertexColors: true }));
  mallaSuelo.receiveShadow = true;
  escena.add(mallaSuelo);

  // ---------- Rayas del centro y pasos de cebra ----------
  const rayas = [];   // [x, z, ancho en x, largo en z]
  for (const c of CALLES) {
    for (const b of MANZANAS) {
      // Calle que corre a lo largo de z (x = c) y calle que corre a lo largo de x (z = c).
      for (let k = -2; k <= 2; k++) {
        rayas.push([c, b + k * 5, 0.3, 2.4]);
        rayas.push([b + k * 5, c, 2.4, 0.3]);
      }
      for (const lado of [-1, 1]) {
        const d = lado * (MANZANA / 2 - 2);
        for (let s = -5; s <= 5; s += 2) {
          rayas.push([c + s, b + d, 1.0, 3]);
          rayas.push([b + d, c + s, 3, 1.0]);
        }
      }
    }
  }
  const mallaRayas = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.02, 1),
    new THREE.MeshLambertMaterial({ color: 0xf8f9fa }),
    rayas.length,
  );
  const quieto = new THREE.Object3D();
  rayas.forEach(([x, z, ax, lz], i) => {
    quieto.position.set(x, 0.012, z);
    quieto.rotation.set(0, 0, 0);
    quieto.scale.set(ax, 1, lz);
    quieto.updateMatrix();
    mallaRayas.setMatrixAt(i, quieto.matrix);
  });
  mallaRayas.receiveShadow = true;
  escena.add(mallaRayas);

  // ---------- Edificios ----------
  const paredes = new Juntador();   // proyectan sombra
  const vidrios = new Juntador();   // ventanas y puertas: no proyectan sombra
  const VIDRIO = [color(0xbde0fe), color(0xa2d2ff), color(0x8ecae6)];
  const PUERTA = color(0x6b4f3f);
  const TINACO = color(0x9aa0a6);

  // Edificios con puerta: para el reto del paquete.
  const edificios = [];

  // caraPuerta: 'x+', 'x-', 'z+' o 'z-'. conVentanas: qué caras llevan ventanas.
  function edificio(x0, z0, x1, z1, pisos, hex, caraPuerta, conVentanas = ['x+', 'x-', 'z+', 'z-'], choca = true) {
    const pared = color(hex).offsetHSL(0, 0, entre(-0.04, 0.04));
    const alto = pisos * ALTO_PISO + 0.8;
    paredes.caja(x0, 0, z0, x1, alto, z1, pared);
    const techo = pared.clone().multiplyScalar(0.78);
    paredes.caja(x0 - 0.3, alto, z0 - 0.3, x1 + 0.3, alto + 0.45, z1 + 0.3, techo);
    if (azar() < 0.6) {
      const tx = entre(x0 + 2, x1 - 4);
      const tz = entre(z0 + 2, z1 - 4);
      paredes.caja(tx, alto + 0.45, tz, tx + 2, alto + 2, tz + 2, TINACO);
    }
    if (choca) obstaculos.caja(x0, z0, x1, z1);

    const caras = {
      'x+': { plano: x1, desde: z0, hasta: z1, eje: 'x', signo: 1 },
      'x-': { plano: x0, desde: z0, hasta: z1, eje: 'x', signo: -1 },
      'z+': { plano: z1, desde: x0, hasta: x1, eje: 'z', signo: 1 },
      'z-': { plano: z0, desde: x0, hasta: x1, eje: 'z', signo: -1 },
    };
    const vidrio = elegir(VIDRIO);
    for (const nombre of conVentanas) {
      const c = caras[nombre];
      const ancho = c.hasta - c.desde;
      const columnas = Math.max(1, Math.floor(ancho / 3.2));
      const paso = ancho / columnas;
      const columnaPuerta = nombre === caraPuerta ? Math.floor(columnas / 2) : -1;
      // Vector "derecha" de la cara, visto desde afuera.
      const [ux, uz] = c.eje === 'x' ? [0, -c.signo] : [c.signo, 0];
      const fuera = c.plano + c.signo * 0.04;
      for (let col = 0; col < columnas; col++) {
        const t = c.desde + paso * (col + 0.5);
        const [px, pz] = c.eje === 'x' ? [fuera, t] : [t, fuera];
        for (let p = 0; p < pisos; p++) {
          if (p === 0 && col === columnaPuerta) {
            vidrios.cara(px, 1.3, pz, ux * 0.9, 0, uz * 0.9, 0, 1.3, 0, PUERTA);
            continue;
          }
          vidrios.cara(px, p * ALTO_PISO + 1.75, pz, ux * 0.7, 0, uz * 0.7, 0, 0.75, 0, vidrio);
        }
      }
      // Toldo de color sobre la puerta.
      if (columnaPuerta >= 0) {
        const t = c.desde + paso * (columnaPuerta + 0.5);
        const [nx, nz] = c.eje === 'x' ? [c.signo, 0] : [0, c.signo];
        const [px, pz] = c.eje === 'x' ? [c.plano, t] : [t, c.plano];
        edificios.push({ hex, puerta: { x: px, z: pz, nx, nz } });
        const toldo = color(elegir(COLORES));
        const sale = c.signo * 1.1;
        if (c.eje === 'x') paredes.caja(Math.min(c.plano, c.plano + sale), 2.75, t - 1.4, Math.max(c.plano, c.plano + sale), 3.0, t + 1.4, toldo, true);
        else paredes.caja(t - 1.4, 2.75, Math.min(c.plano, c.plano + sale), t + 1.4, 3.0, Math.max(c.plano, c.plano + sale), toldo, true);
      }
    }
  }

  const L = MANZANA / 2 - BANQUETA;   // medio-lado del terreno de cada manzana
  let iColor = 0;
  const siguienteColor = () => COLORES[(iColor++ + Math.floor(azar() * 3)) % COLORES.length];

  for (const bx of MANZANAS) {
    for (const bz of MANZANAS) {
      if (bx === 0 && bz === 0) continue;   // el parque
      if (bx === LOTE.x && bz === LOTE.z) continue;   // el estacionamiento
      const tipo = elegir(['cuatro', 'cuatro', 'dos', 'uno']);
      if (tipo === 'cuatro') {
        // Cuatro edificios pegados a las esquinas; entre ellos queda un pasillo
        // de menos de 1.1 m: ni la moto cabe.
        for (const qx of [-1, 1]) {
          for (const qz of [-1, 1]) {
            const w = entre(14.45, 14.9);
            const d = entre(14.45, 14.9);
            const x0 = qx > 0 ? bx + L - w : bx - L;
            const z0 = qz > 0 ? bz + L - d : bz - L;
            const puerta = azar() < 0.5 ? (qx > 0 ? 'x+' : 'x-') : (qz > 0 ? 'z+' : 'z-');
            edificio(x0, z0, x0 + w, z0 + d, 2 + Math.floor(azar() * 4), siguienteColor(), puerta);
          }
        }
      } else if (tipo === 'dos') {
        const aLoLargoDeX = azar() < 0.5;
        for (const q of [-1, 1]) {
          const d = entre(14.45, 14.9);
          const pisos = 3 + Math.floor(azar() * 4);
          if (aLoLargoDeX) {
            const z0 = q > 0 ? bz + L - d : bz - L;
            edificio(bx - L, z0, bx + L, z0 + d, pisos, siguienteColor(), q > 0 ? 'z+' : 'z-');
          } else {
            const x0 = q > 0 ? bx + L - d : bx - L;
            edificio(x0, bz - L, x0 + d, bz + L, pisos, siguienteColor(), q > 0 ? 'x+' : 'x-');
          }
        }
      } else {
        const m = entre(12.5, L);
        edificio(bx - m, bz - m, bx + m, bz + m, 5 + Math.floor(azar() * 4), siguienteColor(), elegir(['x+', 'x-', 'z+', 'z-']));
      }
    }
  }

  // Edificios de la orilla: una fila sin huecos en cada lado. Solo la cara de adentro lleva ventanas.
  function filaDeOrilla(desde, hasta, colocar) {
    let t = desde;
    while (t < hasta) {
      const ancho = Math.min(entre(12, 20), hasta - t);
      colocar(t, t + ancho, entre(16, 22), 3 + Math.floor(azar() * 5), siguienteColor());
      t += ancho;
    }
  }
  const E = LIMITE + 22;
  filaDeOrilla(-E, E, (a, b, fondo, pisos, hex) => edificio(a, LIMITE, b, LIMITE + fondo, pisos, hex, 'z-', ['z-'], false));
  filaDeOrilla(-E, E, (a, b, fondo, pisos, hex) => edificio(a, -LIMITE - fondo, b, -LIMITE, pisos, hex, 'z+', ['z+'], false));
  filaDeOrilla(-LIMITE, LIMITE, (a, b, fondo, pisos, hex) => edificio(LIMITE, a, LIMITE + fondo, b, pisos, hex, 'x-', ['x-'], false));
  filaDeOrilla(-LIMITE, LIMITE, (a, b, fondo, pisos, hex) => edificio(-LIMITE - fondo, a, -LIMITE, b, pisos, hex, 'x+', ['x+'], false));
  // Para chocar, la orilla es una pared continua.
  obstaculos.caja(-E - 30, LIMITE, E + 30, LIMITE + 60);
  obstaculos.caja(-E - 30, -LIMITE - 60, E + 30, -LIMITE);
  obstaculos.caja(LIMITE, -E - 30, LIMITE + 60, E + 30);
  obstaculos.caja(-LIMITE - 60, -E - 30, -LIMITE, E + 30);

  // ---------- Estacionamiento (junto al parque) ----------
  // Dos filas de 6 cajones, una de cada lado de un pasillo ancho que se abre a las dos calles.
  // Atrás de cada fila hay un seto para no pasarse. Algunos cajones tienen carros estacionados.
  const cajones = [];
  {
    const { x: bx, z: bz } = LOTE;
    const piso = ALTO_BANQUETA + 0.025;
    const lote = new Juntador();
    lote.caja(bx - L, ALTO_BANQUETA, bz - L, bx + L, piso, bz + L, color(0x4a4e57));
    const BLANCO = color(0xf8f9fa);
    for (const fila of [1, -1]) {
      const zFondo = bz + fila * L;
      const zFrente = bz + fila * (L - LARGO_CAJON);
      for (let i = 0; i <= 6; i++) {
        const x = bx - L + i * ANCHO_CAJON;
        lote.caja(x - 0.08, piso, Math.min(zFondo, zFrente), x + 0.08, piso + 0.01, Math.max(zFondo, zFrente), BLANCO);
      }
      for (let i = 0; i < 6; i++) {
        const x0 = bx - L + i * ANCHO_CAJON;
        cajones.push({
          x0, x1: x0 + ANCHO_CAJON,
          z0: Math.min(zFondo, zFrente), z1: Math.max(zFondo, zFrente),
          cx: x0 + ANCHO_CAJON / 2, cz: (zFondo + zFrente) / 2,
          ocupado: false,
        });
      }
      // Seto en la banqueta, atrás de la fila.
      const z0 = fila > 0 ? bz + L + 0.2 : bz - L - 1.4;
      paredes.caja(bx - L, ALTO_BANQUETA, z0, bx + L, ALTO_BANQUETA + 1.1, z0 + 1.2, color(0x3a7d44));
      obstaculos.caja(bx - L, z0, bx + L, z0 + 1.2);
    }
    const mallaLote = lote.malla(new THREE.MeshLambertMaterial({ vertexColors: true }));
    mallaLote.receiveShadow = true;
    escena.add(mallaLote);

    // Carros estacionados (cajas juntas, sin ruedas que giren).
    const COLORES_ESTACIONADOS = [0x3a86ff, 0xffbe0b, 0x8ac926, 0x9b5de5, 0xf15bb5];
    const VIDRIO = color(0xa8dadc);
    const LLANTA = color(0x222222);
    [1, 4, 6, 8, 11].forEach((indice, k) => {
      const c = cajones[indice];
      c.ocupado = true;
      const { cx, cz } = c;
      const y = piso;
      const carroceria = color(COLORES_ESTACIONADOS[k]);
      const atras = cz > bz ? 1 : -1;   // el vidrio de atrás queda hacia el seto
      paredes.caja(cx - 0.95, y + 0.45, cz - 1.8, cx + 0.95, y + 1.07, cz + 1.8, carroceria);
      paredes.caja(cx - 0.8, y + 1.07, cz + atras * 0.25 - 0.95, cx + 0.8, y + 1.73, cz + atras * 0.25 + 0.95, VIDRIO);
      paredes.caja(cx - 0.86, y + 1.73, cz + atras * 0.25 - 1.01, cx + 0.86, y + 1.89, cz + atras * 0.25 + 1.01, carroceria);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          paredes.caja(cx + sx * 0.96 - 0.18, y, cz + sz * 1.2 - 0.45, cx + sx * 0.96 + 0.18, y + 0.9, cz + sz * 1.2 + 0.45, LLANTA, true);
        }
      }
      obstaculos.caja(cx - 1.05, cz - 1.95, cx + 1.05, cz + 1.95);
    });

    // Letrero de "P" en la esquina, viendo hacia la calle.
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 128;
    const g = lienzo.getContext('2d');
    g.fillStyle = '#1d4ed8';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffffff';
    g.font = 'bold 104px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('P', 64, 70);
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;
    const conP = new THREE.MeshLambertMaterial({ map: textura });
    const azul = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
    const letrero = new THREE.Group();
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), lambertPlano(0x9aa0a6));
    poste.position.y = 1.5;
    const placa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.5), [conP, conP, azul, azul, azul, azul]);
    placa.position.y = 3.3;
    letrero.add(poste, placa);
    letrero.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    letrero.position.set(bx - L - BANQUETA / 2, ALTO_BANQUETA, bz - 9.5);
    escena.add(letrero);
    obstaculos.circulo(letrero.position.x, letrero.position.z, 0.25);
  }

  const mallaParedes = paredes.malla(new THREE.MeshLambertMaterial({ vertexColors: true }));
  mallaParedes.castShadow = true;
  mallaParedes.receiveShadow = true;
  escena.add(mallaParedes);
  const mallaVidrios = vidrios.malla(new THREE.MeshLambertMaterial({ vertexColors: true }));
  mallaVidrios.receiveShadow = true;
  escena.add(mallaVidrios);

  // ---------- Árboles: en algunas banquetas y en el parque ----------
  const arboles = [];   // [x, z, tamaño]
  for (const bx of MANZANAS) {
    for (const bz of MANZANAS) {
      if (bx === 0 && bz === 0) continue;
      if (bx === LOTE.x && bz === LOTE.z) continue;
      const enBanqueta = MANZANA / 2 - BANQUETA / 2;
      for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (azar() < 0.5) continue;
        for (const k of [-9, 0, 9]) {
          const x = bx + (ex ? ex * enBanqueta : k);
          const z = bz + (ez ? ez * enBanqueta : k);
          arboles.push([x, z, 0.75]);
        }
      }
    }
  }
  const enParque = [];
  for (let intento = 0; intento < 400 && enParque.length < 14; intento++) {
    const x = entre(-L + 2, L - 2);
    const z = entre(-L + 2, L - 2);
    if (Math.hypot(x, z) < 7.5) continue;                               // espacio para la fuente
    if (enParque.some(([ax, az]) => Math.hypot(ax - x, az - z) < 5.5)) continue;
    enParque.push([x, z, entre(0.95, 1.3)]);
  }
  arboles.push(...enParque);

  const troncos = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.42, 2.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: true }),
    arboles.length,
  );
  const copas = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.9, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    arboles.length,
  );
  const VERDES = [0x2d6a4f, 0x40916c, 0x52b788, 0x3a7d44];
  const tono = new THREE.Color();
  arboles.forEach(([x, z, s], i) => {
    quieto.position.set(x, ALTO_BANQUETA + 1.2 * s, z);
    quieto.rotation.set(0, azar() * Math.PI, 0);
    quieto.scale.set(s, s, s);
    quieto.updateMatrix();
    troncos.setMatrixAt(i, quieto.matrix);
    quieto.position.y = ALTO_BANQUETA + 3.6 * s;
    quieto.updateMatrix();
    copas.setMatrixAt(i, quieto.matrix);
    copas.setColorAt(i, tono.setHex(elegir(VERDES)));
    obstaculos.circulo(x, z, 0.45 * s);
  });
  for (const m of [troncos, copas]) {
    m.castShadow = true;
    m.computeBoundingSphere();
    escena.add(m);
  }

  // ---------- Fuente del parque ----------
  const piedra = new THREE.MeshLambertMaterial({ color: 0xb8c0c8, flatShading: true });
  const agua = new THREE.MeshLambertMaterial({ color: 0x4cc9f0 });
  const fuente = new THREE.Group();
  const pila = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.8, 16), piedra);
  pila.position.y = ALTO_BANQUETA + 0.4;
  const espejo = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 16), agua);
  espejo.position.y = ALTO_BANQUETA + 0.72;
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 8), piedra);
  columna.position.y = ALTO_BANQUETA + 1.6;
  const plato = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.5, 0.4, 12), piedra);
  plato.position.y = ALTO_BANQUETA + 2.7;
  const chorro = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), agua);
  chorro.position.y = ALTO_BANQUETA + 3.4;
  fuente.add(pila, espejo, columna, plato, chorro);
  fuente.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  escena.add(fuente);
  obstaculos.circulo(0, 0, 3.3);

  // ---------- Nubes ----------
  const N_NUBES = 16;
  const nubes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false }),
    N_NUBES * 3,
  );
  for (let i = 0; i < N_NUBES; i++) {
    const a = azar() * Math.PI * 2;
    const r = 40 + azar() * 150;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const cy = 55 + azar() * 15;
    for (let j = 0; j < 3; j++) {
      const s = 3.5 + azar() * 2.5;
      quieto.position.set(cx + (j - 1) * 5, cy + azar() * 1.5, cz + azar() * 2);
      quieto.rotation.set(azar(), azar(), azar());
      quieto.scale.set(s * 1.3, s * 0.8, s);
      quieto.updateMatrix();
      nubes.setMatrixAt(i * 3 + j, quieto.matrix);
    }
  }
  nubes.computeBoundingSphere();
  escena.add(nubes);

  // Puntos sobre las calles (a la mitad de cada cuadra y en los cruces): ahí van las estrellas.
  const puntosCalle = [];
  for (const c of CALLES) {
    for (const b of MANZANAS) puntosCalle.push([c, b], [b, c]);
    for (const c2 of CALLES) puntosCalle.push([c, c2]);
  }

  return {
    obstaculos,
    edificios,
    puntosCalle,
    cajones,

    // El cajón libre donde está el vehículo (sus dos círculos adentro), o null.
    cajonDe(vehiculo) {
      const { posicion: p, adelante: a, distanciaCirculos: d } = vehiculo;
      for (const c of cajones) {
        if (c.ocupado) continue;
        let dentro = true;
        for (const lado of [1, -1]) {
          const x = p.x + a.x * d * lado;
          const z = p.z + a.z * d * lado;
          if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) dentro = false;
        }
        if (dentro) return c;
      }
      return null;
    },

    // Se empieza en el carril derecho de una calle, junto al parque, viendo hacia +z.
    salida: { x: CALLES[3] - 3, z: MANZANAS[1], rumbo: 0 },

    // Altura del piso: arriba de la banqueta o en la calle.
    alturaSuelo(x, z) {
      if (Math.abs(x) > BORDE || Math.abs(z) > BORDE) return ALTO_BANQUETA;
      const ux = (((x + BORDE) % PASO) + PASO) % PASO;
      const uz = (((z + BORDE) % PASO) + PASO) % PASO;
      return ux >= ANCHO_CALLE && uz >= ANCHO_CALLE ? ALTO_BANQUETA : 0;
    },

    // La sombra solo se calcula cerca del vehículo; el sol lo sigue.
    seguir(posicion) {
      sol.position.copy(posicion).add(DESDE_EL_SOL);
      sol.target.position.copy(posicion);
    },
  };
}

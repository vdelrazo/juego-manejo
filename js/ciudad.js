// La ciudad: calles en cuadrícula, edificios de colores con ventanas, cornisas y tinacos,
// banquetas, pasos de cebra, postes de luz, árboles, un parque con fuente y un estacionamiento.
// La orilla está cerrada por edificios.
//
// Para que el iPad vaya ligero, los edificios no son objetos sueltos: sus caras se juntan
// en pocas geometrías grandes (Juntador), y lo que se repite (árboles, postes) se dibuja
// con copias (InstancedMesh).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Obstaculos } from './choques.js';
import * as tex from './texturas.js';
import { crearCarro, ESTILOS_RIN } from './modelos.js';
import { SOL } from './graficos.js';

const N = 5;                                  // manzanas por lado
const ANCHO_CALLE = 12;
const MANZANA = 36;                           // incluye la banqueta
const BANQUETA = 3;
const PASO = MANZANA + ANCHO_CALLE;           // de una calle a la siguiente
const BORDE = (N * PASO + ANCHO_CALLE) / 2;   // del centro a la orilla de la última calle
const LIMITE = BORDE + BANQUETA;              // aquí empiezan los edificios de la orilla
const ALTO_BANQUETA = 0.15;
const ALTO_PISO = 3;

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

// Números al azar que salen siempre iguales: la ciudad no cambia de una partida a otra.
function azarFijo(semilla) {
  return () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };
}

// Junta muchas caras (rectángulos) de colores en una sola geometría.
// Las coordenadas de textura salen del mundo (cada "escala" metros se repite la textura),
// salvo que se den a mano (para las ventanas, que usan un atlas).
class Juntador {
  constructor(escala = 1) {
    this.escala = escala;
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.uv = [];
    this.idx = [];
  }

  // Rectángulo con centro c, medio-ancho u (hacia la derecha) y medio-alto v (hacia arriba).
  // Se ve de frente desde el lado al que apunta u × v.
  // op.abajo / op.arriba: oscurecer el borde de abajo o de arriba (sombra de contacto).
  cara(cx, cy, cz, ux, uy, uz, vx, vy, vz, color, op = {}) {
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const largo = Math.hypot(nx, ny, nz) || 1;
    nx /= largo; ny /= largo; nz /= largo;
    const i = this.pos.length / 3;
    const abajo = op.abajo ?? 1;
    const arriba = op.arriba ?? 1;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = cx + su * ux + sv * vx;
      const y = cy + su * uy + sv * vy;
      const z = cz + su * uz + sv * vz;
      this.pos.push(x, y, z);
      this.nor.push(nx, ny, nz);
      const k = sv < 0 ? abajo : arriba;
      this.col.push(color.r * k, color.g * k, color.b * k);
      if (op.uv) {
        const [u0, v0, u1, v1] = op.uv;
        this.uv.push(su < 0 ? u0 : u1, sv < 0 ? v0 : v1);
      } else if (Math.abs(ny) > 0.5) {
        this.uv.push(x / this.escala, z / this.escala);
      } else if (Math.abs(nx) > 0.5) {
        this.uv.push(z / this.escala, y / this.escala);
      } else {
        this.uv.push(x / this.escala, y / this.escala);
      }
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  // op.conPiso: también la cara de abajo. op.lados: color de los lados (si es otro).
  // op.sombraBase: oscurece la parte baja de las paredes (como sombra de contacto con el piso).
  // op.sinTecho: sin la cara de arriba (cuando otra pieza la tapa).
  caja(x0, y0, z0, x1, y1, z1, color, op = {}) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const lados = op.lados ?? color;
    const verticales = (ya, yb, opc) => {
      const cy = (ya + yb) / 2, hy = (yb - ya) / 2;
      this.cara(x1, cy, cz, 0, 0, -hz, 0, hy, 0, lados, opc);
      this.cara(x0, cy, cz, 0, 0, hz, 0, hy, 0, lados, opc);
      this.cara(cx, cy, z1, hx, 0, 0, 0, hy, 0, lados, opc);
      this.cara(cx, cy, z0, -hx, 0, 0, 0, hy, 0, lados, opc);
    };
    if (op.sombraBase && y1 - y0 > 3) {
      verticales(y0, y0 + 2.6, { abajo: op.sombraBase });
      verticales(y0 + 2.6, y1, {});
    } else {
      verticales(y0, y1, op.sombraBase ? { abajo: op.sombraBase } : {});
    }
    if (!op.sinTecho) this.cara(cx, y1, cz, hx, 0, 0, 0, 0, -hz, color);
    if (op.conPiso) this.cara(cx, y0, cz, hx, 0, 0, 0, 0, hz, color);
  }

  malla(material, { sombra = false } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.castShadow = sombra;
    m.receiveShadow = true;
    return m;
  }
}

// Esfera con los vértices unidos: la luz se reparte suave y no se ven caras planas.
function esferaSuave(detalle) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detalle).deleteAttribute('normal').deleteAttribute('uv'));
  g.computeVertexNormals();
  return g;
}

// Junta las piezas de un objeto quieto (por ejemplo, un carro estacionado) por material:
// muchas piezas se dibujan como pocas, y el iPad trabaja menos.
function juntarPorMaterial(objeto) {
  objeto.updateMatrixWorld(true);
  const grupos = new Map();
  objeto.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const nombre of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(nombre)) g.deleteAttribute(nombre);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(o.matrixWorld);
    if (!grupos.has(o.material)) grupos.set(o.material, { geos: [], sombra: o.castShadow, transparente: o.material.transparent });
    grupos.get(o.material).geos.push(g);
  });
  const resultado = new THREE.Group();
  for (const [material, { geos, sombra }] of grupos) {
    const m = new THREE.Mesh(mergeGeometries(geos), material);
    m.castShadow = sombra && !material.transparent;
    m.receiveShadow = !material.transparent;
    if (material.transparent) m.renderOrder = 1;
    resultado.add(m);
  }
  return resultado;
}

export function crearCiudad(escena) {
  const azar = azarFijo(20261117);          // dónde va cada cosa (no cambiar el orden de uso)
  const azarDetalle = azarFijo(777);        // detalles (ventanas, cornisas, tinacos…)
  const entre = (a, b) => a + azar() * (b - a);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  const detalle = (lista) => lista[Math.floor(azarDetalle() * lista.length)];
  const obstaculos = new Obstaculos();
  const color = (hex) => new THREE.Color(hex);
  const quieto = new THREE.Object3D();
  const animaciones = [];

  // ---------- Texturas y materiales ----------
  const texAsfalto = tex.asfalto();
  const texBanqueta = tex.banqueta();
  const texPasto = tex.pasto();
  const texEstuco = tex.estuco();
  const texLadrillo = tex.ladrillo();
  const texRayas = tex.rayas();
  const atlas = tex.ventanas();

  const matParedEstuco = new THREE.MeshStandardMaterial({ vertexColors: true, map: texEstuco, roughness: 0.9 });
  const matParedLadrillo = new THREE.MeshStandardMaterial({ vertexColors: true, map: texLadrillo, roughness: 0.92 });
  const matDetalle = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const matVidrio = new THREE.MeshStandardMaterial({
    map: atlas.mapa, roughnessMap: atlas.brillo, roughness: 1, metalness: 0.08, envMapIntensity: 1.4,
  });
  const matToldo = new THREE.MeshStandardMaterial({ vertexColors: true, map: texRayas, roughness: 0.8, side: THREE.DoubleSide });
  const matBanqueta = new THREE.MeshStandardMaterial({ vertexColors: true, map: texBanqueta, roughness: 0.92 });
  const matPasto = new THREE.MeshStandardMaterial({ vertexColors: true, map: texPasto, roughness: 0.95 });

  // ---------- Sol ----------
  escena.add(new THREE.HemisphereLight(0xdcefff, 0x8d8a80, 0.55));
  const sol = new THREE.DirectionalLight(0xfff0d6, 2.8);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 5, far: 220 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.04;
  sol.shadow.radius = 3;
  escena.add(sol, sol.target);
  const DESDE_EL_SOL = SOL.clone().multiplyScalar(90);

  // ---------- Piso: pasto lejano y asfalto ----------
  const pastoLejano = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshStandardMaterial({ color: 0x86c76a, roughness: 1 }));
  pastoLejano.rotation.x = -Math.PI / 2;
  pastoLejano.position.y = -0.05;
  escena.add(pastoLejano);

  const tamAsfalto = 2 * LIMITE + 60;
  texAsfalto.repeat.set(tamAsfalto / 9, tamAsfalto / 9);
  const asfalto = new THREE.Mesh(
    new THREE.PlaneGeometry(tamAsfalto, tamAsfalto),
    new THREE.MeshStandardMaterial({ map: texAsfalto, roughness: 0.93 }),
  );
  asfalto.rotation.x = -Math.PI / 2;
  asfalto.receiveShadow = true;
  escena.add(asfalto);

  // ---------- Banquetas, parque y estacionamiento ----------
  const suelo = new Juntador(4);   // losetas de 1 m (la textura tiene 4 × 4)
  const cesped = new Juntador(6);
  const BLANCO_BANQUETA = color(0xffffff);
  const GUARNICION = color(0xc9ccd2);
  for (const bx of MANZANAS) {
    for (const bz of MANZANAS) {
      suelo.caja(bx - MANZANA / 2, 0, bz - MANZANA / 2, bx + MANZANA / 2, ALTO_BANQUETA, bz + MANZANA / 2, BLANCO_BANQUETA, { lados: GUARNICION });
    }
  }
  const F = LIMITE + 40;
  suelo.caja(-F, 0, BORDE, F, ALTO_BANQUETA, F, BLANCO_BANQUETA, { lados: GUARNICION });
  suelo.caja(-F, 0, -F, F, ALTO_BANQUETA, -BORDE, BLANCO_BANQUETA, { lados: GUARNICION });
  suelo.caja(BORDE, 0, -BORDE, F, ALTO_BANQUETA, BORDE, BLANCO_BANQUETA, { lados: GUARNICION });
  suelo.caja(-F, 0, -BORDE, -BORDE, ALTO_BANQUETA, BORDE, BLANCO_BANQUETA, { lados: GUARNICION });

  // Parque: pasto, una glorieta de losetas alrededor de la fuente y cuatro andadores.
  const L = MANZANA / 2 - BANQUETA;   // medio-lado del terreno de cada manzana
  const yPasto = ALTO_BANQUETA + 0.03;
  cesped.caja(-L, ALTO_BANQUETA, -L, L, yPasto, L, color(0xffffff));
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const largoX = ax ? L : 1.6, largoZ = az ? L : 1.6;
    suelo.caja(-largoX, yPasto, -largoZ, largoX, yPasto + 0.01, largoZ, color(0xf1ece2));
  }
  const glorieta = new THREE.Mesh(
    new THREE.RingGeometry(3.6, 6.2, 48),
    new THREE.MeshStandardMaterial({ color: 0xf1ece2, map: texBanqueta, roughness: 0.9 }),
  );
  glorieta.rotation.x = -Math.PI / 2;
  glorieta.position.y = yPasto + 0.02;
  glorieta.receiveShadow = true;
  escena.add(glorieta);

  // ---------- Rayas del centro y pasos de cebra ----------
  const rayas = [];   // [x, z, ancho en x, largo en z]
  for (const c of CALLES) {
    for (const b of MANZANAS) {
      for (let k = -2; k <= 2; k++) {
        rayas.push([c, b + k * 5, 0.25, 2.4]);
        rayas.push([b + k * 5, c, 2.4, 0.25]);
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
    new THREE.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.7 }),
    rayas.length,
  );
  rayas.forEach(([x, z, ax, lz], i) => {
    quieto.position.set(x, 0.012, z);
    quieto.rotation.set(0, 0, 0);
    quieto.scale.set(ax, 1, lz);
    quieto.updateMatrix();
    mallaRayas.setMatrixAt(i, quieto.matrix);
  });
  mallaRayas.receiveShadow = true;
  escena.add(mallaRayas);

  // Coladeras.
  const coladeras = [];
  for (const c of CALLES) for (const b of MANZANAS) if (azarDetalle() < 0.35) coladeras.push([c + 3.2, b + 9]);
  const mallaColaderas = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.03, 20),
    new THREE.MeshStandardMaterial({ color: 0x3d4148, metalness: 0.6, roughness: 0.5 }),
    coladeras.length,
  );
  coladeras.forEach(([x, z], i) => {
    quieto.position.set(x, 0.012, z);
    quieto.scale.set(1, 1, 1);
    quieto.updateMatrix();
    mallaColaderas.setMatrixAt(i, quieto.matrix);
  });
  mallaColaderas.receiveShadow = true;
  escena.add(mallaColaderas);

  // ---------- Edificios ----------
  // La ciudad se arma en trozos de 96 m: lo que queda fuera de la vista no se dibuja.
  const TROZO = 96;
  const trozos = new Map();
  const trozo = (x, z) => {
    const clave = Math.floor((x + 1000) / TROZO) + ':' + Math.floor((z + 1000) / TROZO);
    if (!trozos.has(clave)) {
      trozos.set(clave, { estuco: new Juntador(4), ladrillo: new Juntador(3), detalles: new Juntador(), vidrios: new Juntador(), toldos: new Juntador() });
    }
    return trozos.get(clave);
  };
  const tinacos = [];          // [x, y, z]
  const GRIS_AZOTEA = color(0x8f939a);
  const AIRE = color(0xd9dde3);

  // Edificios con puerta: para el reto del paquete.
  const edificios = [];

  // caraPuerta: 'x+', 'x-', 'z+' o 'z-'. conVentanas: qué caras llevan ventanas.
  function edificio(x0, z0, x1, z1, pisos, hex, caraPuerta, conVentanas = ['x+', 'x-', 'z+', 'z-'], choca = true) {
    const { estuco: paredesEstuco, ladrillo: paredesLadrillo, detalles, vidrios, toldos } = trozo((x0 + x1) / 2, (z0 + z1) / 2);
    const pared = color(hex).offsetHSL(0, 0, entre(-0.04, 0.04));
    const alto = pisos * ALTO_PISO + 0.8;
    const ladrillo = azarDetalle() < 0.3;
    (ladrillo ? paredesLadrillo : paredesEstuco).caja(x0, 0, z0, x1, alto, z1, pared, { sombraBase: 0.62, sinTecho: true });
    if (choca) obstaculos.caja(x0, z0, x1, z1);

    // Zoclo, cornisas entre pisos y pretil de la azotea.
    const claro = pared.clone().offsetHSL(0, -0.05, 0.1);
    const oscuro = pared.clone().multiplyScalar(0.72);
    const marco = (y, alto2, sale, c) => detalles.caja(x0 - sale, y, z0 - sale, x1 + sale, y + alto2, z1 + sale, c, { conPiso: true });
    marco(0, 0.75, 0.06, oscuro);
    for (let p = 1; p < pisos; p++) marco(p * ALTO_PISO - 0.08, 0.16, 0.1, claro);
    marco(alto - 0.25, 0.3, 0.16, claro);
    const pretil = 0.3;
    detalles.caja(x0 - 0.16, alto, z0 - 0.16, x1 + 0.16, alto + 0.6, z0 - 0.16 + pretil, claro);
    detalles.caja(x0 - 0.16, alto, z1 + 0.16 - pretil, x1 + 0.16, alto + 0.6, z1 + 0.16, claro);
    detalles.caja(x0 - 0.16, alto, z0 - 0.16, x0 - 0.16 + pretil, alto + 0.6, z1 + 0.16, claro);
    detalles.caja(x1 + 0.16 - pretil, alto, z0 - 0.16, x1 + 0.16, alto + 0.6, z1 + 0.16, claro);
    detalles.caja(x0, alto, z0, x1, alto + 0.05, z1, GRIS_AZOTEA);
    // Tinacos negros y aparatos de aire en la azotea.
    const nTinacos = 1 + Math.floor(azarDetalle() * 2);
    for (let k = 0; k < nTinacos; k++) {
      tinacos.push([x0 + 1.5 + azarDetalle() * (x1 - x0 - 3), alto + 0.05, z0 + 1.5 + azarDetalle() * (z1 - z0 - 3)]);
    }
    if (azarDetalle() < 0.7) {
      const ax = x0 + 1.5 + azarDetalle() * (x1 - x0 - 4);
      const az = z0 + 1.5 + azarDetalle() * (z1 - z0 - 4);
      detalles.caja(ax, alto + 0.05, az, ax + 1.6, alto + 1.0, az + 1.1, AIRE);
    }

    const caras = {
      'x+': { plano: x1, desde: z0, hasta: z1, eje: 'x', signo: 1 },
      'x-': { plano: x0, desde: z0, hasta: z1, eje: 'x', signo: -1 },
      'z+': { plano: z1, desde: x0, hasta: x1, eje: 'z', signo: 1 },
      'z-': { plano: z0, desde: x0, hasta: x1, eje: 'z', signo: -1 },
    };
    const tiposVentana = [0, 0, 0, 1, 2, 3, 4, 5];
    const conBalcones = pisos >= 5 && azarDetalle() < 0.6;
    for (const nombre of conVentanas) {
      const c = caras[nombre];
      const ancho = c.hasta - c.desde;
      const columnas = Math.max(1, Math.floor(ancho / 3.2));
      const paso = ancho / columnas;
      const conPuerta = nombre === caraPuerta;
      const columnaPuerta = conPuerta ? Math.floor(columnas / 2) : -1;
      // Vector "derecha" de la cara, visto desde afuera, y la normal.
      const [ux, uz] = c.eje === 'x' ? [0, -c.signo] : [c.signo, 0];
      const [nx, nz] = c.eje === 'x' ? [c.signo, 0] : [0, c.signo];
      const enCara = (t, sale) => (c.eje === 'x' ? [c.plano + c.signo * sale, t] : [t, c.plano + c.signo * sale]);
      for (let col = 0; col < columnas; col++) {
        const t = c.desde + paso * (col + 0.5);
        for (let p = 0; p < pisos; p++) {
          if (p === 0 && col === columnaPuerta) {
            const [px, pz] = enCara(t, 0.05);
            vidrios.cara(px, 1.4, pz, ux * 0.95, 0, uz * 0.95, 0, 1.25, 0, color(0xffffff), { uv: tex.celdaVentana(6) });
            continue;
          }
          const tipo = p === 0 && conPuerta ? 7 : detalle(tiposVentana);
          const [px, pz] = enCara(t, 0.05);
          const y = p * ALTO_PISO + 1.75;
          vidrios.cara(px, y, pz, ux * 0.72, 0, uz * 0.72, 0, 0.78, 0, color(0xffffff), { uv: tex.celdaVentana(tipo) });
          // Repisa bajo la ventana: solo las caras que se ven (arriba, frente y abajo).
          const a = 0.82, prof = 0.11;
          const [sx, sz] = enCara(t, prof);
          detalles.cara(sx, y - 0.8, sz, ux * a, 0, uz * a, -nx * prof, 0, -nz * prof, claro);
          detalles.cara(sx, y - 0.88, sz, ux * a, 0, uz * a, nx * prof, 0, nz * prof, claro);
          const [fx2, fz2] = enCara(t, 2 * prof);
          detalles.cara(fx2, y - 0.84, fz2, ux * a, 0, uz * a, 0, 0.04, 0, claro);
          // Balcones en algunos edificios altos, en la cara de la puerta.
          if (conBalcones && conPuerta && p >= 1 && col % 2 === 0) {
            const [bx2, bz2] = enCara(t, 0.55);
            const w = 1.1, d = 0.55;
            const hx = Math.abs(ux) * w + Math.abs(nx) * d, hz = Math.abs(uz) * w + Math.abs(nz) * d;
            detalles.caja(bx2 - hx, p * ALTO_PISO, bz2 - hz, bx2 + hx, p * ALTO_PISO + 0.15, bz2 + hz, claro, { conPiso: true });
            const [fx, fz] = enCara(t, 1.05);
            const fhx = Math.abs(ux) * w + Math.abs(nx) * 0.04, fhz = Math.abs(uz) * w + Math.abs(nz) * 0.04;
            detalles.caja(fx - fhx, p * ALTO_PISO + 0.15, fz - fhz, fx + fhx, p * ALTO_PISO + 1.0, fz + fhz, oscuro);
          }
        }
      }
      // Toldo de rayas sobre la puerta (inclinado hacia afuera).
      if (columnaPuerta >= 0) {
        const t = c.desde + paso * (columnaPuerta + 0.5);
        const [px, pz] = enCara(t, 0);
        edificios.push({ hex, puerta: { x: px, z: pz, nx, nz } });
        const colorToldo = color(detalle(COLORES)).offsetHSL(0, 0.05, 0);
        const [cx, cz] = enCara(t, 0.6);
        let [tx, tz] = [ux * 1.6, uz * 1.6];
        const vx = nx * 0.6, vy = -0.25, vz = nz * 0.6;
        if (tz * vx - tx * vz < 0) [tx, tz] = [-tx, -tz];   // que la cara de arriba vea hacia el cielo
        toldos.cara(cx, 3.0, cz, tx, 0, tz, vx, vy, vz, colorToldo, { uv: [0, 0, 1, 1] });
      }
    }
  }

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
    const lote = new Juntador(9);
    lote.caja(bx - L, ALTO_BANQUETA, bz - L, bx + L, piso, bz + L, color(0x4a4e57));
    const BLANCO = color(0xf1f1ee);
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
      // Seto en la banqueta, atrás de la fila (en bolitas, como arbustos).
      const z0 = fila > 0 ? bz + L + 0.2 : bz - L - 1.4;
      trozo(bx, bz).detalles.caja(bx - L, ALTO_BANQUETA, z0, bx + L, ALTO_BANQUETA + 0.9, z0 + 1.2, color(0x3a7d44), { sombraBase: 0.7 });
      obstaculos.caja(bx - L, z0, bx + L, z0 + 1.2);
    }
    const texLote = texAsfalto.clone();
    texLote.repeat.set(1, 1);
    texLote.needsUpdate = true;
    const mallaLote = lote.malla(new THREE.MeshStandardMaterial({ vertexColors: true, map: texLote, roughness: 0.9 }));
    escena.add(mallaLote);

    // Carros estacionados: el mismo modelo que el del jugador, todos juntados para que pesen poco.
    const estacionados = new THREE.Group();
    const COLORES_ESTACIONADOS = [0x3a86ff, 0xffbe0b, 0x8ac926, 0x9b5de5, 0xf15bb5];
    const PLACAS = ['LUNA', 'SOL', 'MAR', 'RIO', 'PAZ'];
    [1, 4, 6, 8, 11].forEach((indice, k) => {
      const c = cajones[indice];
      c.ocupado = true;
      const carro = crearCarro({ color: COLORES_ESTACIONADOS[k], rines: ESTILOS_RIN[k % ESTILOS_RIN.length], placa: PLACAS[k] });
      carro.raiz.position.set(c.cx, piso, c.cz);
      carro.raiz.rotation.y = c.cz > bz ? Math.PI : 0;   // de frente al pasillo
      estacionados.add(carro.raiz);
      obstaculos.caja(c.cx - 1.05, c.cz - 2.05, c.cx + 1.05, c.cz + 2.05);
    });
    escena.add(juntarPorMaterial(estacionados));

    // Letrero de "P" en la esquina, viendo hacia la calle.
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 128;
    const g = lienzo.getContext('2d');
    g.fillStyle = '#1d4ed8';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.strokeRect(8, 8, 112, 112);
    g.fillStyle = '#ffffff';
    g.font = 'bold 96px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('P', 64, 70);
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;
    const conP = new THREE.MeshStandardMaterial({ map: textura, roughness: 0.4 });
    const azul = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
    const letrero = new THREE.Group();
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 12), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.4 }));
    poste.position.y = 1.5;
    const placa = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 1.4), [conP, conP, azul, azul, azul, azul]);
    placa.position.y = 3.3;
    letrero.add(poste, placa);
    letrero.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    letrero.position.set(bx - L - BANQUETA / 2, ALTO_BANQUETA, bz - 9.5);
    escena.add(letrero);
    obstaculos.circulo(letrero.position.x, letrero.position.z, 0.25);
  }

  for (const t of trozos.values()) {
    const piezas = [[t.estuco, matParedEstuco, true], [t.ladrillo, matParedLadrillo, true], [t.detalles, matDetalle, true], [t.vidrios, matVidrio, false], [t.toldos, matToldo, true]];
    for (const [j, material, sombra] of piezas) if (j.pos.length) escena.add(j.malla(material, { sombra }));
  }
  escena.add(suelo.malla(matBanqueta));
  escena.add(cesped.malla(matPasto));

  // Tinacos (negros, como los de las azoteas de México).
  {
    const cuerpo = new THREE.CylinderGeometry(0.6, 0.6, 1.25, 20);
    cuerpo.translate(0, 0.62, 0);
    const tapa = new THREE.CylinderGeometry(0.42, 0.6, 0.18, 20);
    tapa.translate(0, 1.33, 0);
    const geo = mergeGeometries([cuerpo, tapa]);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.55 }), tinacos.length);
    tinacos.forEach(([x, y, z], i) => {
      quieto.position.set(x, y, z);
      quieto.rotation.set(0, 0, 0);
      quieto.scale.set(1, 1, 1);
      quieto.updateMatrix();
      m.setMatrixAt(i, quieto.matrix);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    escena.add(m);
  }

  // ---------- Mobiliario: postes de luz, hidrantes y botes de basura ----------
  const postes = [];     // [x, z, ángulo hacia la calle]
  const hidrantes = [];
  const botes = [];
  const enOrilla = MANZANA / 2 - 0.65;   // cerca de la guarnición
  for (const bx of MANZANAS) {
    for (const bz of MANZANAS) {
      if (bx === 0 && bz === 0) continue;
      for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const k of [-13.5, 13.5]) {
          const x = bx + (ex ? ex * enOrilla : k);
          const z = bz + (ez ? ez * enOrilla : k);
          postes.push([x, z, Math.atan2(ex, ez)]);
        }
      }
      if (bx === LOTE.x && bz === LOTE.z) continue;
      hidrantes.push([bx + enOrilla * (azarDetalle() < 0.5 ? 1 : -1), bz + 4.5]);
      botes.push([bx - 4.5, bz + enOrilla * (azarDetalle() < 0.5 ? 1 : -1)]);
    }
  }
  {
    const metal = new THREE.MeshStandardMaterial({ color: 0x2f4f4f, metalness: 0.6, roughness: 0.45 });
    const vara = new THREE.CylinderGeometry(0.07, 0.1, 5.2, 12);
    vara.translate(0, 2.6, 0);
    const brazo = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8);
    brazo.rotateX(Math.PI / 2);
    brazo.translate(0, 5.1, 0.6);
    const caja = new THREE.BoxGeometry(0.34, 0.14, 0.62);
    caja.translate(0, 5.05, 1.25);
    const geoPoste = mergeGeometries([vara, brazo, caja]);
    const lampara = new THREE.BoxGeometry(0.28, 0.04, 0.5);
    lampara.translate(0, 4.97, 1.25);
    const mPoste = new THREE.InstancedMesh(geoPoste, metal, postes.length);
    const mLampara = new THREE.InstancedMesh(lampara, new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe6a8, emissiveIntensity: 0.6 }), postes.length);
    postes.forEach(([x, z, a], i) => {
      quieto.position.set(x, ALTO_BANQUETA, z);
      quieto.rotation.set(0, a, 0);
      quieto.scale.set(1, 1, 1);
      quieto.updateMatrix();
      mPoste.setMatrixAt(i, quieto.matrix);
      mLampara.setMatrixAt(i, quieto.matrix);
      obstaculos.circulo(x, z, 0.15);
    });
    mPoste.castShadow = true;
    for (const m of [mPoste, mLampara]) {
      m.computeBoundingSphere();
      escena.add(m);
    }

    const rojo = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.45, metalness: 0.2 });
    const cuerpo = new THREE.CylinderGeometry(0.17, 0.2, 0.7, 14);
    cuerpo.translate(0, 0.35, 0);
    const cabeza = new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cabeza.translate(0, 0.7, 0);
    const salida = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10);
    salida.rotateZ(Math.PI / 2);
    salida.translate(0, 0.45, 0);
    const mHidrante = new THREE.InstancedMesh(mergeGeometries([cuerpo, cabeza, salida]), rojo, hidrantes.length);
    hidrantes.forEach(([x, z], i) => {
      quieto.position.set(x, ALTO_BANQUETA, z);
      quieto.rotation.set(0, 0, 0);
      quieto.updateMatrix();
      mHidrante.setMatrixAt(i, quieto.matrix);
      obstaculos.circulo(x, z, 0.25);
    });

    const verde = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.5, metalness: 0.3 });
    const bote = new THREE.CylinderGeometry(0.3, 0.26, 0.95, 16, 1, true);
    bote.translate(0, 0.48, 0);
    const borde = new THREE.TorusGeometry(0.3, 0.03, 6, 16);
    borde.rotateX(Math.PI / 2);
    borde.translate(0, 0.95, 0);
    const mBote = new THREE.InstancedMesh(mergeGeometries([bote.toNonIndexed(), borde.toNonIndexed()]), verde, botes.length);
    botes.forEach(([x, z], i) => {
      quieto.position.set(x, ALTO_BANQUETA, z);
      quieto.updateMatrix();
      mBote.setMatrixAt(i, quieto.matrix);
      obstaculos.circulo(x, z, 0.35);
    });
    for (const m of [mHidrante, mBote]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      escena.add(m);
    }
  }

  // ---------- Árboles: en algunas banquetas y en el parque ----------
  const arboles = [];   // [x, z, tamaño]
  const copas = [];     // [x, z, radio]: para que la cámara no se meta en un árbol
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

  {
    // Copa: tres bolas con bultitos, sombreado suave. Tronco: cilindro que se adelgaza.
    // Vértices unidos: así la luz se reparte suave y no se ven caras planas.
    const geoBola = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'));
    const p = geoBola.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const bulto = 1 + 0.16 * Math.sin(v.x * 5.1) * Math.sin(v.y * 4.3 + 1) * Math.sin(v.z * 4.7 + 2);
      v.multiplyScalar(bulto);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geoBola.computeVertexNormals();
    const troncos = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.2, 0.34, 2.8, 9).translate(0, 1.4, 0),
      new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.9 }),
      arboles.length,
    );
    const bolas = new THREE.InstancedMesh(
      geoBola,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }),
      arboles.length * 3,
    );
    const VERDES = [0x2d6a4f, 0x40916c, 0x52b788, 0x3a7d44, 0x5fa052];
    const tono = new THREE.Color();
    const bases = [];   // para mecerlas con el viento
    arboles.forEach(([x, z, s], i) => {
      quieto.position.set(x, ALTO_BANQUETA, z);
      quieto.rotation.set(0, azarDetalle() * Math.PI, 0);
      quieto.scale.set(s, s, s);
      quieto.updateMatrix();
      troncos.setMatrixAt(i, quieto.matrix);
      obstaculos.circulo(x, z, 0.45 * s);
      copas.push([x, z, 2.3 * s]);
      const verde = detalle(VERDES);
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * Math.PI * 2 + azarDetalle();
        const r = j === 0 ? 0 : 0.9 * s;
        const bx = x + Math.cos(a) * r * (j ? 1 : 0);
        const bz = z + Math.sin(a) * r * (j ? 1 : 0);
        const by = ALTO_BANQUETA + (j === 0 ? 4.0 : 3.3) * s;
        const tam = (j === 0 ? 1.9 : 1.45) * s;
        bases.push({ x: bx, y: by, z: bz, tam, fase: azarDetalle() * 6.28 });
        tono.setHex(verde).offsetHSL(0, 0, (azarDetalle() - 0.5) * 0.08);
        bolas.setColorAt(i * 3 + j, tono);
      }
    });
    const mecer = (t) => {
      bases.forEach((b, k) => {
        const viento = Math.sin(t * 1.1 + b.fase) * 0.06 * b.tam;
        quieto.position.set(b.x + viento, b.y, b.z + viento * 0.5);
        quieto.rotation.set(0, b.fase, 0);
        quieto.scale.set(b.tam, b.tam * 0.92, b.tam);
        quieto.updateMatrix();
        bolas.setMatrixAt(k, quieto.matrix);
      });
      bolas.instanceMatrix.needsUpdate = true;
    };
    mecer(0);
    let reloj = 0;
    let acumulado = 0;
    animaciones.push((dt) => {
      reloj += dt;
      acumulado += dt;
      if (acumulado < 1 / 30) return;   // basta con 30 veces por segundo
      acumulado = 0;
      mecer(reloj);
    });
    for (const m of [troncos, bolas]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      escena.add(m);
    }
  }

  // ---------- Parque: fuente, bancas y flores ----------
  {
    const piedra = new THREE.MeshStandardMaterial({ color: 0xd9d4cb, roughness: 0.75 });
    const texAgua = tex.agua();
    texAgua.repeat.set(2, 2);
    const agua = new THREE.MeshStandardMaterial({
      color: 0x3aa6d8, roughness: 0.06, metalness: 0.1, normalMap: texAgua,
      normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.92, envMapIntensity: 1.5,
    });
    const fuente = new THREE.Group();
    const y0 = yPasto;
    const pila = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 40), piedra);
    pila.position.y = y0 + 0.35;
    const borde = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 10, 48).rotateX(Math.PI / 2), piedra);
    borde.position.y = y0 + 0.72;
    const espejo = new THREE.Mesh(new THREE.CircleGeometry(3.05, 40).rotateX(-Math.PI / 2), agua);
    espejo.position.y = y0 + 0.66;
    const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.3, 20), piedra);
    columna.position.y = y0 + 1.6;
    const plato = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.45, 0.42, 32), piedra);
    plato.position.y = y0 + 2.75;
    const aguaPlato = new THREE.Mesh(new THREE.CircleGeometry(1.18, 32).rotateX(-Math.PI / 2), agua);
    aguaPlato.position.y = y0 + 2.95;
    fuente.add(pila, borde, espejo, columna, plato, aguaPlato);
    fuente.traverse((m) => { if (m.isMesh) { m.castShadow = m.material !== agua; m.receiveShadow = true; } });
    escena.add(fuente);
    obstaculos.circulo(0, 0, 3.4);

    // Gotas del chorro: suben y caen en arcos.
    const N_GOTAS = 48;
    const gotas = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xbfe9ff, roughness: 0.05, transparent: true, opacity: 0.8 }),
      N_GOTAS,
    );
    const datos = Array.from({ length: N_GOTAS }, (_, i) => ({ a: (i / N_GOTAS) * Math.PI * 2, t: (i * 0.37) % 1 }));
    escena.add(gotas);
    animaciones.push((dt) => {
      texAgua.offset.x += dt * 0.03;
      texAgua.offset.y += dt * 0.02;
      datos.forEach((d, i) => {
        d.t = (d.t + dt * 0.8) % 1;
        const r = 0.15 + d.t * 1.05;
        const h = 3.1 + Math.sin(d.t * Math.PI) * 0.9 - d.t * 0.2;
        quieto.position.set(Math.cos(d.a) * r, y0 + h, Math.sin(d.a) * r);
        quieto.scale.setScalar(1 - d.t * 0.4);
        quieto.updateMatrix();
        gotas.setMatrixAt(i, quieto.matrix);
      });
      gotas.instanceMatrix.needsUpdate = true;
    });

    // Bancas alrededor de la glorieta, viendo hacia la fuente.
    const madera = new THREE.MeshStandardMaterial({ color: 0xb5794a, roughness: 0.8 });
    const hierro = new THREE.MeshStandardMaterial({ color: 0x2b2d33, metalness: 0.6, roughness: 0.5 });
    const asiento = new THREE.BoxGeometry(1.8, 0.08, 0.5).translate(0, 0.48, 0);
    const respaldo = new THREE.BoxGeometry(1.8, 0.45, 0.06).translate(0, 0.78, -0.24);
    const patas = mergeGeometries([-0.8, 0.8].map((x) => new THREE.BoxGeometry(0.08, 0.48, 0.5).translate(x, 0.24, 0)));
    const angulos = [0.4, 1.2, 2.0, 2.75, 3.55, 4.35, 5.1, 5.85];
    const mMadera = new THREE.InstancedMesh(mergeGeometries([asiento, respaldo]), madera, angulos.length);
    const mPatas = new THREE.InstancedMesh(patas, hierro, angulos.length);
    angulos.forEach((a, i) => {
      const x = Math.cos(a) * 7.1, z = Math.sin(a) * 7.1;
      quieto.position.set(x, yPasto, z);
      quieto.rotation.set(0, Math.atan2(-x, -z), 0);   // viendo hacia la fuente
      quieto.scale.set(1, 1, 1);
      quieto.updateMatrix();
      mMadera.setMatrixAt(i, quieto.matrix);
      mPatas.setMatrixAt(i, quieto.matrix);
      obstaculos.circulo(x, z, 0.75);
    });
    for (const m of [mMadera, mPatas]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      escena.add(m);
    }

    // Flores en las esquinas del parque.
    const flores = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (let k = 0; k < 40; k++) {
        const a = azarDetalle() * Math.PI * 2, r = Math.sqrt(azarDetalle()) * 2.2;
        flores.push([sx * 10.5 + Math.cos(a) * r, sz * 10.5 + Math.sin(a) * r]);
      }
    }
    const mFlores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), flores.length);
    const COLORES_FLOR = [0xff5d8f, 0xffd60a, 0xffffff, 0xb388eb, 0xff8c42];
    const tono = new THREE.Color();
    flores.forEach(([x, z], i) => {
      quieto.position.set(x, yPasto + 0.22, z);
      quieto.rotation.set(0, 0, 0);
      quieto.scale.set(1, 0.7, 1);
      quieto.updateMatrix();
      mFlores.setMatrixAt(i, quieto.matrix);
      mFlores.setColorAt(i, tono.setHex(COLORES_FLOR[i % COLORES_FLOR.length]));
    });
    mFlores.computeBoundingSphere();
    escena.add(mFlores);
  }

  // ---------- Nubes esponjosas que se mueven despacio ----------
  {
    const N_NUBES = 16;
    const nubes = new THREE.InstancedMesh(
      esferaSuave(2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xb8c7d6, emissiveIntensity: 0.35, fog: false }),
      N_NUBES * 5,
    );
    const grupoNubes = new THREE.Group();
    grupoNubes.add(nubes);
    for (let i = 0; i < N_NUBES; i++) {
      const a = azarDetalle() * Math.PI * 2;
      const r = 60 + azarDetalle() * 180;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 70 + azarDetalle() * 25;
      for (let j = 0; j < 5; j++) {
        const s = 4 + azarDetalle() * 3.5;
        quieto.position.set(cx + (j - 2) * 4.2, cy + azarDetalle() * 2 - (j === 0 || j === 4 ? 1.2 : 0), cz + (azarDetalle() - 0.5) * 4);
        quieto.rotation.set(0, 0, 0);
        quieto.scale.set(s * 1.2, s * 0.75, s);
        quieto.updateMatrix();
        nubes.setMatrixAt(i * 5 + j, quieto.matrix);
      }
    }
    nubes.computeBoundingSphere();
    escena.add(grupoNubes);
    animaciones.push((dt) => {
      grupoNubes.position.x += dt * 0.6;
      if (grupoNubes.position.x > 200) grupoNubes.position.x = -200;
    });
  }

  // Puntos sobre las calles (a la mitad de cada cuadra y en los cruces): ahí van las estrellas.
  const puntosCalle = [];
  for (const c of CALLES) {
    for (const b of MANZANAS) puntosCalle.push([c, b], [b, c]);
    for (const c2 of CALLES) puntosCalle.push([c, c2]);
  }

  return {
    sol,
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

    // La sombra solo se calcula cerca del vehículo. El sol se mueve en saltos de 8 m:
    // devuelve true cuando saltó (hay que volver a calcular las sombras).
    seguir(posicion) {
      const x = Math.round(posicion.x / 8) * 8;
      const z = Math.round(posicion.z / 8) * 8;
      if (x === sol.target.position.x && z === sol.target.position.z && sol.userData.listo) return false;
      sol.userData.listo = true;
      sol.target.position.set(x, 0, z);
      sol.position.copy(sol.target.position).add(DESDE_EL_SOL);
      sol.target.updateMatrixWorld();
      sol.updateMatrixWorld();
      return true;
    },

    // Qué parte del camino de (x0, z0) a (x1, z1) está libre de copas de árboles (1 = todo libre).
    libreDeArboles(x0, z0, x1, z1) {
      const dx = x1 - x0, dz = z1 - z0;
      const largo2 = dx * dx + dz * dz || 1;
      let t = 1;
      for (const [cx, cz, r] of copas) {
        // Punto del camino más cercano al árbol.
        const u = Math.max(0, Math.min(1, ((cx - x0) * dx + (cz - z0) * dz) / largo2));
        const px = x0 + dx * u - cx, pz = z0 + dz * u - cz;
        const d2 = px * px + pz * pz;
        if (d2 >= r * r) continue;
        // Donde el camino entra al círculo.
        const atras = Math.sqrt((r * r - d2) / largo2);
        t = Math.min(t, Math.max(0, u - atras));
      }
      return t;
    },

    // Árboles que se mecen, agua de la fuente y nubes.
    actualizar(dt) {
      for (const animar of animaciones) animar(dt);
    },
  };
}

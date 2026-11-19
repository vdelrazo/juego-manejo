// Vehículos hechos por artistas (archivos .glb en la carpeta modelos/):
//   - Kenney (CC0): carro (sedán), camión de bomberos y monster truck, más llantas y una defensa suelta.
//   - Moto todoterreno de "jeremy" (CC-BY 3.0, vía Poly Pizza): ver CREDITOS.md.
//
// Cada vehículo se arma con las mismas partes que los modelos hechos en código (raiz, cuerpo,
// ruedas, pivotes, piel…), así el resto del juego no tiene que saber de dónde salió.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, pintura, sombraPiso, piloto } from './modelos.js';

const ARCHIVOS = {
  sedan: 'modelos/kenney/car/sedan.glb',
  bomberos: 'modelos/kenney/car/firetruck.glb',
  monstruo: 'modelos/kenney/toy/vehicle-monster-truck.glb',
  defensa: 'modelos/kenney/car/debris-bumper.glb',
  rinClasico: 'modelos/kenney/car/wheel-default.glb',
  rinDeportivo: 'modelos/kenney/car/wheel-racing.glb',
  rinOscuro: 'modelos/kenney/car/wheel-dark.glb',
  moto: 'modelos/moto/moto.glb',
};
const plantillas = {};

export async function cargarModelosArtista() {
  const cargador = new GLTFLoader();
  await Promise.all(Object.entries(ARCHIVOS).map(async ([nombre, ruta]) => {
    plantillas[nombre] = (await cargador.loadAsync(ruta)).scene;
  }));
}

// Cómo se acomoda cada modelo de Kenney: escala (sus unidades son chicas) y hacia dónde ve.
const KENNEY = {
  carro: { archivo: 'sedan', escala: 1.55, giro: 0 },
  bomberos: { archivo: 'bomberos', escala: 1.55, giro: 0 },
  monstruo: { archivo: 'monstruo', escala: 4.2, giro: Math.PI },   // el de juguete ve hacia -z
};

const caja = (obj) => new THREE.Box3().setFromObject(obj);

// Busca la altura de la carrocería en (x, z) disparando un rayo hacia abajo.
function alturaEn(malla, x, z) {
  const rayo = new THREE.Raycaster(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
  const golpe = rayo.intersectObject(malla, true)[0];
  return golpe ? golpe.point.y : null;
}

// ---------- Pintura sobre la paleta de colores de Kenney ----------
// Cada modelo toma sus colores de una imagen-paleta. Para pintar se copia esa imagen y se cambian
// todos los tonos del color principal de la carrocería (el más usado), conservando lo claro u
// oscuro de cada tono.

// Tono (0 a 1) de un color RGB de 0 a 255.
function tono(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h / 6) + 1) % 1;
}
const saturacion = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
function prepararPintura(malla) {
  const original = malla.material;
  const img = original.map.image;
  const lienzo = document.createElement('canvas');
  lienzo.width = img.width;
  lienzo.height = img.height;
  const g = lienzo.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const base = g.getImageData(0, 0, lienzo.width, lienzo.height);

  // Color más usado (y con color: no gris) en los triángulos de la carrocería.
  const geo = malla.geometry;
  const uv = geo.attributes.uv;
  const indice = geo.index;
  const cuenta = new Map();
  const n = indice ? indice.count : uv.count;
  for (let t = 0; t < n; t += 3) {
    let u = 0, v = 0;
    for (let k = 0; k < 3; k++) {
      const i = indice ? indice.getX(t + k) : t + k;
      u += uv.getX(i) / 3;
      v += uv.getY(i) / 3;
    }
    const px = Math.min(lienzo.width - 1, Math.max(0, Math.floor(u * lienzo.width)));
    const py = Math.min(lienzo.height - 1, Math.max(0, Math.floor(v * lienzo.height)));
    const o = (py * lienzo.width + px) * 4;
    const r = base.data[o], gg = base.data[o + 1], b = base.data[o + 2];
    const saturacion = Math.max(r, gg, b) - Math.min(r, gg, b);
    if (saturacion < 40) continue;
    const clave = (r << 16) | (gg << 8) | b;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  let dominante = 0xff0000, maximo = 0;
  for (const [clave, c] of cuenta) if (c > maximo) { maximo = c; dominante = clave; }
  const dr = (dominante >> 16) & 255, dg = (dominante >> 8) & 255, db = dominante & 255;
  const luzBase = Math.max(1, dr * 0.3 + dg * 0.59 + db * 0.11);
  const tonoBase = tono(dr, dg, db);
  // Qué píxeles de la paleta son "del color de la carrocería": mismo tono y con color.
  const esCarroceria = new Uint8Array(base.data.length / 4);
  for (let i = 0, p = 0; i < base.data.length; i += 4, p++) {
    const r = base.data[i], gg = base.data[i + 1], b = base.data[i + 2];
    if (saturacion(r, gg, b) < 0.25) continue;
    const dt = Math.abs(tono(r, gg, b) - tonoBase);
    if (Math.min(dt, 1 - dt) < 0.045) esCarroceria[p] = 1;
  }

  const textura = new THREE.CanvasTexture(lienzo);
  textura.flipY = false;
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = original.map.magFilter;
  textura.minFilter = original.map.minFilter;
  const material = new THREE.MeshPhysicalMaterial({ map: textura, roughness: 0.4, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
  malla.material = material;

  const color = new THREE.Color(dominante);
  const pielLisa = pintura(color.clone());   // para las piezas que se agregan (alerón)
  const rgb = { r: 0, g: 0, b: 0 };
  function pintar(hex) {
    color.set(hex);
    pielLisa.color.set(hex);
    color.getRGB(rgb, THREE.SRGBColorSpace);
    const datos = g.createImageData(lienzo.width, lienzo.height);
    const d = datos.data, s = base.data;
    for (let i = 0, p = 0; i < s.length; i += 4, p++) {
      const r = s[i], gg = s[i + 1], b = s[i + 2];
      if (esCarroceria[p]) {
        const k = (r * 0.3 + gg * 0.59 + b * 0.11) / luzBase;
        d[i] = Math.min(255, rgb.r * 255 * k);
        d[i + 1] = Math.min(255, rgb.g * 255 * k);
        d[i + 2] = Math.min(255, rgb.b * 255 * k);
      } else {
        d[i] = r; d[i + 1] = gg; d[i + 2] = b;
      }
      d[i + 3] = s[i + 3];
    }
    g.putImageData(datos, 0, 0);
    textura.needsUpdate = true;
  }
  return { material, color, pielLisa, pintar };
}

// ---------- Vehículos de Kenney ----------

export function crearKenney(tipo) {
  const c = KENNEY[tipo];
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();          // lo que se ladea y cabecea
  raiz.add(cuerpo);
  const carroceria = new THREE.Group();
  cuerpo.add(carroceria);

  const copia = plantillas[c.archivo].clone(true);
  const ajuste = new THREE.Group();
  ajuste.rotation.y = c.giro;
  ajuste.scale.setScalar(c.escala);
  ajuste.add(copia);
  raiz.add(ajuste);
  raiz.updateMatrixWorld(true);

  // Las llantas salen a grupos propios: giran (rotation.x) y las de adelante también voltean.
  const ruedas = [];
  const pivotesDelanteros = [];
  let radioBase = 0.4;
  for (const nodo of [...copia.children]) {
    if (!nodo.name.startsWith('wheel')) continue;
    const pos = nodo.getWorldPosition(new THREE.Vector3());
    const tam = caja(nodo).getSize(new THREE.Vector3());
    radioBase = tam.y / 2;
    nodo.removeFromParent();
    nodo.position.set(0, 0, 0);
    nodo.rotation.set(0, c.giro, 0);
    nodo.scale.setScalar(c.escala);
    const rueda = new THREE.Group();
    rueda.add(nodo);
    rueda.userData = { original: nodo, lado: Math.sign(pos.x), radio: radioBase };
    if (pos.z > 0) {
      const pivote = new THREE.Group();
      pivote.position.copy(pos);
      pivote.add(rueda);
      raiz.add(pivote);
      pivotesDelanteros.push(pivote);
    } else {
      rueda.position.copy(pos);
      raiz.add(rueda);
    }
    ruedas.push(rueda);
  }
  // La carrocería (con su parrilla) se pasa al grupo que se ladea.
  ajuste.removeFromParent();
  carroceria.add(ajuste);
  const alturaCuerpo = 0.55;
  cuerpo.position.y = alturaCuerpo;
  carroceria.position.y = -alturaCuerpo;
  raiz.updateMatrixWorld(true);

  const lamina = copia.getObjectByName('body') ?? copia.children.find((m) => m.isMesh);
  const { color, pielLisa, pintar } = prepararPintura(lamina);
  lamina.castShadow = true;
  copia.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  // Medidas para colocar piezas: techo, cajuela, defensa, humo.
  const medida = caja(lamina);
  const largo = medida.max.z - medida.min.z;
  const ancho = medida.max.x - medida.min.x;
  const zTecho = medida.getCenter(new THREE.Vector3()).z - largo * 0.08;
  const yTecho = alturaEn(lamina, 0, zTecho) ?? medida.max.y;
  const zCajuela = medida.min.z + largo * 0.12;
  const yCajuela = alturaEn(lamina, 0, zCajuela) ?? medida.max.y * 0.7;

  // Daños: una defensa suelta (pieza de choque de Kenney) colgando adelante o atrás.
  const defensas = {};
  for (const [id, z, giroZ] of [['defDel', medida.max.z + 0.05, 0.32], ['defTras', medida.min.z - 0.05, -0.32]]) {
    const d = plantillas.defensa.clone(true);
    const grupo = new THREE.Group();
    d.scale.setScalar(c.escala * 0.9);
    grupo.add(d);
    grupo.position.set(0, 0.25, z);
    grupo.rotation.set(id === 'defDel' ? 0.25 : -0.25, id === 'defDel' ? 0 : Math.PI, giroZ);
    grupo.visible = false;
    d.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    carroceria.add(grupo);
    defensas[id] = grupo;
  }

  const ESTILO_RIN = { clasico: null, estrella: 'rinOscuro', deportivo: 'rinDeportivo' };
  raiz.add(sombraPiso(ancho + 0.6, largo + 0.9));

  const modelo = {
    tipo, raiz, cuerpo, carroceria, ruedas, pivotesDelanteros,
    piel: { color },                     // color actual (para guardarlo)
    pielLisa, pintar,
    faros: [], defensas: [],
    superficies: [lamina],
    radioRueda: radioBase, radioBase, alturaCuerpo,
    largo, ancho, alto: medida.max.y,
    anclas: {
      techo: { y: yTecho - 0.02, z: zTecho },
      aleron: { y: yCajuela, z: zCajuela, ancho: ancho * 0.7 },
    },
    anclaPaquete: { padre: carroceria, x: 0, y: yTecho + 0.35, z: zTecho, tam: 0.85 },
    alturaEstrellitas: medida.max.y + 0.7,
    origenHumo: new THREE.Vector3(0, medida.max.y * 0.75, medida.max.z - largo * 0.18),
    partes: {
      ponerRines(estilo) {
        for (const rueda of ruedas) {
          for (const hijo of [...rueda.children]) rueda.remove(hijo);
          const archivo = ESTILO_RIN[estilo];
          if (!archivo) { rueda.add(rueda.userData.original); continue; }
          const nueva = plantillas[archivo].clone(true);
          const t = caja(nueva).getSize(new THREE.Vector3());
          nueva.scale.setScalar((rueda.userData.radio * 2) / t.y);
          if (rueda.userData.lado < 0) nueva.rotation.y = Math.PI;
          nueva.traverse((m) => { if (m.isMesh) m.castShadow = true; });
          rueda.add(nueva);
        }
      },
      piezasDanables: () => defensas,
      piezasDeLado: (deFrente) => [deFrente ? 'defDel' : 'defTras'],
      danarPieza(id, danada) {
        if (defensas[id]) defensas[id].visible = danada;
      },
    },
  };
  return modelo;
}

// ---------- Moto de artista ----------
// Viene en una sola pieza: aquí se separan las llantas (todo lo que cae dentro de cada rueda)
// para que puedan girar, y la parte negra de la carrocería se vuelve pintable.

const LARGO_MOTO = 2.2;

export function crearMotoArtista({ color = 0x1d7ff2, casco = 0xffd60a } = {}) {
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();          // en la moto todo se inclina junto, desde el piso
  raiz.add(cuerpo);

  // Orientar (el modelo ve hacia +x) y escalar; luego "hornear" todo a coordenadas de la moto.
  const copia = plantillas.moto.clone(true);
  const ajuste = new THREE.Group();
  ajuste.add(copia);
  const t0 = caja(copia).getSize(new THREE.Vector3());
  ajuste.scale.setScalar(LARGO_MOTO / t0.x);
  ajuste.rotation.y = -Math.PI / 2;
  ajuste.updateMatrixWorld(true);
  const piezas = [];   // { geo (sin índices, en coordenadas de la moto), material }
  copia.traverse((m) => {
    if (!m.isMesh) return;
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    piezas.push({ geo, material: m.material });
  });

  // Dónde están las ruedas: con los puntos más bajos, uno adelante (z > 0) y otro atrás.
  let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const { geo } of piezas) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i));
      minZ = Math.min(minZ, p.getZ(i)); maxZ = Math.max(maxZ, p.getZ(i));
    }
  }
  const alto = maxY - minY;
  const centroZ = (minZ + maxZ) / 2;
  const grupos = [{ z0: Infinity, z1: -Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity }, { z0: Infinity, z1: -Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity }];
  for (const { geo } of piezas) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > minY + alto * 0.12) continue;   // solo lo que toca el piso: las llantas
      const g = grupos[p.getZ(i) > centroZ ? 1 : 0];
      const z = p.getZ(i), x = p.getX(i);
      g.z0 = Math.min(g.z0, z); g.z1 = Math.max(g.z1, z);
      g.y1 = Math.max(g.y1, y);
      g.x0 = Math.min(g.x0, x); g.x1 = Math.max(g.x1, x);
    }
  }
  // Con la cuerda (c) y la altura (h) de la parte baja de la llanta sale el radio: (c² + h²) / 2h.
  const ruedasInfo = grupos.map((g) => {
    const c = (g.z1 - g.z0) / 2;
    const h = Math.max(0.01, g.y1 - minY);
    const radio = ((c * c + h * h) / (2 * h)) * 1.03;
    return { z: (g.z0 + g.z1) / 2, y: minY + radio, radio, medioAncho: Math.max(0.06, (g.x1 - g.x0) / 2) * 1.6 };
  });

  // Repartir los triángulos: dentro de una rueda → esa rueda; si no → carrocería.
  const destinos = [new Map(), new Map(), new Map()];   // trasera, delantera, carrocería: material → [geos]
  const tmp = new THREE.Vector3();
  for (const { geo, material } of piezas) {
    const p = geo.attributes.position;
    const conjuntos = [[], [], []];
    for (let t = 0; t < p.count; t += 3) {
      tmp.set(0, 0, 0);
      for (let k = 0; k < 3; k++) tmp.add(new THREE.Vector3().fromBufferAttribute(p, t + k));
      tmp.multiplyScalar(1 / 3);
      let destino = 2;
      ruedasInfo.forEach((r, i) => {
        if (Math.abs(tmp.x) < r.medioAncho && Math.hypot(tmp.y - r.y, tmp.z - r.z) < r.radio) destino = i;
      });
      conjuntos[destino].push(t);
    }
    conjuntos.forEach((tris, d) => {
      if (!tris.length) return;
      const nueva = new THREE.BufferGeometry();
      for (const nombre of Object.keys(geo.attributes)) {
        const a = geo.attributes[nombre];
        const arr = new a.array.constructor(tris.length * 3 * a.itemSize);
        tris.forEach((t, j) => {
          for (let k = 0; k < 3 * a.itemSize; k++) arr[j * 3 * a.itemSize + k] = a.array[t * a.itemSize + k];
        });
        nueva.setAttribute(nombre, new THREE.BufferAttribute(arr, a.itemSize));
      }
      if (!destinos[d].has(material)) destinos[d].set(material, []);
      destinos[d].get(material).push(nueva);
    });
  }

  // Carrocería: lo negro (el material más oscuro que no esté en las ruedas) se vuelve pintable.
  const piel = pintura(color);
  const superficies = [];
  let masOscuro = null, luz = Infinity;
  for (const material of destinos[2].keys()) {
    const l = material.color.r + material.color.g + material.color.b;
    if (l < luz) { luz = l; masOscuro = material; }
  }
  for (const [material, geos] of destinos[2]) {
    const m = new THREE.Mesh(mergeGeometries(geos), material === masOscuro ? piel : material);
    m.castShadow = true;
    m.receiveShadow = true;
    cuerpo.add(m);
    if (material === masOscuro) superficies.push(m);
  }
  // Ruedas: cada una centrada en su eje para poder girar.
  const ruedas = [];
  const pivotesDelanteros = [];
  ruedasInfo.forEach((r, i) => {
    const rueda = new THREE.Group();
    for (const [material, geos] of destinos[i]) {
      const g = mergeGeometries(geos);
      g.translate(0, -r.y, -r.z);
      const m = new THREE.Mesh(g, material);
      m.castShadow = true;
      rueda.add(m);
    }
    if (i === 1) {
      const pivote = new THREE.Group();
      pivote.position.set(0, r.y, r.z);
      pivote.add(rueda);
      cuerpo.add(pivote);
      pivotesDelanteros.push(pivote);
    } else {
      rueda.position.set(0, r.y, r.z);
      cuerpo.add(rueda);
    }
    ruedas.push(rueda);
  });

  // Piloto: sentado en el asiento (esta moto es un poco más baja que la hecha en código).
  const { grupo: jinete, pielCasco } = piloto({ casco });
  jinete.position.set(0, (maxY - minY) * 0.6 - 0.95, 0.05);
  cuerpo.add(jinete);

  raiz.add(sombraPiso(1.2, LARGO_MOTO + 0.6));

  return {
    tipo: 'moto', raiz, cuerpo, ruedas, pivotesDelanteros, piel, pielCasco,
    faros: [],
    superficies,
    radioRueda: ruedasInfo[0].radio,
    largo: LARGO_MOTO, ancho: 0.8, alto,
    anclaPaquete: { padre: cuerpo, x: 0, y: alto * 0.62 + 0.2, z: minZ + 0.25, tam: 0.5 },
    alturaEstrellitas: 2.3,
    origenHumo: new THREE.Vector3(0, alto * 0.45, 0.1),
    partes: {
      piezasDanables: () => ({}),
      piezasDeLado: () => [],
      danarPieza() {},
    },
  };
}

// Modelos del carro y la moto, hechos en código con formas redondeadas.
// Cada modelo devuelve sus piezas por separado (pintura, rines, faros…) para que el taller
// pueda pintarlas o cambiarlas.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import * as texturas from './texturas.js';

// ---------- Materiales ----------

export function pintura(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.25,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
}

const MAT = {
  vidrio: new THREE.MeshPhysicalMaterial({
    color: 0x1c2b3d, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
    side: THREE.DoubleSide,
  }),
  cromo: new THREE.MeshStandardMaterial({ color: 0xe8ecf1, metalness: 1, roughness: 0.18 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.35 }),
  metalOscuro: new THREE.MeshStandardMaterial({ color: 0x3b4048, metalness: 0.7, roughness: 0.45 }),
  hule: new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.88 }),
  plastico: new THREE.MeshStandardMaterial({ color: 0x30343b, roughness: 0.55 }),
  hueco: new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 1 }),
  piel: new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.5 }),
  faro: new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff0c8, emissiveIntensity: 0.9, roughness: 0.15 }),
  calavera: new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff1f1f, emissiveIntensity: 0.7, roughness: 0.25 }),
  direccional: new THREE.MeshStandardMaterial({ color: 0xffa94d, emissive: 0xff8a1f, emissiveIntensity: 0.4, roughness: 0.3 }),
};

const sombraSuave = texturas.sombraSuave();

function malla(geo, material, { sombra = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

// Caja redondeada.
function cajaR(an, al, la, radio, material) {
  return malla(new RoundedBoxGeometry(an, al, la, 2, Math.min(radio, 0.49 * Math.min(an, al, la))), material);
}

// Cápsula o cilindro entre dos puntos (para tubos, brazos y piernas).
const ARRIBA = new THREE.Vector3(0, 1, 0);
function entre(geoPorLargo, a, b, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const largo = dir.length();
  const m = malla(geoPorLargo(largo), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(ARRIBA, dir.normalize());
  return m;
}
const capsula = (r) => (l) => new THREE.CapsuleGeometry(r, Math.max(0.001, l - 2 * r), 6, 12);
const tubo = (r) => (l) => new THREE.CylinderGeometry(r, r, l, 10);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Extrusión de un perfil lateral (z hacia adelante, y hacia arriba), centrada a lo ancho.
function perfil(forma, ancho, bisel) {
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: ancho - 2 * bisel.grosor,
    bevelEnabled: true,
    bevelThickness: bisel.grosor,
    bevelSize: bisel.tam,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geo.rotateY(-Math.PI / 2);   // el perfil queda de lado: x de la forma → z del vehículo
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, 0, 0);
  // Normales suaves en las curvas y aristas marcadas donde de verdad hay esquina.
  return toCreasedNormals(geo, Math.PI / 4);
}

// ---------- Ruedas ----------

// Llanta con hombros redondeados (torno de un perfil).
function llanta(radio, ancho) {
  const r0 = radio * 0.62;
  const h = ancho / 2;
  const puntos = [
    [r0, -h], [radio - 0.05, -h], [radio - 0.015, -h * 0.82], [radio, -h * 0.5],
    [radio, h * 0.5], [radio - 0.015, h * 0.82], [radio - 0.05, h], [r0, h],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(puntos, 24);
  geo.rotateZ(Math.PI / 2);
  return malla(geo, MAT.hule);
}

// Rin: estilos para el taller. "lado" = 1 o -1 (hacia qué lado mira la cara del rin).
export const ESTILOS_RIN = ['clasico', 'estrella', 'deportivo'];

export function rin(estilo, radio, ancho, lado) {
  const g = new THREE.Group();
  const r = radio * 0.62;
  const cara = ancho / 2 * lado;
  const base = new THREE.CylinderGeometry(r, r, ancho * 0.9, 28);
  base.rotateZ(Math.PI / 2);
  g.add(malla(base, estilo === 'deportivo' ? MAT.metalOscuro : MAT.metal));
  const tapon = new THREE.CylinderGeometry(r * 0.32, r * 0.36, 0.04, 20);
  tapon.rotateZ(Math.PI / 2);
  const centro = malla(tapon, MAT.cromo);
  centro.position.x = cara;
  g.add(centro);
  const rayos = estilo === 'estrella' ? 5 : estilo === 'deportivo' ? 10 : 6;
  for (let i = 0; i < rayos; i++) {
    const a = (i / rayos) * Math.PI * 2;
    const rayo = estilo === 'clasico'
      ? malla(new THREE.CylinderGeometry(r * 0.13, r * 0.13, 0.03, 12).rotateZ(Math.PI / 2), MAT.plastico)
      : malla(new THREE.BoxGeometry(0.03, r * 0.7, estilo === 'estrella' ? r * 0.3 : r * 0.14), MAT.cromo);
    if (estilo === 'clasico') {
      rayo.position.set(cara, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
    } else {
      rayo.position.set(cara, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      rayo.rotation.x = a;
    }
    g.add(rayo);
  }
  return g;
}

// Rueda completa: grupo que gira (rotation.x) con llanta y rin.
function rueda(radio, ancho, estiloRin, lado) {
  const g = new THREE.Group();
  g.add(llanta(radio, ancho));
  const r = rin(estiloRin, radio, ancho, lado);
  r.name = 'rin';
  g.add(r);
  g.userData = { radio, ancho, lado };
  return g;
}

// Sombra suave pegada al piso, debajo del vehículo.
function sombraPiso(ancho, largo) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, largo),
    new THREE.MeshBasicMaterial({ map: sombraSuave, transparent: true, depthWrite: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

// ---------- Carro ----------

export const RUEDA_CARRO = 0.4;

export function crearCarro({ color = 0xef233c, rines = 'clasico', placa = 'AMIGO' } = {}) {
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();          // lo que se ladea y cabecea
  cuerpo.position.y = 0.55;
  raiz.add(cuerpo);
  const carroceria = new THREE.Group();
  carroceria.position.y = -0.55;
  cuerpo.add(carroceria);
  const piel = pintura(color);

  // Perfil de la carrocería (ya con el bisel descontado), con los huecos de las ruedas.
  const s = new THREE.Shape();
  s.moveTo(-1.89, 0.5);
  s.quadraticCurveTo(-1.89, 0.36, -1.78, 0.36);
  s.absarc(-1.2, 0.4, 0.52, Math.PI, 0, true);
  s.lineTo(-0.68, 0.36);
  s.lineTo(0.68, 0.36);
  s.absarc(1.2, 0.4, 0.52, Math.PI, 0, true);
  s.lineTo(1.72, 0.36);
  s.lineTo(1.8, 0.36);
  s.quadraticCurveTo(1.91, 0.36, 1.91, 0.5);
  s.lineTo(1.91, 0.7);
  s.quadraticCurveTo(1.91, 0.9, 1.72, 0.92);
  s.quadraticCurveTo(1.1, 0.98, 0.55, 1.02);
  s.lineTo(-1.2, 1.02);
  s.quadraticCurveTo(-1.86, 1.02, -1.89, 0.8);
  s.closePath();
  carroceria.add(malla(perfil(s, 1.9, { grosor: 0.1, tam: 0.06 }), piel));
  // Interior oscuro de las salpicaderas (lo que se ve arriba de cada llanta).
  for (const z of [1.2, -1.2]) {
    const hueco = malla(new THREE.CylinderGeometry(0.47, 0.47, 1.6, 24).rotateZ(Math.PI / 2), MAT.hueco, { sombra: false });
    hueco.position.set(0, RUEDA_CARRO, z);
    carroceria.add(hueco);
  }

  // Cabina del color del carro, con parabrisas, medallón y ventanas de vidrio encima.
  const c = new THREE.Shape();
  c.moveTo(-1.1, 1.0);
  c.lineTo(0.5, 1.0);
  c.lineTo(-0.02, 1.52);       // parabrisas (recto, para que el vidrio asiente bien)
  c.lineTo(-0.8, 1.52);        // techo
  c.lineTo(-1.1, 1.25);        // medallón
  c.closePath();
  carroceria.add(malla(perfil(c, 1.5, { grosor: 0.08, tam: 0.05 }), piel));
  // Parabrisas y medallón: placas de vidrio pegadas a las caras inclinadas.
  const parabrisas = malla(new THREE.PlaneGeometry(1.3, 0.6), MAT.vidrio, { sombra: false });
  parabrisas.position.set(0, 1.3, 0.28);
  parabrisas.rotation.x = -Math.PI / 4;
  const medallon = malla(new THREE.PlaneGeometry(1.25, 0.3), MAT.vidrio, { sombra: false });
  medallon.position.set(0, 1.427, -0.987);
  medallon.rotation.x = -2.303;
  carroceria.add(parabrisas, medallon);
  // Ventanas de los lados (dos por lado, con el poste del medio en color carro).
  const ventana = (puntos) => {
    const forma = new THREE.Shape(puntos.map(([z, y]) => new THREE.Vector2(z, y)));
    return new THREE.ShapeGeometry(forma).rotateY(-Math.PI / 2);
  };
  const ventanas = [
    ventana([[-0.3, 1.07], [0.32, 1.07], [-0.07, 1.46], [-0.3, 1.46]]),
    ventana([[-1.0, 1.07], [-0.42, 1.07], [-0.42, 1.46], [-0.8, 1.46], [-1.0, 1.27]]),
  ];
  for (const x of [-0.757, 0.757]) {
    for (const geo of ventanas) {
      const v = malla(geo, MAT.vidrio, { sombra: false });
      v.position.x = x;
      carroceria.add(v);
    }
  }
  for (const x of [-0.74, 0.74]) {
    const lado = Math.sign(x);
    const espejo = cajaR(0.2, 0.12, 0.1, 0.04, piel);
    espejo.position.set(lado * 1.02, 1.14, 0.42);
    carroceria.add(espejo);
    const manija = cajaR(0.03, 0.04, 0.18, 0.015, MAT.cromo);
    manija.position.set(lado * 0.965, 0.95, -0.1);
    carroceria.add(manija);
  }

  // Faros, calaveras, parrilla, defensas y placas.
  const faros = [];
  for (const x of [-0.6, 0.6]) {
    const aro = malla(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 24).rotateX(Math.PI / 2), MAT.cromo);
    aro.position.set(x, 0.72, 1.97);
    const faro = malla(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 24).rotateX(Math.PI / 2), MAT.faro);
    faro.position.set(x, 0.72, 1.99);
    const calavera = cajaR(0.34, 0.15, 0.05, 0.03, MAT.calavera);
    calavera.position.set(x * 1.03, 0.82, -1.98);
    const direccional = cajaR(0.12, 0.08, 0.04, 0.02, MAT.direccional);
    direccional.position.set(x * 1.35, 0.56, 1.95);
    carroceria.add(aro, faro, calavera, direccional);
    faros.push(faro);
  }
  const parrilla = cajaR(0.62, 0.17, 0.05, 0.04, MAT.plastico);
  parrilla.position.set(0, 0.6, 1.98);
  carroceria.add(parrilla);
  const defensas = [];
  const matPlaca = new THREE.MeshStandardMaterial({ map: texturas.placa(placa), roughness: 0.4 });
  for (const z of [2.0, -1.98]) {
    const d = malla(new THREE.CapsuleGeometry(0.1, 1.62, 6, 14).rotateZ(Math.PI / 2), MAT.plastico);
    d.position.set(0, 0.4, z);
    carroceria.add(d);
    defensas.push(d);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), matPlaca);
    p.position.set(0, 0.4, z > 0 ? 2.11 : -2.09);
    if (z < 0) p.rotation.y = Math.PI;
    carroceria.add(p);
  }

  // Ruedas: las de adelante dentro de un pivote para voltear.
  const ruedas = [];
  const pivotesDelanteros = [];
  for (const [x, z] of [[0.86, 1.2], [-0.86, 1.2], [0.86, -1.2], [-0.86, -1.2]]) {
    const r = rueda(RUEDA_CARRO, 0.32, rines, Math.sign(x));
    if (z > 0) {
      const pivote = new THREE.Group();
      pivote.position.set(x, RUEDA_CARRO, z);
      pivote.add(r);
      raiz.add(pivote);
      pivotesDelanteros.push(pivote);
    } else {
      r.position.set(x, RUEDA_CARRO, z);
      raiz.add(r);
    }
    ruedas.push(r);
  }

  raiz.add(sombraPiso(2.8, 5));

  return {
    raiz, cuerpo, ruedas, pivotesDelanteros, piel, faros, defensas,
    radioRueda: RUEDA_CARRO,
    anclaPaquete: { padre: carroceria, x: 0, y: 1.98, z: -0.42, tam: 0.85 },
    alturaEstrellitas: 2.4,
  };
}

// ---------- Moto ----------

export const RUEDA_MOTO = 0.34;

export function crearMoto({ color = 0x1d7ff2, casco = 0xffd60a, chamarra = 0x06d6a0, rines = 'deportivo' } = {}) {
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();          // en la moto todo se inclina junto, desde el piso
  raiz.add(cuerpo);
  const piel = pintura(color);
  const pielCasco = pintura(casco);
  const ropa = new THREE.MeshStandardMaterial({ color: chamarra, roughness: 0.75 });
  const pantalon = new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.8 });
  const R = RUEDA_MOTO;

  // Ruedas: llanta (dona) + rin con rayos + disco de freno.
  function ruedaMoto() {
    const g = new THREE.Group();
    const dona = new THREE.TorusGeometry(R - 0.07, 0.075, 14, 36);
    dona.rotateY(Math.PI / 2);
    g.add(malla(dona, MAT.hule));
    g.add(rin(rines, R * 0.85, 0.1, 1));
    const disco = malla(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 24).rotateZ(Math.PI / 2), MAT.metal);
    disco.position.x = -0.07;
    g.add(disco);
    return g;
  }
  const trasera = ruedaMoto();
  trasera.position.set(0, R, -0.75);
  cuerpo.add(trasera);
  const pivote = new THREE.Group();
  pivote.position.set(0, R, 0.78);
  cuerpo.add(pivote);
  const delantera = ruedaMoto();
  pivote.add(delantera);

  // Horquilla, manubrio, faro y salpicadera de adelante (giran con el pivote).
  for (const x of [-0.1, 0.1]) pivote.add(entre(tubo(0.032), V(x, 0, 0), V(x, 0.68, -0.22), MAT.cromo));
  pivote.add(entre(tubo(0.03), V(-0.36, 0.84, -0.3), V(0.36, 0.84, -0.3), MAT.metalOscuro));
  for (const x of [-0.36, 0.36]) pivote.add(entre(capsula(0.035), V(x * 0.85, 0.84, -0.3), V(x * 1.12, 0.84, -0.3), MAT.piel));
  const caja = cajaR(0.3, 0.24, 0.2, 0.08, piel);
  caja.position.set(0, 0.66, -0.12);
  pivote.add(caja);
  const faro = malla(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20).rotateX(Math.PI / 2), MAT.faro);
  faro.position.set(0, 0.64, 0.0);
  pivote.add(faro);
  const salpicadera = malla(new THREE.TorusGeometry(R + 0.04, 0.06, 8, 20, Math.PI * 0.6).rotateY(Math.PI / 2), piel);
  salpicadera.rotation.x = Math.PI * 0.2;
  pivote.add(salpicadera);

  // Chasis, motor y escape.
  cuerpo.add(entre(tubo(0.035), V(0, 0.98, 0.52), V(0, 0.82, -0.5), MAT.metalOscuro));
  cuerpo.add(entre(tubo(0.035), V(0, 0.98, 0.52), V(0, 0.42, 0.12), MAT.metalOscuro));
  for (const x of [-0.11, 0.11]) cuerpo.add(entre(tubo(0.03), V(x, 0.45, -0.1), V(x, R, -0.75), MAT.metalOscuro));
  const motor = cajaR(0.32, 0.34, 0.42, 0.06, MAT.metalOscuro);
  motor.position.set(0, 0.5, 0.06);
  cuerpo.add(motor);
  for (let i = 0; i < 4; i++) {
    const aleta = cajaR(0.36, 0.025, 0.3, 0.01, MAT.metal);
    aleta.position.set(0, 0.62 + i * 0.05, 0.12);
    cuerpo.add(aleta);
  }
  cuerpo.add(entre(tubo(0.035), V(0.16, 0.42, 0.15), V(0.18, 0.42, -0.4), MAT.cromo));
  const mofle = malla(new THREE.CapsuleGeometry(0.07, 0.38, 6, 14).rotateX(Math.PI / 2), MAT.cromo);
  mofle.position.set(0.19, 0.46, -0.62);
  cuerpo.add(mofle);

  // Tanque, asiento y cola.
  const tanque = malla(new THREE.SphereGeometry(1, 28, 18), piel);
  tanque.scale.set(0.22, 0.16, 0.33);
  tanque.position.set(0, 0.98, 0.22);
  cuerpo.add(tanque);
  const asiento = malla(new THREE.CapsuleGeometry(0.12, 0.5, 6, 14).rotateX(Math.PI / 2), MAT.piel);
  asiento.scale.set(1.25, 0.7, 1);
  asiento.position.set(0, 0.92, -0.32);
  cuerpo.add(asiento);
  const cola = cajaR(0.26, 0.16, 0.4, 0.07, piel);
  cola.position.set(0, 0.88, -0.72);
  cola.rotation.x = -0.15;
  cuerpo.add(cola);
  const calavera = cajaR(0.16, 0.07, 0.04, 0.02, MAT.calavera);
  calavera.position.set(0, 0.88, -0.94);
  cuerpo.add(calavera);

  // Piloto.
  const cadera = V(0, 1.0, -0.26);
  const hombro = V(0, 1.5, -0.04);
  for (const x of [-0.15, 0.15]) {
    const rodilla = V(x * 1.35, 0.96, 0.14);
    const pie = V(x * 1.4, 0.56, -0.02);
    cuerpo.add(entre(capsula(0.075), V(x, cadera.y, cadera.z), rodilla, pantalon));
    cuerpo.add(entre(capsula(0.065), rodilla, pie, pantalon));
    const bota = cajaR(0.12, 0.1, 0.2, 0.04, MAT.plastico);
    bota.position.set(pie.x, 0.52, pie.z + 0.04);
    cuerpo.add(bota);
    const mano = V(x * 2.3, 1.14, 0.47);
    cuerpo.add(entre(capsula(0.06), V(x * 1.4, hombro.y, hombro.z), mano, ropa));
    const guante = malla(new THREE.SphereGeometry(0.065, 14, 10), MAT.plastico);
    guante.position.copy(mano);
    cuerpo.add(guante);
  }
  cuerpo.add(entre(capsula(0.17), cadera, hombro, ropa));
  const cabeza = malla(new THREE.SphereGeometry(0.21, 28, 18), pielCasco);
  cabeza.position.set(0, 1.78, 0.02);
  cuerpo.add(cabeza);
  const visera = malla(new THREE.SphereGeometry(0.215, 24, 12, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.35, Math.PI * 0.28), MAT.vidrio);
  visera.position.copy(cabeza.position);
  cuerpo.add(visera);

  raiz.add(sombraPiso(1.3, 2.8));

  return {
    raiz, cuerpo, ruedas: [trasera, delantera], pivotesDelanteros: [pivote], piel, pielCasco, faros: [faro],
    radioRueda: R,
    anclaPaquete: { padre: cuerpo, x: 0, y: 1.2, z: -0.86, tam: 0.5 },
    alturaEstrellitas: 2.3,
  };
}

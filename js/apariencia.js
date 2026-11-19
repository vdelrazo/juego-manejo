// Cómo se ve cada vehículo: color, calcomanías, lodo, piezas y daños. Se guarda en este iPad.
//
// Calcomanías y manchas de lodo son "parches" (DecalGeometry) pegados sobre la carrocería:
// van dentro del vehículo, así que se mueven con él.

import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import {
  ponerRines, ponerLlantasGrandes, ponerAleron, ponerTecho, ponerColorCasco,
  piezasDanables, piezasDeLado, danarPieza,
} from './modelos.js';

const CLAVE = 'juego-manejo:vehiculos';
const N_MANCHAS = 14;
const MAX_CALCOMANIAS = 8;
const MAX_RAYONES = 6;

// Piezas que trae cada vehículo de fábrica.
export const PIEZAS_INICIALES = {
  carro: { rines: 'clasico', grandes: false, aleron: 'ninguno', techo: 'nada', claxon: 'normal' },
  moto: { casco: '#ffd60a', claxon: 'normal' },
  monstruo: { aleron: 'ninguno', techo: 'nada', claxon: 'normal' },
  bomberos: { claxon: 'bomberos' },
};

function leerTodo() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}
function guardarTodo(datos) {
  try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* no pasa nada */ }
}

function azarFijo(semilla) {
  return () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };
}

const redondear = (v) => Math.round(v * 1000) / 1000;

// ---------- Texturas ----------

const texturasCalcomania = new Map();
export function texturaCalcomania(emoji) {
  if (!texturasCalcomania.has(emoji)) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.font = '200px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 128, 140);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texturasCalcomania.set(emoji, t);
  }
  return texturasCalcomania.get(emoji);
}

let texturaRayon = null;
function rayon() {
  if (!texturaRayon) {
    const azar = azarFijo(42);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = i % 2 ? 'rgba(235,235,235,0.95)' : 'rgba(150,150,150,0.9)';
      g.lineWidth = 2 + azar() * 3;
      g.beginPath();
      const y = 30 + i * 12 + azar() * 6;
      g.moveTo(14 + azar() * 10, y);
      g.quadraticCurveTo(64, y + (azar() - 0.5) * 20, 114 - azar() * 10, y + (azar() - 0.5) * 16);
      g.stroke();
    }
    texturaRayon = new THREE.CanvasTexture(c);
    texturaRayon.colorSpace = THREE.SRGBColorSpace;
  }
  return texturaRayon;
}

let texturaLodo = null;
function lodo() {
  if (!texturaLodo) {
    const azar = azarFijo(99);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const mancha = (x, y, r, a) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(96,66,38,${a})`);
      grad.addColorStop(0.7, `rgba(110,78,45,${a * 0.9})`);
      grad.addColorStop(1, 'rgba(110,78,45,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    mancha(64, 64, 38, 0.95);
    for (let i = 0; i < 14; i++) {
      const a = azar() * Math.PI * 2, d = 20 + azar() * 30;
      mancha(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 6 + azar() * 12, 0.9);
    }
    texturaLodo = new THREE.CanvasTexture(c);
    texturaLodo.colorSpace = THREE.SRGBColorSpace;
  }
  return texturaLodo;
}

// ---------- Parches ----------

// Pega un parche sobre una pieza. p y n están en el espacio del "padre" de la pieza.
function parche(pieza, p, n, tam, giro, material) {
  pieza.updateMatrix();
  pieza.parent.updateWorldMatrix(true, false);
  tam /= pieza.parent.getWorldScale(new THREE.Vector3()).x || 1;
  const molde = new THREE.Mesh(pieza.geometry);
  molde.matrixWorld.copy(pieza.matrix);
  const ayuda = new THREE.Object3D();
  ayuda.position.copy(p);
  ayuda.lookAt(p.clone().add(n));
  ayuda.rotateZ(giro);
  const geo = new DecalGeometry(molde, p, ayuda.rotation, new THREE.Vector3(tam, tam, tam * 1.2));
  const m = new THREE.Mesh(geo, material);
  m.renderOrder = 2;
  pieza.parent.add(m);
  return m;
}

function materialParche(map, rugosidad) {
  return new THREE.MeshStandardMaterial({
    map, transparent: true, depthWrite: false, roughness: rugosidad,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
}

// Punto y normal de un toque (intersección del raycaster), en el espacio del padre de la pieza.
function puntoEnPieza(interseccion) {
  const pieza = interseccion.object;
  pieza.updateMatrix();
  const p = pieza.parent.worldToLocal(interseccion.point.clone());
  const n = interseccion.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(pieza.matrix)).normalize();
  return { pieza, p, n };
}

export class Apariencia {
  // origen: 'artista' o 'codigo' (las calcomanías guardadas solo sirven para el mismo modelo).
  constructor(tipo, modelo, origen = 'artista') {
    this.tipo = tipo;
    this.modelo = modelo;
    this.origen = origen;
    this.superficies = modelo.superficies;   // piezas donde se pueden pegar cosas
    this.colorDestino = null;
    this.calcomanias = [];                    // { datos, malla }
    this.lodo = 0;                            // 0 = limpio, 1 = lleno de lodo
    this.manchas = [];
    this.tamCalcomania = tipo === 'moto' ? 0.3 : 0.55;
    this.piezas = { ...PIEZAS_INICIALES[tipo] };
    this.danos = {};          // { defDel: true, … }
    this.rayones = [];        // { lugar, malla, quitando }
    this.prepararManchas();
    this.lugaresRayon = this.buscarLugares(7, 8, this.tipo === 'moto' ? 0.25 : 0.4);
    this.cargar();
    this.aplicarPiezas();
  }

  // ---------- Guardar y cargar ----------

  cargar() {
    const d = leerTodo()[this.tipo];
    if (!d) return;
    if (d.color) this.aplicarColor(d.color);
    const mismoModelo = (d.origen ?? 'codigo') === this.origen;
    if (mismoModelo) for (const c of d.calcomanias || []) this.pegar(c, false);
    this.lodo = d.lodo ?? 0;
    this.mostrarLodo();
    // Solo las piezas que este vehículo tiene (por ejemplo, la moto de artista no cambia rines).
    for (const [k, v] of Object.entries(d.piezas || {})) if (k in this.piezas) this.piezas[k] = v;
    for (const id of Object.keys(d.danos || {})) if (d.danos[id]) this.danar(id, false);
    if (mismoModelo) for (const k of d.rayones || []) this.rayar(k, false);
  }

  guardar() {
    const todo = leerTodo();
    todo[this.tipo] = {
      origen: this.origen,
      color: '#' + (this.colorDestino ?? this.modelo.piel.color).getHexString(),
      calcomanias: this.calcomanias.map((c) => c.datos),
      lodo: redondear(this.lodo),
      piezas: this.piezas,
      danos: this.danos,
      rayones: this.rayones.filter((r) => !r.quitando).map((r) => r.k),
    };
    guardarTodo(todo);
  }

  // ---------- Pintura ----------

  pintar(hex) {
    // Los modelos de artista pintan su paleta de una vez (la nube de pintura tapa el cambio).
    if (this.modelo.pintar) this.modelo.pintar(hex);
    else this.colorDestino = new THREE.Color(hex);
    this.guardar();
  }

  aplicarColor(hex) {
    if (this.modelo.pintar) this.modelo.pintar(hex);
    else this.modelo.piel.color.set(hex);
  }

  // ---------- Calcomanías ----------

  pegar({ e, i, p, n, g }, guardar = true) {
    const pieza = this.superficies[i];
    if (!pieza) return;
    const malla = parche(pieza, new THREE.Vector3(...p), new THREE.Vector3(...n), this.tamCalcomania, g, materialParche(texturaCalcomania(e), 0.35));
    this.calcomanias.push({ datos: { e, i, p, n, g }, malla });
    if (this.calcomanias.length > MAX_CALCOMANIAS) this.quitar(this.calcomanias.shift());
    if (guardar) this.guardar();
  }

  pegarEn(interseccion, emoji) {
    const i = this.superficies.indexOf(interseccion.object);
    if (i < 0) return false;
    const { p, n } = puntoEnPieza(interseccion);
    this.pegar({ e: emoji, i, p: p.toArray().map(redondear), n: n.toArray().map(redondear), g: redondear((Math.random() - 0.5) * 0.7) });
    return true;
  }

  quitar(c) {
    c.malla.removeFromParent();
    c.malla.geometry.dispose();
    c.malla.material.dispose();
  }

  quitarCalcomanias() {
    for (const c of this.calcomanias) this.quitar(c);
    this.calcomanias = [];
    this.guardar();
  }

  // ---------- Lodo ----------

  // ---------- Piezas ----------

  aplicarPiezas() {
    const m = this.modelo;
    const p = this.piezas;
    if ('rines' in p) ponerRines(m, p.rines);
    if ('grandes' in p) ponerLlantasGrandes(m, p.grandes);
    if ('aleron' in p) ponerAleron(m, p.aleron);
    if ('techo' in p) ponerTecho(m, p.techo);
    if ('casco' in p) ponerColorCasco(m, p.casco);
  }

  ponerPieza(nombre, valor) {
    this.piezas[nombre] = valor;
    this.aplicarPiezas();
    this.guardar();
  }

  // ---------- Daños (solo de apariencia) ----------

  // Un choque: se daña algo del lado que pegó; si ya todo está dañado, un rayón más.
  chocar(deFrente) {
    const sanas = piezasDeLado(this.modelo, deFrente).filter((id) => !this.danos[id]);
    if (sanas.length) this.danar(sanas[Math.floor(Math.random() * sanas.length)]);
    if (!sanas.length || Math.random() < 0.35) this.rayar();
  }

  danar(id, guardar = true) {
    // Solo lo que este vehículo puede mostrar (los de Kenney no tienen faros que se rompan).
    if (!(id in piezasDanables(this.modelo))) return;
    this.danos[id] = true;
    danarPieza(this.modelo, id, true);
    if (guardar) this.guardar();
  }

  rayar(k = null, guardar = true) {
    const usados = new Set(this.rayones.map((r) => r.k));
    if (k === null) {
      const libres = this.lugaresRayon.map((_, i) => i).filter((i) => !usados.has(i));
      if (!libres.length || this.rayones.length >= MAX_RAYONES) return;
      k = libres[Math.floor(Math.random() * libres.length)];
    }
    const lugar = this.lugaresRayon[k];
    if (!lugar || usados.has(k)) return;
    const malla = parche(lugar.pieza, lugar.p, lugar.n, lugar.tam, lugar.giro, materialParche(rayon(), 0.5));
    this.rayones.push({ k, lugar, malla, quitando: false, opacidad: 1 });
    if (guardar) this.guardar();
  }

  // Lo que hay que reparar, con su posición en el mundo (para poner la llave encima).
  pendientes() {
    const lista = [];
    const piezas = piezasDanables(this.modelo);
    for (const id of Object.keys(this.danos)) {
      if (this.danos[id] && piezas[id]) lista.push({ id, objeto: piezas[id], posicion: () => piezas[id].getWorldPosition(new THREE.Vector3()) });
    }
    for (const r of this.rayones) {
      if (!r.quitando) lista.push({ id: 'rayon', rayon: r, posicion: () => r.lugar.pieza.parent.localToWorld(r.lugar.p.clone()) });
    }
    return lista;
  }

  reparar(pendiente) {
    if (pendiente.id === 'rayon') {
      pendiente.rayon.quitando = true;
    } else {
      delete this.danos[pendiente.id];
      danarPieza(this.modelo, pendiente.id, false);
    }
    this.guardar();
  }

  get cuantosDanos() {
    return Object.values(this.danos).filter(Boolean).length + this.rayones.filter((r) => !r.quitando).length;
  }

  // Lugares fijos sobre la carrocería, encontrados disparando rayos hacia el vehículo.
  buscarLugares(semilla, cuantos, tamBase) {
    const raiz = this.modelo.raiz;
    raiz.updateMatrixWorld(true);
    const azar = azarFijo(semilla);
    const rayo = new THREE.Raycaster();
    const centro = new THREE.Vector3(0, this.tipo === 'moto' ? 0.9 : 0.75, 0);
    const largo = this.tipo === 'moto' ? 1.4 : 2.4;
    const lugares = [];
    for (let k = 0; k < 400 && lugares.length < cuantos; k++) {
      const dir = new THREE.Vector3(azar() - 0.5, (azar() - 0.6) * 0.8, (azar() - 0.5) * largo).normalize();
      rayo.set(centro.clone().addScaledVector(dir, 6), dir.clone().negate());
      const golpe = rayo.intersectObjects(this.superficies, false)[0];
      if (!golpe) continue;
      const { pieza, p, n } = puntoEnPieza(golpe);
      if (lugares.some((m) => m.pieza === pieza && m.p.distanceTo(p) < 0.4)) continue;
      lugares.push({ pieza, p, n, tam: tamBase + azar() * 0.15, giro: azar() * 6.28 });
    }
    return lugares;
  }

  // Lugares fijos donde puede caer lodo: se buscan disparando rayos hacia el vehículo.
  prepararManchas() {
    const raiz = this.modelo.raiz;
    raiz.updateMatrixWorld(true);
    const azar = azarFijo(this.tipo === 'moto' ? 5 : 3);
    const rayo = new THREE.Raycaster();
    const centro = new THREE.Vector3(0, this.tipo === 'moto' ? 0.9 : 0.75, 0);
    const largo = this.tipo === 'moto' ? 1.4 : 2.4;
    for (let k = 0; k < 400 && this.manchas.length < N_MANCHAS; k++) {
      // Más lodo en los lados y abajo que en el techo.
      const dir = new THREE.Vector3(azar() - 0.5, (azar() - 0.75) * 0.7, (azar() - 0.5) * largo).normalize();
      const origen = centro.clone().addScaledVector(dir, 6);
      rayo.set(origen, dir.clone().negate());
      const golpe = rayo.intersectObjects(this.superficies, false)[0];
      if (!golpe) continue;
      const { pieza, p, n } = puntoEnPieza(golpe);
      if (this.manchas.some((m) => m.pieza === pieza && m.p.distanceTo(p) < 0.35)) continue;
      this.manchas.push({ pieza, p, n, tam: (this.tipo === 'moto' ? 0.25 : 0.42) + azar() * 0.2, giro: azar() * 6.28, malla: null, opacidad: 0, quitando: false });
    }
  }

  mostrarLodo() {
    const visibles = Math.round(this.lodo * this.manchas.length);
    this.manchas.forEach((m, k) => {
      const debe = k < visibles;
      if (debe && !m.malla) m.malla = parche(m.pieza, m.p, m.n, m.tam, m.giro, materialParche(lodo(), 1));
      if (m.malla) {
        if (debe && !m.quitando) m.opacidad = 1;
        if (!debe && !m.quitando) m.opacidad = 0;
        m.malla.visible = m.opacidad > 0.01;
        m.malla.material.opacity = m.opacidad;
      }
    });
  }

  // Manejar ensucia poco a poco (cantidad: de 0 a 1).
  ensuciar(cantidad) {
    const antes = Math.round(this.lodo * this.manchas.length);
    this.lodo = Math.min(1, this.lodo + cantidad);
    if (Math.round(this.lodo * this.manchas.length) !== antes) {
      this.mostrarLodo();
      this.guardar();
    }
  }

  get manchasVisibles() {
    return this.manchas.filter((m) => m.malla && m.malla.visible && !m.quitando).length;
  }

  // Tallar en un punto (del mundo): quita la mancha más cercana. Devuelve true si quitó algo.
  tallarEn(puntoMundo) {
    let mejor = null;
    let distancia = this.tipo === 'moto' ? 0.55 : 0.95;   // generoso: los dedos son grandes
    for (const m of this.manchas) {
      if (!m.malla || !m.malla.visible || m.quitando) continue;
      const d = m.pieza.parent.localToWorld(m.p.clone()).distanceTo(puntoMundo);
      if (d < distancia) {
        distancia = d;
        mejor = m;
      }
    }
    if (!mejor) return false;
    mejor.quitando = true;
    this.lodo = Math.max(0, (this.manchasVisibles) / this.manchas.length);
    this.guardar();
    return true;
  }

  // ---------- Cada cuadro ----------

  actualizar(dt) {
    if (this.colorDestino) {
      this.modelo.piel.color.lerp(this.colorDestino, 1 - Math.exp(-6 * dt));
      if (Math.abs(this.modelo.piel.color.r - this.colorDestino.r) + Math.abs(this.modelo.piel.color.g - this.colorDestino.g) + Math.abs(this.modelo.piel.color.b - this.colorDestino.b) < 0.003) {
        this.modelo.piel.color.copy(this.colorDestino);
        this.colorDestino = null;
      }
    }
    for (let i = this.rayones.length - 1; i >= 0; i--) {
      const r = this.rayones[i];
      if (!r.quitando) continue;
      r.opacidad -= dt * 2;
      r.malla.material.opacity = Math.max(0, r.opacidad);
      if (r.opacidad <= 0) {
        r.malla.removeFromParent();
        r.malla.geometry.dispose();
        this.rayones.splice(i, 1);
        this.guardar();
      }
    }
    for (const m of this.manchas) {
      if (!m.quitando) continue;
      m.opacidad = Math.max(0, m.opacidad - dt * 3);
      m.malla.material.opacity = m.opacidad;
      if (m.opacidad <= 0) {
        m.quitando = false;
        m.malla.visible = false;
      }
    }
  }
}

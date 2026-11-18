// Retos: se van alternando estrellas → paquete → estacionarse → estrellas…
// Una flecha grande sobre el vehículo apunta al objetivo y la voz dice qué hacer.
// Al terminar uno hay festejo y, unos segundos después, empieza el siguiente.

import * as THREE from 'three';
import { COLORES_CASA } from './ciudad.js';

const ORDEN = ['estrellas', 'paquete', 'estacionarse'];
const N_ESTRELLAS = 6;
const RADIO_ESTRELLA = 3.5;       // qué tan cerca hay que pasar para juntarla
const RADIO_ENTREGA = 4.5;
const ESPERA_SIGUIENTE = 4;       // segundos de festejo antes del siguiente reto
const NUMEROS = ['¡Una!', '¡Dos!', '¡Tres!', '¡Cuatro!', '¡Cinco!', '¡Seis!'];
const AMARILLO = 0xffd60a;

const distancia = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function barajar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function formaEstrella(rFuera, rDentro) {
  const forma = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rFuera : rDentro;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) forma.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else forma.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return forma;
}

// Columna de luz que se ve de lejos, con un aro en el piso.
function crearFaro(radio) {
  const grupo = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false, fog: false });
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 40, 20, 1, true), material);
  columna.position.y = 20;
  const aro = new THREE.Mesh(
    new THREE.RingGeometry(radio * 0.75, radio, 32),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  aro.rotation.x = -Math.PI / 2;
  aro.position.y = 0.25;
  grupo.add(columna, aro);
  grupo.ponerColor = (hex) => {
    columna.material.color.setHex(hex);
    aro.material.color.setHex(hex);
  };
  grupo.visible = false;
  return grupo;
}

export class Retos {
  // ui: { decir(texto), estrella(numero), festejo(), mostrar(tipo, datos), ocultar() }
  constructor(escena, ciudad, ui) {
    this.ciudad = ciudad;
    this.ui = ui;
    this.tipo = null;
    this.fase = null;            // 'jugando' | 'festejo'
    this.reloj = 0;
    this.reiniciar();

    // Flecha que apunta al objetivo.
    const formaFlecha = new THREE.Shape();
    formaFlecha.moveTo(0, 1.2);
    formaFlecha.lineTo(0.85, 0.2);
    formaFlecha.lineTo(0.32, 0.2);
    formaFlecha.lineTo(0.32, -1.0);
    formaFlecha.lineTo(-0.32, -1.0);
    formaFlecha.lineTo(-0.32, 0.2);
    formaFlecha.lineTo(-0.85, 0.2);
    formaFlecha.closePath();
    const geoFlecha = new THREE.ExtrudeGeometry(formaFlecha, { depth: 0.3, bevelEnabled: false });
    geoFlecha.center();
    geoFlecha.rotateX(Math.PI / 2);        // acostada, apuntando hacia +z
    geoFlecha.scale(1.25, 1.25, 1.25);
    this.puntero = new THREE.Mesh(geoFlecha, new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xff8c00, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.1 }));
    this.puntero.castShadow = false;
    // La flecha va sobre una "placa" inclinada hacia la cámara (que está detrás del vehículo):
    // así se ve de frente y no de canto. Dentro de la placa gira hacia el objetivo.
    this.flecha = new THREE.Group();
    this.flecha.rotation.order = 'YXZ';
    this.flecha.add(this.puntero);
    this.flecha.visible = false;
    escena.add(this.flecha);

    // Estrellas para juntar.
    const geoEstrella = new THREE.ExtrudeGeometry(formaEstrella(1.0, 0.45), { depth: 0.3, bevelEnabled: false });
    geoEstrella.center();
    const matEstrella = new THREE.MeshStandardMaterial({ color: AMARILLO, emissive: 0xffb000, emissiveIntensity: 0.45, metalness: 0.55, roughness: 0.22 });
    this.estrellas = [];
    for (let i = 0; i < N_ESTRELLAS; i++) {
      const e = new THREE.Mesh(geoEstrella, matEstrella);
      e.castShadow = false;
      e.visible = false;
      escena.add(e);
      this.estrellas.push(e);
    }

    // Lugar de entrega del paquete.
    this.faroEntrega = crearFaro(3.2);
    escena.add(this.faroEntrega);

    // Cajón marcado en amarillo.
    this.marcaCajon = new THREE.Group();
    const relleno = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: AMARILLO, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    relleno.rotation.x = -Math.PI / 2;
    relleno.position.y = 0.2;
    this.rellenoCajon = relleno;
    this.bordesCajon = [];
    const matBorde = new THREE.MeshStandardMaterial({ color: AMARILLO, emissive: 0xffb000, emissiveIntensity: 0.5, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), matBorde);
      this.bordesCajon.push(b);
      this.marcaCajon.add(b);
    }
    this.faroCajon = crearFaro(1.8);
    this.faroCajon.ponerColor(AMARILLO);
    this.faroCajon.visible = true;
    this.marcaCajon.add(relleno, this.faroCajon);
    this.marcaCajon.visible = false;
    escena.add(this.marcaCajon);
  }

  reiniciar() {
    this.indice = 0;
    this.iColor = 0;
    this.cajonAnterior = null;
  }

  get activo() {
    return this.tipo !== null;
  }

  empezar(vehiculo) {
    this.ocultarTodo(vehiculo);
    this.tipo = ORDEN[this.indice % ORDEN.length];
    this.indice++;
    this.fase = 'jugando';
    this.flecha.visible = true;
    this.angulo = null;
    if (this.tipo === 'estrellas') this.empezarEstrellas(vehiculo);
    else if (this.tipo === 'paquete') this.empezarPaquete(vehiculo);
    else this.empezarEstacionarse();
  }

  detener(vehiculo) {
    this.ocultarTodo(vehiculo);
    this.tipo = null;
    this.fase = null;
    this.ui.ocultar();
  }

  ocultarTodo(vehiculo) {
    this.flecha.visible = false;
    for (const e of this.estrellas) e.visible = false;
    this.faroEntrega.visible = false;
    this.marcaCajon.visible = false;
    if (vehiculo?.paquete) vehiculo.paquete.visible = false;
  }

  // ---------- Estrellas ----------

  empezarEstrellas(vehiculo) {
    const p = vehiculo.posicion;
    const cerca = barajar(this.ciudad.puntosCalle.filter(([x, z]) => {
      const d = distancia(x, z, p.x, p.z);
      return d > 20 && d < 110;
    }));
    const elegidos = [];
    const todos = barajar([...this.ciudad.puntosCalle]);
    for (const [lista, minimo] of [[cerca, 28], [cerca, 18], [todos, 18], [todos, 0]]) {
      for (const punto of lista) {
        if (elegidos.length === N_ESTRELLAS) break;
        if (elegidos.includes(punto)) continue;
        if (elegidos.every(([x, z]) => distancia(x, z, punto[0], punto[1]) >= minimo)) elegidos.push(punto);
      }
    }
    elegidos.forEach(([x, z], i) => {
      const e = this.estrellas[i];
      e.position.set(x, 1.6, z);
      e.visible = true;
    });
    this.juntadas = 0;
    this.ui.mostrar('estrellas', { juntadas: 0, total: N_ESTRELLAS });
    this.ui.decir('¡Junta las seis estrellas! Sigue la flecha.');
  }

  // ---------- Paquete ----------

  empezarPaquete(vehiculo) {
    const p = vehiculo.posicion;
    const color = COLORES_CASA[this.iColor++ % COLORES_CASA.length];
    const lugares = this.ciudad.edificios
      .filter((e) => e.hex === color.hex)
      .map((e) => ({ x: e.puerta.x + e.puerta.nx * 6.5, z: e.puerta.z + e.puerta.nz * 6.5 }))
      .filter((l) => !this.ciudad.obstaculos.empujar(l.x, l.z, 1.5));
    const buenos = lugares.filter((l) => {
      const d = distancia(l.x, l.z, p.x, p.z);
      return d > 40 && d < 160;
    });
    const lista = buenos.length ? buenos : lugares;
    this.entrega = lista[Math.floor(Math.random() * lista.length)];
    this.faroEntrega.ponerColor(color.hex);
    this.faroEntrega.position.set(this.entrega.x, 0, this.entrega.z);
    this.faroEntrega.visible = true;
    vehiculo.paquete.visible = true;
    this.ui.mostrar('paquete', { hex: color.hex });
    this.ui.decir(`¡Lleva el paquete a la casa ${color.nombre}! Sigue la flecha.`);
  }

  // ---------- Estacionarse ----------

  empezarEstacionarse() {
    const libres = this.ciudad.cajones.filter((c) => !c.ocupado && c !== this.cajonAnterior);
    this.cajon = libres[Math.floor(Math.random() * libres.length)];
    this.cajonAnterior = this.cajon;
    const c = this.cajon;
    const ancho = c.x1 - c.x0;
    const largo = c.z1 - c.z0;
    this.marcaCajon.position.set(c.cx, 0, c.cz);
    this.rellenoCajon.scale.set(ancho - 0.3, largo - 0.3, 1);
    const g = 0.22;
    const [izq, der, frente, fondo] = this.bordesCajon;
    izq.scale.set(g, 1, largo); izq.position.set(-ancho / 2 + g / 2, 0.22, 0);
    der.scale.set(g, 1, largo); der.position.set(ancho / 2 - g / 2, 0.22, 0);
    frente.scale.set(ancho, 1, g); frente.position.set(0, 0.22, -largo / 2 + g / 2);
    fondo.scale.set(ancho, 1, g); fondo.position.set(0, 0.22, largo / 2 - g / 2);
    this.marcaCajon.visible = true;
    this.ui.mostrar('estacionarse', {});
    this.ui.decir('¡Estaciónate en el cajón amarillo! Sigue la flecha.');
  }

  // ---------- Cada cuadro ----------

  // estado: { cajon, estacionado } — dónde está el vehículo y si ya se quedó quieto ahí.
  actualizar(dt, vehiculo, estado) {
    if (!this.tipo) return;
    this.reloj += dt;

    if (this.fase === 'festejo') {
      // Se mide con el reloj de verdad: dura lo mismo aunque el iPad vaya lento.
      if (performance.now() >= this.finFestejo) this.empezar(vehiculo);
      return;
    }

    const p = vehiculo.posicion;
    let objetivo = null;

    if (this.tipo === 'estrellas') {
      let masCerca = Infinity;
      for (const e of this.estrellas) {
        if (!e.visible) continue;
        e.rotation.y += dt * 2.5;
        e.position.y = 1.6 + Math.sin(this.reloj * 3 + e.position.x) * 0.2;
        const d = distancia(e.position.x, e.position.z, p.x, p.z);
        if (d < RADIO_ESTRELLA) {
          e.visible = false;
          this.juntadas++;
          this.ui.estrella(this.juntadas);
          this.ui.mostrar('estrellas', { juntadas: this.juntadas, total: N_ESTRELLAS });
          if (this.juntadas === N_ESTRELLAS) {
            this.terminar('¡Muy bien! ¡Juntaste todas las estrellas!');
            return;
          }
          this.ui.decir(NUMEROS[this.juntadas - 1]);
          continue;
        }
        if (d < masCerca) {
          masCerca = d;
          objetivo = e.position;
        }
      }
    } else if (this.tipo === 'paquete') {
      const s = 1 + Math.sin(this.reloj * 4) * 0.08;
      this.faroEntrega.scale.set(s, 1, s);
      objetivo = this.entrega;
      if (distancia(this.entrega.x, this.entrega.z, p.x, p.z) < RADIO_ENTREGA) {
        vehiculo.paquete.visible = false;
        this.terminar('¡Muy bien! ¡Entregaste el paquete!');
        return;
      }
    } else {
      this.rellenoCajon.material.opacity = 0.35 + Math.sin(this.reloj * 5) * 0.15;
      objetivo = { x: this.cajon.cx, z: this.cajon.cz };
      if (estado.estacionado && estado.cajon === this.cajon) {
        this.terminar('¡Muy bien! ¡Te estacionaste!');
        return;
      }
    }

    if (objetivo) this.apuntar(dt, vehiculo, objetivo);
  }

  apuntar(dt, vehiculo, objetivo) {
    const p = vehiculo.posicion;
    const deseado = Math.atan2(objetivo.x - p.x, objetivo.z - p.z);
    if (this.angulo === null) this.angulo = deseado;
    // Gira por el lado más corto, con suavidad.
    let diferencia = deseado - this.angulo;
    diferencia = Math.atan2(Math.sin(diferencia), Math.cos(diferencia));
    this.angulo += diferencia * (1 - Math.exp(-8 * dt));
    this.flecha.rotation.set(-0.85, vehiculo.rumbo, 0);
    this.puntero.rotation.y = this.angulo - vehiculo.rumbo;
    this.flecha.position.set(p.x, p.y + vehiculo.alturaFlecha + Math.sin(this.reloj * 4) * 0.15, p.z);
  }

  terminar(frase) {
    this.fase = 'festejo';
    this.finFestejo = performance.now() + ESPERA_SIGUIENTE * 1000;
    this.flecha.visible = false;
    this.faroEntrega.visible = false;
    this.marcaCajon.visible = false;
    this.ui.festejo();
    this.ui.decir(frase);
  }
}

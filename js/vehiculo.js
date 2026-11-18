// El vehículo (carro o moto): cómo se mueve. Las formas están en modelos.js.
// Los dos se manejan igual; solo cambian la forma, el tamaño para chocar y el sonido.
// Reglas: avanza con el pedal verde, va de reversa con el azul (más lento), frena solo
// poco a poco al soltar, y puede girar estando parado, pero despacio.
// Al chocar rebota suave, se marea un momento y avisa con alChocar().

import * as THREE from 'three';
import { crearCarro, crearMoto } from './modelos.js';
import { Apariencia } from './apariencia.js';

export const VEL_MAX = 10;          // metros por segundo
const VEL_REVERSA = 4;              // 40 % de la velocidad máxima
const ACELERACION = 4;              // tarda unos 2.5 s en llegar a la velocidad máxima
const ACEL_REVERSA = 3;
const FRENO = 8;                    // al apretar el pedal contrario
const FRENADO_SOLO = 2.5;           // al soltar el pedal se detiene en unos 4 s
const FRENADO_REBOTE = 6;
const FRENADO_CAJON = 6;            // dentro de un cajón frena más, para que estacionarse sea fácil
const GIRO_PARADO = 0.5;            // radianes por segundo: media vuelta en unos 6 s
const GIRO_ANDANDO = 1.5;
const RESPUESTA_GIRO = 6;           // qué tan rápido obedece el volante

const UMBRAL_CHOQUE = 2;            // m/s contra algo para que cuente como choque
const TIEMPO_REBOTE = 0.5;          // segundos en que no hace caso a los pedales

// Lo que cambia entre carro y moto.
const MEDIDAS = {
  carro: {
    radioChoque: 1.1,           // se cuida con dos círculos: adelante y atrás
    distanciaCirculos: 1.0,
    ladeo: -0.05,               // el carro se ladea hacia afuera de la curva
    alturaFlecha: 3.5,
    camara: { distancia: 8.5, altura: 4.3, mira: 1.2, vuelta: 10 },
  },
  moto: {
    radioChoque: 0.6,
    distanciaCirculos: 0.55,
    ladeo: 0.32,                // la moto se inclina hacia adentro de la curva
    alturaFlecha: 2.9,
    camara: { distancia: 7, altura: 3.5, mira: 1.0, vuelta: 7.5 },
  },
};

const limitar = (v, min, max) => (v < min ? min : v > max ? max : v);

export class Vehiculo {
  constructor(tipo = 'carro') {
    this.tipo = tipo;
    Object.assign(this, MEDIDAS[tipo]);
    this.objeto = new THREE.Group();
    this.posicion = this.objeto.position;
    this.adelante = new THREE.Vector3(0, 0, 1);
    this.rumbo = 0;           // hacia dónde ve; 0 = +Z
    this.velocidad = 0;       // negativa = de reversa
    this.giro = 0;            // -1 izquierda … 1 derecha, ya suavizado
    this.cabeceo = 0;
    this.rebote = 0;          // tiempo que le queda al rebote de un choque
    this.mareo = 0;           // 1 justo al chocar, baja a 0
    this.reloj = 0;
    this.alChocar = null;
    // La forma: cuerpo (se ladea), ruedas, pivotes de las ruedas de adelante y piezas para el taller.
    this.modelo = tipo === 'moto' ? crearMoto() : crearCarro();
    this.objeto.add(this.modelo.raiz);
    this.cuerpo = this.modelo.cuerpo;
    this.ruedas = this.modelo.ruedas;
    this.pivotesDelanteros = this.modelo.pivotesDelanteros;
    this.radioRueda = this.modelo.radioRueda;
    this.armarPaquete();
    this.armarEstrellitas();
    this.apariencia = new Apariencia(tipo, this.modelo);
    // El vehículo no entra al mapa de sombras (que se recalcula de vez en cuando):
    // su sombra es la mancha suave pegada al piso que trae el modelo.
    this.objeto.traverse((m) => { m.castShadow = false; });
  }

  get fraccionVelocidad() {
    return this.velocidad / VEL_MAX;
  }

  colocar(x, z, rumbo) {
    this.posicion.set(x, 0, z);
    this.rumbo = rumbo;
    this.velocidad = 0;
    this.giro = 0;
    this.rebote = 0;
    this.mareo = 0;
    this.adelante.set(Math.sin(rumbo), 0, Math.cos(rumbo));
    this.objeto.rotation.y = rumbo;
  }

  actualizar(dt, mando, ciudad) {
    this.reloj += dt;
    const rebotando = this.rebote > 0;
    if (rebotando) this.rebote -= dt;
    const avanzar = !rebotando && mando.acelerar && !mando.reversa;
    const retroceder = !rebotando && mando.reversa && !mando.acelerar;

    // Velocidad: si va para un lado y se aprieta el otro pedal, primero frena.
    let v = this.velocidad;
    if (avanzar) {
      v = v < 0 ? Math.min(0, v + FRENO * dt) : Math.min(VEL_MAX, v + ACELERACION * dt);
    } else if (retroceder) {
      v = v > 0 ? Math.max(0, v - FRENO * dt) : Math.max(-VEL_REVERSA, v - ACEL_REVERSA * dt);
    } else {
      const frenado = rebotando ? FRENADO_REBOTE : ciudad.cajonDe(this) ? FRENADO_CAJON : FRENADO_SOLO;
      const f = frenado * dt;
      v = v > 0 ? Math.max(0, v - f) : Math.min(0, v + f);
    }
    this.velocidad = v;

    // Giro como en un vehículo de verdad: de reversa la nariz se va al lado contrario.
    // Parado gira despacio; la tasa cambia sin saltos entre parado, adelante y atrás.
    this.giro += (mando.giro - this.giro) * (1 - Math.exp(-RESPUESTA_GIRO * dt));
    const andando = limitar(v / 3, -1, 1);
    const tasa = GIRO_PARADO * (1 - Math.abs(andando)) + GIRO_ANDANDO * andando;
    this.rumbo -= this.giro * tasa * dt;
    this.adelante.set(Math.sin(this.rumbo), 0, Math.cos(this.rumbo));

    this.posicion.addScaledVector(this.adelante, v * dt);
    // Manejar ensucia: se llena de lodo en unos 800 m de calle (más rápido en el pasto).
    this.apariencia.ensuciar(Math.abs(v) * dt * (ciudad.esPasto(this.posicion.x, this.posicion.z) ? 0.004 : 0.0012));
    this.chocar(ciudad.obstaculos);

    // Sube y baja de la banqueta con suavidad.
    const piso = ciudad.alturaSuelo(this.posicion.x, this.posicion.z);
    this.posicion.y += (piso - this.posicion.y) * (1 - Math.exp(-14 * dt));

    this.objeto.rotation.y = this.rumbo;
    this.animar(dt, avanzar, retroceder);
    this.apariencia.actualizar(dt);
  }

  chocar(obstaculos) {
    let impacto = 0;
    let nx = 0;
    let nz = 0;
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      for (const lado of [1, -1]) {
        const cx = this.posicion.x + this.adelante.x * this.distanciaCirculos * lado;
        const cz = this.posicion.z + this.adelante.z * this.distanciaCirculos * lado;
        const golpe = obstaculos.empujar(cx, cz, this.radioChoque);
        if (!golpe) continue;
        this.posicion.x += golpe.nx * golpe.pen;
        this.posicion.z += golpe.nz * golpe.pen;
        // Qué tan rápido iba contra eso (solo cuenta si iba hacia él).
        const contra = -(this.adelante.x * golpe.nx + this.adelante.z * golpe.nz) * this.velocidad;
        if (contra > impacto) {
          impacto = contra;
          nx = golpe.nx;
          nz = golpe.nz;
        }
      }
    }
    if (impacto <= 0 || this.rebote > 0) return;

    if (impacto > UMBRAL_CHOQUE) {
      // Choque: rebota suave hacia el lado contrario y se marea un momento.
      this.velocidad = -Math.sign(this.velocidad) * Math.min(4, 1 + impacto * 0.35);
      this.rebote = TIEMPO_REBOTE;
      this.mareo = 1;
      this.apariencia.ensuciar(0.08);
      this.alChocar?.(impacto);
    } else {
      // Toque suave: de frente se detiene, de lado se desliza.
      const deFrente = Math.abs(this.adelante.x * nx + this.adelante.z * nz);
      this.velocidad *= 1 - deFrente;
    }
  }

  animar(dt, avanzar, retroceder) {
    // Ruedas que ruedan, y las de adelante que voltean.
    const vuelta = (this.velocidad * dt) / this.radioRueda;
    for (const rueda of this.ruedas) rueda.rotation.x += vuelta;
    for (const pivote of this.pivotesDelanteros) pivote.rotation.y = -this.giro * 0.45;

    // Ladeo en las curvas (el carro hacia afuera, la moto hacia adentro) y cabeceo al acelerar.
    const rapidez = Math.min(1, Math.abs(this.velocidad) / 4);
    this.cuerpo.rotation.z = this.giro * rapidez * this.ladeo;
    let cabeceoDeseado = 0;
    if (avanzar && this.velocidad < VEL_MAX * 0.95) cabeceoDeseado = -0.035;
    if (retroceder && this.velocidad > -VEL_REVERSA * 0.95) cabeceoDeseado = 0.03;
    this.cabeceo += (cabeceoDeseado - this.cabeceo) * (1 - Math.exp(-6 * dt));

    // Al chocar: se sacude y le salen estrellitas de mareo.
    this.mareo = Math.max(0, this.mareo - dt / 1.6);
    const sacudida = Math.sin(this.reloj * 32) * 0.07 * Math.max(0, this.mareo - 0.6) * 2.5;
    this.cuerpo.rotation.x = this.cabeceo + sacudida;
    this.estrellitas.visible = this.mareo > 0;
    if (this.estrellitas.visible) {
      this.estrellitas.rotation.y += dt * 5;
      const s = Math.min(1, this.mareo * 3);
      this.estrellitas.scale.set(s, s, s);
    }
  }

  // Caja de cartón para el reto del paquete (escondida hasta que hace falta).
  armarPaquete() {
    const { padre, x, y, z, tam } = this.modelo.anclaPaquete;
    this.paquete = new THREE.Group();
    this.paquete.position.set(x, y, z);
    const carton = new THREE.Mesh(
      new THREE.BoxGeometry(tam, tam * 0.75, tam),
      new THREE.MeshStandardMaterial({ color: 0xc8996b, roughness: 0.9 }),
    );
    const cinta = new THREE.Mesh(
      new THREE.BoxGeometry(tam * 1.02, tam * 0.76, tam * 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf1e3c8, roughness: 0.7 }),
    );
    carton.castShadow = cinta.castShadow = true;
    this.paquete.add(carton, cinta);
    this.paquete.visible = false;
    padre.add(this.paquete);
  }

  // Estrellitas de mareo, girando sobre el vehículo.
  armarEstrellitas() {
    const forma = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.32 : 0.14;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) forma.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else forma.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geoEstrella = new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: false });
    geoEstrella.center();
    const amarillo = new THREE.MeshStandardMaterial({ color: 0xffd60a, emissive: 0xffb800, emissiveIntensity: 0.6, roughness: 0.3 });
    this.estrellitas = new THREE.Group();
    this.estrellitas.position.y = this.modelo.alturaEstrellitas;
    for (let i = 0; i < 3; i++) {
      const estrella = new THREE.Mesh(geoEstrella, amarillo);
      const a = (i / 3) * Math.PI * 2;
      estrella.position.set(Math.cos(a) * 0.8, Math.sin(i * 2.1) * 0.12, Math.sin(a) * 0.8);
      estrella.rotation.y = -a;
      this.estrellitas.add(estrella);
    }
    this.estrellitas.visible = false;
    this.objeto.add(this.estrellitas);
  }
}

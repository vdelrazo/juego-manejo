// El carro: su forma (cajas y cilindros) y cómo se mueve.
// Reglas: avanza con el pedal verde, va de reversa con el azul (más lento), frena solo
// poco a poco al soltar, y puede girar estando parado, pero despacio.
// Al chocar rebota suave, se marea un momento y avisa con alChocar().

import * as THREE from '../vendor/three/three.module.js';

export const VEL_MAX = 10;          // metros por segundo
const VEL_REVERSA = 4;              // 40 % de la velocidad máxima
const ACELERACION = 4;              // tarda unos 2.5 s en llegar a la velocidad máxima
const ACEL_REVERSA = 3;
const FRENO = 8;                    // al apretar el pedal contrario
const FRENADO_SOLO = 2.5;           // al soltar el pedal se detiene en unos 4 s
const FRENADO_REBOTE = 6;
const GIRO_PARADO = 0.5;            // radianes por segundo: media vuelta en unos 6 s
const GIRO_ANDANDO = 1.5;
const RESPUESTA_GIRO = 6;           // qué tan rápido obedece el volante

const UMBRAL_CHOQUE = 2;            // m/s contra algo para que cuente como choque
const TIEMPO_REBOTE = 0.5;          // segundos en que no hace caso a los pedales
const RADIO_CHOQUE = 1.1;           // el carro se cuida con dos círculos: adelante y atrás
const DISTANCIA_CIRCULOS = 0.95;

const RADIO_RUEDA = 0.45;
const limitar = (v, min, max) => (v < min ? min : v > max ? max : v);

export class Vehiculo {
  constructor() {
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
    this.armarModelo();
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
      const f = (rebotando ? FRENADO_REBOTE : FRENADO_SOLO) * dt;
      v = v > 0 ? Math.max(0, v - f) : Math.min(0, v + f);
    }
    this.velocidad = v;

    // Giro como en un carro de verdad: de reversa la nariz se va al lado contrario.
    // Parado gira despacio; la tasa cambia sin saltos entre parado, adelante y atrás.
    this.giro += (mando.giro - this.giro) * (1 - Math.exp(-RESPUESTA_GIRO * dt));
    const andando = limitar(v / 3, -1, 1);
    const tasa = GIRO_PARADO * (1 - Math.abs(andando)) + GIRO_ANDANDO * andando;
    this.rumbo -= this.giro * tasa * dt;
    this.adelante.set(Math.sin(this.rumbo), 0, Math.cos(this.rumbo));

    this.posicion.addScaledVector(this.adelante, v * dt);
    this.chocar(ciudad.obstaculos);

    // Sube y baja de la banqueta con suavidad.
    const piso = ciudad.alturaSuelo(this.posicion.x, this.posicion.z);
    this.posicion.y += (piso - this.posicion.y) * (1 - Math.exp(-14 * dt));

    this.objeto.rotation.y = this.rumbo;
    this.animar(dt, avanzar, retroceder);
  }

  chocar(obstaculos) {
    let impacto = 0;
    let nx = 0;
    let nz = 0;
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      for (const lado of [1, -1]) {
        const cx = this.posicion.x + this.adelante.x * DISTANCIA_CIRCULOS * lado;
        const cz = this.posicion.z + this.adelante.z * DISTANCIA_CIRCULOS * lado;
        const golpe = obstaculos.empujar(cx, cz, RADIO_CHOQUE);
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
      this.alChocar?.(impacto);
    } else {
      // Toque suave: de frente se detiene, de lado se desliza.
      const deFrente = Math.abs(this.adelante.x * nx + this.adelante.z * nz);
      this.velocidad *= 1 - deFrente;
    }
  }

  animar(dt, avanzar, retroceder) {
    // Ruedas que ruedan, y las de adelante que voltean.
    const vuelta = (this.velocidad * dt) / RADIO_RUEDA;
    for (const rueda of this.ruedas) rueda.rotation.x += vuelta;
    for (const pivote of this.pivotesDelanteros) pivote.rotation.y = -this.giro * 0.45;

    // El cuerpo se ladea en las curvas y cabecea al acelerar.
    const rapidez = Math.min(1, Math.abs(this.velocidad) / 4);
    this.cuerpo.rotation.z = -this.giro * rapidez * 0.06;
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

  armarModelo() {
    const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const ROJO = lambert(0xef233c);
    const VIDRIO = lambert(0xa8dadc);
    const OSCURO = lambert(0x2b2d42);
    const FARO = lambert(0xffd166);
    const CALAVERA = lambert(0xd90429);
    const LLANTA = lambert(0x222222);
    const RIN = lambert(0xdddddd);
    const AMARILLO = new THREE.MeshLambertMaterial({ color: 0xffd60a, emissive: 0x8a6d00 });

    const caja = (material, an, al, la, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(an, al, la), material);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

    // Todo lo que no son ruedas va en "cuerpo", para poder ladearlo.
    this.cuerpo = new THREE.Group();
    this.cuerpo.position.y = 0.45;
    this.cuerpo.add(
      caja(ROJO, 1.9, 0.62, 3.6, 0, 0.3, 0),            // carrocería
      caja(VIDRIO, 1.6, 0.66, 1.9, 0, 0.92, -0.25),     // ventanas
      caja(ROJO, 1.72, 0.16, 2.02, 0, 1.3, -0.25),      // techo
      caja(OSCURO, 2.0, 0.28, 0.22, 0, 0.1, 1.84),      // defensa de adelante
      caja(OSCURO, 2.0, 0.28, 0.22, 0, 0.1, -1.84),     // defensa de atrás
      caja(FARO, 0.42, 0.22, 0.06, 0.6, 0.4, 1.81),
      caja(FARO, 0.42, 0.22, 0.06, -0.6, 0.4, 1.81),
      caja(CALAVERA, 0.4, 0.2, 0.06, 0.62, 0.42, -1.81),
      caja(CALAVERA, 0.4, 0.2, 0.06, -0.62, 0.42, -1.81),
    );
    this.objeto.add(this.cuerpo);

    // Ruedas: pivote (para voltear) → rueda (para rodar) → llanta y rin.
    const geoLlanta = new THREE.CylinderGeometry(RADIO_RUEDA, RADIO_RUEDA, 0.36, 14);
    geoLlanta.rotateZ(Math.PI / 2);
    const geoRin = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8);
    geoRin.rotateZ(Math.PI / 2);

    this.ruedas = [];
    this.pivotesDelanteros = [];
    for (const [x, z] of [[0.96, 1.2], [-0.96, 1.2], [0.96, -1.2], [-0.96, -1.2]]) {
      const pivote = new THREE.Group();
      pivote.position.set(x, RADIO_RUEDA, z);
      const rueda = new THREE.Group();
      const llanta = new THREE.Mesh(geoLlanta, LLANTA);
      llanta.castShadow = true;
      rueda.add(llanta, new THREE.Mesh(geoRin, RIN));
      pivote.add(rueda);
      this.objeto.add(pivote);
      this.ruedas.push(rueda);
      if (z > 0) this.pivotesDelanteros.push(pivote);
    }

    // Estrellitas de mareo, girando sobre el techo.
    const forma = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.32 : 0.14;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) forma.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else forma.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geoEstrella = new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: false });
    geoEstrella.center();
    this.estrellitas = new THREE.Group();
    this.estrellitas.position.y = 2.5;
    for (let i = 0; i < 3; i++) {
      const estrella = new THREE.Mesh(geoEstrella, AMARILLO);
      const a = (i / 3) * Math.PI * 2;
      estrella.position.set(Math.cos(a) * 0.8, Math.sin(i * 2.1) * 0.12, Math.sin(a) * 0.8);
      estrella.rotation.y = -a;
      this.estrellitas.add(estrella);
    }
    this.estrellitas.visible = false;
    this.objeto.add(this.estrellitas);
  }
}

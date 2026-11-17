// El carro: su forma (cajas y cilindros) y cómo se mueve.
// Reglas: avanza mientras se aprieta el pedal, frena solo poco a poco al soltarlo,
// no tiene reversa y puede girar estando parado, pero despacio.

import * as THREE from '../vendor/three/three.module.js';

export const VEL_MAX = 10;          // metros por segundo
const ACELERACION = 4;              // tarda unos 2.5 s en llegar a la velocidad máxima
const FRENADO_SOLO = 2.5;           // al soltar el pedal se detiene en unos 4 s
const GIRO_PARADO = 0.5;            // radianes por segundo: media vuelta en unos 6 s
const GIRO_ANDANDO = 1.5;
const RESPUESTA_GIRO = 6;           // qué tan rápido obedece el volante
const VEL_EN_LA_ORILLA = 2;

const RADIO_RUEDA = 0.45;

export class Vehiculo {
  constructor() {
    this.objeto = new THREE.Group();
    this.posicion = this.objeto.position;
    this.adelante = new THREE.Vector3(0, 0, 1);
    this.rumbo = 0;           // hacia dónde ve; 0 = +Z
    this.velocidad = 0;
    this.giro = 0;            // -1 izquierda … 1 derecha, ya suavizado
    this.cabeceo = 0;
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
    this.adelante.set(Math.sin(rumbo), 0, Math.cos(rumbo));
    this.objeto.rotation.y = rumbo;
  }

  actualizar(dt, mando, radioLimite) {
    // Velocidad
    if (mando.acelerar) {
      this.velocidad = Math.min(VEL_MAX, this.velocidad + ACELERACION * dt);
    } else {
      this.velocidad = Math.max(0, this.velocidad - FRENADO_SOLO * dt);
    }

    // Giro: suave, y más lento cuando va parado o muy despacio.
    this.giro += (mando.giro - this.giro) * (1 - Math.exp(-RESPUESTA_GIRO * dt));
    const andando = Math.min(1, this.velocidad / 3);
    const tasa = GIRO_PARADO + (GIRO_ANDANDO - GIRO_PARADO) * andando;
    this.rumbo -= this.giro * tasa * dt;
    this.adelante.set(Math.sin(this.rumbo), 0, Math.cos(this.rumbo));

    this.posicion.addScaledVector(this.adelante, this.velocidad * dt);

    // En la orilla del prado se detiene (todavía sin choque: eso es de la fase 2).
    const distancia = Math.hypot(this.posicion.x, this.posicion.z);
    if (distancia > radioLimite) {
      this.posicion.x *= radioLimite / distancia;
      this.posicion.z *= radioLimite / distancia;
      this.velocidad = Math.min(this.velocidad, VEL_EN_LA_ORILLA);
    }

    this.objeto.rotation.y = this.rumbo;
    this.animar(dt, mando.acelerar);
  }

  animar(dt, acelerando) {
    // Ruedas que ruedan, y las de adelante que voltean.
    const vuelta = (this.velocidad * dt) / RADIO_RUEDA;
    for (const rueda of this.ruedas) rueda.rotation.x += vuelta;
    for (const pivote of this.pivotesDelanteros) pivote.rotation.y = -this.giro * 0.45;

    // El cuerpo se ladea en las curvas y levanta un poco la nariz al acelerar.
    const andando = Math.min(1, this.velocidad / 4);
    this.cuerpo.rotation.z = -this.giro * andando * 0.06;
    const cabeceoDeseado = acelerando && this.velocidad < VEL_MAX * 0.95 ? -0.035 : 0;
    this.cabeceo += (cabeceoDeseado - this.cabeceo) * (1 - Math.exp(-6 * dt));
    this.cuerpo.rotation.x = this.cabeceo;
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
  }
}

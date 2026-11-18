// El vehículo (carro o moto): su forma (cajas y cilindros) y cómo se mueve.
// Los dos se manejan igual; solo cambian la forma, el tamaño para chocar y el sonido.
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
const FRENADO_CAJON = 6;            // dentro de un cajón frena más, para que estacionarse sea fácil
const GIRO_PARADO = 0.5;            // radianes por segundo: media vuelta en unos 6 s
const GIRO_ANDANDO = 1.5;
const RESPUESTA_GIRO = 6;           // qué tan rápido obedece el volante

const UMBRAL_CHOQUE = 2;            // m/s contra algo para que cuente como choque
const TIEMPO_REBOTE = 0.5;          // segundos en que no hace caso a los pedales

// Lo que cambia entre carro y moto.
const MEDIDAS = {
  carro: {
    radioRueda: 0.45,
    radioChoque: 1.1,           // se cuida con dos círculos: adelante y atrás
    distanciaCirculos: 0.95,
    ladeo: -0.06,               // el carro se ladea hacia afuera de la curva
    alturaFlecha: 3.4,
    camara: { distancia: 8.5, altura: 4.3, mira: 1.2, vuelta: 10 },
  },
  moto: {
    radioRueda: 0.36,
    radioChoque: 0.6,
    distanciaCirculos: 0.55,
    ladeo: 0.32,                // la moto se inclina hacia adentro de la curva
    alturaFlecha: 2.9,
    camara: { distancia: 7, altura: 3.5, mira: 1.0, vuelta: 7.5 },
  },
};

const limitar = (v, min, max) => (v < min ? min : v > max ? max : v);
const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

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
    this.ruedas = [];
    this.pivotesDelanteros = [];
    if (tipo === 'moto') this.armarMoto();
    else this.armarCarro();
    this.armarEstrellitas();
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

  // ---------- Formas ----------

  caja(material, an, al, la, x, y, z, padre = this.cuerpo) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(an, al, la), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    padre.add(m);
    return m;
  }

  // Rueda: rueda (para rodar) → llanta y rin. Va dentro de "padre".
  rueda(padre, x, y, z, ancho) {
    const r = this.radioRueda;
    const geoLlanta = new THREE.CylinderGeometry(r, r, ancho, 14);
    geoLlanta.rotateZ(Math.PI / 2);
    const geoRin = new THREE.CylinderGeometry(r * 0.44, r * 0.44, ancho + 0.02, 8);
    geoRin.rotateZ(Math.PI / 2);
    const rueda = new THREE.Group();
    rueda.position.set(x, y, z);
    const llanta = new THREE.Mesh(geoLlanta, lambert(0x222222));
    llanta.castShadow = true;
    rueda.add(llanta, new THREE.Mesh(geoRin, lambert(0xdddddd)));
    padre.add(rueda);
    this.ruedas.push(rueda);
    return rueda;
  }

  // Caja de cartón para el reto del paquete (escondida hasta que hace falta).
  armarPaquete(padre, tam, x, y, z) {
    this.paquete = new THREE.Group();
    this.paquete.position.set(x, y, z);
    this.caja(lambert(0xc8996b), tam, tam * 0.75, tam, 0, 0, 0, this.paquete);
    this.caja(lambert(0xf1e3c8), tam * 1.02, tam * 0.76, tam * 0.18, 0, 0, 0, this.paquete);   // cinta
    this.paquete.visible = false;
    padre.add(this.paquete);
  }

  armarCarro() {
    const ROJO = lambert(0xef233c);
    const VIDRIO = lambert(0xa8dadc);
    const OSCURO = lambert(0x2b2d42);
    const FARO = lambert(0xffd166);
    const CALAVERA = lambert(0xd90429);

    // Todo lo que no son ruedas va en "cuerpo", para poder ladearlo.
    this.cuerpo = new THREE.Group();
    this.cuerpo.position.y = 0.45;
    this.objeto.add(this.cuerpo);
    this.caja(ROJO, 1.9, 0.62, 3.6, 0, 0.3, 0);            // carrocería
    this.caja(VIDRIO, 1.6, 0.66, 1.9, 0, 0.92, -0.25);     // ventanas
    this.caja(ROJO, 1.72, 0.16, 2.02, 0, 1.3, -0.25);      // techo
    this.caja(OSCURO, 2.0, 0.28, 0.22, 0, 0.1, 1.84);      // defensa de adelante
    this.caja(OSCURO, 2.0, 0.28, 0.22, 0, 0.1, -1.84);     // defensa de atrás
    this.caja(FARO, 0.42, 0.22, 0.06, 0.6, 0.4, 1.81);
    this.caja(FARO, 0.42, 0.22, 0.06, -0.6, 0.4, 1.81);
    this.caja(CALAVERA, 0.4, 0.2, 0.06, 0.62, 0.42, -1.81);
    this.caja(CALAVERA, 0.4, 0.2, 0.06, -0.62, 0.42, -1.81);
    this.armarPaquete(this.cuerpo, 0.9, 0, 1.72, -0.25);

    // Ruedas: las de adelante van dentro de un pivote para voltear.
    for (const [x, z] of [[0.96, 1.2], [-0.96, 1.2], [0.96, -1.2], [-0.96, -1.2]]) {
      if (z > 0) {
        const pivote = new THREE.Group();
        pivote.position.set(x, this.radioRueda, z);
        this.objeto.add(pivote);
        this.pivotesDelanteros.push(pivote);
        this.rueda(pivote, 0, 0, 0, 0.36);
      } else {
        this.rueda(this.objeto, x, this.radioRueda, z, 0.36);
      }
    }
  }

  armarMoto() {
    const AZUL = lambert(0x1d7ff2);
    const OSCURO = lambert(0x2b2d42);
    const METAL = lambert(0x8d99ae);
    const FARO = lambert(0xffd166);
    const CALAVERA = lambert(0xd90429);
    const CASCO = lambert(0xffd60a);
    const CHAMARRA = lambert(0x06d6a0);
    const PANTALON = lambert(0x3d405b);

    // En la moto todo se inclina junto, desde el piso.
    this.cuerpo = new THREE.Group();
    this.objeto.add(this.cuerpo);
    const r = this.radioRueda;

    this.rueda(this.cuerpo, 0, r, -0.72, 0.16);
    const pivote = new THREE.Group();          // horquilla, manubrio y llanta de adelante
    pivote.position.set(0, r, 0.78);
    this.cuerpo.add(pivote);
    this.pivotesDelanteros.push(pivote);
    this.rueda(pivote, 0, 0, 0, 0.16);
    this.caja(METAL, 0.06, 0.75, 0.06, 0.1, 0.36, -0.02, pivote);      // horquilla
    this.caja(METAL, 0.06, 0.75, 0.06, -0.1, 0.36, -0.02, pivote);
    this.caja(OSCURO, 0.78, 0.07, 0.07, 0, 0.78, -0.1, pivote);         // manubrio
    this.caja(FARO, 0.24, 0.18, 0.08, 0, 0.6, 0.06, pivote);            // faro

    this.caja(METAL, 0.28, 0.24, 1.2, 0, 0.55, 0);                      // chasis
    this.caja(lambert(0x5c6370), 0.34, 0.32, 0.42, 0, 0.42, 0.05);      // motor
    this.caja(AZUL, 0.44, 0.3, 0.56, 0, 0.82, 0.3);                     // tanque
    this.caja(OSCURO, 0.36, 0.12, 0.7, 0, 0.88, -0.3);                  // asiento
    this.caja(AZUL, 0.26, 0.08, 0.55, 0, 0.8, -0.78);                   // salpicadera
    this.caja(CALAVERA, 0.2, 0.1, 0.05, 0, 0.8, -1.06);

    // Piloto.
    for (const x of [0.2, -0.2]) {
      this.caja(PANTALON, 0.16, 0.16, 0.5, x, 1.0, -0.12);              // muslos
      this.caja(PANTALON, 0.15, 0.48, 0.15, x * 1.1, 0.72, 0.14);       // piernas
    }
    const torso = this.caja(CHAMARRA, 0.46, 0.58, 0.3, 0, 1.28, -0.15);
    torso.rotation.x = 0.35;
    for (const x of [0.25, -0.25]) {
      const brazo = this.caja(CHAMARRA, 0.13, 0.13, 0.83, x, 1.32, 0.33);
      brazo.rotation.x = 0.45;
    }
    const casco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), CASCO);
    casco.position.set(0, 1.78, 0);
    casco.castShadow = true;
    this.cuerpo.add(casco);
    this.caja(OSCURO, 0.32, 0.1, 0.06, 0, 1.76, 0.23);                  // visera

    this.armarPaquete(this.cuerpo, 0.55, 0, 1.12, -0.9);
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
    const amarillo = new THREE.MeshLambertMaterial({ color: 0xffd60a, emissive: 0x8a6d00 });
    this.estrellitas = new THREE.Group();
    this.estrellitas.position.y = this.tipo === 'moto' ? 2.3 : 2.5;
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

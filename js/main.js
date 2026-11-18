// Arranque del juego: escena, cámara, pantallas y el ciclo de cada cuadro.

import * as THREE from '../vendor/three/three.module.js';
import { crearCiudad } from './ciudad.js';
import { Vehiculo } from './vehiculo.js';
import { Controles, alTocar } from './controles.js';
import * as sonido from './sonido.js';

const $ = (id) => document.getElementById(id);

// ---------- Escena ----------

const renderer = new THREE.WebGLRenderer({ canvas: $('escena'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(60, 1, 0.3, 500);
const ciudad = crearCiudad(escena);
const SALIDA = ciudad.salida;

const carro = new Vehiculo();
escena.add(carro.objeto);
carro.colocar(SALIDA.x, SALIDA.z, SALIDA.rumbo);

function ajustarTamano() {
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  renderer.setSize(ancho, alto, false);
  camara.aspect = ancho / alto;
  camara.updateProjectionMatrix();
}
addEventListener('resize', ajustarTamano);
ajustarTamano();

// ---------- Controles ----------

const hud = $('hud');
const btnModo = $('btn-modo');

const controles = new Controles({
  hud,
  btnIzq: $('btn-izq'),
  btnDer: $('btn-der'),
  btnAcelerar: $('btn-acelerar'),
  btnReversa: $('btn-reversa'),
  btnModo,
  alCambiarModo(modo) {
    sonido.sonidoSi();
    sonido.decir(modo === 'inclinar' ? '¡Gira el iPad como un volante!' : '¡Usa las flechas!');
  },
  alNoPoderInclinar() {
    sonido.sonidoNo();
    btnModo.classList.remove('no-se-puede');
    void btnModo.offsetWidth;   // para que la animación vuelva a empezar
    btnModo.classList.add('no-se-puede');
  },
});

// iOS no deja hacer zoom con dos dedos si se cancela este gesto.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Choques: "¡Cuidado, me dolió!" ----------

const avisoChoque = $('aviso-choque');
let ultimoBoing = -10;
let ultimoAviso = -10;
let ocultarAviso = 0;

carro.alChocar = () => {
  const ahora = performance.now() / 1000;
  if (ahora - ultimoBoing > 0.4) {
    sonido.sonidoChoque();
    ultimoBoing = ahora;
  }
  // El mensaje y la voz esperan unos segundos para no repetirse si se queda empujando.
  if (ahora - ultimoAviso > 3) {
    ultimoAviso = ahora;
    sonido.decir('¡Cuidado, me dolió!');
    avisoChoque.hidden = true;
    void avisoChoque.offsetWidth;   // para que la animación vuelva a empezar
    avisoChoque.hidden = false;
    clearTimeout(ocultarAviso);
    ocultarAviso = setTimeout(() => { avisoChoque.hidden = true; }, 1800);
  }
};

// ---------- Pantallas ----------

let jugando = false;
let saltarCamara = true;
const vertical = matchMedia('(orientation: portrait)');

// ▶ usa "click" a propósito: es el evento que iOS acepta para pedir el permiso
// de inclinación, activar el audio y la voz. Las tres cosas tienen que pasar aquí.
$('btn-jugar').addEventListener('click', () => {
  controles.pedirPermisoInclinacion();
  sonido.iniciarAudio();
  sonido.decir('¡Vámonos!');
  carro.colocar(SALIDA.x, SALIDA.z, SALIDA.rumbo);
  saltarCamara = true;
  jugando = true;
  $('inicio').hidden = true;
  hud.hidden = false;
});

alTocar($('btn-casa'), () => {
  jugando = false;
  controles.soltarTodo();
  carro.colocar(SALIDA.x, SALIDA.z, SALIDA.rumbo);
  saltarCamara = true;
  hud.hidden = true;
  avisoChoque.hidden = true;
  $('inicio').hidden = false;
});

vertical.addEventListener('change', () => {
  if (!vertical.matches) return;
  controles.soltarTodo();
  if (jugando) sonido.decir('¡Gira tu iPad!');
});

// ---------- Cámara ----------

const DISTANCIA_CAMARA = 8.5;
const ALTURA_CAMARA = 4.3;
const posicionDeseada = new THREE.Vector3();
const miraDeseada = new THREE.Vector3();
const mira = new THREE.Vector3();
let anguloVuelta = 0;

// Pone la cámara a cierta distancia del vehículo, en la dirección (dx, dz);
// si un edificio estorba, se acerca y sube para ver por encima.
// Devuelve qué tan lejos quedó, de 0 (encima del vehículo) a 1 (distancia normal).
function colocarCamara(dx, dz, distancia, altura) {
  const p = carro.posicion;
  const libre = ciudad.obstaculos.libre(p.x, p.z, p.x + dx * distancia, p.z + dz * distancia);
  const d = libre < 1 ? Math.max(2.2, libre * distancia - 0.8) : distancia;
  posicionDeseada.set(p.x + dx * d, p.y + altura + (distancia - d) * 0.45, p.z + dz * d);
  return d / distancia;
}

function moverCamara(dt) {
  const p = carro.posicion;
  if (jugando) {
    // Detrás del vehículo y un poco arriba, viendo un poco hacia adelante
    // (menos hacia adelante si la cámara tuvo que acercarse).
    const lejos = colocarCamara(-carro.adelante.x, -carro.adelante.z, DISTANCIA_CAMARA, ALTURA_CAMARA);
    miraDeseada.copy(p).addScaledVector(carro.adelante, 4 * lejos * lejos);
    miraDeseada.y = p.y + 1.2;
  } else {
    // En la pantalla de inicio la cámara le da vueltas; mirar un poco abajo deja el carro arriba del ▶.
    anguloVuelta += dt * 0.25;
    colocarCamara(Math.sin(anguloVuelta), Math.cos(anguloVuelta), 10, 4.5);
    miraDeseada.set(p.x, p.y - 0.5, p.z);
  }

  if (saltarCamara) {
    camara.position.copy(posicionDeseada);
    mira.copy(miraDeseada);
    saltarCamara = false;
  } else {
    const k = 1 - Math.exp(-dt * 3.5);
    camara.position.lerp(posicionDeseada, k);
    mira.lerp(miraDeseada, k);
  }
  camara.lookAt(mira);
}

// ---------- Datos para revisar en el iPad: agregar ?depurar a la dirección ----------

const depurar = new URLSearchParams(location.search).has('depurar') ? $('depurar') : null;
if (depurar) depurar.hidden = false;
let cuadros = 0;
let desdeUltimoConteo = 0;
let fps = 0;

function mostrarDepuracion(dt) {
  cuadros++;
  desdeUltimoConteo += dt;
  if (desdeUltimoConteo < 0.5) return;
  fps = Math.round(cuadros / desdeUltimoConteo);
  cuadros = 0;
  desdeUltimoConteo = 0;
  const c = controles;
  depurar.textContent =
    `${fps} fps · vel ${carro.velocidad.toFixed(1)} · modo ${c.modo} · permiso ${c.permiso} · sensor ${c.hayDatos ? 'sí' : 'no'}\n` +
    `giro ${c.giroInclinacion.toFixed(2)} · lado ${c.lecturaCruda.lado.toFixed(1)} · ` +
    `vertical ${c.lecturaCruda.vertical.toFixed(1)} · signo ${c.signo}`;
}

// ---------- Ciclo de cada cuadro ----------

const QUIETO = { giro: 0, acelerar: false, reversa: false };
let antes = performance.now();
let siguientePitido = 0;

renderer.setAnimationLoop((ahora) => {
  const dt = Math.min(0.05, Math.max(0, (ahora - antes) / 1000));
  antes = ahora;

  const manejando = jugando && !vertical.matches;
  carro.actualizar(dt, manejando ? controles.leer() : QUIETO, ciudad);
  moverCamara(dt);
  ciudad.seguir(carro.posicion);
  sonido.actualizarMotor(Math.abs(carro.fraccionVelocidad), jugando);

  // "Pi-pi-pi" mientras va de reversa.
  if (jugando && carro.velocidad < -0.3) {
    if (ahora >= siguientePitido) {
      sonido.pitidoReversa();
      siguientePitido = ahora + 600;
    }
  } else {
    siguientePitido = 0;
  }

  renderer.render(escena, camara);
  if (depurar) mostrarDepuracion(dt);
});

// Para revisar el estado desde la consola o en pruebas automáticas.
if (depurar) {
  window.__juego = { carro, controles, ciudad, camara, escena, renderer, get jugando() { return jugando; } };
}

// Todo listo: ya se puede jugar.
$('cargando').hidden = true;
$('btn-jugar').hidden = false;

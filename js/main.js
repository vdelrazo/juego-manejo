// Arranque del juego: escena, cámara, pantallas y el ciclo de cada cuadro.

import * as THREE from '../vendor/three/three.module.js';
import { crearMundo, RADIO_MANEJO, RADIO_CAMINO } from './mundo.js';
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
const camara = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const mundo = crearMundo(escena);

const carro = new Vehiculo();
escena.add(carro.objeto);

// Se empieza sobre el camino, viendo hacia donde sigue la curva.
const SALIDA = { x: 0, z: -RADIO_CAMINO, rumbo: Math.PI / 2 };
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
  $('inicio').hidden = false;
});

vertical.addEventListener('change', () => {
  if (!vertical.matches) return;
  controles.soltarTodo();
  if (jugando) sonido.decir('¡Gira tu iPad!');
});

// ---------- Cámara ----------

const posicionDeseada = new THREE.Vector3();
const miraDeseada = new THREE.Vector3();
const mira = new THREE.Vector3();
let anguloVuelta = 0;

function moverCamara(dt) {
  const p = carro.posicion;
  if (jugando) {
    // Detrás del carro y un poco arriba.
    posicionDeseada.copy(p).addScaledVector(carro.adelante, -8.5);
    posicionDeseada.y = 4.3;
    miraDeseada.copy(p).addScaledVector(carro.adelante, 4);
    miraDeseada.y = 1.2;
  } else {
    // En la pantalla de inicio la cámara le da vueltas al carro.
    anguloVuelta += dt * 0.25;
    posicionDeseada.set(p.x + Math.sin(anguloVuelta) * 10, 4.5, p.z + Math.cos(anguloVuelta) * 10);
    miraDeseada.set(p.x, -0.5, p.z);   // mirar un poco abajo deja el carro arriba del ▶
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
    `${fps} fps · modo ${c.modo} · permiso ${c.permiso} · sensor ${c.hayDatos ? 'sí' : 'no'}\n` +
    `giro ${c.giroInclinacion.toFixed(2)} · lado ${c.lecturaCruda.lado.toFixed(1)} · ` +
    `vertical ${c.lecturaCruda.vertical.toFixed(1)} · signo ${c.signo}`;
}

// ---------- Ciclo de cada cuadro ----------

const QUIETO = { giro: 0, acelerar: false };
let antes = performance.now();

renderer.setAnimationLoop((ahora) => {
  const dt = Math.min(0.05, Math.max(0, (ahora - antes) / 1000));
  antes = ahora;

  const manejando = jugando && !vertical.matches;
  carro.actualizar(dt, manejando ? controles.leer() : QUIETO, RADIO_MANEJO);
  moverCamara(dt);
  mundo.seguir(carro.posicion);
  sonido.actualizarMotor(carro.fraccionVelocidad, jugando);
  renderer.render(escena, camara);

  if (depurar) mostrarDepuracion(dt);
});

// Para revisar el estado desde la consola o en pruebas automáticas.
if (depurar) window.__juego = { carro, controles, get jugando() { return jugando; } };

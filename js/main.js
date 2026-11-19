// Arranque del juego: escena, cámara, pantallas (elegir vehículo → elegir modo → jugar)
// y el ciclo de cada cuadro.

import * as THREE from 'three';
import { crearGraficos } from './graficos.js';
import { crearCiudad } from './ciudad.js';
import { Vehiculo } from './vehiculo.js';
import { Controles, alTocar } from './controles.js';
import { Retos } from './retos.js';
import { crearTaller, COLORES_PINTURA, CALCOMANIAS } from './taller.js';
import { cargarModelosArtista } from './modelos-artista.js';
import * as sonido from './sonido.js';

const $ = (id) => document.getElementById(id);

// ---------- Escena ----------

const graficos = crearGraficos($('escena'));
const renderer = graficos.renderer;

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(58, 1, 0.3, 700);
// Primero se cargan los modelos de artista (mientras, se ve el círculo de "cargando").
await cargarModelosArtista();
const ciudad = crearCiudad(escena);
graficos.prepararEscena(escena, camara, ciudad.sol);
const SALIDA = ciudad.salida;

// Los dos vehículos se arman al principio; en la escena solo está el elegido.
const TIPOS = ['moto', 'carro', 'monstruo', 'bomberos'];
const NOMBRES = { moto: 'la moto', carro: 'el carro', monstruo: 'el monster truck', bomberos: 'el camión de bomberos' };
const vehiculos = Object.fromEntries(TIPOS.map((t) => [t, new Vehiculo(t)]));
let vehiculo = vehiculos.carro;
escena.add(vehiculo.objeto);
vehiculo.colocar(SALIDA.x, SALIDA.z, SALIDA.rumbo);

function ponerVehiculo(tipo) {
  if (vehiculos[tipo] === vehiculo) return;
  escena.remove(vehiculo.objeto);
  vehiculo = vehiculos[tipo];
  escena.add(vehiculo.objeto);
  vehiculo.colocar(SALIDA.x, SALIDA.z, SALIDA.rumbo);
  sonido.ponerVehiculo(tipo);
  saltarCamara = true;
}


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

function alChocar() {
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
}
for (const v of Object.values(vehiculos)) v.alChocar = alChocar;

// ---------- Retos ----------

const panelReto = $('reto');
const ranuras = [];
for (let i = 0; i < 6; i++) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 100 100');
  s.classList.add('ranura');
  s.innerHTML = '<path d="M50 6 L61.2 36.6 L93.7 37.8 L68.1 57.9 L77 89.2 L50 71 L23 89.2 L31.9 57.9 L6.3 37.8 L38.8 36.6 Z"/>';
  $('reto-estrellas').appendChild(s);
  ranuras.push(s);
}

const COLORES_CONFETI = ['#ef476f', '#ffd166', '#06d6a0', '#4ea8de', '#b388eb', '#f78c6b'];
function confeti() {
  const capa = $('confeti');
  capa.replaceChildren();
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}vw`;
    p.style.background = COLORES_CONFETI[i % COLORES_CONFETI.length];
    p.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.setProperty('--deriva', `${(Math.random() - 0.5) * 30}vw`);
    p.style.setProperty('--giro', `${(Math.random() - 0.5) * 1440}deg`);
    capa.appendChild(p);
  }
  setTimeout(() => capa.replaceChildren(), 3800);
}

const retos = new Retos(escena, ciudad, {
  decir: sonido.decir,
  estrella: sonido.sonidoEstrella,
  festejo() {
    sonido.sonidoFestejo();
    confeti();
  },
  mostrar(tipo, datos) {
    panelReto.hidden = false;
    panelReto.dataset.tipo = tipo;
    if (tipo === 'estrellas') ranuras.forEach((r, i) => r.classList.toggle('llena', i < datos.juntadas));
    if (tipo === 'paquete') $('casa-destino').setAttribute('fill', `#${datos.hex.toString(16).padStart(6, '0')}`);
  },
  ocultar() {
    panelReto.hidden = true;
  },
});

// ---------- Taller ----------
// Se entra manejando por el portón del taller. Adentro: el vehículo en una plataforma que gira
// y el panel con 🔧 reparación, 🧽 lavado, 🎨 pintura y 🔩 piezas. El botón verde regresa a manejar.

const panelTaller = $('taller');
let enTaller = false;
let bloqueoTaller = false;   // al salir, no se vuelve a abrir hasta que el vehículo se aleje

const taller = crearTaller(renderer, {
  decir: sonido.decir,
  sonidoBurbujas: sonido.sonidoBurbujas,
  sonidoPegar: sonido.sonidoPegar,
  sonidoClanc: sonido.sonidoClanc,
  festejoChico() {
    sonido.sonidoFestejo();
    confeti();
  },
});

const contenedorBotes = panelTaller.querySelector('.botes');
for (const c of COLORES_PINTURA) {
  const b = document.createElement('button');
  b.className = 'bote';
  b.style.background = c.hex;
  b.setAttribute('aria-label', c.nombre);
  alTocar(b, () => {
    taller.pintar(c.hex);
    sonido.sonidoSpray();
    sonido.decir('¡' + c.nombre[0].toUpperCase() + c.nombre.slice(1) + '!');
  });
  contenedorBotes.appendChild(b);
}
const contenedorCalcomanias = panelTaller.querySelector('.calcomanias');
const botonesCalcomania = [];
for (const e of [...CALCOMANIAS, '🗑️']) {
  const b = document.createElement('button');
  b.className = 'calcomania';
  b.textContent = e;
  alTocar(b, () => {
    if (e === '🗑️') {
      vehiculo.apariencia.quitarCalcomanias();
      taller.elegirCalcomania(null);
      sonido.sonidoNo();
    } else {
      taller.elegirCalcomania(e);
      sonido.sonidoSi();
      sonido.decir(`¡Ahora toca ${NOMBRES[vehiculo.tipo]} para pegarla!`);
    }
    for (const otro of botonesCalcomania) otro.classList.toggle('elegida', otro.textContent === taller.calcomania);
  });
  botonesCalcomania.push(b);
  contenedorCalcomanias.appendChild(b);
}

// Medidor de lodo: bolitas cafés (lodo) que se vuelven azul claro al limpiar.
const medidor = panelTaller.querySelector('.medidor-lodo');
const bolitas = Array.from({ length: 7 }, () => medidor.appendChild(document.createElement('i')));
let lodoMostrado = -1;
function actualizarMedidor() {
  const total = vehiculo.apariencia.manchas.length || 1;
  const sucias = Math.ceil((vehiculo.apariencia.manchasVisibles / total) * bolitas.length);
  if (sucias === lodoMostrado) return;
  lodoMostrado = sucias;
  bolitas.forEach((b, i) => b.classList.toggle('limpia', i >= sucias));
}

// ---------- 🔧 Reparación: medidor de llaves ----------
const medidorDanos = panelTaller.querySelector('.medidor-danos');
let danosMostrados = -1;
function actualizarMedidorDanos() {
  const n = vehiculo.apariencia.cuantosDanos;
  if (n === danosMostrados) return;
  danosMostrados = n;
  medidorDanos.textContent = n ? '🔧'.repeat(Math.min(n, 8)) : '✨🙂✨';
}

// ---------- 🔩 Piezas: filas de opciones (cambian según sea carro o moto) ----------
const ICONO_RIN = {
  clasico: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#1d1f23"/><circle cx="20" cy="20" r="11" fill="#c5ccd4"/>' +
    [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${20 + 6.5 * Math.cos(i * 1.047)}" cy="${20 + 6.5 * Math.sin(i * 1.047)}" r="1.8" fill="#30343b"/>`).join('') + '</svg>',
  estrella: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#1d1f23"/><circle cx="20" cy="20" r="11" fill="#9aa3ad"/>' +
    [0, 1, 2, 3, 4].map((i) => `<rect x="18.5" y="9.5" width="3" height="10.5" fill="#eef2f6" transform="rotate(${i * 72} 20 20)"/>`).join('') + '</svg>',
  deportivo: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#1d1f23"/><circle cx="20" cy="20" r="11" fill="#3b4048"/>' +
    [...Array(10).keys()].map((i) => `<rect x="19.3" y="9.5" width="1.4" height="10.5" fill="#eef2f6" transform="rotate(${i * 36} 20 20)"/>`).join('') + '</svg>',
};
const SILUETA = (ala) => `<svg viewBox="0 0 48 30"><path d="M4 22 V16 Q4 13 8 13 L14 12 L19 6 H31 L36 12 L42 13 Q45 14 45 17 V22 Z" fill="#ef233c"/>${ala}<circle cx="13" cy="23" r="4" fill="#222"/><circle cx="36" cy="23" r="4" fill="#222"/></svg>`;
// Todas las filas posibles; cada vehículo muestra solo las de las piezas que tiene.
const FILAS = [
    { pieza: 'rines', opciones: [['clasico', ICONO_RIN.clasico], ['estrella', ICONO_RIN.estrella], ['deportivo', ICONO_RIN.deportivo]], voz: '¡Rines nuevos!' },
    { pieza: 'grandes', opciones: [[false, '<span style="font-size:60%">🛞</span>'], [true, '🛞']], voz: (v) => (v ? '¡Llantas gigantes!' : '¡Llantas normales!') },
    { pieza: 'aleron', opciones: [['ninguno', SILUETA('')], ['chico', SILUETA('<rect x="2" y="10" width="9" height="2" fill="#30343b"/>')], ['grande', SILUETA('<rect x="0" y="5" width="11" height="2.5" fill="#30343b"/><rect x="4" y="7" width="1.5" height="6" fill="#30343b"/>')]], voz: (v) => (v === 'ninguno' ? '¡Sin alerón!' : '¡Alerón!') },
    { pieza: 'techo', opciones: [['nada', '🚫'], ['policia', '🚨'], ['bomberos', '🚒'], ['taxi', '🚕'], ['maletas', '🧳']], voz: (v) => ({ nada: '¡Sin nada arriba!', policia: '¡Patrulla! Toca el claxon.', bomberos: '¡Bomberos! Toca el claxon.', taxi: '¡Taxi!', maletas: '¡Listo para el viaje!' })[v] },
    { pieza: 'casco', opciones: ['#ffd60a', '#ef233c', '#1d7ff2', '#2dc653', '#ff5fa2', '#f4f5f7'].map((c) => [c, '']), color: true, voz: '¡Casco nuevo!' },
    { pieza: 'claxon', opciones: [['normal', '📯'], ['pato', '🦆'], ['tren', '🚂']], claxon: true },
];
function filasDe(v) {
  const filas = FILAS.filter((f) => f.pieza in v.apariencia.piezas);
  // El camión de bomberos trae su sirena como primera opción de claxon.
  if (v.tipo === 'bomberos') {
    return filas.map((f) => (f.pieza === 'claxon' ? { ...f, opciones: [['bomberos', '🚒'], ...f.opciones] } : f));
  }
  return filas;
}
const contenidoPiezas = $('contenido-piezas');
function armarPiezas() {
  contenidoPiezas.replaceChildren();
  for (const fila of filasDe(vehiculo)) {
    const div = document.createElement('div');
    div.className = 'fila-piezas';
    const botones = [];
    for (const [valor, icono] of fila.opciones) {
      const b = document.createElement('button');
      b.className = 'pieza' + (fila.color ? ' color' : '');
      if (fila.color) b.style.background = valor;
      else b.innerHTML = icono;
      const marcar = () => botones.forEach(([v, x]) => x.classList.toggle('elegida', v === vehiculo.apariencia.piezas[fila.pieza]));
      alTocar(b, () => {
        vehiculo.apariencia.ponerPieza(fila.pieza, valor);
        vehiculo.objeto.traverse((m) => { if (m.isMesh) m.castShadow = !m.material.transparent; });
        marcar();
        if (fila.claxon) sonido.claxon(valor, vehiculo.tipo === 'moto');
        else {
          sonido.sonidoClanc();
          sonido.decir(typeof fila.voz === 'function' ? fila.voz(valor) : fila.voz);
        }
        taller.ponerLlaves();
        ponerIconoClaxon();
      });
      botones.push([valor, b]);
      div.appendChild(b);
      marcar();
    }
    contenidoPiezas.appendChild(div);
  }
}

// ---------- Claxon (botón amarillo al manejar) ----------
const btnClaxon = $('btn-claxon');
function ponerIconoClaxon() {
  const p = vehiculo.apariencia.piezas;
  btnClaxon.textContent = p.techo === 'policia' || p.techo === 'bomberos' ? '🚨' : { normal: '📯', pato: '🦆', tren: '🚂', bomberos: '🚨' }[p.claxon] ?? '📯';
}
alTocar(btnClaxon, () => sonido.claxon(vehiculo.tocarClaxon(), vehiculo.tipo === 'moto'));

function ponerPestana(nombre) {
  panelTaller.dataset.pestana = nombre;
  taller.ponerPestana(nombre);
  for (const otro of botonesCalcomania) otro.classList.remove('elegida');
  const cual = NOMBRES[vehiculo.tipo];
  if (nombre === 'reparacion') {
    sonido.decir(vehiculo.apariencia.cuantosDanos > 0 ? '¡Toca las llaves para arreglarlo!' : `¡${cual[0].toUpperCase() + cual.slice(1)} está como nuevo!`);
  } else if (nombre === 'piezas') sonido.decir('¡Elige piezas nuevas!');
  else if (nombre === 'pintura') sonido.decir('¡Elige un color o una calcomanía!');
  else if (vehiculo.apariencia.manchasVisibles > 0) sonido.decir(`¡Talla ${cual} con tu dedo para quitar el lodo!`);
  else sonido.decir(`¡${cual[0].toUpperCase() + cual.slice(1)} ya está limpio! Pero puedes echarle burbujas.`);
}
for (const b of panelTaller.querySelectorAll('.pestana')) alTocar(b, () => ponerPestana(b.dataset.pestana));

function abrirTaller() {
  enTaller = true;
  controles.soltarTodo();
  avisoChoque.hidden = true;
  escena.remove(vehiculo.objeto);
  taller.abrir(vehiculo);
  vehiculo.objeto.traverse((m) => { if (m.isMesh) m.castShadow = !m.material.transparent; });
  hud.hidden = true;
  panelTaller.hidden = false;
  $('btn-taller-salir').textContent = ({ moto: '🏍️', carro: '🚗', monstruo: '🛻', bomberos: '🚒' })[vehiculo.tipo] + ' ➜';
  lodoMostrado = -1;
  danosMostrados = -1;
  armarPiezas();
  // Empieza en lo que más hace falta: reparar, luego lavar; si no, pintar.
  const inicial = vehiculo.apariencia.cuantosDanos > 0 ? 'reparacion' : vehiculo.apariencia.manchasVisibles > 0 ? 'lavado' : 'pintura';
  panelTaller.dataset.pestana = inicial;
  taller.ponerPestana(inicial);
  sonido.decir(`¡Bienvenido al taller! ¿Qué le hacemos a ${NOMBRES[vehiculo.tipo].replace(/^(la|el) /, (m) => (m === 'la ' ? 'tu ' : 'tu '))}?`);
}

function cerrarTaller() {
  enTaller = false;
  taller.cerrar();
  vehiculo.objeto.traverse((m) => { m.castShadow = false; });
  escena.add(vehiculo.objeto);
  panelTaller.hidden = true;
  bloqueoTaller = true;
  saltarCamara = true;
  graficos.actualizarSombras();
}

alTocar($('btn-taller-salir'), () => {
  cerrarTaller();
  const s = ciudad.salidaTaller;
  vehiculo.colocar(s.x, s.z, s.rumbo);
  hud.hidden = false;
  ponerIconoClaxon();
  sonido.decir('¡A manejar!');
});
alTocar($('btn-taller-casa'), () => {
  cerrarTaller();
  volverAlInicio();
});

// Toques sobre el vehículo dentro del taller.
const lienzo = $('escena');
lienzo.addEventListener('pointerdown', (e) => { if (enTaller) taller.alBajar(e); });
lienzo.addEventListener('pointermove', (e) => { if (enTaller) taller.alMover(e); });
for (const tipo of ['pointerup', 'pointercancel']) lienzo.addEventListener(tipo, (e) => { if (enTaller) taller.alSubir(e); });

// ---------- Pantallas ----------

let jugando = false;
let saltarCamara = true;
const vertical = matchMedia('(orientation: portrait)');

function mostrarPantalla(pantalla) {
  jugando = pantalla === 'juego';
  $('inicio').hidden = jugando;
  $('elegir-vehiculo').hidden = pantalla !== 'vehiculo';
  $('elegir-modo').hidden = pantalla !== 'modo';
  $('btn-volver').hidden = pantalla !== 'modo';
  hud.hidden = !jugando;
}

function volverAlInicio() {
  retos.detener(vehiculo);
  controles.soltarTodo();
  vehiculo.colocar(SALIDA.x, SALIDA.z, SALIDA.rumbo);
  saltarCamara = true;
  avisoChoque.hidden = true;
  motorApagado = false;
  mostrarPantalla('vehiculo');
  sonido.decir('¿Con qué quieres manejar?');
}

// Elegir vehículo. Usa "click" a propósito: es el evento que iOS acepta para pedir
// el permiso de inclinación y activar el audio y la voz. Las tres cosas pasan aquí.
for (const boton of document.querySelectorAll('[data-vehiculo]')) {
  boton.addEventListener('click', () => {
    controles.pedirPermisoInclinacion();
    sonido.iniciarAudio();
    const tipo = boton.dataset.vehiculo;
    ponerVehiculo(tipo);
    const nombre = NOMBRES[tipo];
    sonido.decir(`¡${nombre[0].toUpperCase() + nombre.slice(1)}! ¿Quieres pasear o jugar retos?`);
    mostrarPantalla('modo');
  });
}

// Elegir modo (pasear o retos).
for (const boton of document.querySelectorAll('[data-jugar]')) {
  boton.addEventListener('click', () => {
    sonido.iniciarAudio();
    vehiculo.colocar(SALIDA.x, SALIDA.z, SALIDA.rumbo);
    saltarCamara = true;
    motorApagado = false;
    avisoChoque.hidden = true;
    mostrarPantalla('juego');
    ponerIconoClaxon();
    if (boton.dataset.jugar === 'retos') {
      retos.reiniciar();
      retos.empezar(vehiculo);
    } else {
      retos.detener(vehiculo);
      sonido.decir('¡A pasear!');
    }
  });
}

alTocar($('btn-volver'), volverAlInicio);
alTocar($('btn-casa'), volverAlInicio);

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

// Pone la cámara a cierta distancia del vehículo, en la dirección (dx, dz);
// si un edificio estorba, se acerca y sube para ver por encima.
// Devuelve qué tan lejos quedó, de 0 (encima del vehículo) a 1 (distancia normal).
function colocarCamara(dx, dz, distancia, altura) {
  const p = vehiculo.posicion;
  const libre = Math.min(
    ciudad.obstaculos.libre(p.x, p.z, p.x + dx * distancia, p.z + dz * distancia),
    ciudad.libreDeArboles(p.x, p.z, p.x + dx * distancia, p.z + dz * distancia),
  );
  const d = libre < 1 ? Math.max(2.2, libre * distancia - 0.8) : distancia;
  posicionDeseada.set(p.x + dx * d, p.y + altura + (distancia - d) * 0.45, p.z + dz * d);
  return d / distancia;
}

function moverCamara(dt) {
  const p = vehiculo.posicion;
  const c = vehiculo.camara;
  if (jugando) {
    // Detrás del vehículo y un poco arriba, viendo un poco hacia adelante
    // (menos hacia adelante si la cámara tuvo que acercarse).
    const lejos = colocarCamara(-vehiculo.adelante.x, -vehiculo.adelante.z, c.distancia, c.altura);
    miraDeseada.copy(p).addScaledVector(vehiculo.adelante, 4 * lejos * lejos);
    miraDeseada.y = p.y + c.mira;
  } else {
    // En el menú la cámara le da vueltas; mirar un poco abajo deja el vehículo arriba de las opciones.
    anguloVuelta += dt * 0.25;
    colocarCamara(Math.sin(anguloVuelta), Math.cos(anguloVuelta), c.vuelta, c.altura * 0.9);
    miraDeseada.set(p.x, p.y - 1.2, p.z);
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

// ---------- Motor: se apaga al quedarse quieto dentro de un cajón ----------

let motorApagado = false;
let tiempoQuieto = 0;
const estadoCajon = { cajon: null, estacionado: false };

function revisarMotor(dt, mando) {
  const pedal = mando.acelerar || mando.reversa;
  const cajon = jugando ? ciudad.cajonDe(vehiculo) : null;
  if (cajon && !pedal && Math.abs(vehiculo.velocidad) < 0.25) tiempoQuieto += dt;
  else tiempoQuieto = 0;

  if (!motorApagado && tiempoQuieto > 0.6) motorApagado = true;
  if (motorApagado && pedal) {
    motorApagado = false;
    sonido.sonidoArranque();
  }
  estadoCajon.cajon = cajon;
  estadoCajon.estacionado = motorApagado;
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
    `${fps} fps · calidad ${graficos.nivel} · vel ${vehiculo.velocidad.toFixed(1)} · ${retos.tipo ?? 'paseo'} · motor ${motorApagado ? 'apagado' : 'prendido'}\n` +
    `modo ${c.modo} · permiso ${c.permiso} · sensor ${c.hayDatos ? 'sí' : 'no'} · giro ${c.giroInclinacion.toFixed(2)} · ` +
    `lado ${c.lecturaCruda.lado.toFixed(1)} · vertical ${c.lecturaCruda.vertical.toFixed(1)} · signo ${c.signo}`;
}

// ---------- Ciclo de cada cuadro ----------

const QUIETO = { giro: 0, acelerar: false, reversa: false };
let antes = performance.now();
let siguientePitido = 0;

renderer.setAnimationLoop((ahora) => {
  const dtReal = Math.max(0, (ahora - antes) / 1000);   // para medir los fps de verdad
  const dt = Math.min(0.05, dtReal);                      // para mover las cosas sin saltos grandes
  antes = ahora;

  if (enTaller) {
    taller.actualizar(dt);
    actualizarMedidor();
    actualizarMedidorDanos();
    sonido.actualizarMotor(0, false);
    graficos.dibujar(taller.escena, taller.camara);
    if (depurar) mostrarDepuracion(dtReal);
    return;
  }

  const manejando = jugando && !vertical.matches;
  const mando = manejando ? controles.leer() : QUIETO;
  vehiculo.actualizar(dt, mando, ciudad);
  revisarMotor(dt, mando);
  // ¿Entró manejando al taller?
  const enPorton = ciudad.enTaller(vehiculo.posicion.x, vehiculo.posicion.z);
  if (jugando && enPorton && !bloqueoTaller) {
    abrirTaller();
    return;
  }
  if (!enPorton) bloqueoTaller = false;
  retos.actualizar(dt, vehiculo, estadoCajon);
  ciudad.actualizar(dt);
  moverCamara(dt);
  if (ciudad.seguir(vehiculo.posicion)) graficos.actualizarSombras();
  sonido.actualizarMotor(Math.abs(vehiculo.fraccionVelocidad), jugando && !motorApagado, mando.acelerar || mando.reversa);

  // "Pi-pi-pi" mientras va de reversa.
  if (jugando && vehiculo.velocidad < -0.3) {
    if (ahora >= siguientePitido) {
      sonido.pitidoReversa();
      siguientePitido = ahora + 600;
    }
  } else {
    siguientePitido = 0;
  }

  graficos.dibujar();
  graficos.vigilar(dtReal, jugando);
  if (depurar) mostrarDepuracion(dtReal);
});

// Para revisar el estado desde la consola o en pruebas automáticas.
if (depurar) {
  window.__juego = {
    get vehiculo() { return vehiculo; },
    get carro() { return vehiculo; },
    get jugando() { return jugando; },
    get motorApagado() { return motorApagado; },
    controles, ciudad, retos, camara, escena, renderer, graficos, taller,
    get enTaller() { return enTaller; },
  };
}

// Todo listo: ya se puede elegir.
$('cargando').hidden = true;
mostrarPantalla('vehiculo');

// Sonido y voz. Todo se genera en el navegador: no hay archivos de audio.
// iOS no deja sonar nada hasta el primer toque, por eso iniciarAudio() se llama
// en el primer toque (al elegir vehículo), y la primera frase de voz también se dice ahí.

let ctx = null;
let motor = null;

export function iniciarAudio() {
  // Que suene aunque el iPad esté en modo silencio (Safari 16.4 o más nuevo).
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* no pasa nada */ }

  const ContextoAudio = window.AudioContext || window.webkitAudioContext;
  if (!ContextoAudio) return;
  if (!ctx) {
    ctx = new ContextoAudio();
    motor = crearMotor(ctx);
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

// Si iOS pausó el audio (por ejemplo, al salir y volver a la app), el siguiente toque lo despierta.
document.addEventListener('pointerdown', () => {
  if (ctx && ctx.state !== 'running' && document.visibilityState === 'visible') {
    ctx.resume().catch(() => {});
  }
});
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.visibilityState === 'hidden') ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

// ---------- Motor: un rugido grave que se abre al acelerar ----------
// Dos dientes de sierra casi iguales (al desafinarse "gruñen"), un tono más grave abajo,
// un pulso al ritmo de las explosiones del motor y un filtro que se abre al acelerar.

const TONOS = {
  carro: { base: 48, rango: 62 },
  moto: { base: 75, rango: 105 },
  monstruo: { base: 36, rango: 50 },
  bomberos: { base: 42, rango: 52 },
};
let tono = TONOS.carro;

export function ponerVehiculo(tipo) {
  tono = TONOS[tipo] ?? TONOS.carro;
  ultimaFraccion = -1;   // que se vuelva a programar el motor
}

function crearMotor(ctx) {
  const salida = ctx.createGain();
  salida.gain.value = 0;
  salida.connect(ctx.destination);

  // Saturación leve: le da "garra" sin volverse áspero.
  const garra = ctx.createWaveShaper();
  const curva = new Float32Array(256);
  for (let i = 0; i < 256; i++) curva[i] = Math.tanh(((i / 255) * 2 - 1) * 2.2);
  garra.curve = curva;
  garra.connect(salida);

  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 350;
  filtro.Q.value = 3;
  filtro.connect(garra);

  // Pulso de las explosiones: sube y baja el volumen muy rápido.
  const mezcla = ctx.createGain();
  mezcla.gain.value = 0.45;
  mezcla.connect(filtro);
  const pulso = ctx.createOscillator();
  pulso.frequency.value = 24;
  const fuerzaPulso = ctx.createGain();
  fuerzaPulso.gain.value = 0.25;
  pulso.connect(fuerzaPulso).connect(mezcla.gain);

  const sierra1 = ctx.createOscillator();
  sierra1.type = 'sawtooth';
  const sierra2 = ctx.createOscillator();
  sierra2.type = 'sawtooth';
  const grave = ctx.createOscillator();
  grave.type = 'sine';
  const volumenGrave = ctx.createGain();
  volumenGrave.gain.value = 0.9;
  sierra1.connect(mezcla);
  sierra2.connect(mezcla);
  grave.connect(volumenGrave).connect(mezcla);

  for (const o of [sierra1, sierra2, grave, pulso]) o.start();
  return { salida, filtro, sierra1, sierra2, grave, pulso };
}

let ultimaFraccion = -1;
let ultimoEncendido = null;
let ultimoAcelerando = null;

export function actualizarMotor(fraccion, encendido, acelerando = false) {
  if (!motor) return;
  // Solo se programan cambios cuando de verdad cambia algo.
  if (Math.abs(fraccion - ultimaFraccion) < 0.01 && encendido === ultimoEncendido && acelerando === ultimoAcelerando) return;
  ultimaFraccion = fraccion;
  ultimoEncendido = encendido;
  ultimoAcelerando = acelerando;

  const t = ctx.currentTime;
  const f = tono.base + tono.rango * fraccion + (acelerando ? 6 : 0);
  motor.sierra1.frequency.setTargetAtTime(f, t, 0.12);
  motor.sierra2.frequency.setTargetAtTime(f * 1.013, t, 0.12);
  motor.grave.frequency.setTargetAtTime(f / 2, t, 0.12);
  motor.pulso.frequency.setTargetAtTime(f / 2, t, 0.12);
  motor.filtro.frequency.setTargetAtTime(300 + 800 * fraccion + (acelerando ? 450 : 0), t, 0.15);
  const volumen = 0.05 + 0.06 * fraccion + (acelerando ? 0.02 : 0);
  motor.salida.gain.setTargetAtTime(encendido ? volumen : 0, t, encendido ? 0.15 : 0.35);
}

// Arranque: "rrr-RUM" corto cuando el motor se vuelve a encender.
export function sonidoArranque() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(tono.base * 0.6, t);
  osc.frequency.linearRampToValueAtTime(tono.base * 0.9, t + 0.25);
  osc.frequency.exponentialRampToValueAtTime(tono.base * 2, t + 0.45);
  osc.frequency.exponentialRampToValueAtTime(tono.base * 1.1, t + 0.8);
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 900;
  const vol = ctx.createGain();
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.linearRampToValueAtTime(0.12, t + 0.05);
  vol.gain.setValueAtTime(0.12, t + 0.5);
  vol.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
  osc.connect(filtro).connect(vol).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.9);
}

// ---------- Efectos cortos ----------

function pitido(desde, hasta, duracion, tipo = 'sine', volumen = 0.22, cuando = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + cuando;
  const osc = ctx.createOscillator();
  osc.type = tipo;
  osc.frequency.setValueAtTime(desde, t);
  osc.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
  const vol = ctx.createGain();
  vol.gain.setValueAtTime(volumen, t);
  vol.gain.exponentialRampToValueAtTime(0.001, t + duracion);
  osc.connect(vol).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duracion + 0.02);
}

export const sonidoSi = () => pitido(520, 880, 0.14);
export const sonidoNo = () => pitido(300, 150, 0.3, 'triangle', 0.3);
export const pitidoReversa = () => pitido(1050, 1000, 0.13, 'sine', 0.06);

// Taller: "pssst" de pintura en aerosol (ruido filtrado).
let bufferRuido = null;
export function sonidoSpray() {
  if (!ctx) return;
  if (!bufferRuido) {
    bufferRuido = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
    const d = bufferRuido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime;
  const ruido = ctx.createBufferSource();
  ruido.buffer = bufferRuido;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 4200;
  filtro.Q.value = 0.8;
  const vol = ctx.createGain();
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.linearRampToValueAtTime(0.16, t + 0.05);
  vol.gain.setValueAtTime(0.16, t + 0.45);
  vol.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
  ruido.connect(filtro).connect(vol).connect(ctx.destination);
  ruido.start(t);
  ruido.stop(t + 0.7);
}

// Taller: burbujas ("blup-blup").
export function sonidoBurbujas() {
  for (let i = 0; i < 3; i++) {
    const f = 380 + Math.random() * 500;
    pitido(f, f * 1.8, 0.07, 'sine', 0.12, i * 0.06 + Math.random() * 0.03);
  }
}

// Taller: "clanc" metálico de la llave al reparar.
export function sonidoClanc() {
  for (const [f, cuando] of [[1650, 0], [2470, 0.005], [1240, 0.18], [1860, 0.185]]) {
    pitido(f, f * 0.97, 0.12, 'square', 0.05, cuando);
  }
}

// Una nota con forma de onda y volumen dados (para claxons y sirenas).
function nota(tipo, desde, hasta, inicio, duracion, volumen, filtroHz = 2500) {
  if (!ctx) return;
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  osc.type = tipo;
  osc.frequency.setValueAtTime(desde, t);
  osc.frequency.linearRampToValueAtTime(hasta, t + duracion);
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = filtroHz;
  const vol = ctx.createGain();
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.linearRampToValueAtTime(volumen, t + 0.02);
  vol.gain.setValueAtTime(volumen, t + duracion - 0.04);
  vol.gain.linearRampToValueAtTime(0.0001, t + duracion);
  osc.connect(filtro).connect(vol).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duracion + 0.02);
}

// Claxon según la pieza elegida: normal ("mec-mec"), pato ("cuac-cuac"), tren ("chu-chuuu"),
// o sirena de policía o bomberos (si el carro trae torreta).
export function claxon(tipo, moto = false) {
  const agudo = moto ? 1.35 : 1;
  if (tipo === 'pato') {
    for (const i of [0, 0.32]) nota('sawtooth', 620, 380, i, 0.22, 0.14, 1400);
  } else if (tipo === 'tren') {
    nota('triangle', 520, 520, 0, 0.18, 0.12);
    nota('triangle', 660, 660, 0, 0.18, 0.1);
    nota('triangle', 520, 500, 0.25, 0.65, 0.12);
    nota('triangle', 660, 640, 0.25, 0.65, 0.1);
  } else if (tipo === 'policia') {
    for (let i = 0; i < 3; i++) {
      nota('triangle', 650, 1250, i * 0.9, 0.45, 0.12);
      nota('triangle', 1250, 650, i * 0.9 + 0.45, 0.45, 0.12);
    }
  } else if (tipo === 'bomberos') {
    for (let i = 0; i < 2; i++) {
      nota('triangle', 500, 1100, i * 1.3, 0.9, 0.12);
      nota('triangle', 1100, 500, i * 1.3 + 0.9, 0.4, 0.1);
    }
  } else {
    for (const i of [0, 0.22]) {
      nota('square', 410 * agudo, 410 * agudo, i, 0.17, 0.08, 1800);
      nota('square', 515 * agudo, 515 * agudo, i, 0.17, 0.07, 1800);
    }
  }
}

// Taller: "pop" al pegar una calcomanía.
export const sonidoPegar = () => pitido(520, 1250, 0.09, 'triangle', 0.22);

// Estrella: "ding-ding", más agudo con cada estrella juntada.
export function sonidoEstrella(numero) {
  const base = 660 * Math.pow(2, (numero * 2) / 12);
  pitido(base, base, 0.12, 'triangle', 0.25);
  pitido(base * 1.5, base * 1.5, 0.25, 'triangle', 0.25, 0.1);
}

// Festejo: do-mi-sol-do hacia arriba.
export function sonidoFestejo() {
  [523, 659, 784, 1047].forEach((nota, i) => pitido(nota, nota, i === 3 ? 0.5 : 0.16, 'triangle', 0.25, i * 0.13));
}

// Choque: un "boing" de caricatura más un "toc" grave.
export function sonidoChoque() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.45);
  const temblor = ctx.createOscillator();
  temblor.frequency.value = 22;
  const fuerzaTemblor = ctx.createGain();
  fuerzaTemblor.gain.value = 35;
  temblor.connect(fuerzaTemblor).connect(osc.frequency);
  const vol = ctx.createGain();
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.linearRampToValueAtTime(0.28, t + 0.015);
  vol.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(vol).connect(ctx.destination);
  osc.start(t);
  temblor.start(t);
  osc.stop(t + 0.55);
  temblor.stop(t + 0.55);
  pitido(160, 60, 0.15, 'sine', 0.3);
}

// ---------- Voz ----------

let voz = null;

function elegirVoz() {
  const voces = speechSynthesis.getVoices();
  voz = voces.find((v) => v.lang.replace('_', '-') === 'es-MX')
    || voces.find((v) => v.lang.startsWith('es'))
    || null;
}

if ('speechSynthesis' in window) {
  elegirVoz();
  speechSynthesis.addEventListener?.('voiceschanged', elegirVoz);
}

export function decir(texto) {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = 'es-MX';
  if (voz) frase.voice = voz;
  frase.rate = 0.95;
  frase.pitch = 1.15;
  speechSynthesis.speak(frase);
}

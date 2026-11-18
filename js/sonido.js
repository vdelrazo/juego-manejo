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

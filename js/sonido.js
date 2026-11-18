// Sonido y voz. Todo se genera en el navegador: no hay archivos de audio.
// iOS no deja sonar nada hasta el primer toque, por eso iniciarAudio() se llama
// al tocar ▶, y la primera frase de voz también se dice ahí.

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

// ---------- Motor: un zumbido suave y redondo, como de carrito de juguete ----------

function crearMotor(ctx) {
  const salida = ctx.createGain();
  salida.gain.value = 0;
  salida.connect(ctx.destination);

  // Un vaivén leve para que no suene como un tono plano.
  const vaiven = ctx.createGain();
  vaiven.gain.value = 0.88;
  vaiven.connect(salida);

  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 700;
  filtro.Q.value = 0.5;
  filtro.connect(vaiven);

  // Onda triangular (suave) más un armónico senoidal bajito.
  const grave = ctx.createOscillator();
  grave.type = 'triangle';
  grave.frequency.value = 85;
  grave.connect(filtro);

  const armonico = ctx.createOscillator();
  armonico.type = 'sine';
  armonico.frequency.value = 170;
  const volumenArmonico = ctx.createGain();
  volumenArmonico.gain.value = 0.25;
  armonico.connect(volumenArmonico).connect(filtro);

  const pulso = ctx.createOscillator();
  pulso.frequency.value = 7;
  const fuerzaPulso = ctx.createGain();
  fuerzaPulso.gain.value = 0.12;
  pulso.connect(fuerzaPulso).connect(vaiven.gain);

  grave.start();
  armonico.start();
  pulso.start();
  return { salida, filtro, grave, armonico, pulso };
}

let ultimaFraccion = -1;
let ultimoEncendido = null;

export function actualizarMotor(fraccion, encendido) {
  if (!motor) return;
  // Solo se programan cambios cuando de verdad cambia algo.
  if (Math.abs(fraccion - ultimaFraccion) < 0.01 && encendido === ultimoEncendido) return;
  ultimaFraccion = fraccion;
  ultimoEncendido = encendido;

  const t = ctx.currentTime;
  const tono = 85 + 85 * fraccion;
  motor.grave.frequency.setTargetAtTime(tono, t, 0.1);
  motor.armonico.frequency.setTargetAtTime(tono * 2, t, 0.1);
  motor.pulso.frequency.setTargetAtTime(7 + 9 * fraccion, t, 0.1);
  motor.filtro.frequency.setTargetAtTime(700 + 700 * fraccion, t, 0.1);
  motor.salida.gain.setTargetAtTime(encendido ? 0.04 + 0.05 * fraccion : 0, t, 0.2);
}

// ---------- Efectos cortos ----------

function pitido(desde, hasta, duracion, tipo = 'sine', volumen = 0.22) {
  if (!ctx) return;
  const t = ctx.currentTime;
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

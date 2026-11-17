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

// ---------- Motor: un "brum" grave que sube con la velocidad ----------

function crearMotor(ctx) {
  const salida = ctx.createGain();
  salida.gain.value = 0;
  salida.connect(ctx.destination);

  // Tremolo: hace que suene "brum-brum-brum" en vez de un zumbido parejo.
  const tremolo = ctx.createGain();
  tremolo.gain.value = 0.7;
  tremolo.connect(salida);

  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 450;
  filtro.Q.value = 2;
  filtro.connect(tremolo);

  const grave = ctx.createOscillator();
  grave.type = 'sawtooth';
  grave.frequency.value = 55;
  grave.connect(filtro);

  const sub = ctx.createOscillator();
  sub.type = 'square';
  sub.frequency.value = 27.5;
  const volumenSub = ctx.createGain();
  volumenSub.gain.value = 0.45;
  sub.connect(volumenSub).connect(filtro);

  const pulso = ctx.createOscillator();
  pulso.frequency.value = 9;
  const fuerzaPulso = ctx.createGain();
  fuerzaPulso.gain.value = 0.3;
  pulso.connect(fuerzaPulso).connect(tremolo.gain);

  grave.start();
  sub.start();
  pulso.start();
  return { salida, filtro, grave, sub, pulso };
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
  const tono = 55 + 75 * fraccion;
  motor.grave.frequency.setTargetAtTime(tono, t, 0.08);
  motor.sub.frequency.setTargetAtTime(tono / 2, t, 0.08);
  motor.pulso.frequency.setTargetAtTime(9 + 14 * fraccion, t, 0.08);
  motor.filtro.frequency.setTargetAtTime(450 + 900 * fraccion, t, 0.08);
  motor.salida.gain.setTargetAtTime(encendido ? 0.06 + 0.08 * fraccion : 0, t, 0.15);
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

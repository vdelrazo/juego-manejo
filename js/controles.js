// Controles: modo botones y modo inclinar, y el interruptor para cambiar en plena partida.
// Los dos pedales (avanzar y reversa) se ven en los dos modos.
// En la computadora también funcionan las flechas o W A S D (y espacio para avanzar).
//
// Inclinar: se lee la gravedad (devicemotion). Del vector de gravedad se toma la parte
// que cae "de lado" en la pantalla; eso dice cuánto está girado el iPad como volante.
// Funciona igual con el iPad parado o acostado, y por cualquiera de sus dos lados
// horizontales. El signo de los datos cambia entre navegadores, así que se averigua
// solo: cuando el iPad está levantado, la gravedad apunta hacia abajo de la pantalla.

const ANGULO_MAX = (25 * Math.PI) / 180;    // con esta inclinación el giro es completo
const ZONA_MUERTA = (4 * Math.PI) / 180;    // poquita inclinación no cuenta: ir derecho es fácil
const UMBRAL_LEVANTADO = 3;                 // m/s²: el iPad está levantado lo suficiente para saber qué lado está arriba
const SUAVIZADO = 0.35;

const TECLAS = {
  ArrowLeft: 'izq', KeyA: 'izq',
  ArrowRight: 'der', KeyD: 'der',
  ArrowUp: 'acelerar', KeyW: 'acelerar', Space: 'acelerar',
  ArrowDown: 'reversa', KeyS: 'reversa',
};

// Botón que cuenta mientras se mantiene apretado (con uno o varios dedos).
function botonSostenido(el, alCambiar) {
  const dedos = new Set();
  const avisar = () => {
    el.classList.toggle('apretado', dedos.size > 0);
    alCambiar(dedos.size > 0);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dedos.add(e.pointerId);
    // Así el botón se entera cuando se suelta, aunque el dedo (o el mouse) se haya salido.
    try { el.setPointerCapture(e.pointerId); } catch { /* no pasa nada */ }
    avisar();
  });
  const soltar = (e) => {
    if (dedos.delete(e.pointerId)) avisar();
  };
  el.addEventListener('pointerup', soltar);
  el.addEventListener('pointercancel', soltar);
  el.addEventListener('lostpointercapture', soltar);
  return () => {
    dedos.clear();
    avisar();
  };
}

// Toque que funciona aunque otro dedo esté apretando el pedal
// (con varios dedos en la pantalla, iOS no siempre manda "click").
export function alTocar(el, accion) {
  const dedos = new Set();
  el.addEventListener('pointerdown', (e) => {
    dedos.add(e.pointerId);
    el.classList.add('apretado');
  });
  el.addEventListener('pointerup', (e) => {
    if (!dedos.delete(e.pointerId)) return;
    el.classList.toggle('apretado', dedos.size > 0);
    accion(e);
  });
  el.addEventListener('pointercancel', (e) => {
    dedos.delete(e.pointerId);
    el.classList.toggle('apretado', dedos.size > 0);
  });
}

export class Controles {
  constructor({ hud, btnIzq, btnDer, btnAcelerar, btnReversa, btnModo, alCambiarModo, alNoPoderInclinar }) {
    this.hud = hud;
    this.alCambiarModo = alCambiarModo;
    this.alNoPoderInclinar = alNoPoderInclinar;

    this.modo = 'botones';
    this.permiso = 'sin-pedir';      // 'sin-pedir' | 'si' | 'no'
    this.hayDatos = false;           // ya llegaron datos reales del sensor
    this.giroInclinacion = 0;
    this.signo = 1;
    this.lecturaCruda = { lado: 0, vertical: 0 };

    this.izq = false;
    this.der = false;
    this.pedal = false;
    this.pedalReversa = false;
    this.teclas = new Set();
    this.mando = { giro: 0, acelerar: false, reversa: false };

    this.soltarIzq = botonSostenido(btnIzq, (v) => { this.izq = v; });
    this.soltarDer = botonSostenido(btnDer, (v) => { this.der = v; });
    this.soltarPedal = botonSostenido(btnAcelerar, (v) => { this.pedal = v; });
    this.soltarReversa = botonSostenido(btnReversa, (v) => { this.pedalReversa = v; });
    alTocar(btnModo, () => this.alTocarModo());

    addEventListener('keydown', (e) => {
      const t = TECLAS[e.code];
      if (!t) return;
      e.preventDefault();
      this.teclas.add(t);
    });
    addEventListener('keyup', (e) => this.teclas.delete(TECLAS[e.code]));
    addEventListener('blur', () => this.soltarTodo());
    document.addEventListener('visibilitychange', () => this.soltarTodo());

    this.alMoverse = this.alMoverse.bind(this);
    this.mostrarModo();
  }

  // Lo que el carro debe hacer en este momento.
  leer() {
    let giro = this.modo === 'inclinar'
      ? this.giroInclinacion
      : (this.der ? 1 : 0) - (this.izq ? 1 : 0);
    const giroTeclas = (this.teclas.has('der') ? 1 : 0) - (this.teclas.has('izq') ? 1 : 0);
    if (giroTeclas !== 0) giro = giroTeclas;
    this.mando.giro = giro;
    this.mando.acelerar = this.pedal || this.teclas.has('acelerar');
    this.mando.reversa = this.pedalReversa || this.teclas.has('reversa');
    return this.mando;
  }

  soltarTodo() {
    this.soltarIzq();
    this.soltarDer();
    this.soltarPedal();
    this.soltarReversa();
    this.teclas.clear();
  }

  // Tiene que llamarse dentro de un toque: iOS solo muestra la ventana de permiso así.
  pedirPermisoInclinacion() {
    const DME = window.DeviceMotionEvent;
    if (!DME) {
      this.permiso = 'no';
      return Promise.resolve(false);
    }
    if (typeof DME.requestPermission !== 'function') {
      // Android y computadoras no piden permiso; se sabrá si hay sensor cuando lleguen datos.
      this.permiso = 'si';
      this.escuchar();
      return Promise.resolve(true);
    }
    if (this.permiso === 'si') return Promise.resolve(true);
    return DME.requestPermission().then(
      (respuesta) => {
        this.permiso = respuesta === 'granted' ? 'si' : 'no';
        if (this.permiso === 'si') this.escuchar();
        return this.permiso === 'si';
      },
      () => {
        this.permiso = 'no';
        return false;
      },
    );
  }

  escuchar() {
    if (this.escuchando) return;
    this.escuchando = true;
    addEventListener('devicemotion', this.alMoverse);
  }

  alMoverse(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null) return;
    this.hayDatos = true;

    // En horizontal, el eje x del aparato va de arriba a abajo de la pantalla
    // y el eje y va de lado a lado. En vertical es al revés.
    const horizontal = innerWidth > innerHeight;
    const vertical = horizontal ? g.x : g.y;
    const lado = horizontal ? g.y : -g.x;
    if (Math.abs(vertical) > UMBRAL_LEVANTADO) this.signo = Math.sign(vertical);

    const magnitud = Math.hypot(g.x, g.y, g.z ?? 0) || 9.81;
    const seno = Math.max(-1, Math.min(1, (this.signo * lado) / magnitud));
    const angulo = Math.asin(seno);
    const fuera = Math.max(0, Math.abs(angulo) - ZONA_MUERTA);
    const giro = Math.sign(angulo) * Math.min(1, fuera / (ANGULO_MAX - ZONA_MUERTA));

    this.giroInclinacion += (giro - this.giroInclinacion) * SUAVIZADO;
    this.lecturaCruda.lado = lado;
    this.lecturaCruda.vertical = vertical;
  }

  // Espera un momento a que el sensor mande algo (justo después de dar permiso).
  esperarDatos(ms = 600) {
    if (this.hayDatos) return Promise.resolve(true);
    const limite = performance.now() + ms;
    return new Promise((listo) => {
      const revisar = () => {
        if (this.hayDatos) listo(true);
        else if (performance.now() > limite) listo(false);
        else setTimeout(revisar, 50);
      };
      revisar();
    });
  }

  alTocarModo() {
    if (this.modo === 'inclinar') {
      this.ponerModo('botones');
      return;
    }
    // Si al empezar no se dio permiso, se vuelve a pedir aquí (también es un toque).
    this.pedirPermisoInclinacion()
      .then((ok) => (ok ? this.esperarDatos() : false))
      .then((ok) => {
        if (ok) this.ponerModo('inclinar');
        else this.alNoPoderInclinar?.();
      });
  }

  ponerModo(modo) {
    if (modo === this.modo) return;
    this.modo = modo;
    // Se sueltan las flechas (desaparecen), pero no los pedales: se cambia sin dejar de avanzar.
    this.soltarIzq();
    this.soltarDer();
    this.giroInclinacion = 0;
    this.mostrarModo();
    this.alCambiarModo?.(modo);
  }

  mostrarModo() {
    this.hud.dataset.modo = this.modo;
  }
}

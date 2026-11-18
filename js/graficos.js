// Cómo se dibuja todo: renderer, cielo, reflejos del entorno, brillo (bloom) y niveles de calidad.
//
// Niveles: alta (resolución completa), media (resolución 1.5), baja (resolución 1, sombras más simples).
// Si el juego va lento, baja de nivel solo y lo recuerda en este iPad.
// El brillo (bloom) cuesta mucho en la ciudad; queda listo para escenas chicas (por ejemplo, el taller).
// Las sombras de la ciudad no se recalculan en cada cuadro: solo cuando el sol salta (ver ciudad.seguir).
// ?calidad=alta|media|baja en la dirección lo fija a mano.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const NIVELES = {
  alta: { resolucion: 2, brillo: false, sombra: 2048 },
  media: { resolucion: 1.5, brillo: false, sombra: 2048 },
  baja: { resolucion: 1, brillo: false, sombra: 1024 },
};
const ORDEN = ['alta', 'media', 'baja'];
const CLAVE = 'juego-manejo:calidad';

export const SOL = new THREE.Vector3(0.45, 0.8, 0.32).normalize();
const CIELO_ARRIBA = new THREE.Color(0x2a7de1);
const CIELO_HORIZONTE = new THREE.Color(0xa9d9fb);
const CIELO_ABAJO = new THREE.Color(0x9fb7a0);

function leer(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* no pasa nada */ }
}

// Cúpula del cielo: degradado de arriba al horizonte, y el sol con un halo.
function crearCupula() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      arriba: { value: CIELO_ARRIBA },
      horizonte: { value: CIELO_HORIZONTE },
      abajo: { value: CIELO_ABAJO },
      dirSol: { value: SOL },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w;   // siempre al fondo
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 arriba, horizonte, abajo, dirSol;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 color = mix(horizonte, arriba, pow(clamp(h, 0.0, 1.0), 0.55));
        color = mix(color, abajo, smoothstep(0.0, -0.12, h));
        float s = max(dot(d, dirSol), 0.0);
        color += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.08);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
  cupula.frustumCulled = false;
  cupula.renderOrder = -1;
  return cupula;
}

export function crearGraficos(lienzo) {
  const forzada = new URLSearchParams(location.search).get('calidad');
  const nombres = { alta: 'alta', media: 'media', baja: 'baja' };
  let nivel = nombres[forzada] ?? nombres[leer(CLAVE)] ?? 'alta';
  // Para pruebas: ?res=1.5&brillo=0&msaa=0&sombra=1024 cambian una sola cosa del nivel.
  const prueba = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => ['res', 'brillo', 'msaa', 'sombra'].includes(k)).map(([k, v]) => [k, Number(v)]));
  const adaptable = !nombres[forzada] && Object.keys(prueba).length === 0;
  const ajustesDe = (nombre) => {
    const n = { ...NIVELES[nombre] };
    if ('res' in prueba) n.resolucion = prueba.res;
    if ('brillo' in prueba) n.brillo = prueba.brillo > 0;
    if ('msaa' in prueba) n.msaa = prueba.msaa;
    if ('sombra' in prueba) n.sombra = prueba.sombra;
    return n;
  };

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  // "Neutral" respeta los colores vivos (los otros los deslavan).
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  let escena = null;
  let camara = null;
  let compositor = null;
  let brillo = null;
  let sol = null;

  function armarCompositor() {
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2());
    const destino = new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType, samples: ajustesDe(nivel).msaa ?? 4 });
    compositor = new EffectComposer(renderer, destino);
    compositor.addPass(new RenderPass(escena, camara));
    brillo = new UnrealBloomPass(new THREE.Vector2(tam.x / 2, tam.y / 2), 0.28, 0.45, 0.92);
    compositor.addPass(brillo);
    compositor.addPass(new OutputPass());
  }

  function aplicarNivel() {
    const n = ajustesDe(nivel);
    renderer.shadowMap.enabled = n.sombra > 0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, n.resolucion));
    if (sol && n.sombra > 0 && sol.shadow.mapSize.x !== n.sombra) {
      sol.shadow.mapSize.set(n.sombra, n.sombra);
      sol.shadow.map?.dispose();
      sol.shadow.map = null;
    }
    renderer.shadowMap.needsUpdate = true;
    ajustarTamano();
    if (n.brillo && !compositor && escena) armarCompositor();
    if (!n.brillo && compositor) {
      compositor.dispose();
      compositor = null;
    }
  }

  function ajustarTamano() {
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    renderer.setSize(ancho, alto, false);
    if (camara) {
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
    }
    if (compositor) {
      compositor.setPixelRatio(renderer.getPixelRatio());
      compositor.setSize(ancho, alto);
    }
  }
  addEventListener('resize', ajustarTamano);

  // ---------- Velocidad: si va lento, baja la calidad ----------
  let cuadros = 0;
  let tiempo = 0;
  let lentos = 0;
  let ignorar = 3;   // los primeros segundos siempre van a tirones (se preparan las sombras y shaders)

  function vigilar(dt, activo) {
    if (!adaptable || !activo) return;
    if (ignorar > 0) { ignorar -= dt; return; }
    cuadros++;
    tiempo += dt;
    if (tiempo < 2) return;
    const fps = cuadros / tiempo;
    cuadros = 0;
    tiempo = 0;
    // Un iPad en modo de ahorro de energía se queda en 30 fps parejos: eso no es lentitud.
    const enAhorro = fps > 28 && fps < 31.5;
    lentos = fps < 45 && !enAhorro ? lentos + 1 : 0;
    if (lentos >= 2 && nivel !== 'baja') {
      nivel = ORDEN[ORDEN.indexOf(nivel) + 1];
      guardar(CLAVE, nivel);
      lentos = 0;
      ignorar = 3;
      aplicarNivel();
    }
  }

  return {
    renderer,
    get nivel() { return nivel; },

    // Cielo, reflejos del entorno, niebla y el sol.
    prepararEscena(nuevaEscena, nuevaCamara, luzSol) {
      escena = nuevaEscena;
      camara = nuevaCamara;
      sol = luzSol;
      escena.add(crearCupula());
      escena.fog = new THREE.Fog(CIELO_HORIZONTE, 170, 460);
      escena.background = CIELO_HORIZONTE.clone();

      // Reflejos: se "fotografía" el cielo una vez y se usa en todos los materiales.
      const fotoCielo = new THREE.Scene();
      fotoCielo.add(crearCupula());
      const pmrem = new THREE.PMREMGenerator(renderer);
      escena.environment = pmrem.fromScene(fotoCielo, 0.02).texture;
      escena.environmentIntensity = 0.85;
      pmrem.dispose();

      aplicarNivel();
    },

    dibujar() {
      if (compositor) compositor.render();
      else renderer.render(escena, camara);
    },

    vigilar,

    // Volver a calcular las sombras (cuando el sol se movió).
    actualizarSombras() {
      renderer.shadowMap.needsUpdate = true;
    },
  };
}

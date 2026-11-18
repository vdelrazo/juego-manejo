// Texturas dibujadas con canvas: no hay archivos de imagen.
// Todas usan números al azar con semilla fija, así se ven igual siempre.

import * as THREE from 'three';

function azarFijo(semilla) {
  return () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };
}

function lienzo(ancho, alto = ancho) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return [c, c.getContext('2d')];
}

function textura(c, { repetir = true, color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const gris = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;

// Puntitos claros y oscuros para que nada se vea plano.
function puntear(g, ancho, alto, azar, cantidad, base, rango, tam = 2) {
  for (let i = 0; i < cantidad; i++) {
    g.fillStyle = gris(base + (azar() - 0.5) * rango, 0.5);
    const t = tam * (0.5 + azar());
    g.fillRect(azar() * ancho, azar() * alto, t, t);
  }
}

// ---------- Piso ----------

export function asfalto() {
  const azar = azarFijo(11);
  const [c, g] = lienzo(512);
  g.fillStyle = '#5d636d';
  g.fillRect(0, 0, 512, 512);
  // Manchas grandes y suaves.
  for (let i = 0; i < 26; i++) {
    const x = azar() * 512, y = azar() * 512, r = 30 + azar() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const v = azar() < 0.5 ? 70 : 105;
    grad.addColorStop(0, gris(v, 0.22));
    grad.addColorStop(1, gris(v, 0));
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  puntear(g, 512, 512, azar, 9000, 95, 70, 2);
  // Grietitas.
  g.strokeStyle = 'rgba(40,42,46,0.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = azar() * 512, y = azar() * 512;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (azar() - 0.5) * 40;
      y += (azar() - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return textura(c);
}

export function banqueta() {
  const azar = azarFijo(23);
  const [c, g] = lienzo(512);
  const losa = 128;   // 4 losetas por lado: 1 m cada una
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = 214 + (azar() - 0.5) * 18;
      g.fillStyle = gris(v);
      g.fillRect(i * losa, j * losa, losa, losa);
    }
  }
  puntear(g, 512, 512, azar, 5000, 200, 50, 2);
  g.strokeStyle = 'rgba(150,155,162,0.9)';
  g.lineWidth = 4;
  for (let k = 0; k <= 4; k++) {
    g.beginPath(); g.moveTo(k * losa, 0); g.lineTo(k * losa, 512); g.stroke();
    g.beginPath(); g.moveTo(0, k * losa); g.lineTo(512, k * losa); g.stroke();
  }
  return textura(c);
}

export function pasto() {
  const azar = azarFijo(37);
  const [c, g] = lienzo(512);
  g.fillStyle = '#6cbf4c';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const x = azar() * 512, y = azar() * 512;
    const l = 4 + azar() * 7;
    const tono = azar();
    g.strokeStyle = tono < 0.5 ? 'rgba(70,140,50,0.55)' : 'rgba(150,215,110,0.5)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (azar() - 0.5) * 3, y - l);
    g.stroke();
  }
  return textura(c);
}

// ---------- Paredes (se multiplican por el color de cada edificio) ----------

export function estuco() {
  const azar = azarFijo(41);
  const [c, g] = lienzo(256);
  g.fillStyle = gris(238);
  g.fillRect(0, 0, 256, 256);
  puntear(g, 256, 256, azar, 6000, 228, 40, 2);
  return textura(c);
}

export function ladrillo() {
  const azar = azarFijo(53);
  const [c, g] = lienzo(512);
  g.fillStyle = gris(245);   // junta
  g.fillRect(0, 0, 512, 512);
  const alto = 32, largo = 96;
  for (let fila = 0; fila < 512 / alto; fila++) {
    const corrimiento = fila % 2 ? largo / 2 : 0;
    for (let x = -largo; x < 512 + largo; x += largo) {
      const v = 175 + azar() * 45;
      g.fillStyle = gris(v);
      g.fillRect(x + corrimiento + 3, fila * alto + 3, largo - 6, alto - 6);
    }
  }
  puntear(g, 512, 512, azar, 4000, 190, 60, 2);
  return textura(c);
}

// Rayas para los toldos: blanco y gris (por el color del toldo quedan rayas de dos tonos).
export function rayas() {
  const [c, g] = lienzo(128, 16);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? gris(255) : gris(150);
    g.fillRect(i * 16, 0, 16, 16);
  }
  return textura(c);
}

// ---------- Ventanas: un atlas de 4 × 2 tipos, con su mapa de brillo ----------
// 0 vidrio · 1 cortinas rosas · 2 cortina amarilla · 3 persiana · 4 maceta · 5 luz encendida
// 6 puerta · 7 aparador de tienda
export const VENTANAS = { columnas: 4, filas: 2 };

export function ventanas() {
  const azar = azarFijo(67);
  const C = 256;
  const [c, g] = lienzo(C * 4, C * 2);
  const [cr, gr] = lienzo(C * 4, C * 2);   // brillo (rugosidad): oscuro = liso y brillante

  const celda = (i) => [(i % 4) * C, Math.floor(i / 4) * C];

  function vidrio(x, y, w, h, encendida = false) {
    const grad = g.createLinearGradient(x, y, x, y + h);
    if (encendida) {
      grad.addColorStop(0, '#ffe7a8');
      grad.addColorStop(1, '#f6b956');
    } else {
      grad.addColorStop(0, '#2e4a6b');
      grad.addColorStop(0.55, '#4f7699');
      grad.addColorStop(1, '#7ea6c4');
    }
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);
    // Reflejo en diagonal.
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.moveTo(x + w * 0.15, y + h);
    g.lineTo(x + w * 0.55, y);
    g.lineTo(x + w * 0.75, y);
    g.lineTo(x + w * 0.35, y + h);
    g.fill();
    g.restore();
    gr.fillStyle = gris(encendida ? 120 : 14);
    gr.fillRect(x, y, w, h);
  }

  function marco(x, y, w, h, grosor, color = '#f4f1ea') {
    g.fillStyle = color;
    g.fillRect(x, y, w, grosor);
    g.fillRect(x, y + h - grosor, w, grosor);
    g.fillRect(x, y, grosor, h);
    g.fillRect(x + w - grosor, y, grosor, h);
    gr.fillStyle = gris(170);
    gr.fillRect(x, y, w, grosor);
    gr.fillRect(x, y + h - grosor, w, grosor);
    gr.fillRect(x, y, grosor, h);
    gr.fillRect(x + w - grosor, y, grosor, h);
  }

  function telaRugosa(x, y, w, h) {
    gr.fillStyle = gris(235);
    gr.fillRect(x, y, w, h);
  }

  // Ventanas normales (0 a 5).
  for (let i = 0; i < 6; i++) {
    const [x, y] = celda(i);
    g.fillStyle = '#f4f1ea';
    g.fillRect(x, y, C, C);
    gr.fillStyle = gris(170);
    gr.fillRect(x, y, C, C);
    const m = 18;
    vidrio(x + m, y + m, C - 2 * m, C - 2 * m, i === 5);
    if (i === 1) {
      // Cortinas rosas a los lados.
      g.fillStyle = '#f7a1c4';
      g.fillRect(x + m, y + m, 46, C - 2 * m);
      g.fillRect(x + C - m - 46, y + m, 46, C - 2 * m);
      telaRugosa(x + m, y + m, 46, C - 2 * m);
      telaRugosa(x + C - m - 46, y + m, 46, C - 2 * m);
    } else if (i === 2) {
      g.fillStyle = '#ffd166';
      g.fillRect(x + m, y + m, C - 2 * m, 92);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 6; k++) g.fillRect(x + m + 12 + k * 36, y + m, 6, 92);
      telaRugosa(x + m, y + m, C - 2 * m, 92);
    } else if (i === 3) {
      for (let k = 0; k < 14; k++) {
        g.fillStyle = k % 2 ? '#e9e4d8' : '#d6d0c2';
        g.fillRect(x + m, y + m + k * 9, C - 2 * m, 9);
      }
      telaRugosa(x + m, y + m, C - 2 * m, 126);
    } else if (i === 4) {
      // Maceta con plantita en el pretil.
      g.fillStyle = '#c0643a';
      g.fillRect(x + 90, y + C - m - 40, 76, 40);
      for (let k = 0; k < 9; k++) {
        g.fillStyle = k % 2 ? '#3f9a4a' : '#58b85e';
        g.beginPath();
        g.arc(x + 100 + azar() * 56, y + C - m - 50 - azar() * 30, 16 + azar() * 8, 0, Math.PI * 2);
        g.fill();
      }
      telaRugosa(x + 90, y + C - m - 90, 76, 90);
    }
    // Travesaños del marco.
    marco(x, y, C, C, m);
    g.fillStyle = '#f4f1ea';
    g.fillRect(x + C / 2 - 5, y + m, 10, C - 2 * m);
    gr.fillStyle = gris(170);
    gr.fillRect(x + C / 2 - 5, y + m, 10, C - 2 * m);
  }

  // 6: puerta de madera con vidrio arriba.
  {
    const [x, y] = celda(6);
    const grad = g.createLinearGradient(x, 0, x + C, 0);
    grad.addColorStop(0, '#7a4f33');
    grad.addColorStop(0.5, '#8d5d3d');
    grad.addColorStop(1, '#6f4630');
    g.fillStyle = grad;
    g.fillRect(x, y, C, C);
    gr.fillStyle = gris(200);
    gr.fillRect(x, y, C, C);
    vidrio(x + 40, y + 24, C - 80, 70);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 6;
    g.strokeRect(x + 40, y + 116, C - 80, 54);
    g.strokeRect(x + 40, y + 182, C - 80, 54);
    g.fillStyle = '#e8c35a';
    g.beginPath();
    g.arc(x + C - 52, y + 150, 9, 0, Math.PI * 2);
    g.fill();
    gr.fillStyle = gris(40);
    gr.beginPath();
    gr.arc(x + C - 52, y + 150, 9, 0, Math.PI * 2);
    gr.fill();
  }

  // 7: aparador de tienda con cositas de colores.
  {
    const [x, y] = celda(7);
    g.fillStyle = '#2b2d42';
    g.fillRect(x, y, C, C);
    gr.fillStyle = gris(150);
    gr.fillRect(x, y, C, C);
    vidrio(x + 12, y + 12, C - 24, C - 24);
    const colores = ['#ef476f', '#ffd166', '#06d6a0', '#4ea8de', '#b388eb', '#f78c6b'];
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(x + 20, y + 168, C - 40, 8);
    g.fillRect(x + 20, y + 98, C - 40, 8);
    for (let k = 0; k < 7; k++) {
      g.fillStyle = colores[k % colores.length];
      g.fillRect(x + 26 + k * 30, y + 136 - (k % 3) * 8, 22, 32 + (k % 3) * 8);
      g.fillStyle = colores[(k + 3) % colores.length];
      g.beginPath();
      g.arc(x + 37 + k * 30, y + 84, 11, 0, Math.PI * 2);
      g.fill();
    }
  }

  const mapa = textura(c, { repetir: false });
  const brillo = textura(cr, { repetir: false, color: false });
  return { mapa, brillo };
}

// Coordenadas de textura (u0, v0, u1, v1) de un tipo de ventana del atlas.
export function celdaVentana(tipo) {
  const col = tipo % VENTANAS.columnas;
  const fila = Math.floor(tipo / VENTANAS.columnas);
  const u0 = col / VENTANAS.columnas;
  const v1 = 1 - fila / VENTANAS.filas;
  return [u0 + 0.002, v1 - 1 / VENTANAS.filas + 0.004, u0 + 1 / VENTANAS.columnas - 0.002, v1 - 0.004];
}

// ---------- Otros ----------

// Mapa de normales con ondas, para el agua de la fuente.
export function agua() {
  const N = 256;
  const [c, g] = lienzo(N);
  const datos = g.createImageData(N, N);
  const altura = (x, y) =>
    Math.sin((x / N) * Math.PI * 2 * 3) * 0.5 + Math.sin((y / N) * Math.PI * 2 * 4 + (x / N) * 6) * 0.5 +
    Math.sin(((x + y) / N) * Math.PI * 2 * 5) * 0.3;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = altura(x + 1, y) - altura(x - 1, y);
      const dy = altura(x, y + 1) - altura(x, y - 1);
      const nx = -dx * 2, ny = -dy * 2, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      datos.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      datos.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      datos.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      datos.data[i + 3] = 255;
    }
  }
  g.putImageData(datos, 0, 0);
  return textura(c, { color: false });
}

// Sombra suave (negro que se desvanece), para poner bajo el vehículo.
export function sombraSuave() {
  const [c, g] = lienzo(128);
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return textura(c, { repetir: false });
}

// Placa del carro.
export function placa(texto) {
  const [c, g] = lienzo(256, 80);
  g.fillStyle = '#f8f9fa';
  g.fillRect(0, 0, 256, 80);
  g.strokeStyle = '#1d3557';
  g.lineWidth = 6;
  g.strokeRect(4, 4, 248, 72);
  g.fillStyle = '#1d3557';
  g.font = 'bold 50px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, 128, 44);
  return textura(c, { repetir: false });
}

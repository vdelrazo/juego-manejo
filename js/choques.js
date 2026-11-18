// Obstáculos vistos desde arriba: cajas (edificios, orilla de la ciudad) y círculos (árboles, fuente).
// Sirve para dos cosas: sacar al vehículo de lo que se le meta, y saber si algo le tapa la vista a la cámara.

const limitar = (v, min, max) => (v < min ? min : v > max ? max : v);

export class Obstaculos {
  constructor() {
    this.cajas = [];
    this.circulos = [];
    this.golpe = { nx: 0, nz: 0, pen: 0 };
  }

  caja(x0, z0, x1, z1) {
    this.cajas.push({ x0, z0, x1, z1 });
  }

  circulo(x, z, r) {
    this.circulos.push({ x, z, r });
  }

  // Si el círculo (x, z, r) se mete en algo, dice hacia dónde sacarlo (nx, nz) y cuánto (pen).
  // Devuelve el golpe más profundo, o null si no toca nada.
  empujar(x, z, r) {
    let pen = 0;
    let nx = 0;
    let nz = 0;

    for (const c of this.cajas) {
      if (x + r <= c.x0 || x - r >= c.x1 || z + r <= c.z0 || z - r >= c.z1) continue;
      const dx = x - limitar(x, c.x0, c.x1);
      const dz = z - limitar(z, c.z0, c.z1);
      const d2 = dx * dx + dz * dz;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        if (d >= r || r - d <= pen) continue;
        pen = r - d;
        nx = dx / d;
        nz = dz / d;
      } else {
        // El centro quedó adentro: se saca por el lado más cercano.
        const lados = [
          [x - c.x0, -1, 0], [c.x1 - x, 1, 0], [z - c.z0, 0, -1], [c.z1 - z, 0, 1],
        ];
        lados.sort((a, b) => a[0] - b[0]);
        const [dist, lx, lz] = lados[0];
        if (dist + r <= pen) continue;
        pen = dist + r;
        nx = lx;
        nz = lz;
      }
    }

    for (const c of this.circulos) {
      const dx = x - c.x;
      const dz = z - c.z;
      const suma = r + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= suma * suma) continue;
      const d = Math.sqrt(d2);
      if (suma - d <= pen) continue;
      pen = suma - d;
      if (d > 1e-6) {
        nx = dx / d;
        nz = dz / d;
      } else {
        nx = 1;
        nz = 0;
      }
    }

    if (pen <= 0) return null;
    this.golpe.nx = nx;
    this.golpe.nz = nz;
    this.golpe.pen = pen;
    return this.golpe;
  }

  // Qué parte del camino de (x0, z0) a (x1, z1) está libre de cajas: 1 = todo libre.
  libre(x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    let t = 1;
    for (const c of this.cajas) {
      let entra = 0;
      let sale = t;
      if (Math.abs(dx) < 1e-9) {
        if (x0 < c.x0 || x0 > c.x1) continue;
      } else {
        const a = (c.x0 - x0) / dx;
        const b = (c.x1 - x0) / dx;
        entra = Math.max(entra, Math.min(a, b));
        sale = Math.min(sale, Math.max(a, b));
      }
      if (Math.abs(dz) < 1e-9) {
        if (z0 < c.z0 || z0 > c.z1) continue;
      } else {
        const a = (c.z0 - z0) / dz;
        const b = (c.z1 - z0) / dz;
        entra = Math.max(entra, Math.min(a, b));
        sale = Math.min(sale, Math.max(a, b));
      }
      if (entra <= sale) t = Math.min(t, entra);
    }
    return t;
  }
}

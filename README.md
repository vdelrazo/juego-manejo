# Juego de manejo 🚗🏍️

Un juego 3D sencillo de manejar carro o moto, hecho para niños de 3 a 5 años.

**Jugar:** https://vdelrazo.github.io/juego-manejo/

## Instalar en el iPad

1. Abre el enlace en **Safari**.
2. Toca **Compartir** (el cuadro con la flecha hacia arriba).
3. Elige **Agregar a pantalla de inicio**.

El juego queda con su propio ícono y se abre en pantalla completa.

## Probar en la computadora

```
python -m http.server 8000
```

y abrir http://localhost:8000. Se maneja con las flechas (o W A D) y la barra espaciadora.
La inclinación y el sonido de iOS solo se pueden probar en el iPad.

Agregando `?depurar` a la dirección se ven los fps y lo que lee el sensor de inclinación.

Las reglas y las decisiones de diseño están en [CLAUDE.md](CLAUDE.md).

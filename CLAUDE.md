# Juego de manejo para niños

Juego 3D estilo arcade de manejar carro o moto, para niños de **3 a 5 años**.
Se juega en dos iPads: se abre en Safari y se agrega a la pantalla de inicio,
sin pasar por el App Store. Se publica con GitHub Pages:
https://vdelrazo.github.io/juego-manejo/

Este archivo es la fuente de verdad del diseño. Si una decisión cambia,
actualízala aquí.

## Forma de trabajar

- Antes de cambios que toquen varios archivos, proponer un plan y esperar aprobación.
- Avanzar por fases (ver abajo); cada fase termina con algo jugable en el iPad.
- Probar en el iPad real: el navegador de Windows no simula bien la inclinación ni el audio de iOS.

## Reglas del juego (decididas 2026-11-17)

### Público: niños de 3 a 5 años
- **El juego no depende de leer.** Todo se entiende con íconos, colores, sonidos y voz.
  Los textos que aparezcan también se dicen en voz alta (`speechSynthesis`, voz es-MX).
- Botones grandes (80 px o más) y separados entre sí.
- Pocos menús, sin submenús. Desde cualquier pantalla se regresa al inicio con un toque.

### Inicio de partida
1. **Elegir vehículo:** moto, carro y quizá un camión de bomberos (2 o 3 opciones).
   Todos se manejan con la misma lógica; solo cambia el modelo y el sonido.
2. **Elegir modo:**
   - **Paseo libre:** recorrer el pueblito sin objetivos.
   - **Misiones sencillas:** recoger estrellas, llevar un paquete a "la casa azul", etc.
     Una flecha grande y la voz guían hacia el objetivo.

### Mundo
- 3D sencillo y colorido (*low-poly*), con la cámara detrás del vehículo.
- Un pueblito pequeño: calles, casas de colores, árboles y un parque.
- **Semáforos y señales de alto:** si el niño se detiene en rojo, gana estrellas extra.
  Pasarse el alto no castiga; solo se pierde la estrella.

### Choques: nunca se pierde
- No hay "game over" ni vidas.
- Al chocar, el vehículo rebota suavemente, suena algo chistoso y aparece el mensaje
  **"¡Cuidado, me dolió!"**, también dicho en voz alta.

### Controles
- **Modo inclinar:** se gira inclinando el iPad como volante, con un botón grande para acelerar.
- **Modo botones:** botones en pantalla para izquierda, derecha y acelerar.
- **Se cambia de modo en plena partida** con un botón siempre visible, sin pausar ni salir.
- Al soltar el acelerador, el vehículo frena solo poco a poco.
- **Sin reversa** (decidido 2026-11-17): para dar la vuelta se gira en U.
- **Se puede girar estando parado, pero despacio**, para que nunca se quede atorado de frente a algo.

### Jugadores
- Un jugador; cada quien juega en su propio iPad.
- El multijugador (ver a otros en el mismo mundo) queda para una versión futura: necesita un servidor.

## Decisiones técnicas

- **HTML + JavaScript (módulos ES) + Three.js.** Sin paso de compilación: lo que está en `main` es lo que se publica.
- **Three.js copiado dentro del repo** (`vendor/three/`, versión 0.187.0), no cargado desde un CDN, para que funcione sin internet.
- **Modelos hechos con cajas y cilindros** en el código, sin archivos 3D. Sonidos generados con Web Audio, sin archivos de audio.
- **`?depurar`** al final de la dirección muestra fps y lo que lee el sensor de inclinación, para revisar en el iPad.
- **GitHub Pages** se publica desde la raíz de la rama `main`. `.nojekyll` evita que Jekyll procese los archivos.
- **PWA:** con `manifest.json` y un *service worker*, el juego abre en pantalla completa, con ícono propio y sin internet.
- Particularidades de iOS/Safari:
  - **Inclinación:** se lee la gravedad con `devicemotion` (no los ángulos de `deviceorientation`), así funciona igual con el iPad parado o acostado y por cualquiera de sus dos lados horizontales. Unos grados al centro no tienen efecto, para que ir derecho sea fácil. `DeviceMotionEvent.requestPermission()` solo funciona después de un toque del usuario y con HTTPS (GitHub Pages ya usa HTTPS). Por ahora se pide al tocar ▶ para empezar (normalmente lo toca un adulto), así el niño cambia de modo después sin ventanas de por medio. Si se niega, el juego sigue en modo botones.
  - **Audio:** iOS no reproduce sonido hasta el primer toque. El botón de "Jugar" desbloquea el audio y la voz.
  - **Orientación:** iOS ignora `orientation` del manifest. Si el iPad está vertical, se muestra un aviso visual de "gira tu iPad".
  - **Rendimiento:** pocos polígonos, sombras sencillas y `devicePixelRatio` limitado a 2.
- **iPads:** probablemente "iPad 11" (iPad de 11.ª generación o un modelo de 11 pulgadas; falta
  confirmar en *Ajustes > General > Información*). Cualquiera de esos mueve sin problema un 3D
  *low-poly* a 60 fps, así que se mantiene el estilo sencillo sin recortes extra.
- **Nombre:** por ahora se queda como está: "A manejar" en la pantalla de inicio del iPad y
  `juego-manejo` como repo.

## Fases

1. **Prototipo:** un carro sobre terreno plano, cámara detrás, controles de botones e inclinación, y cambio de control en plena partida.
   *Hecha el 2026-11-17; falta probarla en el iPad.*
2. **Pueblito y choques:** calles, casas y árboles; choques con rebote, sonido y "¡Cuidado, me dolió!".
3. **Menú de inicio:** elegir vehículo (2 o 3) y modo (paseo libre o misiones).
4. **Misiones y semáforos:** estrellas, entregas, flecha guía y estrellas extra por respetar el rojo.
5. **Instalable y pulido:** PWA sin internet, ícono, música, voces y ajustes de rendimiento.

## Preguntas abiertas

- Confirmar el modelo exacto de los iPads.
- Lista concreta de misiones para la fase 4.

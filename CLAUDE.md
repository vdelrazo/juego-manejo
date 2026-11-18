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

### Inicio de partida (aprobado 2026-11-17, falta hacerlo: es la fase 3)
Dos pantallas, cada una con dos opciones enormes y la voz que pregunta. Ya no hay ▶:
el primer toque (al elegir vehículo) activa el sonido y el permiso de inclinación.
🏠 regresa a la primera pantalla.
1. **Elegir vehículo:** moto o carro. El camión de bomberos queda para después.
   Se manejan con la misma lógica; la moto se inclina más en las curvas y suena un poco más agudo.
2. **Elegir modo:** "¿Quieres pasear o jugar retos?"
   - **Paseo libre:** recorrer la ciudad sin objetivos.
   - **Retos:** una flecha grande sobre el vehículo y la voz guían hacia el objetivo. Los primeros dos, alternados:
     - **Estrellas:** 6 estrellas en las calles; al juntarlas todas, festejo con confeti y voz.
     - **Paquete:** "Lleva el paquete a la casa azul" (el color cambia: azul, roja, amarilla, verde).
       Al llegar, festejo. De paso se practican los colores.

### Mundo
- 3D sencillo y colorido (*low-poly*), con la cámara detrás del vehículo. Si un edificio le tapa
  la vista, la cámara se acerca y sube.
- **Una ciudad** (cambiado 2026-11-17; antes era un pueblito): 5 × 5 manzanas con calles anchas
  (12 m), edificios de colores de 2 a 8 pisos con ventanas y puertas con toldo, banquetas,
  pasos de cebra, árboles y un parque con fuente en el centro. La orilla está cerrada por
  edificios. Siempre sale igual (números al azar con semilla fija).
- **Semáforos y señales de alto:** si el niño se detiene en rojo, gana estrellas extra.
  Pasarse el alto no castiga; solo se pierde la estrella.

### Choques: nunca se pierde
- No hay "game over" ni vidas.
- Al chocar, el vehículo rebota suavemente, suena algo chistoso ("boing") y aparece el mensaje
  **"¡Cuidado, me dolió!"**, también dicho en voz alta. Le salen estrellitas de mareo.
- Solo cuenta como choque si iba a más de 2 m/s contra algo; empujar despacio una pared no.
  El mensaje y la voz no se repiten antes de 3 segundos.

### Controles
- **Modo inclinar:** se gira inclinando el iPad como volante.
- **Modo botones:** botones en pantalla para izquierda y derecha.
- **Pedales en los dos modos:** el verde ▲ avanza; el azul ▼ (más chico, a su izquierda) va de reversa.
- **Se cambia de modo en plena partida** con un botón siempre visible, sin pausar ni salir
  y sin soltar los pedales.
- Al soltar el pedal, el vehículo frena solo poco a poco.
- **Con reversa** (cambiado 2026-11-17; antes era sin reversa): va al 40 % de la velocidad,
  suena "pi-pi-pi" y gira como un carro de verdad. Si va hacia adelante y se aprieta ▼,
  primero frena y luego retrocede (y al revés).
- **Se puede girar estando parado, pero despacio**, para que nunca se quede atorado de frente a algo.

### Sonido
- Motor: zumbido suave y redondo, como de carrito de juguete (cambiado 2026-11-17: el primero
  se oía áspero).

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
2. **Ciudad, reversa y choques:** calles, edificios y árboles; reversa; choques con rebote, sonido y "¡Cuidado, me dolió!"; motor más suave.
   *Hecha el 2026-11-17; falta probarla en el iPad.*
3. **Menú de inicio:** elegir vehículo (moto o carro) y modo (paseo libre o retos). **Es lo siguiente.**
4. **Retos y semáforos:** estrellas y paquete a la casa de color con flecha guía; después,
   semáforos con estrellas extra por respetar el rojo.
5. **Instalable y pulido:** PWA sin internet, ícono, música, voces y ajustes de rendimiento.

## Preguntas abiertas

- Confirmar el modelo exacto de los iPads.
- Más retos, después de estrellas y paquete.

### Pendiente de probar en el iPad (fases 1 y 2)

Abrir https://vdelrazo.github.io/juego-manejo/?depurar y revisar:

1. ¿Sale la ventana de permiso al tocar ▶? ¿Vuelve a preguntar cada vez que se abre el juego?
2. Al inclinar a la derecha, ¿el carro va a la derecha?
3. ¿La sensibilidad está bien? (giro completo con 25° de inclinación)
4. ¿Se oyen el motor y la voz? ¿La voz suena con acento mexicano?
5. ¿Las flechas y los pedales funcionan bien con dos dedos?
6. ¿Cuántos fps marca? (la ciudad tiene unos 41 000 triángulos)
7. ¿La velocidad se siente bien para un niño de 3 a 5 años?
8. ¿El pedal de reversa está en un buen lugar? ¿El "pi-pi-pi" molesta?
9. ¿El choque se siente bien (rebote, "boing", mensaje)? ¿O se repite demasiado?
10. ¿El motor nuevo ya suena suave?

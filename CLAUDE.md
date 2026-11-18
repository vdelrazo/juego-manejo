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
Dos pantallas, cada una con dos opciones enormes (dibujos, sin texto) y la voz que pregunta.
No hay ▶: el primer toque (al elegir vehículo) activa el sonido y el permiso de inclinación.
🏠 regresa a la primera pantalla.
1. **Elegir vehículo:** moto o carro. El camión de bomberos queda para después.
   Se manejan con la misma lógica; la moto se inclina hacia adentro en las curvas, es más
   chica (cabe por lugares más angostos) y su motor suena más agudo.
2. **Elegir modo:** "¿Quieres pasear o jugar retos?"
   - **Paseo libre:** recorrer la ciudad sin objetivos.
   - **Retos:** una flecha grande sobre el vehículo (inclinada hacia la cámara para que se vea
     de frente) y la voz guían hacia el objetivo. Arriba al centro, un panel con dibujos dice
     qué hay que hacer. Se alternan estrellas → paquete → estacionarse; al terminar uno hay
     festejo (confeti, musiquita y voz) y 4 s después empieza el siguiente.
     - **Estrellas:** 6 estrellas en las calles, cerca del vehículo; la voz cuenta "¡Una!, ¡Dos!…".
     - **Paquete:** "Lleva el paquete a la casa azul" (el color cambia: azul, roja, amarilla, verde).
       El paquete va en el techo del carro o atrás de la moto; se entrega frente a la puerta,
       marcada con una columna de luz del mismo color. De paso se practican los colores.
     - **Estacionarse** (pedido 2026-11-17): "Estaciónate en el cajón amarillo". El cajón se
       marca en amarillo con una columna de luz; el reto se cumple cuando el vehículo se queda
       quieto adentro y el motor se apaga.

### Mundo
- 3D sencillo y colorido (*low-poly*), con la cámara detrás del vehículo. Si un edificio le tapa
  la vista, la cámara se acerca y sube.
- **Una ciudad** (cambiado 2026-11-17; antes era un pueblito): 5 × 5 manzanas con calles anchas
  (12 m), edificios de colores de 2 a 8 pisos con ventanas y puertas con toldo, banquetas,
  pasos de cebra, árboles y un parque con fuente en el centro. La orilla está cerrada por
  edificios. Siempre sale igual (números al azar con semilla fija). No hay turquesa, para que
  no se confunda con el azul en el reto del paquete.
- **Estacionamiento** en la manzana al este del parque: 12 cajones grandes (5 × 7 m) en dos
  filas, con un pasillo ancho que se abre a las dos calles, setos atrás de cada fila, 5 carros
  estacionados y un letrero de "P". Dentro de un cajón, al soltar el pedal el vehículo frena
  más rápido, para que estacionarse sea fácil.
- **Semáforos y señales de alto:** si el niño se detiene en rojo, gana estrellas extra.
  Pasarse el alto no castiga; solo se pierde la estrella.

### Taller (aprobado 2026-11-18)
- Se entra **manejando hasta un edificio "Taller"** en la ciudad. Tiene que ser fácil entrar:
  portón ancho, zona de entrada grande y marcada.
- Adentro la pantalla se divide: **el vehículo en 3D ocupa la mayor parte** (unos dos tercios,
  a la izquierda) y un panel a la derecha con pestañas de dibujos: 🔧 reparación, 🧽 lavado,
  🎨 pintura, 🔩 piezas. Al cambiar de pestaña solo cambia el panel. Un botón grande regresa a manejar.
- Los choques dejan **daños** y manejar **ensucia** el vehículo. Son solo de apariencia: nunca
  impiden jugar. En el taller se reparan y se lavan.
- **Pintura y piezas siempre se pueden cambiar**, aunque el vehículo no esté dañado ni sucio.
- Cada iPad guarda su vehículo (colores, piezas, calcomanías) para la siguiente vez.

### Gráficas (pedido 2026-11-18: "lo más que se pueda")
- Calidad lo más alta posible: materiales con reflejos (pintura con barniz, vidrios), cielo con
  degradado y sol, sombras suaves, brillo (*bloom*), texturas generadas en el código y más detalle
  en la ciudad (cornisas, postes, bancas, tinacos, etc.).
- **Calidad automática:** si el iPad va lento, el juego baja la calidad solo y lo recuerda.
  `?calidad=alta|media|baja` en la dirección la fija a mano.
- Lo que más costaba (y cómo se resolvió): el *bloom* (se quitó de la ciudad; queda para el taller),
  dibujar la ciudad entera en cada cuadro (se arma en trozos de 96 m y no se dibuja lo que no se ve)
  y recalcular sombras en cada cuadro (ahora solo cuando el vehículo avanza 8 m; el vehículo usa
  una sombra suave pegada al piso).

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
- Motor: **rugido** grave que se abre al acelerar (cambiado 2026-11-17 dos veces: el primero se
  oía áspero; el segundo, un zumbido suave, no convenció). La moto ruge más agudo.
- **En un cajón el motor se apaga:** si el vehículo se queda quieto dentro de un cajón, deja de
  sonar. Al apretar un pedal vuelve a arrancar ("rrr-RUM"). Pasa en paseo libre y en los retos.

### Jugadores
- Un jugador; cada quien juega en su propio iPad.
- El multijugador (ver a otros en el mismo mundo) queda para una versión futura: necesita un servidor.

## Decisiones técnicas

- **HTML + JavaScript (módulos ES) + Three.js.** Sin paso de compilación: lo que está en `main` es lo que se publica.
- **Three.js copiado dentro del repo** (`vendor/three/`, versión 0.187.0), no cargado desde un CDN, para que funcione sin internet.
- **Modelos hechos en el código**, sin archivos 3D: formas redondeadas (perfiles extruidos con
  bisel, cápsulas, tornos) y piezas separadas para poder pintarlas y cambiarlas en el taller.
  Texturas dibujadas en el código (canvas), sin archivos de imagen. Sonidos generados con Web Audio.
- **Complementos de Three.js** (efectos de imagen) copiados en `vendor/three/addons/`; un
  *import map* en `index.html` hace que `three` apunte a la copia local.
- **`?depurar`** al final de la dirección muestra fps y lo que lee el sensor de inclinación, para revisar en el iPad.
- **GitHub Pages** se publica desde la raíz de la rama `main`. `.nojekyll` evita que Jekyll procese los archivos.
- **PWA:** con `manifest.json` y un *service worker*, el juego abre en pantalla completa, con ícono propio y sin internet.
- Particularidades de iOS/Safari:
  - **Inclinación:** se lee la gravedad con `devicemotion` (no los ángulos de `deviceorientation`), así funciona igual con el iPad parado o acostado y por cualquiera de sus dos lados horizontales. Unos grados al centro no tienen efecto, para que ir derecho sea fácil. `DeviceMotionEvent.requestPermission()` solo funciona después de un toque del usuario y con HTTPS (GitHub Pages ya usa HTTPS). Se pide al elegir vehículo (el primer toque), así el niño cambia de modo después sin ventanas de por medio. Si se niega, el juego sigue en modo botones.
  - **Audio:** iOS no reproduce sonido hasta el primer toque. Elegir vehículo desbloquea el audio y la voz (por eso esa primera pantalla no tiene voz la primera vez).
  - **Toques:** las opciones del menú usan `click` (lo que iOS acepta para el permiso y el audio); los botones del juego usan eventos de puntero, porque con varios dedos en la pantalla iOS no siempre manda `click`.
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
2. **Ciudad, reversa y choques:** calles, edificios y árboles; reversa; choques con rebote, sonido y "¡Cuidado, me dolió!"; sonido del motor nuevo.
   *Hecha el 2026-11-17.*
3. **Menú de inicio:** elegir vehículo (moto o carro) y modo (paseo libre o retos).
   *Hecha el 2026-11-17.*
4. **Retos:** estrellas, paquete a la casa de color y estacionarse, con flecha guía.
   *Hechos el 2026-11-17.* (El 2026-11-17 se jugó un rato en el iPad y "estuvo bien"; no se midieron fps.)
5. **Gráficas al máximo:** luz, materiales, cielo, carro y moto nuevos, ciudad con detalle, calidad automática.
   *Hecha el 2026-11-18.* Medido en una laptop con Intel Iris Xe (potencia parecida a la de un iPad de
   11.ª generación) con la resolución de un iPad de 11": calidad alta ≈ 52 fps, media ≈ 73 fps.
6. **Taller, parte 1:** edificio del taller, pantalla dividida, guardado, pintura y lavado (con suciedad al manejar).
7. **Taller, parte 2:** daños por choques, reparación y cambio de piezas.
8. **Semáforos:** estrellas extra por detenerse en rojo.
9. **Instalable y pulido:** PWA sin internet, ícono, música, voces y ajustes de rendimiento.

## Preguntas abiertas

- Confirmar el modelo exacto de los iPads.
- Más retos, después de estrellas, paquete y estacionarse.

### Pendiente de probar en el iPad (fases 1 a 4)

Abrir https://vdelrazo.github.io/juego-manejo/?depurar y revisar:

1. ¿Sale la ventana de permiso al elegir vehículo? ¿Vuelve a preguntar cada vez que se abre el juego?
2. Al inclinar a la derecha, ¿el vehículo va a la derecha?
3. ¿La sensibilidad está bien? (giro completo con 25° de inclinación)
4. ¿Se oyen el motor y la voz? ¿La voz suena con acento mexicano?
5. ¿Las flechas y los pedales funcionan bien con dos dedos?
6. ¿Cuántos fps marca y en qué calidad se queda? (con `?depurar` se ven los dos datos abajo al centro)
7. ¿La velocidad se siente bien para un niño de 3 a 5 años?
8. ¿El pedal de reversa está en un buen lugar? ¿El "pi-pi-pi" molesta?
9. ¿El choque se siente bien (rebote, "boing", mensaje)? ¿O se repite demasiado?
10. ¿El rugido del motor gusta? ¿Se nota que se apaga en el cajón y que arranca otra vez?
11. ¿Los niños entienden los dibujos del menú y del panel de retos, y la flecha?
12. ¿Estacionarse en el cajón es demasiado difícil o demasiado fácil?

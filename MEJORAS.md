# Ejecución: plan de mejoras para Claude Code

> **Para Claude Code:** este documento es la especificación. Lee primero la sección 1 (contexto y reglas) y luego haz **una tarea a la vez**, en el orden de las **fases** (sección 0). Después de cada tarea, pruébala (sección 4) y pídeme confirmación antes de seguir con la siguiente.

---

## 0. Fases

Cada fase termina con la app publicada y usable. No se empieza una fase sin cerrar la anterior.

| Fase | Qué | Tareas | Se cierra cuando |
|---|---|---|---|
| **0 · Base** ✓ | Repo con historial, pruebas automáticas, el bosque y el estilo compacto | Tarea 0 | Cerrada: publicado en el artifact (versión 11) |
| **1 · Lo crítico** ✓ | Lo que protege tus datos y quita fricción diaria | Tarea 7 → Tarea 3 → Tarea 1 → Tarea 2 | Cerrada: publicado en el artifact (versión 13). Solo falta que descargues tu primera copia |
| **2 · Usarla** | 4 semanas de uso real, **sin funciones nuevas** (solo arreglar errores) | Tarea 8 → Tarea 9 → Tarea 10 (adelantadas, publicadas en la versión 15) | Pasaron 4 domingos con revisión cerrada |
| **3 · Según el uso** | Solo lo que el uso real pida, en este orden por defecto | Tarea 5 → Tarea 6 → Tarea 4 | Tú decides, con lo anotado en la fase 2 |
| **4 · Fuera del artifact** | La versión independiente (sección 3) | — | Fuera de alcance por ahora |

**Por qué este orden**
- La **Tarea 7** (frentes de hábito) entró primero a la fase 1 porque salió del uso real: armar un hábito como leer exigía crear una tarea cada día.
- La **Tarea 3** va después: hoy tus datos viven solo en el artifact y no tienen copia. Se hace antes de cambiar cómo se guardan (Tarea 1).
- En la **fase 2**, lo que estorbe se anota en Semana → «¿Qué voy a cambiar?» empezando con `App:` (se guarda solo, cualquier día). Al final de la fase se leen esas 4 revisiones en Anteriores y de ahí sale la fase 3.
- Las **Tareas 8, 9 y 10** salieron de la revisión del 12 oct (Bandeja y Frentes). La 8 arregla errores; la 9 y la 10 son funciones nuevas que el usuario decidió adelantar porque vienen del uso real.
- La **Tarea 5** se reduce: el bosque ya muestra cada día de cada objetivo. Queda el porcentaje de días ganados del mes y la mejor racha de cada hábito.
- La **Tarea 4** (IA) va al final porque es la más grande y la única que depende de una capability (`sample`) cuya forma exacta hay que verificar antes de escribir código.
- **Capabilities:** cada publicación que las declare debe repetir **todas** (la regla completa de `db`, más `downloads` desde la Tarea 3 y más `sample` desde la Tarea 4). Si se omite una, se pierde.

---

## 1. Contexto

**Ejecución** es una app personal de disciplina y ejecución. Es una sola página HTML (`index.html`, unas 1.300 líneas, JavaScript sin frameworks) publicada como **Artifact de claude.ai**:

- URL del artifact: `https://claude.ai/artifact/D1Vk3U5EHEfGAfyGAgCEW9`
- Para publicar cambios hay que usar la **herramienta Artifact** con `url` igual a esa dirección. Primero lee el artifact con `action: "read"` y construye sobre esa versión.
- **Capabilities declaradas:** `db` con la regla `{path:"", read:"owner", write:"owner"}` (solo el dueño lee y escribe) y `downloads` (desde la Tarea 3). Si omites el campo al publicar, se mantiene la declaración. Si lo pasas, repítelas **todas**: `{db:{rules:[{path:"",read:"owner",write:"owner"}]}, downloads:true}` (más `sample:{}` desde la Tarea 4).
- Interfaz en **español (Colombia)**, pensada sobre todo para iPhone (ancho de unos 390 px), con modo claro y oscuro.

### Filosofía del producto (no romperla)

1. **Una Principal por proyecto activo** (máximo 2 por día) y **máximo 2 Extras**. Las Principales **salen solas** los días de cada proyecto (los de su hábito; sin hábito, de lunes a viernes): la siguiente tarea pendiente en el orden en que la escribiste. La que no cumples sigue en Hoy, en rojo («Vencida desde …»), hasta que la hagas. El día está ganado cuando las haces todas.
2. **Máximo 2 proyectos activos.** El resto va a Congelados. Los frentes de **hábito** (lo mismo cada día, como leer 20 minutos) no ocupan cupo.
3. **Mínimo innegociable:** en un día malo, cumplir el mínimo mantiene la racha. Regla: *nunca fallar dos veces seguidas*.
4. **De día solo se ejecuta.** La app decide la Principal; la noche anterior solo vacías la Bandeja y, si quieres, cambias algo.
5. **Interfaz minimalista:** casillas, recuadros punteados con "+" para lo vacío y un botón **"!"** de ayuda en cada apartado (objeto `HELP`). Pocas palabras en pantalla.
6. **Todo queda ligado al frente:** el asistente "Crear frente" pregunta primero el tipo y si empieza **Activo** o **Congelado**. Un proyecto lleva por Frente → Tareas → Objetivo → Hábito (objetivo y hábito opcionales). Un hábito lleva por Frente → Tiempo al día → Meta con fecha (opcional). Congelado no pide fechas ni hábito de proyecto y no crea bosque: las fechas se eligen al activarlo.
7. **Los formularios se comparten:** el asistente y cada módulo usan exactamente el mismo formulario (`goalFields`/`readGoalFields` y `habitFields`/`readHabitFields`). Si agregas un campo, agrégalo ahí y aparecerá en los dos lugares.

### Cinco secciones (barra inferior)

| Sección | Contenido |
|---|---|
| **Hoy** | Fecha · Principal · Extras · Hábitos de hoy · puntos de la semana · Mañana (plan de noche) |
| **Bandeja** | Captura rápida. Casilla = hecho. "Mover" = enviar a un frente o congelarla como idea |
| **Frentes** | Proyectos activos (con su objetivo, la meta de esta semana, su hábito y sus tareas) · Hábitos · Congelados (frentes e Ideas) |
| **Metas** | Visión · Objetivos (barra de progreso, bosque, semanas marcables, plan plegable). Un objetivo de hábito no tiene semanas: avanza por días ("Día 5 de 23 · 4 días cumplidos") |
| **Semana** | Estadísticas · revisión del domingo (3 preguntas, limpieza, semana de cada objetivo) · revisiones anteriores |

### Modelo de datos (capability `db`)

Las colecciones viven en la raíz. Se escribe con `put(col, obj)` (reemplazo completo, con una cola por documento) y se borra con `remove(col, id)`. Para leer, hay suscripciones `onSnapshot` que llenan el objeto `S`.

```
fronts/{id}   { name, note, status: "active"|"frozen", order, created, kind?: "habit",  // sin kind = proyecto
                planSkip?: "YYYY-MM-DD",                       // ese día quitaste su Principal: no vuelve a salir sola
                pauses: [{from:"YYYY-MM-DD", to?:"YYYY-MM-DD"}] }   // periodos congelado; el bosque no cuenta fallos ahí
tasks/{id}    { title, frontId|null, minutes|null, slot: null|"critical"|"secondary",
                date: "YYYY-MM-DD"|null, done, doneAt, created, archived?,
                missed?: ["YYYY-MM-DD"],                       // días en que fue la Principal y no se hizo (se guarda al moverla o quitarla)
                someday?: "YYYY-MM-DD",
                since?: "YYYY-MM-DD" }                         // Principal vencida: primer día en que fue Principal                       // idea congelada desde la Bandeja (sin frente ni plan); sale de inbox() y va a ideas()
goals/{id}    { frontId, title, why, start, deadline, standard, minimum, trigger,   // start/deadline: null si se creó con el frente congelado (se ponen al activarlo)
                weekly: [{text, done}],         // largo = goalWeeks(g), sale de las fechas
                premortem: [{cause, counter}×3], rewardMid, rewardEnd, created }
habits/{id}   { name, minimum, standard, days: [0-6], frontId|null,
                minutes?, minMinutes?,                         // tiempo al día y mínimo en minutos; con ellos, minimum/standard = "5 min"/"20 min"
                log: { "YYYY-MM-DD": "full"|"min"|"auto" }, order, created,
                time?: { "YYYY-MM-DD": minutos },              // minutos hechos con ▶ ese día
                daysHist?: [{to:"YYYY-MM-DD", days:[0-6]}] }  // días que tenía antes de cada cambio
reviews/{lunes YYYY-MM-DD} { done, blocked, change, inbox, frozen, closed }
meta/settings { vision, fixedTime, planBTime, lastBackup? }   // lastBackup: día de la última copia descargada
meta/focus    { days: { "YYYY-MM-DD": minutos } }
```

- `slot:"critical"` es la Principal y `slot:"secondary"` es un Extra. Una tarea en la Bandeja tiene `frontId:null` y `slot:null`.
- Un hábito con `log = "auto"` fue marcado por `syncHabit()` al completar una tarea de su frente.
- Un hábito no toca los días en que su frente estuvo congelado: `scheduled(h, d)` mira `paused(frente, d)`. Esos días no son fallos, no cortan la racha y no se pintan en rojo; la cuenta de fallos (`missedRun`) y la del bosque empiezan de cero después de un tramo congelado.
- `goalWeek(g)` vale 0 si el objetivo todavía no empieza.
- `pauses`: el día `from` ya está congelado y el día `to` no. Un frente congelado sin `pauses` (de antes del bosque) cuenta como congelado desde siempre; al activarlo se guarda `{from:"2000-01-01", to:hoy}`.

### Mapa del código (funciones clave)

- **Estado y escritura:** `S`, `put`, `remove`, `putMeta`, `run` (cola), `init()` (suscripciones).
- **Consultas:** `active`, `frozen`, `crit(d)`, `secs(d)`, `inbox`, `ideas`, `goalFor(fid)`, `goalWeeks`, `goalWeek`, `scheduled`, `streak`, `missedRun`, `dayState`.
- **Lógica:** `assign`, `unassign`, `toggleDone`, `syncHabit`.
- **Render:** `render()` (conserva el foco), `VIEWS.{hoy,bandeja,frentes,metas,semana}`, `taskRow`, `head`, `dash`, `info`.
- **Modales:** `openModal(fn, live)` (cuando `live=false` no se redibuja con cada cambio y `modal.guard` evita cerrarlo tocando fuera), `sheet()`, `taskSheet`, `pickSheet`, `frontSheet`, `goalForm`, `habitsEdit`, `habitEditOne`, `habitNew`, `habitQuick`, `wizardOpen` (W), `nightOpen`/`nightRender` (NP), `settingsSheet`, `guideSheet`, `helpSheet`.
- **Eventos:** clics delegados con `data-act` → objeto `A`. Formularios con `data-form` → objeto `FORMS`.
- **Tipos de frente:** `isHabitFront`, `projects` (solo estos cuentan para el máximo de 2); asistente por pasos `FLOW`, `HABIT0`, `wzCur`, `wzLast`, `wzGoalOk`; `goalFields(g, {compact})` (meta corta de los hábitos).
- **Enfoque:** objeto `F` (`kind` "task" o "habit"), `focusOpen`, `focusHabit` (▶ de un hábito), `habitDone` (pantalla final), `renderFocus`, `tick`, `logFocus`, `habitTime` (guarda los minutos y marca el hábito).
- **Bosque:** `forestOn`, `paused`, `forestMap` (nivel por día), `forestDays` (estado por día), `forestGoal`, `forestWilting`, `forestGrow` / `forestGrowMsg` (texto del aviso), `forestArt`, `hashStr`, `forestSpots` (lugares al azar), `forestSvg` (la isla), `forestStats`, `forestBlock`, `forestSeen` (animación), `TREES`, `ART`, `RANK`, `plural`, `daysOn` (días del hábito en una fecha), `keepMiss` (guarda la Principal fallada al moverla). Se calcula en memoria a partir de `tasks`, `habits` y `fronts.pauses`; no tiene colección propia.

### Reglas al editar

- **Mantén un solo archivo autocontenido.** Solo se permiten CDNs de la lista blanca de Artifacts (las fuentes vienen de Google Fonts).
- **Colores siempre con tokens CSS de `:root`**, con sus variantes oscuras ya definidas.
- **Tamaños del estilo compacto (bloque `v4` del CSS):** casillas redondas de 18 px como los puntos de la semana (con área táctil ampliada; ▶, ⋯, «!», los chips y los botones de los avisos también la tienen), títulos de fila 14 px, detalles 11,5 px, títulos de sección 14 px, filas de 42 px. Lo nuevo usa esos mismos tamaños.
- **Escrituras:** una por documento a la vez (usa `put`). Nunca escribas desde un render ni desde un callback de snapshot.
- **Formularios con texto libre:** usa `openModal(fn, false)` y campos `textarea.auto` para textos largos.
- **Hojas en iPhone (bloque «iPhone» al final del CSS):** los campos de hora y fecha llevan `appearance:none`; con su aspecto nativo, el iPhone les pone relleno y ancho propios por encima del CSS y se salen de la hoja. El fondo se bloquea solo en táctil (`pointer:coarse`), así en computador la columna no salta al quitar la barra. Los textos de las hojas bajan de línea aunque sean un enlace largo. Lo cubre «Hojas en iPhone» en `tests/run.mjs`.
- **Toda función nueva necesita su "!":** actualiza `HELP` y `guideSheet()`.
- **No reintroduzcas términos viejos:** "Tarea Crítica", "P1/P2", "secundaria", "12 semanas", "menú", "Hito semanal".

---

## 2. Tareas

### Tarea 0: Bosque del objetivo *(fase 0 · hecha)*

**Idea:** como la app Forest (una isla de pasto en perspectiva), con los colores y la letra de Ejecución. Cada objetivo con inicio y fecha límite tiene su isla: empieza vacía y se llena con cada día que avanzas. Aplica la regla *nunca fallar dos veces seguidas*.

**Estado de cada día** (se mira solo el **frente del objetivo**):

| Estado | Cuándo |
|---|---|
| **Brote** | El hábito del frente quedó en `"min"` |
| **Árbol** | Se terminó una tarea del frente (`doneAt`) o el hábito quedó en `"full"` o `"auto"` |
| **Árbol con fruto** (`--accent`) | La Principal de ese día era de este frente y está hecha |
| **Marchito** | Un día que tocaba sin nada: el hábito estaba programado (con los días que tenía en esa fecha) o la Principal era de este frente, aunque después la pasaras a otro día o la quitaras |
| **Salvado** (árbol pequeño) | Era marchito y volviste a avanzar en el frente (cualquier día, tocara o no) antes de otro fallo |
| **Seco** (tronco caído) | Segundo fallo seguido |
| **Tierra** | Tercer fallo seguido en adelante |
| **Pasto** | Un día que no tocaba, o con el frente congelado (`pauses`) |
| **Hoy** | Rombo `--accent` y una semilla hasta que cumplas |
| **Por crecer** | Días después de hoy (pasto vacío) |

- Los días que no tocan no cortan ni reinician la cuenta de fallos.
- Isla cuadrada (lado = raíz del número de días, mínimo 3), un espacio por día. Cada día cae en un lugar al azar de toda la isla, fijo para cada objetivo (`forestSpots`, con semilla: id del objetivo + primer día del bloque). El rombo de hoy se dibuja encima de todo para que ningún árbol lo tape. Los objetivos de más de 364 días se ven por bloques de 364: el que contiene hoy.
- El conteo suma árboles (con y sin fruto), brotes, salvados, marchitos y secos. La tierra no se cuenta.
- Tres árboles geométricos (pino, redondo, ciprés), con luz desde la izquierda. Tokens: `--grass`, `--grass-2`, `--grass-side`, `--earth`, `--earth-2`, `--tree`, `--tree-2`, `--trunk`, `--wilt`, `--dead`, `--hi`, `--shade`, en claro y oscuro.

**Dónde aparece:**
- **Metas:** en cada objetivo, entre la barra y las semanas, con su "!" (`HELP.bosque`) y debajo el conteo "11 árboles · 2 brotes · 2 salvados · 1 marchito · 11 por crecer".
- **Frentes:** en la línea del objetivo, "· 9 árboles".
- **Hoy:** si hay un árbol marchito por salvar y hoy toca algo de ese frente: "Tu árbol de CCFA se está marchitando. Hoy haz al menos el mínimo y lo salvas." (si no hay hábito hoy: "Hoy termina la Principal y lo salvas."). Varios frentes van en un solo aviso. Reemplaza el aviso del hábito de ese frente.
- **Avisos al marcar:** primer avance del día: "Brotó una planta en tu bosque." (mínimo), "Creció un árbol en tu bosque." (tarea o hábito) o "Creció un árbol con fruto en tu bosque." (Principal). Si ya había brote: "El brote ya es un árbol.". Si ya había algo y terminas la Principal: "Tu árbol dio fruto.". Si había un árbol marchito por salvar, se agrega "Salvaste el que se marchitaba.". Lo que crece hoy se anima una vez al abrir Metas.
- **Guía:** sección "Tu bosque".

### Tarea 7: Frentes de hábito con tiempo *(fase 1 · hecha)*

**Problema:** un hábito como "leer Dune" obligaba a crear la tarea "Leer" cada día para poder marcarlo. Registrar páginas también es fricción.

**Hecho:**
- **Dos tipos de frente** en el primer paso del asistente: **Proyecto** (tareas distintas, máximo 2 activos) o **Hábito** (lo mismo cada día; no ocupa cupo).
- **El hábito pide solo el tiempo:** Tiempo al día (5 a 90 min, o "Sin tiempo fijo"), Mínimo en minutos y días (todos por defecto). Su meta con fecha es opcional y corta: qué + fechas (3 semanas desde hoy por defecto), sin semanas; lo demás (por qué, disparador, riesgos, recompensas) plegado en "Más detalles". La barra se llena con los días cumplidos sobre los días que tocan.
- **En Hoy → Hábitos**, un hábito con tiempo muestra **▶**. Al tocarlo, el temporizador arranca solo con lo que falta de hoy.
  - Al terminar el tiempo se marca solo (`full`) y el bosque crece.
  - Si paras antes y pasaste el mínimo, queda en `min` ("Mínimo cumplido. La racha sigue viva.").
  - Si paras antes del mínimo, guarda los minutos y lo dice ("Llevas 2 de 20 min").
  - La casilla y "Solo mínimo" siguen sirviendo para cuando no usas el temporizador.
- **Frentes** muestra los hábitos en su propia sección, sin lista de tareas (las que ya tuviera se ven, para no perderlas). La hoja del frente permite **Convertir en hábito** o **Convertir en proyecto**.
- Cualquier hábito, también el de un proyecto, puede tener tiempo y ▶.
- "Crear hábito" (en Hoy y en Editar hábitos) abre el asistente en tipo Hábito.

**Listo cuando:** se puede crear "Leer Dune · 20 min" con 2 proyectos activos, cumplirlo desde Hoy solo con ▶ y ver crecer su bosque, sin escribir tareas ni números. Cubierto por `node tests/run.mjs` (sección "Frentes de hábito").

### Tarea 1: Un solo mínimo y un solo estándar *(fase 1 · hecha)*

**Problema:** el objetivo y el hábito tienen cada uno su propio "Mínimo" y "Estándar". El usuario puede terminar escribiendo dos mínimos distintos para el mismo frente.

**Hacer:**
- Que la **fuente única** sea el hábito del frente.
- En `goalFields`: si el frente tiene un hábito ligado, reemplazar los campos Estándar y Mínimo por una línea de solo lectura ("Mínimo y estándar: los del hábito *THM* (editar)", con un enlace a `habitEditOne`). Si el frente no tiene hábito, mostrar los campos como hoy.
- En el asistente: el paso Objetivo **no** pide mínimo ni estándar. El paso Hábito los pide. Si el usuario elige "No por ahora", el paso Hábito muestra solo esos dos campos, que se guardan en el objetivo.
- En `VIEWS.metas` (Plan), mostrar los valores del hábito cuando exista.

- **Bosque:** el brote sale solo del `log` "min" de un hábito. Si el frente no tiene hábito, el mínimo del objetivo no se puede marcar y el aviso de Hoy pide terminar la Principal.
- **Ya resuelto por la Tarea 7:** en los frentes de hábito la meta no pide mínimo ni estándar, y en los hábitos con tiempo ambos salen de los minutos.
- **Hecho para los proyectos:** `stdMinHtml(fid, g)` muestra en la meta "Mínimo y estándar: los del hábito X (15 min · 45 min). Se cambian en el hábito." si el frente tiene hábito, o los dos campos si no; cambia al elegir otro frente. El asistente no los pide en Objetivo (`noStdMin`); con "No por ahora" pide solo esos dos (`wz-gmin`, `wz-gstd`) si hay objetivo. `readGoalFields` conserva los valores viejos cuando el campo no está. Metas → Plan muestra los del hábito. Se eligió no poner un enlace a editar el hábito dentro del formulario de la meta porque abrirlo perdería lo que llevas escrito.

**Listo cuando:** en ningún flujo se piden dos veces el mínimo y el estándar del mismo frente, los datos antiguos siguen mostrándose bien y `node tests/run.mjs` sigue pasando los casos del bosque.

### Tarea 2: Tu bloque y el Plan B visibles en Hoy *(fase 1 · hecha)*

**Problema:** `fixedTime` y `planBTime` solo aparecen en el último paso de "Planear mañana".

**Hacer:**
- En Hoy, debajo de la fecha, una línea discreta: "Tu bloque: 19:30" (solo si `fixedTime` existe).
- Después de `planBTime`, si la Principal no está hecha, cambiar esa línea por: "Plan B activo: hoy solo el mínimo" (punto color `--warn`).
- En Ajustes: si no hay hora fija, mostrar en Hoy un recuadro punteado "+ Elegir tu hora fija".
- Recalcular cada minuto (ya existe un `setInterval` de 60 s para el cambio de día).

**Listo cuando:** con la hora simulada (por ejemplo con `page.clock` de Playwright), la línea cambia al pasar `planBTime`.

**Hecho:** `dayLine()` devuelve la línea de debajo de la fecha, solo de lunes a viernes: "Tu bloque: 7:30 p. m."; "Plan B activo: hoy solo el mínimo" (punto `--warn`) si pasó `planBTime` y la Principal no está hecha (aunque no haya hora fija); o "+ Elegir tu hora fija", que abre Ajustes. El `setInterval` de 60 s redibuja cuando cambia el día o el estado de la línea. Cubierto por `tests/run.mjs` ("Tu bloque y el Plan B", con `page.clock.install` + `runFor`).

### Tarea 3: Copia de seguridad *(fase 1 · hecha)*

**Hacer:**
- Agregar la capability `downloads` (publicar con `capabilities: {db:{rules:[{path:"",read:"owner",write:"owner"}]}, downloads:true}`, repitiendo la regla de `db` completa).
- En Ajustes, el botón "Descargar mis datos" llama a `downloads.save({filename:"ejecucion-YYYY-MM-DD.json", data})` con el JSON de `S` (todas las colecciones).
- Agregar "Restaurar desde archivo" (`<input type=file>`): valida la estructura, muestra un resumen ("5 frentes, 32 tareas…") y pide doble confirmación antes de escribir.
- Si `claude.use("downloads")` devuelve `null`, ocultar el botón.

**Listo cuando:** descargar y restaurar en un almacenamiento vacío reproduce el mismo estado.

**Hecho:**
- **Ajustes → Tus datos** (con su "!"): "Descargar mis datos" guarda `ejecucion-AAAA-MM-DD.json` (`{app:"ejecucion", version:1, exported, data:{fronts, tasks, goals, habits, reviews, meta:{settings, focus}}}`) y muestra "Última copia: …". Si `downloads` no está o responde que aquí no se puede, el botón no aparece.
- **Restaurar desde archivo** **reemplaza todo** (decisión del usuario). Valida la copia (app, colecciones como arreglos, ids válidos y sin repetir) y muestra qué trae y qué hay ahora. Ofrece descargar lo actual antes y pide dos toques, con el segundo pausado.
- Escribe un documento a la vez, con reintentos si el servidor pide esperar. Mientras tanto la hoja no se puede cerrar. Si falla a la mitad, queda un aviso fijo y se termina repitiendo el mismo archivo.
- No se puede copiar ni restaurar hasta que la app terminó de cargar (si no, la copia saldría vacía). La fecha de la última copia se conserva al restaurar.
- La guía pide descargar los datos cada domingo.
- Mapa: `COLS`, `backupData`, `backupSave`, `backupParse`, `restorePick`, `restoreSheet`, `restoreRun`, `loaded`, `dl`, `RS`, `restoring`. Pruebas en `tests/run.mjs` (sección "Copia de seguridad"); `tests/mock.js` simula `downloads` (`window.__NODL` lo apaga) y fallos de escritura (`window.__FAILAT`).

### Tarea 8: Congelar y activar sin errores *(fase 2 · hecha)*

**Problema (revisión del 12 oct, «revisar completo»):** al activar un frente con hábito salía «Llevas 2 días sin cumplir…» y los días congelados se pintaban de rojo; al congelarlo se borraban los fallos que ya tenía. Su Principal de hoy o de mañana se quedaba en Hoy (y al marcarla crecía el bosque de un frente congelado). El bosque congelado marcaba «hoy», un objetivo vencido seguía con «esta semana» y la ayuda de Congelados decía «2 frentes».

**Hecho:**
- `scheduled(h, d)` mira si el frente estaba congelado **ese día** (`paused`), no si lo está hoy. Se quitaron `habitPaused` y `prevScheduled`.
- La racha cuenta el hábito que hiciste el mismo día en que congelaste, y los puntos de la semana cuentan como fallo una Principal fallada que se movió (`tasks.missed`).
- `missedRun` se corta en un tramo congelado; el bosque también (`forestDays` reinicia la cuenta y `forestWilting` no pide salvar un árbol de antes de congelar). Hoy congelado no es semilla ni se marca en la isla, y `forestGoal` no da bosque a un frente congelado.
- **Congelar** saca del plan la Principal, los Extras y lo pendiente del frente (`keepMiss` guarda la Principal fallada) y el aviso lo dice: «CCFA congelado. Salió de tu plan: Estudiar módulo 3.».
- Metas: un objetivo vencido no marca ninguna semana como «esta semana».
- Ayuda de Congelados: «menos de 2 proyectos activos».

**Listo cuando:** congelar y activar no cambian el pasado ni dejan tareas del frente en Hoy. Cubierto por `tests/run.mjs` («Congelar y activar»).

### Tarea 9: Ideas congeladas desde la Bandeja *(fase 2 · hecha)*

**Problema:** «las notas que ponga en bandeja debería poder moverlas a congelar… no solo de mis frentes activos sino general». Hoy «Mover a…» solo ofrece frentes, y el «Congelar» de «Planear mañana» manda la nota al primer frente congelado que encuentre (con los datos reales, a eJPT, donde queda escondida como «1 tarea»).

**Hacer:**
- Campo opcional `tasks.someday: "YYYY-MM-DD"` (día en que se congeló) en notas sin frente y sin plan. `inbox()` las excluye (el punto de la Bandeja baja); `ideas()` las lista.
- «Mover a…» de una nota sin frente: primera opción **Congelar · para algún día**. El «Congelar» de «Planear mañana» hace lo mismo (se quita la búsqueda por nombre «Algún día»).
- Frentes → Congelados: grupo plegado **Ideas (N)**. Cada idea con «Activar» (vuelve a la Bandeja) y ⋯ («Mover a…»: frentes y Borrar). «Nada congelado» solo si no hay ni ideas ni frentes.
- Los frentes de hábito no se ofrecen como destino de una nota (no llevan tareas). En «Planear mañana», «Borrar» pide dos toques como en «Mover a…».
- Ayuda y guía: Bandeja, Congelados, Mañana.

**Listo cuando:** una idea general se congela con dos toques, no aparece en la Bandeja ni en ningún frente, se ve en Congelados y vuelve a la Bandeja con «Activar»; la copia y la restauración la conservan.

**Hecho:** `ideas()`, acciones `idea-freeze` (no se puede sobre una nota hecha) y `idea-back`; `move` quita `someday`. «Congelar · para algún día» va de primero en «Mover a…», encima de los frentes. En «Planear mañana», «Borrar» se arma en el mismo botón («¿Borrar?») sin redibujar, así la hoja no salta. Las fechas de otro año llevan el año (`fmtDay`). El aviso dice dónde quedó: «Congelada. La ves en Frentes → Congelados.». El grupo «Ideas (N)» va plegado al final de Congelados (la idea más reciente arriba, con «Desde el …») y recuerda si lo abriste (`KEEP` + `<details data-keep>`). Cubierto por `tests/run.mjs` («Ideas congeladas»).

### Tarea 10: Frentes congelados sin fechas; las fechas al activar *(fase 2 · hecha)*

**Problema:** «Debería poder decir si va a estar activa o congelada… que no se cree para esa un bosque ni pida fecha de inicio y fin hasta que la quiera activar». El asistente crea el frente activo si hay cupo y siempre pide fechas; eJPT quedó del 12 oct al 8 nov y su plazo corre aunque esté congelado.

**Hacer:**
- Primer paso del asistente: **Activo** o **Congelado** (también para hábitos). Con 2 proyectos activos, el proyecto queda Congelado. «Nuevo» en Congelados abre con Congelado.
- Congelado pide el nombre, ideas de tareas (si es proyecto) y el objetivo **sin fechas** (qué y por qué); no pide hábito y no hay bosque. `goals.start`/`deadline` pueden ser `null` mientras el frente esté congelado.
- Metas: los objetivos de frentes congelados (con o sin fechas, como eJPT) van en un grupo plegado **Congelados**: título y «Congelado desde …», sin barra, semanas ni bosque.
- **Activar** un frente con objetivo abre una hoja con Inicio y Fecha límite (las mismas de `goalFields`, ya llenas) y el botón «Activar». Si ya hay 2 proyectos activos, la misma hoja deja congelar uno. Sin objetivo, «Activar» sigue siendo un toque.
- En ⋯ de un frente congelado se ven sus tareas.
- Ayuda, guía y sección 1 (flujo del asistente, modelo de datos).

**Listo cuando:** se puede crear un frente congelado sin fechas ni bosque, activarlo después eligiendo las fechas en ese momento, y eJPT se arregla al activarlo.

**Hecho:**
- Asistente: `W.frozen`, `wzFrozen()` (también si ya hay 2 proyectos activos: «Activo» queda apagado) y `wzFlow()` (proyecto congelado: Frente → Tareas → Objetivo). «Nuevo» de Congelados abre en Congelado (`data-frozen`).
- `goalFields(g, {noDates})` (por defecto, si el frente está congelado) oculta `#g-dates` y `#g-weeks-box`, deja visibles qué y por qué y pliega lo demás; `datesFields()` es el bloque de fechas compartido con la hoja de activar. `readGoalFields` conserva las fechas que tuviera si están ocultas y `FORMS.goal` solo las exige si se ven. Cambiar de frente en el formulario las muestra u oculta.
- `pauseFrom(f)`, `isFrozen(fid)`, `liveGoals(f)` / `planGoal(f)` (los objetivos que seguían vivos al congelarlo, o creados sin fechas), `goalDone`, `actDates`, `durTxt`.
- «Activar» (`front-activate`): sin objetivo y con cupo, un toque. Si no, `activateSheet()` con las fechas de `actDates()`: sin avance, desde el próximo lunes (hoy en un hábito) con la misma duración; con avance, el mismo inicio y la fecha límite corrida los días congelados («se corrió N días»). Sin cupo, «Congelar X y activar Y» (`activate-go` con `data-out`). Las semanas se ajustan a las fechas nuevas. `freezeFront`/`activateFront` son las mismas que usan Congelar y Activar.
- Metas: los objetivos de frentes congelados van plegados en «Congelados (N)» (`data-keep="metas-cold"`) con «Congelado desde el …». Un objetivo sin fechas en un frente activo dice «Sin fechas · ponlas en ⋯ → Editar» y no inventa semanas (tampoco en Frentes ni en Semana).
- Frentes: la fila de un congelado dice su objetivo y su ⋯ muestra sus tareas con «Mover».
- Revisión: `liveGoals(f)` deja fuera los objetivos cumplidos (`goalDone`) y pone primero los que tienen fechas (también `goalFor`); al activar, **todos** los objetivos vivos del frente reciben fechas. Solo el tramo congelado que se cierra corre la fecha límite (los anteriores ya la corrieron). En la hoja de activar, mover el inicio conserva la duración («Duración: 4 semanas»). Si ya tenía avance: «Sigue donde ibas…» y «Su bosque sigue donde iba.». Si pasas a Congelado después de llenar el hábito, ese hábito no se crea. En el formulario, pasar a un frente activo abre el plan por semanas. El primer paso del asistente separa «Tipo» y «¿Empieza ya?».
- Cubierto por `tests/run.mjs` («Frentes congelados sin fechas» y sus arreglos).

### Calma visual *(fase 2 · hecha, publicada en la versión 16)*

**Problema:** «siento mucha presión visual». Había un «!» con círculo en cada sección, varios recuadros vacíos a la vez en Hoy, hasta 4 avisos juntos y 10 filas «Sin definir» en Metas.

**Bosque más vivo:** los árboles miden 1,2 × 1,5 en el mismo cuadro (se tocan y el bosque se ve tupido). Al deslizar el dedo de lado sobre la isla se inclinan con el dedo y al soltar vuelven meciéndose, cada uno con un pequeño desfase (`WIND`, `.sway`, `@keyframes sway`; `touch-action:pan-y` deja subir y bajar la página).

**Hecho:** los «!» quedan tenues y sin círculo; Hoy no pide la hora fija (se elige en Ajustes) y Extras aparece solo cuando ya hay Principal; Hoy muestra un solo aviso, el más importante (2 días sin cumplir → árbol marchito → revisión del domingo → pendientes, en una línea con «y N más» → la última vez no cumpliste); Metas muestra solo la semana actual y las que tienen texto, y pliega el resto en «Todas las semanas (N)». Cubierto por `tests/run.mjs` («Calma visual»).

### Objetivo claro en el asistente *(fase 2 · hecha, publicada en la versión 17)*

**Problema:** al crear «Jr Penetration Tester» el usuario pensó que el proyecto ya incluía el objetivo y lo saltó; luego veía «+ Objetivo» sin entender por qué.

**Hecho:** el paso Objetivo de un proyecto explica «La meta con fecha de X: qué quieres lograr y para cuándo. De aquí salen sus semanas y su bosque.» y trae escrita la propuesta «Completar X» (`W.goalSeen`; si eliges «Sin objetivo» no vuelve). En Frentes, un proyecto sin objetivo dice «+ Objetivo · sin él no hay bosque».

### Principales automáticas *(fase 2 · hecha, publicada en la versión 18)*

**Problema:** con 2 proyectos activos solo cabía una Principal por día y había que elegirla a mano; la que no se cumplía salía como «Pendiente» y había que pasarla a hoy.

**Hecho:**
- `crits(d)`, `critOf(d, fid)`, `dayWon(d)`: una Principal por proyecto (máx. 2). `assign`, «Pasar a hoy», «Crear y programar» y «Planear mañana» reemplazan solo la del mismo frente.
- `autoPlan()` (tras cada snapshot, con `planSoon()`, y al cambiar el día): para cada proyecto activo, si tiene una Principal vencida la pasa a hoy (`since` guarda desde cuándo; el día fallado va a `missed` solo si le tocaba, `dueOn`); si no, y hoy le toca, pone `nextTask(fid)`. `PLANNED` evita repetir la escritura; si la quitas («Quitar del día») se guarda `fronts.planSkip = hoy` y ese día no vuelve sola.
- Hoy: «Principales 1/2», la vencida con borde y texto en rojo («Vencida desde el 15 oct»). Mañana muestra lo que saldrá solo. El día se gana con todas hechas (puntos, Plan B, Semana).
- Cubierto por `tests/run.mjs` («Principales automáticas» y los casos de vencida).

### Aviso de proyecto sin tareas *(fase 2 · hecha, publicada en la versión 19)*

**Problema:** un proyecto activo sin tareas pendientes no saca Principal y nada lo dice; podían pasar días sin avanzar ese frente sin notarlo.

**Cambio:** en Hoy, el aviso de menor prioridad dice «X no tiene tareas. Sin ellas no sale su Principal.» con el botón **Agregar**, que abre Frentes con el campo de nueva tarea de ese proyecto listo. Las ideas congeladas no cuentan como tareas. Al agregar una, sale sola como Principal si ese día toca.

### Tarea 4: IA dentro de la app *(media)*

Usar la capability `sample` (declararla: `sample:{}`). Se llama solo cuando el usuario toca un botón; nunca al cargar.

- **Partir tarea:** en `taskSheet`, la opción "Partir en pasos" pide a Claude de 2 a 5 subtareas que empiecen con un verbo, de 15 a 45 minutos cada una. Las muestra para confirmar y las crea en el mismo frente.
- **Proponer semanas:** en `goalFields`, el botón "Sugerir semanas" (junto a "Semana a semana") envía el título, las fechas y el número de semanas, y llena los campos `g-w*` vacíos. El usuario puede editarlos antes de guardar.
- **Resumen de revisión:** en Semana, "Analizar mis últimas 4 semanas" envía las revisiones, `dayState` por día y los registros de los hábitos, y devuelve 3 patrones y 1 cambio sugerido para el sistema.
- Usar `sample.json()` con un formato de salida estricto. Manejar `not_granted` (ocultar el botón) y `rate_limited` (mostrar un aviso).

**Listo cuando:** las tres funciones devuelven resultados editables y nada se guarda sin que el usuario lo confirme.

### Tarea 5: Historial y rachas *(baja)*

**Hacer:**
- En Semana, una tarjeta "Este mes" con el porcentaje de días ganados del mes (`dayState` = `win`) y la mejor racha de cada hábito. Sin calendario de puntos: el bosque ya muestra cada día.
- Calcularlo en memoria a partir de `tasks` y `habits` (no hace falta una colección nueva).

### Tarea 6: Plantillas de objetivo para certificaciones *(baja)*

**Hacer:**
- En `goalForm` y en el paso Objetivo del asistente, un selector "Usar plantilla": CCFA, OSCP, eJPT y "Ruta web THM".
- Cada plantilla llena el título, las semanas sugeridas (el texto se ajusta al número de semanas que dan las fechas) y los riesgos típicos.
- Las plantillas viven en una constante `TEMPLATES` del propio archivo.

---

## 3. Fuera de alcance por ahora (escalar)

Esto no se hace en el artifact. Queda como referencia para una versión independiente:

- **App web instalable propia:** dominio propio, service worker para funcionar sin internet y **notificaciones push** a la hora fija.
- **Cuentas multiusuario y base de datos propia:** Supabase o Firebase, migrando el mismo modelo de datos.
- **Nicho a validar:** profesionales técnicos que preparan certificaciones. Modelo gratuito con plantillas y coach de IA de pago.
- **Validación previa:** 4 semanas de uso propio y luego 5 a 10 usuarios. La métrica es si siguen usándola a los 14 días.

---

## 4. Cómo probar cada cambio

> **Atajo:** `node tests/run.mjs` hace los pasos 2 y 3 (flujos base y casos del bosque, en claro y oscuro) y deja las capturas en `tests/out/`. Cada tarea nueva agrega sus casos a ese archivo.
> **Capturas:** `node tests/vistas.mjs` toma las 5 vistas y una hoja con datos realistas, en claro y oscuro, en `tests/out/vistas/`. Sirve para la revisión visual del paso 4.

1. **Revisión de sintaxis:** extrae el `<script>` y corre `node --check`.
2. **Prueba con almacenamiento simulado:** crea una página de prueba que inyecte, **antes** del HTML de la app, un `window.claude` falso:

```js
// mock.js: db en memoria compatible con lo que usa la app
(function(){
  const store = {}, subs = [];
  const notify = () => subs.forEach(f => f());
  const mk = p => ({ id:p.split('/').pop(), exists:!!store[p], data:() => store[p] && JSON.parse(JSON.stringify(store[p])), metadata:{} });
  const db = {
    collection: c => ({ onSnapshot(next){ const f = () => { const docs = Object.keys(store).filter(k => k.startsWith(c+'/') && k.split('/').length === 2).map(mk); next({docs, size:docs.length, empty:!docs.length}); }; subs.push(f); setTimeout(f, 10); return () => {}; } }),
    doc: p => ({ set(d){ store[p] = JSON.parse(JSON.stringify(d)); setTimeout(notify); return Promise.resolve(); },
                 delete(){ delete store[p]; setTimeout(notify); return Promise.resolve(); },
                 onSnapshot(next){ const f = () => next(mk(p)); subs.push(f); setTimeout(f, 10); return () => {}; } })
  };
  window.claude = { use: async n => n === 'db' ? db : null };
  window.__store = store;
})();
```

   La página de prueba es: `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style><script>`*mock*`</script></head><body>`*contenido de index.html*`</body></html>`

3. **Playwright** a 390×860, en modo claro y oscuro, con `page.clock.setFixedTime(...)` para fijar la fecha y `p.setDefaultTimeout(4000)`. Recorre al menos estos flujos:
   - Crear frente con el asistente (tareas + objetivo de 4 semanas + hábito) y verificar en `window.__store` que todo quede ligado por `frontId`.
   - Elegir la Principal, marcarla y verificar que el hábito del frente pase a `"auto"` y que el punto de hoy sea `win`.
   - Que la Bandeja no muestre tareas programadas.
   - Que no se pueda reemplazar una Principal ya hecha.
   - Que congelar un frente oculte su hábito en Hoy.
   - Que no haya errores en la consola (`pageerror`) ni scroll horizontal (`scrollWidth === 390`).
4. **Una sola revisión visual** (capturas) antes de publicar.
5. **Publicar** con la herramienta Artifact (`url` del artifact). Sin `capabilities` se conservan las declaradas; si una tarea las cambia, pasarlas todas.

---

## 5. Prompt sugerido para arrancar en Claude Code

```
Lee MEJORAS.md completo. Trabajamos sobre index.html (la app "Ejecución").
Sigue la sección 0: haz solo la primera tarea de la fase actual que no esté marcada «hecha»
en su título (si dice «hecha, falta publicar», solo publícala). Antes de editar, muéstrame en 5 líneas tu plan.
Cuando termines: corre node tests/run.mjs, muéstrame una captura y espera mi OK antes de publicar.
Al publicar, cambia la etiqueta de la tarea a «(fase N · hecha)».
```

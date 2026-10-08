# Ejecución: plan de mejoras para Claude Code

> **Para Claude Code:** este documento es la especificación. Lee primero la sección 1 (contexto y reglas) y luego haz **una tarea a la vez**, en el orden de las **fases** (sección 0). Después de cada tarea, pruébala (sección 4) y pídeme confirmación antes de seguir con la siguiente.

---

## 0. Fases

Cada fase termina con la app publicada y usable. No se empieza una fase sin cerrar la anterior.

| Fase | Qué | Tareas | Se cierra cuando |
|---|---|---|---|
| **0 · Base** | Repo con historial, pruebas automáticas y el bosque | Tarea 0 | El bosque está publicado en el artifact |
| **1 · Lo crítico** | Lo que protege tus datos y quita fricción diaria | Tarea 3 → Tarea 1 → Tarea 2 | Tienes una copia descargada y la app no pide nada dos veces |
| **2 · Usarla** | 4 semanas de uso real, **sin funciones nuevas** (solo arreglar errores) | — | Pasaron 4 domingos con revisión cerrada |
| **3 · Según el uso** | Solo lo que el uso real pida, en este orden por defecto | Tarea 5 → Tarea 6 → Tarea 4 | Tú decides, con lo anotado en la fase 2 |
| **4 · Fuera del artifact** | La versión independiente (sección 3) | — | Fuera de alcance por ahora |

**Por qué este orden**
- La **Tarea 3** va primero en la fase 1: hoy tus datos viven solo en el artifact y no tienen copia. Se hace antes de cambiar cómo se guardan (Tarea 1).
- En la **fase 2**, todo lo que estorbe se anota en la Bandeja empezando con `App:`. Al final de la fase se revisa esa lista y de ahí sale la fase 3.
- La **Tarea 5** se reduce: el bosque ya muestra cada día de cada objetivo. Queda el porcentaje de días ganados del mes y la mejor racha de cada hábito.
- La **Tarea 4** (IA) va al final porque es la más grande y la única que depende de una capability (`sample`) cuya forma exacta hay que verificar antes de escribir código.
- **Capabilities:** cada publicación que las declare debe repetir **todas** (la regla completa de `db`, más `downloads` desde la Tarea 3 y más `sample` desde la Tarea 4). Si se omite una, se pierde.

---

## 1. Contexto

**Ejecución** es una app personal de disciplina y ejecución. Es una sola página HTML (`index.html`, unas 1.300 líneas, JavaScript sin frameworks) publicada como **Artifact de claude.ai**:

- URL del artifact: `https://claude.ai/artifact/D1Vk3U5EHEfGAfyGAgCEW9`
- Para publicar cambios hay que usar la **herramienta Artifact** con `url` igual a esa dirección. Primero lee el artifact con `action: "read"` y construye sobre esa versión.
- **No cambies `capabilities`.** Si omites el campo al publicar, se mantiene la declaración actual: `db` con la regla `{path:"", read:"owner", write:"owner"}`, es decir, solo el dueño lee y escribe.
- Interfaz en **español (Colombia)**, pensada sobre todo para iPhone (ancho de unos 390 px), con modo claro y oscuro.

### Filosofía del producto (no romperla)

1. **Una sola tarea Principal por día** y **máximo 2 Extras**. Si cumples la Principal, el día está ganado.
2. **Máximo 2 frentes activos.** El resto va a Congelados.
3. **Mínimo innegociable:** en un día malo, cumplir el mínimo mantiene la racha. Regla: *nunca fallar dos veces seguidas*.
4. **Se decide la noche anterior y de día solo se ejecuta.**
5. **Interfaz minimalista:** casillas, recuadros punteados con "+" para lo vacío y un botón **"!"** de ayuda en cada apartado (objeto `HELP`). Pocas palabras en pantalla.
6. **Todo queda ligado al frente:** el asistente "Crear frente" lleva por Frente → Tareas → Objetivo → Hábito. El objetivo y el hábito son opcionales.
7. **Los formularios se comparten:** el asistente y cada módulo usan exactamente el mismo formulario (`goalFields`/`readGoalFields` y `habitFields`/`readHabitFields`). Si agregas un campo, agrégalo ahí y aparecerá en los dos lugares.

### Cinco secciones (barra inferior)

| Sección | Contenido |
|---|---|
| **Hoy** | Fecha · Principal · Extras · Hábitos de hoy · puntos de la semana · Mañana (plan de noche) |
| **Bandeja** | Captura rápida. Casilla = hecho. "Mover" = enviar a un frente |
| **Frentes** | Frentes activos (con su objetivo, la meta de esta semana y su hábito) · tareas · Congelados |
| **Metas** | Visión · Objetivos (barra de progreso, semanas marcables, plan plegable) |
| **Semana** | Estadísticas · revisión del domingo (3 preguntas, limpieza, semana de cada objetivo) · revisiones anteriores |

### Modelo de datos (capability `db`)

Las colecciones viven en la raíz. Se escribe con `put(col, obj)` (reemplazo completo, con una cola por documento) y se borra con `remove(col, id)`. Para leer, hay suscripciones `onSnapshot` que llenan el objeto `S`.

```
fronts/{id}   { name, note, status: "active"|"frozen", order, created,
                pauses: [{from:"YYYY-MM-DD", to?:"YYYY-MM-DD"}] }   // periodos congelado; el bosque no cuenta fallos ahí
tasks/{id}    { title, frontId|null, minutes|null, slot: null|"critical"|"secondary",
                date: "YYYY-MM-DD"|null, done, doneAt, created, archived? }
goals/{id}    { frontId, title, why, start, deadline, standard, minimum, trigger,
                weekly: [{text, done}],         // largo = goalWeeks(g), sale de las fechas
                premortem: [{cause, counter}×3], rewardMid, rewardEnd, created }
habits/{id}   { name, minimum, standard, days: [0-6], frontId|null,
                log: { "YYYY-MM-DD": "full"|"min"|"auto" }, order, created }
reviews/{lunes YYYY-MM-DD} { done, blocked, change, inbox, frozen, closed }
meta/settings { vision, fixedTime, planBTime }
meta/focus    { days: { "YYYY-MM-DD": minutos } }
```

- `slot:"critical"` es la Principal y `slot:"secondary"` es un Extra. Una tarea en la Bandeja tiene `frontId:null` y `slot:null`.
- Un hábito con `log = "auto"` fue marcado por `syncHabit()` al completar una tarea de su frente.
- Los hábitos de frentes congelados están en pausa (`habitPaused`).
- `goalWeek(g)` vale 0 si el objetivo todavía no empieza.

### Mapa del código (funciones clave)

- **Estado y escritura:** `S`, `put`, `remove`, `putMeta`, `run` (cola), `init()` (suscripciones).
- **Consultas:** `active`, `frozen`, `crit(d)`, `secs(d)`, `inbox`, `goalFor(fid)`, `goalWeeks`, `goalWeek`, `scheduled`, `streak`, `missedRun`, `dayState`.
- **Lógica:** `assign`, `unassign`, `toggleDone`, `syncHabit`.
- **Render:** `render()` (conserva el foco), `VIEWS.{hoy,bandeja,frentes,metas,semana}`, `taskRow`, `head`, `dash`, `info`.
- **Modales:** `openModal(fn, live)` (cuando `live=false` no se redibuja con cada cambio y `modal.guard` evita cerrarlo tocando fuera), `sheet()`, `taskSheet`, `pickSheet`, `frontSheet`, `goalForm`, `habitsEdit`, `habitEditOne`, `habitNew`, `habitQuick`, `wizardOpen` (W), `nightOpen`/`nightRender` (NP), `settingsSheet`, `guideSheet`, `helpSheet`.
- **Eventos:** clics delegados con `data-act` → objeto `A`. Formularios con `data-form` → objeto `FORMS`.
- **Enfoque:** objeto `F`, `focusOpen`, `renderFocus`, `tick`, `logFocus`.
- **Bosque:** `forestOn`, `paused`, `forestMap` (nivel por día), `forestDays` (estado por día), `forestGoal`, `forestWilting`, `forestGrow` (texto del aviso), `forestArt`, `forestSvg` (la isla), `forestStats`, `forestBlock`, `TREES`, `ART`. Se calcula en memoria a partir de `tasks`, `habits` y `fronts.pauses`; no tiene colección propia.

### Reglas al editar

- **Mantén un solo archivo autocontenido.** Solo se permiten CDNs de la lista blanca de Artifacts (las fuentes vienen de Google Fonts).
- **Colores siempre con tokens CSS de `:root`**, con sus variantes oscuras ya definidas.
- **Escrituras:** una por documento a la vez (usa `put`). Nunca escribas desde un render ni desde un callback de snapshot.
- **Formularios con texto libre:** usa `openModal(fn, false)` y campos `textarea.auto` para textos largos.
- **Toda función nueva necesita su "!":** actualiza `HELP` y `guideSheet()`.
- **No reintroduzcas términos viejos:** "Tarea Crítica", "P1/P2", "secundaria", "12 semanas", "menú", "Hito semanal".

---

## 2. Tareas

### Tarea 0: Bosque del objetivo *(fase 0 · hecha, falta publicar)*

**Idea:** como la app Forest (una isla de pasto en perspectiva), con los colores y la letra de Ejecución. Cada objetivo con inicio y fecha límite tiene su isla: empieza vacía y se llena con cada día que avanzas. Aplica la regla *nunca fallar dos veces seguidas*.

**Estado de cada día** (se mira solo el **frente del objetivo**):

| Estado | Cuándo |
|---|---|
| **Brote** | El hábito del frente quedó en `"min"` |
| **Árbol** | Se terminó una tarea del frente (`doneAt`) o el hábito quedó en `"full"` o `"auto"` |
| **Árbol con fruto** (`--accent`) | La Principal de ese día era de este frente y está hecha |
| **Marchito** | Un día que tocaba (hábito programado o Principal del frente) sin nada |
| **Salvado** (árbol pequeño) | Era marchito y se cumplió el siguiente día que tocaba |
| **Seco** (tronco caído) | Segundo fallo seguido |
| **Tierra** | Tercer fallo seguido en adelante |
| **Pasto** | Un día que no tocaba, o con el frente congelado (`pauses`) |
| **Hoy** | Rombo `--accent` y una semilla hasta que cumplas |

- Los días que no tocan no cortan ni reinician la cuenta de fallos.
- Isla cuadrada (lado = raíz del número de días, mínimo 3), un espacio por día (máximo 364), llenada desde el fondo hacia el frente.
- Tres árboles geométricos (pino, redondo, ciprés), con luz desde la izquierda. Tokens: `--grass`, `--grass-2`, `--grass-side`, `--earth`, `--earth-2`, `--tree`, `--tree-2`, `--trunk`, `--wilt`, `--dead`, `--hi`, `--shade`, en claro y oscuro.

**Dónde aparece:**
- **Metas:** en cada objetivo, entre la barra y las semanas, con su "!" (`HELP.bosque`) y debajo el conteo "11 árboles · 2 brotes · 1 marchito · 11 por crecer".
- **Frentes:** en la línea del objetivo, "· 9 árboles".
- **Hoy:** si hay un árbol marchito por salvar: "Tu árbol de CCFA se está marchitando. Hoy haz al menos el mínimo y lo salvas." (reemplaza el aviso del hábito de ese frente).
- **Avisos al marcar:** "Creció un árbol en tu bosque.", "Brotó una planta…", "Tu árbol dio fruto.", "Salvaste el que se marchitaba.". El árbol de hoy se anima una vez la próxima vez que abres Metas.
- **Guía:** sección "Tu bosque".

### Tarea 1: Un solo mínimo y un solo estándar *(alta)*

**Problema:** el objetivo y el hábito tienen cada uno su propio "Mínimo" y "Estándar". El usuario puede terminar escribiendo dos mínimos distintos para el mismo frente.

**Hacer:**
- Que la **fuente única** sea el hábito del frente.
- En `goalFields`: si el frente tiene un hábito ligado, reemplazar los campos Estándar y Mínimo por una línea de solo lectura ("Mínimo y estándar: los del hábito *THM* (editar)", con un enlace a `habitEditOne`). Si el frente no tiene hábito, mostrar los campos como hoy.
- En el asistente: el paso Objetivo **no** pide mínimo ni estándar. El paso Hábito los pide. Si el usuario elige "No por ahora", el paso Hábito muestra solo esos dos campos, que se guardan en el objetivo.
- En `VIEWS.metas` (Plan), mostrar los valores del hábito cuando exista.

**Listo cuando:** en ningún flujo se piden dos veces el mínimo y el estándar del mismo frente, y los datos antiguos siguen mostrándose bien.

### Tarea 2: Tu bloque y el Plan B visibles en Hoy *(alta)*

**Problema:** `fixedTime` y `planBTime` solo aparecen en el último paso de "Planear mañana".

**Hacer:**
- En Hoy, debajo de la fecha, una línea discreta: "Tu bloque: 19:30" (solo si `fixedTime` existe).
- Después de `planBTime`, si la Principal no está hecha, cambiar esa línea por: "Plan B activo: hoy solo el mínimo" (punto color `--warn`).
- En Ajustes: si no hay hora fija, mostrar en Hoy un recuadro punteado "+ Elegir tu hora fija".
- Recalcular cada minuto (ya existe un `setInterval` de 60 s para el cambio de día).

**Listo cuando:** con la hora simulada (por ejemplo con `page.clock` de Playwright), la línea cambia al pasar `planBTime`.

### Tarea 3: Copia de seguridad *(alta)*

**Hacer:**
- Agregar la capability `downloads` (publicar con `capabilities: {db:{rules:[{path:"",read:"owner",write:"owner"}]}, downloads:true}`, repitiendo la regla de `db` completa).
- En Ajustes, el botón "Descargar mis datos" llama a `downloads.save({filename:"ejecucion-YYYY-MM-DD.json", data})` con el JSON de `S` (todas las colecciones).
- Agregar "Restaurar desde archivo" (`<input type=file>`): valida la estructura, muestra un resumen ("5 frentes, 32 tareas…") y pide doble confirmación antes de escribir.
- Si `claude.use("downloads")` devuelve `null`, ocultar el botón.

**Listo cuando:** descargar y restaurar en un almacenamiento vacío reproduce el mismo estado.

### Tarea 4: IA dentro de la app *(media)*

Usar la capability `sample` (declararla: `sample:{}`). Se llama solo cuando el usuario toca un botón; nunca al cargar.

- **Partir tarea:** en `taskSheet`, la opción "Partir en pasos" pide a Claude de 2 a 5 subtareas que empiecen con un verbo, de 15 a 45 minutos cada una. Las muestra para confirmar y las crea en el mismo frente.
- **Proponer semanas:** en `goalFields`, el botón "Sugerir semanas" (junto a "Semana a semana") envía el título, las fechas y el número de semanas, y llena los campos `g-w*` vacíos. El usuario puede editarlos antes de guardar.
- **Resumen de revisión:** en Semana, "Analizar mis últimas 4 semanas" envía las revisiones, `dayState` por día y los registros de los hábitos, y devuelve 3 patrones y 1 cambio sugerido para el sistema.
- Usar `sample.json()` con un formato de salida estricto. Manejar `not_granted` (ocultar el botón) y `rate_limited` (mostrar un aviso).

**Listo cuando:** las tres funciones devuelven resultados editables y nada se guarda sin que el usuario lo confirme.

### Tarea 5: Historial y rachas *(baja)*

**Hacer:**
- En Semana, una tarjeta "Este mes": un calendario de puntos con el `dayState` de cada día del mes (los mismos colores que Hoy), el porcentaje de días ganados y la mejor racha de cada hábito.
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
5. **Publicar** con la herramienta Artifact (`url` del artifact), sin pasar `capabilities` salvo en las tareas 3 y 4.

---

## 5. Prompt sugerido para arrancar en Claude Code

```
Lee MEJORAS.md completo. Trabajamos sobre index.html (la app "Ejecución").
Haz solo la Tarea 1. Antes de editar, muéstrame en 5 líneas tu plan.
Cuando termines: corre las pruebas de la sección 4, muéstrame una captura
y espera mi OK antes de publicar en el artifact.
```

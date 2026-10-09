// Pruebas de Ejecución con un db simulado. Uso: node tests/run.mjs  → capturas en tests/out/
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = await import('/opt/node-tools/node_modules/playwright/index.mjs'); }
const dir = path.dirname(fileURLToPath(import.meta.url)), out = path.join(dir, 'out'); fs.mkdirSync(out, { recursive:true });
const app = fs.readFileSync(path.join(dir, '../index.html'), 'utf8'), mock = fs.readFileSync(path.join(dir, 'mock.js'), 'utf8');
const page = path.join(out, 'test.html');
fs.writeFileSync(page, `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style><script>${mock}</script></head><body>${app}</body></html>`);

const NOW = '2026-10-08T20:00:00'; // jueves
const ymd = d => d.toISOString().slice(0, 10), add = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const TODAY = '2026-10-08';
let fails = 0; const ok = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) fails++; };
const b = await pw.chromium.launch();
async function open(scheme, seed, width = 390){
  const p = await b.newPage({ viewport:{ width, height:860 }, colorScheme:scheme });
  p.setDefaultTimeout(4000); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.setFixedTime(new Date(NOW));
  if (seed) await p.addInitScript(s => { window.__SEED = s; }, seed);
  await p.goto('file://' + page); await p.waitForSelector('.sec-head');
  return p;
}
const store = p => p.evaluate(() => { const s = window.__store, v = k => Object.entries(s).filter(([x]) => x.startsWith(k + '/')).map(([x, d]) => ({ id:x.split('/')[1], ...d })); return { fronts:v('fronts'), tasks:v('tasks'), goals:v('goals'), habits:v('habits') }; });
const nav = (p, v) => p.click(`#nav [data-v=${v}]`);
const toastText = p => p.locator('.toast').textContent().catch(() => '');
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth);

// ---------- 1. flujos de la sección 4.3 ----------
for (const scheme of ['light', 'dark']){
  console.log(`\nFlujos base · ${scheme}`);
  const p = await open(scheme);
  await p.click('text=Crear tu primer frente');
  await p.fill('#wz-name', 'THM Web'); await p.click('[data-act=wz-next]');
  await p.fill('#wz-task', 'Resolver la sala de XSS'); await p.press('#wz-task', 'Enter');
  await p.fill('#wz-task', 'Leer el módulo de SQLi'); await p.press('#wz-task', 'Enter'); await p.click('[data-act=wz-next]');
  await p.fill('#g-title', 'Terminar la ruta web'); await p.fill('#g-start', TODAY); await p.fill('#g-deadline', add(TODAY, 27)); await p.click('[data-act=wz-next]');
  await p.click('[data-act=wz-habit][data-v="1"]'); await p.fill('#h-m-w', '15 min'); await p.click('[data-act=wz-create]');
  await p.waitForTimeout(100);
  let s = await store(p); const fid = s.fronts[0].id;
  ok(s.tasks.length === 2 && s.tasks.every(t => t.frontId === fid) && s.goals[0].frontId === fid && s.habits[0].frontId === fid, 'el asistente liga tareas, objetivo y hábito al frente');
  ok(s.goals[0].weekly.length === 4, 'objetivo de 4 semanas');
  await nav(p, 'hoy'); await p.click('text=Elegir tarea principal'); await p.click('[data-act=pick-do] >> nth=0'); await p.waitForTimeout(100);
  await p.click('.main-task [data-act=done]'); await p.waitForTimeout(100);
  const tt = await toastText(p); s = await store(p);
  ok(s.habits[0].log[TODAY] === 'auto', 'al marcar la Principal el hábito pasa a "auto"');
  ok(await p.locator('.dot.today i').getAttribute('class') === 'win', 'el punto de hoy es win');
  ok(/Creció un árbol/.test(tt), `aviso del bosque al ganar el día ("${tt}")`);
  const doneId = s.tasks.find(t => t.done).id, other = s.tasks.find(t => !t.done).id;
  // reemplazar una Principal ya hecha no debe funcionar
  await nav(p, 'frentes'); await p.click(`[data-act=task-sheet][data-id="${other}"]`); await p.click('[data-act=assign][data-slot=critical] >> nth=0'); await p.waitForTimeout(100);
  s = await store(p); ok(s.tasks.find(t => t.id === doneId).slot === 'critical' && s.tasks.find(t => t.id === other).slot !== 'critical', 'no se puede reemplazar una Principal ya hecha');
  await p.click('[data-act=close]').catch(() => {});
  // Bandeja no muestra tareas programadas
  await nav(p, 'bandeja'); await p.fill('#cap', 'Llamar al banco'); await p.press('#cap', 'Enter'); await p.waitForTimeout(100);
  ok((await p.locator('#view .trow').count()) === 1, 'la Bandeja solo muestra lo capturado (no tareas programadas)');
  // Metas: el bosque aparece con el árbol de hoy
  await nav(p, 'metas'); await p.waitForTimeout(50);
  ok(await p.locator('.forest').count() === 1, 'Metas muestra el bosque del objetivo');
  ok(/1 árbol/.test(await p.locator('.forest .forest-count').textContent()), 'el bosque cuenta 1 árbol');
  await p.screenshot({ path:path.join(out, `metas-nuevo-${scheme}.png`), fullPage:true });
  // congelar el frente oculta su hábito en Hoy
  await nav(p, 'frentes'); await p.click(`[data-act=front-sheet][data-id="${fid}"]`); await p.click('[data-act=front-freeze]'); await p.waitForTimeout(100);
  await nav(p, 'hoy'); ok(!(await p.locator('[data-act=hcheck]').count()), 'congelar el frente oculta su hábito en Hoy');
  ok(await noScroll(p) === 390, 'sin scroll horizontal'); ok(!p.errs.length, 'sin errores en consola ' + (p.errs.join(' | ')));
  await p.close();
}

// ---------- 2. bosque con historia ----------
function seedGoal({ start, days, id = 'g1', title = 'Aprobar la CCFA', levels = {}, habitDays = [0,1,2,3,4,5,6], frontExtra = {}, habit = true, deadline }){
  const seed = { 'fronts/f1':{ name:'CCFA', status:'active', order:1, created:1, ...frontExtra }, 'meta/settings':{}, 'meta/focus':{ days:{} } };
  const log = {}; let n = 0;
  for (const [d, lv] of Object.entries(levels)){
    if (lv === 1) log[d] = 'min';
    if (lv === 2) log[d] = 'full';
    if (lv === 3){ seed[`tasks/t${n}`] = { title:'Estudiar módulo ' + n, frontId:'f1', minutes:45, slot:'critical', date:d, done:true, doneAt:d, created:n }; log[d] = 'auto'; n++; }
  }
  if (habit) seed['habits/h1'] = { name:'CCFA', minimum:'15 min', standard:'45 min', days:habitDays, frontId:'f1', log, order:1, created:start };
  seed[`goals/${id}`] = { frontId:'f1', title, start, deadline:deadline || add(start, days - 1), weekly:Array.from({ length:Math.ceil(days / 7) }, (_, i) => ({ text:`Semana ${i + 1} del plan`, done:i < 1 })), premortem:[], created:1 };
  return seed;
}
const pattern = (start, upto) => { const L = {}; for (let i = 0, d = start; d <= upto; i++, d = add(d, 1)){ const r = [3,2,2,0,1,3,2,0,2,3,1,2][i % 12]; if (r) L[d] = r; } return L; };
const CASES = [
  { name:'4-semanas', start:add(TODAY, -16), days:28 },
  { name:'12-semanas', start:add(TODAY, -40), days:84 },
  { name:'52-semanas', start:add(TODAY, -120), days:364 },
  { name:'1-semana', start:add(TODAY, -3), days:7 },
  { name:'sin-empezar', start:add(TODAY, 4), days:28 },
  { name:'vencido', start:add(TODAY, -40), days:28 },
];
for (const c of CASES){
  for (const scheme of ['light', 'dark']){
    const seed = seedGoal({ start:c.start, days:c.days, levels:pattern(c.start, add(TODAY, -1)) });
    const p = await open(scheme, seed); await nav(p, 'metas'); await p.waitForTimeout(80);
    const info = await p.evaluate(() => { const f = document.querySelector('.forest'); if (!f) return null; const svg = f.querySelector('svg'); const r = svg.getBoundingClientRect();
      return { label:f.querySelector('.forest-count').textContent, cells:+(f.getAttribute('aria-label').match(/en (\d+) días/) || [])[1], w:r.width, h:r.height }; });
    const L = pattern(c.start, add(TODAY, -1)), lastDay = add(c.start, c.days - 1);
    const inRange = Object.entries(L).filter(([d]) => d <= lastDay && d <= TODAY);
    const trees = inRange.filter(([, v]) => v >= 2).length, sprouts = inRange.filter(([, v]) => v === 1).length;
    if (scheme === 'light') console.log(`\nBosque ${c.name}: ${info && info.label} · ${info && info.cells} días · ${info && Math.round(info.w)}×${info && Math.round(info.h)}px`);
    ok(info && info.cells === c.days, `${c.name}/${scheme}: una celda por día (${c.days})`);
    ok(info && info.label.includes(`${trees} ${trees === 1 ? 'árbol' : 'árboles'}`) && (!sprouts || info.label.includes(`${sprouts} brote`)), `${c.name}/${scheme}: cuenta ${trees} árboles y ${sprouts} brotes`);
    ok(await noScroll(p) === 390 && !p.errs.length, `${c.name}/${scheme}: sin scroll ni errores ${p.errs.join('|')}`);
    await p.locator('.goal').first().screenshot({ path:path.join(out, `bosque-${c.name}-${scheme}.png`) });
    if (c.name === '4-semanas'){
      await nav(p, 'frentes'); ok(/· \d+ árboles/.test(await p.locator('.front-goal .tmeta').first().textContent()), `${c.name}/${scheme}: Frentes muestra cuántos árboles lleva`);
      // crecer hoy: hábito completo → árbol, y animación solo al volver a Metas
      await nav(p, 'metas'); await nav(p, 'hoy'); await p.click('[data-act=hcheck]'); const t1 = await toastText(p);
      ok(/Creció un árbol/.test(t1), `${c.name}/${scheme}: aviso al cumplir el hábito ("${t1}")`);
      await nav(p, 'metas'); ok(await p.locator('.forest .grow').count() === 1, `${c.name}/${scheme}: el árbol nuevo se anima`);
      await p.evaluate(() => window.scrollTo(0, 0)); await nav(p, 'metas'); ok(await p.locator('.forest .grow').count() === 0, `${c.name}/${scheme}: no se vuelve a animar`);
      await p.click('[data-act=help][data-k=bosque]'); ok(/fruto/.test(await p.locator('.sheet').textContent()), `${c.name}/${scheme}: el "!" del bosque explica el fruto`);
      await p.screenshot({ path:path.join(out, `ayuda-bosque-${scheme}.png`) });
    }
    await p.close();
  }
}
// ---------- 3. la regla de los dos fallos ----------
const seq = (start, arr) => Object.fromEntries(arr.map((v, i) => [add(start, i), v]).filter(([, v]) => v));
console.log('\nRegla de los dos fallos');
for (const scheme of ['light', 'dark']){
  // salvado, marchito → seco, y marchito → seco → tierra
  let start = add(TODAY, -10);
  let p = await open(scheme, seedGoal({ start, days:28, levels:seq(start, [2,2,0,2,0,0,2,0,0,0]) }));
  await nav(p, 'metas'); let lb = await p.locator('.forest .forest-count').textContent();
  ok(lb.includes('4 árboles') && lb.includes('2 marchitos') && lb.includes('2 secos'), `${scheme}: fallar 1 marchita, fallar 2 seca, cumplir salva ("${lb}")`);
  ok(await p.locator('.forest .bare').count() === 1, `${scheme}: desde el tercer fallo queda tierra`);
  ok(await p.locator('.forest .today').count() === 1, `${scheme}: se marca el espacio de hoy`);
  ok(await p.evaluate(() => document.querySelector('.forest svg').lastElementChild.classList.contains('today')), `${scheme}: el espacio de hoy se dibuja encima de los árboles`);
  await p.locator('.goal').first().screenshot({ path:path.join(out, `bosque-fallos-${scheme}.png`) }); await p.close();
  // ayer se marchitó: aviso en Hoy y hoy lo salvas
  start = add(TODAY, -5);
  p = await open(scheme, seedGoal({ start, days:28, levels:seq(start, [2,2,2,2,0]) }));
  const hoy = await p.locator('.notices').textContent().catch(() => '');
  ok(/Tu árbol de CCFA se está marchitando/.test(hoy) && !/La última vez no cumpliste/.test(hoy), `${scheme}: Hoy avisa que el árbol se marchita (sin repetir el aviso del hábito)`);
  await p.screenshot({ path:path.join(out, `hoy-marchito-${scheme}.png`) });
  await p.click('[data-act=hcheck]'); const tt = await toastText(p);
  ok(/Creció un árbol.*Salvaste el que se marchitaba/.test(tt), `${scheme}: al cumplir hoy se salva ("${tt}")`);
  await nav(p, 'metas'); lb = await p.locator('.forest .forest-count').textContent();
  ok(!lb.includes('marchito') && lb.includes('5 árboles') && lb.includes('1 salvado'), `${scheme}: el marchito pasa a salvado ("${lb}")`);
  ok(await p.locator('.forest .grow').count() === 1, `${scheme}: el árbol que salvaste se anima al abrir Metas`);
  ok(!p.errs.length && await noScroll(p) === 390, `${scheme}: sin errores ni scroll`); await p.close();
  // fines de semana sin hábito: no castigan
  start = '2026-09-28'; const L = {}; for (let d = start; d < TODAY; d = add(d, 1)){ const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (w >= 1 && w <= 5) L[d] = 2; }
  p = await open(scheme, seedGoal({ start, days:28, levels:L, habitDays:[1,2,3,4,5] }));
  await nav(p, 'metas'); lb = await p.locator('.forest .forest-count').textContent();
  ok(!/marchito|seco/.test(lb) && lb.includes(`${Object.keys(L).length} árboles`), `${scheme}: los días que no tocan quedan en pasto ("${lb}")`); await p.close();
  // frente congelado hace 6 días: esos días no cuentan
  start = add(TODAY, -12);
  p = await open(scheme, seedGoal({ start, days:28, levels:seq(start, [2,2,2,2,2,2]), frontExtra:{ status:'frozen', pauses:[{ from:add(TODAY, -6) }] } }));
  await nav(p, 'metas'); lb = await p.locator('.forest .forest-count').textContent();
  ok(!/marchito|seco/.test(lb), `${scheme}: con el frente congelado no se marchita nada ("${lb}")`);
  // y al activarlo se cierra la pausa
  await nav(p, 'frentes'); await p.click('[data-act=front-activate]'); await p.waitForTimeout(80);
  const fr = (await store(p)).fronts[0]; ok(fr.status === 'active' && fr.pauses[0].to === TODAY, `${scheme}: activar cierra la pausa`);
  await p.close();
}
// ---------- 4. arreglos de la revisión ----------
console.log('\nArreglos de la revisión');
for (const scheme of ['light', 'dark']){
  // frente sin hábito: Principal de ayer sin hacer → "Pasar a hoy" no borra el marchito; al terminarla se salva
  for (const act of ['carry', 'unassign']){
    const start = add(TODAY, -6), seed = seedGoal({ start, days:28, habit:false });
    for (let i = 0; i < 6; i++) seed[`tasks/p${i}`] = { title:'Principal ' + i, frontId:'f1', minutes:45, slot:'critical', date:add(start, i), done:i < 5, doneAt:i < 5 ? add(start, i) : null, created:i };
    const p = await open(scheme, seed, 360);
    const btn = await p.evaluate(() => { const b = [...document.querySelectorAll('.notice .text-btn')].map(x => x.getBoundingClientRect().top); return b.length === 2 && Math.abs(b[0] - b[1]) < 2; });
    ok(btn, `${scheme}: a 360 px "Pasar a hoy" y "Quitar" quedan juntos`);
    await p.click(`.notice [data-act=${act}]`); await p.waitForTimeout(80); await nav(p, 'metas');
    let lb = await p.locator('.forest-count').textContent();
    ok(lb.includes('1 marchito'), `${scheme}: "${act === 'carry' ? 'Pasar a hoy' : 'Quitar'}" no borra el marchito ("${lb}")`);
    if (act === 'carry'){
      await nav(p, 'hoy'); const n = await p.locator('.notices').textContent();
      ok(/Hoy termina la Principal y lo salvas/.test(n), `${scheme}: sin hábito, el aviso pide terminar la Principal`);
      await p.click('.main-task [data-act=done]'); const tt = await toastText(p);
      const w = await p.locator('.toast').evaluate(e => e.getBoundingClientRect().width);
      ok(/Salvaste/.test(tt) && w > 250, `${scheme}: al terminarla se salva y el aviso usa el ancho ("${tt}", ${Math.round(w)} px)`);
      await nav(p, 'metas'); lb = await p.locator('.forest-count').textContent(); ok(lb.includes('1 salvado') && !lb.includes('marchito'), `${scheme}: queda salvado ("${lb}")`);
    }
    ok(!p.errs.length && await noScroll(p) === 360, `${scheme}: sin errores ni scroll a 360 px`); await p.close();
  }
  // cambiar los días del hábito no reescribe el pasado
  { const start = '2026-09-14', L = {}; for (let d = start; d < TODAY; d = add(d, 1)){ const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (w >= 1 && w <= 5) L[d] = 2; }
    const p = await open(scheme, seedGoal({ start, days:28, levels:L, habitDays:[1,2,3,4,5] }));
    await p.click('[data-act=habits-edit]'); await p.click('#h-d-h1 label:has(input[value="6"])'); await p.click('#h-d-h1 label:has(input[value="0"])');
    await p.click('[data-form=habit] button[type=submit]'); await p.waitForTimeout(80); await p.click('[data-act=close]');
    const h = (await store(p)).habits[0]; ok(h.days.length === 7 && h.daysHist && h.daysHist[0].to === TODAY, `${scheme}: se guarda el historial de días del hábito`);
    await nav(p, 'metas'); const lb = await p.locator('.forest-count').textContent();
    ok(!/marchito|seco/.test(lb), `${scheme}: agregar sábado y domingo no marchita las semanas pasadas ("${lb}")`); await p.close(); }
  // frente congelado con la versión anterior (sin pauses): al activarlo no aparecen fallos
  { const start = add(TODAY, -12);
    const p = await open(scheme, seedGoal({ start, days:28, levels:seq(start, [2,2,2,2]), frontExtra:{ status:'frozen' } }));
    await nav(p, 'frentes'); await p.click('[data-act=front-activate]'); await p.waitForTimeout(80); await nav(p, 'metas');
    const lb = await p.locator('.forest-count').textContent(); ok(!/marchito|seco/.test(lb), `${scheme}: activar un frente congelado antiguo no llena de fallos ("${lb}")`); await p.close(); }
  // objetivo de más de 364 días: se ve el bloque que contiene hoy
  { const start = add(TODAY, -400), p = await open(scheme, seedGoal({ start, days:520, deadline:add(TODAY, 120), levels:seq(add(TODAY, -3), [2,2,2]) }));
    await nav(p, 'metas'); ok(await p.locator('.forest .today').count() === 1, `${scheme}: en objetivos de más de un año se ve el día de hoy`);
    ok(!p.errs.length, `${scheme}: sin errores en el objetivo largo`); await p.close(); }
}
// ---------- 5. frentes de hábito con tiempo ----------
console.log('\nFrentes de hábito');
const at = mins => new Date(Date.parse(NOW) + mins * 60000);
const base2 = () => ({ 'fronts/p1':{ name:'CCFA', status:'active', order:1, created:1 }, 'fronts/p2':{ name:'THM', status:'active', order:2, created:2 }, 'meta/settings':{}, 'meta/focus':{ days:{} } });
const readHabit = (name = 'Leer') => ({ 'fronts/h1':{ name, status:'active', kind:'habit', order:3, created:3 },
  'habits/hb':{ name, minutes:20, minMinutes:5, minimum:'5 min', standard:'20 min', days:[0,1,2,3,4,5,6], frontId:'h1', log:{}, order:1, created:TODAY } });
for (const scheme of ['light', 'dark']){
  const p = await open(scheme, base2());
  await nav(p, 'frentes');
  ok((await p.locator('.page-head .count').textContent()) === '2/2', `${scheme}: 2 proyectos activos`);
  await p.click('[data-act=front-new][data-kind=habit]');
  ok(await p.locator('.opt.sel[data-v=habit]').count() === 1, `${scheme}: "Nuevo hábito" abre el asistente en tipo Hábito`);
  await p.screenshot({ path:path.join(out, `asistente-tipo-${scheme}.png`) });
  await p.fill('#wz-name', 'Leer Dune'); await p.click('[data-act=wz-next]');
  ok(await p.locator('#h-t-w').inputValue() === '20' && await p.locator('#h-mm-w').isVisible() && !(await p.locator('#h-m-w').isVisible()), `${scheme}: propone 20 min con mínimo en minutos`);
  await p.screenshot({ path:path.join(out, `asistente-tiempo-${scheme}.png`) });
  await p.click('[data-act=wz-next]');
  ok(await p.locator('#g-standard').count() === 0 && await p.locator('#g-weeks').count() === 0 && await p.locator('#g-title').isVisible(), `${scheme}: la meta del hábito es corta (sin mínimo, estándar ni semanas)`);
  await p.fill('#g-title', 'Terminar Dune');
  await p.screenshot({ path:path.join(out, `asistente-meta-${scheme}.png`) });
  await p.click('[data-act=wz-create]'); await p.waitForTimeout(120);
  let s = await store(p); const hf = s.fronts.find(f => f.name === 'Leer Dune'), hh = s.habits[0], gg = s.goals[0];
  ok(hf && hf.kind === 'habit' && hf.status === 'active', `${scheme}: el hábito queda activo aunque haya 2 proyectos`);
  ok(hh && hh.frontId === hf.id && hh.minutes === 20 && hh.minMinutes === 5 && hh.minimum === '5 min' && hh.days.length === 7 && hh.name === 'Leer Dune', `${scheme}: hábito de 20 min, mínimo 5, todos los días`);
  ok(gg && gg.frontId === hf.id && gg.start === TODAY && gg.deadline === add(TODAY, 20), `${scheme}: meta de 3 semanas desde hoy`);
  ok(!s.tasks.length, `${scheme}: no crea tareas`);
  const row = () => p.locator('#view .trow').filter({ hasText:'Leer Dune' });
  ok(await p.locator('[data-act=hfocus]').count() === 1 && /20 min · mínimo 5 min/.test(await row().textContent()), `${scheme}: queda en Hoy con ▶ y "20 min · mínimo 5 min"`);
  ok(await noScroll(p) === 390, `${scheme}: la fila con ▶ cabe a 390 px`);
  await p.screenshot({ path:path.join(out, `hoy-habito-${scheme}.png`) });
  // ▶ arranca de una; parar a los 6 min cuenta como mínimo
  await p.click('[data-act=hfocus]');
  ok((await p.locator('[data-act=focus-toggle]').textContent()) === 'Pausar', `${scheme}: ▶ arranca el temporizador de una`);
  await p.screenshot({ path:path.join(out, `habito-temporizador-${scheme}.png`) });
  await p.clock.setFixedTime(at(6)); await p.waitForTimeout(400);
  await p.click('[data-act=focus-stop]');
  let txt = await p.locator('.focus').textContent();
  ok(/Mínimo cumplido/.test(txt) && /La racha sigue viva/.test(txt) && /Brotó/.test(txt), `${scheme}: parar después del mínimo cuenta como mínimo`);
  await p.click('[data-act=focus-finish]'); await p.waitForTimeout(120);
  s = await store(p); ok(s.habits[0].log[TODAY] === 'min' && s.habits[0].time[TODAY] === 6, `${scheme}: guarda 6 min y el mínimo`);
  ok(/6 de 20 min/.test(await row().textContent()), `${scheme}: Hoy muestra "6 de 20 min"`);
  // seguir: el ▶ continúa con lo que falta y al terminar se marca solo
  await p.click('[data-act=hfocus]');
  ok((await p.locator('#ringTime').textContent()) === '14:00', `${scheme}: sigue con lo que falta (14 min)`);
  await p.clock.setFixedTime(at(20)); await p.waitForTimeout(600);
  txt = await p.locator('.focus').textContent();
  ok(/Hábito cumplido/.test(txt) && /árbol/.test(txt), `${scheme}: al terminar el tiempo se marca solo y crece el árbol`);
  await p.screenshot({ path:path.join(out, `habito-cumplido-${scheme}.png`) });
  await p.click('[data-act=focus-finish]'); await p.waitForTimeout(120);
  s = await store(p); ok(s.habits[0].log[TODAY] === 'full' && s.habits[0].time[TODAY] === 20, `${scheme}: queda cumplido con 20 min`);
  ok(await p.locator('[data-act=hfocus]').count() === 0 && await row().locator('.check.on').count() === 1, `${scheme}: la casilla queda marcada y el ▶ se va`);
  // Frentes y Metas
  await nav(p, 'frentes');
  const card = p.locator('.front').filter({ hasText:'Leer Dune' });
  ok(/Hábito · todos los días · 20 min · mínimo 5 min/.test(await card.textContent()) && await card.locator('.add-line').count() === 0, `${scheme}: Frentes lo muestra en Hábitos, sin pedir tareas`);
  ok((await p.locator('.page-head .count').textContent()) === '2/2', `${scheme}: no ocupa cupo de proyecto`);
  await p.screenshot({ path:path.join(out, `frentes-habitos-${scheme}.png`), fullPage:true });
  await nav(p, 'metas'); ok(/1 árbol/.test(await p.locator('.forest-count').first().textContent()), `${scheme}: el bosque de la meta crece`);
  ok(!p.errs.length && await noScroll(p) === 390, `${scheme}: sin errores ni scroll ${p.errs.join('|')}`);
  await p.close();
}
{ // por debajo del mínimo no marca nada, pero guarda los minutos
  const p = await open('light', { ...base2(), ...readHabit() });
  await p.click('[data-act=hfocus]'); await p.clock.setFixedTime(at(2)); await p.waitForTimeout(400); await p.click('[data-act=focus-stop]');
  const txt = await p.locator('.focus').textContent();
  ok(/Llevas 2 de 20 min/.test(txt) && /El mínimo es 5 min/.test(txt), 'parar antes del mínimo no marca y lo dice claro');
  await p.click('[data-act=focus-finish]'); await p.waitForTimeout(120);
  const h = (await store(p)).habits[0]; ok(!h.log[TODAY] && h.time[TODAY] === 2, 'guarda 2 min sin marcar el hábito');
  // marcar a mano también sirve (leíste sin temporizador)
  await p.click('[data-act=hcheck]'); await p.waitForTimeout(80); ok((await store(p)).habits[0].log[TODAY] === 'full', 'la casilla lo marca a mano');
  // editar: quitar el tiempo muestra los campos de texto
  await p.click('[data-act=habits-edit]'); await p.selectOption('#h-t-hb', '');
  ok(await p.locator('#h-m-hb').isVisible() && !(await p.locator('#h-mm-hb').isVisible()), 'sin tiempo fijo vuelven el mínimo y el estándar en texto');
  await p.selectOption('#h-t-hb', '30'); ok(await p.locator('#h-mm-hb').isVisible(), 'con tiempo vuelve el mínimo en minutos');
  await p.click('[data-form=habit] button[type=submit]'); await p.waitForTimeout(80);
  const h2 = (await store(p)).habits[0]; ok(h2.minutes === 30 && h2.standard === '30 min', 'cambiar el tiempo a 30 min');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
}
{ // convertir un proyecto en hábito
  const seed = { 'fronts/d1':{ name:'Lectura de Dune', status:'active', order:1, created:1 }, 'tasks/t1':{ title:'Leer', frontId:'d1', minutes:45, slot:null, date:null, done:false, created:1 }, 'meta/settings':{}, 'meta/focus':{ days:{} } };
  const p = await open('light', seed); await nav(p, 'frentes');
  await p.click('[data-act=front-sheet][data-id=d1]'); await p.click('[data-act=front-kind][data-v=habit]');
  ok(await p.locator('[data-form=habit-quick]').count() === 1 && await p.locator('#h-t-q').inputValue() === '20', 'al convertir pide el tiempo del hábito');
  await p.click('[data-form=habit-quick] button[type=submit]'); await p.waitForTimeout(100);
  const s = await store(p); ok(s.fronts[0].kind === 'habit' && s.habits[0].frontId === 'd1' && s.habits[0].minutes === 20 && s.habits[0].name === 'Lectura de Dune', 'queda como hábito de 20 min');
  ok((await p.locator('.page-head .count').textContent()) === '0/2', 'deja libre el cupo de proyecto');
  ok(/Leer/.test(await p.locator('.front').filter({ hasText:'Lectura de Dune' }).textContent()), 'la tarea que ya tenía no se pierde');
  await nav(p, 'hoy'); ok(await p.locator('[data-act=hfocus]').count() === 1, 'aparece en Hoy con ▶');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
}
{ // "+ Objetivo" en un hábito abre la meta corta y queda ligada a ese hábito
  const p = await open('light', { ...base2(), ...readHabit() }); await nav(p, 'frentes');
  await p.click('.front:has-text("Leer") [data-act=goal-new]');
  ok(await p.locator('#g-standard').count() === 0 && await p.locator('details summary').filter({ hasText:'Más detalles' }).count() === 1, 'la meta de un hábito usa el formulario corto');
  await p.fill('#g-title', 'Terminar el libro'); await p.click('[data-form=goal] button[type=submit]'); await p.waitForTimeout(80);
  const g = (await store(p)).goals[0]; ok(g && g.frontId === 'h1' && g.start === TODAY, 'la meta queda ligada al hábito y empieza hoy');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
}
{ // meta de hábito: barra por días que tocan, sin "Esta semana", y editarla no borra textos viejos de semanas
  const seed = { ...base2(), ...readHabit() }, L = {};
  for (let d = '2026-09-28'; d <= '2026-10-07'; d = add(d, 1)){ const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (w >= 1 && w <= 5) L[d] = 'full'; }
  seed['habits/hb'] = { ...seed['habits/hb'], days:[1,2,3,4,5], log:L, created:'2026-09-28' };
  seed['goals/g9'] = { frontId:'h1', title:'Terminar el libro', start:'2026-09-28', deadline:'2026-10-07', weekly:[{ text:'Cap 1-10', done:false }, { text:'', done:false }], premortem:[], created:1 };
  const p = await open('light', seed); await nav(p, 'metas');
  ok(await p.locator('.goal .bar > span').first().evaluate(e => e.style.width) === '100%', 'un hábito de lunes a viernes cumplido llena la barra (100 %)');
  ok(/Terminó·8 días cumplidos/.test(await p.locator('.bar-legend').first().textContent()), 'la leyenda cuenta días cumplidos');
  await nav(p, 'frentes'); ok(await p.locator('.front').filter({ hasText:'Leer' }).locator('.fg-week').count() === 0, 'Frentes no muestra "Esta semana" en un hábito');
  await nav(p, 'metas'); await p.click('[data-act=goal-sheet]'); await p.click('[data-act=goal-edit]');
  ok(await p.locator('#g-weeks').count() === 0, 'editar la meta de un hábito no muestra semanas');
  await p.click('[data-form=goal] button[type=submit]'); await p.waitForTimeout(80);
  ok((await store(p)).goals[0].weekly[0].text === 'Cap 1-10', 'guardar la meta no borra los textos de semanas que ya tenía');
  // toques un poco fuera del dibujo pequeño
  await nav(p, 'hoy');
  const hit = await p.evaluate(() => { const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { e, b }; };
    const i = r('.sec-head .info'), m = r('.trow .chip-btn');
    const at = (x, y) => document.elementFromPoint(x, y);
    return { info: i && at(i.b.left + i.b.width / 2, i.b.top - 5) === i.e, chip: m && at(m.b.left + m.b.width / 2, m.b.top - 3) === m.e }; });
  ok(hit.info && hit.chip, `tocar un poco fuera del "!" y de "Solo mínimo" sí los activa (${JSON.stringify(hit)})`);
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
}
{ // activar un hábito congelado no choca con el máximo de 2 proyectos
  const seed = { ...base2(), ...readHabit() }; seed['fronts/h1'] = { ...seed['fronts/h1'], status:'frozen', pauses:[{ from:add(TODAY, -3) }] };
  const p = await open('light', seed); await nav(p, 'frentes'); await p.click('.trow [data-act=front-activate]'); await p.waitForTimeout(80);
  ok((await store(p)).fronts.find(f => f.id === 'h1').status === 'active', 'un hábito congelado se activa aunque haya 2 proyectos');
  await p.close();
}
// escritorio
{ const p = await open('light', seedGoal({ start:add(TODAY, -16), days:28, levels:pattern(add(TODAY, -16), add(TODAY, -1)) }), 1280);
  await nav(p, 'metas'); await p.screenshot({ path:path.join(out, 'metas-escritorio.png') }); ok(!p.errs.length, 'escritorio sin errores'); await p.close(); }
await b.close();
console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodo bien'); process.exit(fails ? 1 : 0);

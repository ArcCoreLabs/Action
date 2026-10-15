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
const nav = async (p, v) => { await p.click(`#nav [data-v=${v}]`); if (v === 'frentes') await unfold(p); };
const unfold = p => p.evaluate(() => new Promise(r => { document.querySelectorAll('details.front:not([open])').forEach(d => { d.open = true; }); setTimeout(r, 30); })); // abre los frentes plegados (los hábitos empiezan plegados), como si los tocaras
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
  await nav(p, 'metas');
  ok(await p.locator('.forest').count() === 0 && /Congelados \(1\)/.test(await p.locator('#view').textContent()), `${scheme}: un objetivo congelado va plegado en Congelados, sin bosque`);
  // al activarlo se cierra la pausa, la fecha límite se corre lo congelado y no se marchita nada
  await nav(p, 'frentes'); await p.click('[data-act=front-activate]');
  ok(await p.inputValue('#g-start') === start && await p.inputValue('#g-deadline') === add(start, 27 + 6) && /se corrió 6 días/.test(await p.locator('.sheet').textContent()), `${scheme}: con avance, la hoja de activar corre la fecha límite 6 días`);
  await p.click('[data-act=activate-go]'); await p.waitForTimeout(80);
  const fr = (await store(p)).fronts[0]; ok(fr.status === 'active' && fr.pauses[0].to === TODAY, `${scheme}: activar cierra la pausa`);
  await nav(p, 'metas'); lb = await p.locator('.forest .forest-count').textContent();
  ok(!/marchito|seco/.test(lb), `${scheme}: los días congelados no marchitan nada ("${lb}")`);
  await p.close();
}
// ---------- 4. arreglos de la revisión ----------
console.log('\nArreglos de la revisión');
for (const scheme of ['light', 'dark']){
  // frente sin hábito: la Principal de ayer sin hacer pasa sola a hoy, en rojo; el marchito se queda; al terminarla se salva
  for (const act of ['done', 'unassign']){
    const start = add(TODAY, -6), seed = seedGoal({ start, days:28, habit:false });
    for (let i = 0; i < 6; i++) seed[`tasks/p${i}`] = { title:'Principal ' + i, frontId:'f1', minutes:45, slot:'critical', date:add(start, i), done:i < 5, doneAt:i < 5 ? add(start, i) : null, created:i };
    const p = await open(scheme, seed, 360); await p.waitForTimeout(500);
    ok(/Vencida desde el/.test(await p.locator('.main-task.late').textContent().catch(() => '')) && await p.locator('.notice [data-act=carry]').count() === 0, `${scheme}: la Principal vencida pasa sola a hoy, en rojo`);
    await nav(p, 'metas'); let lb = await p.locator('.forest-count').textContent();
    ok(lb.includes('1 marchito'), `${scheme}: pasarla a hoy no borra el marchito ("${lb}")`); await nav(p, 'hoy');
    if (act === 'done'){
      const n = await p.locator('.notices').textContent();
      ok(/Hoy termina la Principal y lo salvas/.test(n), `${scheme}: sin hábito, el aviso pide terminar la Principal`);
      await p.click('.main-task [data-act=done]'); const tt = await toastText(p);
      const w = await p.locator('.toast').evaluate(e => e.getBoundingClientRect().width);
      ok(/Salvaste/.test(tt) && w > 250, `${scheme}: al terminarla se salva y el aviso usa el ancho ("${tt}", ${Math.round(w)} px)`);
      await nav(p, 'metas'); lb = await p.locator('.forest-count').textContent(); ok(lb.includes('1 salvado') && !lb.includes('marchito'), `${scheme}: queda salvado ("${lb}")`);
    } else {
      await p.click('.main-task [data-act=task-sheet]'); await p.click('[data-act=unassign]'); await p.waitForTimeout(500);
      const s2 = await store(p); ok(!s2.tasks.find(t => t.id === 'p5').slot && s2.fronts[0].planSkip === TODAY && await p.locator('.main-task').count() === 0, `${scheme}: si la quitas, hoy no vuelve a salir sola`);
      await nav(p, 'metas'); lb = await p.locator('.forest-count').textContent(); ok(lb.includes('1 marchito'), `${scheme}: quitarla no borra el marchito ("${lb}")`);
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
    await nav(p, 'frentes'); await p.click('[data-act=front-activate]'); await p.click('[data-act=activate-go]'); await p.waitForTimeout(80); await nav(p, 'metas');
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
// ---------- 5b. un solo mínimo y un solo estándar por frente ----------
console.log('\nUn solo mínimo y estándar');
{ // asistente de proyecto: la meta no los pide; el hábito sí
  let p = await open('light', { 'meta/settings':{}, 'meta/focus':{ days:{} } });
  await p.click('text=Crear tu primer frente'); await p.fill('#wz-name', 'CCFA'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]');
  ok(await p.locator('#g-title').count() === 1 && await p.locator('#g-standard').count() === 0 && await p.locator('#g-minimum').count() === 0, 'el paso Objetivo no pide mínimo ni estándar');
  await p.fill('#g-title', 'Aprobar la CCFA'); await p.click('[data-act=wz-next]');
  await p.click('[data-act=wz-habit][data-v="1"]');
  ok(await p.locator('#h-m-w').isVisible() && await p.locator('#h-s-w').isVisible(), 'el paso Hábito los pide');
  await p.fill('#h-m-w', '15 min'); await p.fill('#h-s-w', '45 min'); await p.click('[data-act=wz-create]'); await p.waitForTimeout(100);
  let s = await store(p); ok(s.habits[0].minimum === '15 min' && !s.goals[0].minimum && !s.goals[0].standard, 'quedan solo en el hábito');
  // editar la meta de un proyecto con hábito: muestra los del hábito y no los pide
  await nav(p, 'metas'); await p.click('[data-act=goal-sheet]'); await p.click('[data-act=goal-edit]');
  ok(await p.locator('#g-standard').count() === 0 && /los del hábito CCFA \(15 min · 45 min\)/.test(await p.locator('#g-stdmin').textContent()), 'la meta muestra los del hábito en solo lectura');
  await p.click('[data-form=goal] button[type=submit]'); await p.waitForTimeout(80);
  await p.locator('.goal details summary').first().click();
  ok(/Mínimo innegociable15 min/.test(await p.locator('.goal details:last-of-type').first().textContent()), 'Metas → Plan muestra el mínimo del hábito');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // "No por ahora": solo mínimo y estándar, guardados en la meta
  p = await open('light', { 'meta/settings':{}, 'meta/focus':{ days:{} } });
  await p.click('text=Crear tu primer frente'); await p.fill('#wz-name', 'Inglés'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]');
  await p.fill('#g-title', 'Pasar el B2'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-habit][data-v="0"]');
  ok(await p.locator('#wz-gmin').isVisible() && await p.locator('#h-m-w').count() === 0, 'sin hábito pide solo mínimo y estándar');
  await p.fill('#wz-gmin', '10 min'); await p.fill('#wz-gstd', '30 min'); await p.click('[data-act=wz-create]'); await p.waitForTimeout(100);
  s = await store(p); ok(s.goals[0].minimum === '10 min' && s.goals[0].standard === '30 min' && !s.habits.length, 'se guardan en el objetivo');
  // objetivo sin hábito: el formulario los pide; datos viejos con los dos no se pierden al editar
  await nav(p, 'metas'); await p.click('[data-act=goal-sheet]'); await p.click('[data-act=goal-edit]');
  ok(await p.locator('#g-minimum').inputValue() === '10 min', 'sin hábito, la meta los pide y muestra lo guardado');
  await p.click('[data-act=close]'); await p.close();
  // sin hábito ni objetivo no pregunta nada
  p = await open('light', { 'meta/settings':{}, 'meta/focus':{ days:{} } });
  await p.click('text=Crear tu primer frente'); await p.fill('#wz-name', 'Varios'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-skip]');
  await p.click('[data-act=wz-habit][data-v="0"]'); ok(await p.locator('#wz-gmin').count() === 0, 'sin objetivo ni hábito no pide mínimo'); await p.close();
  // datos viejos: meta con su propio mínimo y hábito con otro; manda el del hábito y la meta conserva el suyo al guardar
  const old = { 'fronts/p1':{ name:'CCFA', status:'active', order:1, created:1 }, 'habits/h1':{ name:'CCFA', minimum:'20 min', standard:'1 h', days:[1,2,3,4,5], frontId:'p1', log:{}, order:1, created:'2026-09-01' },
    'goals/g1':{ frontId:'p1', title:'Aprobar', start:'2026-10-01', deadline:'2026-10-28', minimum:'5 min viejo', standard:'30 min viejo', weekly:[], premortem:[], created:1 }, 'meta/settings':{}, 'meta/focus':{ days:{} } };
  p = await open('light', old); await nav(p, 'metas'); await p.locator('.goal details summary').first().click();
  ok(/20 min/.test(await p.locator('.goal details:last-of-type').first().textContent()) && !/5 min viejo/.test(await p.locator('.goal details:last-of-type').first().textContent()), 'con datos viejos se ve el mínimo del hábito');
  await p.click('[data-act=goal-sheet]'); await p.click('[data-act=goal-edit]'); await p.click('[data-form=goal] button[type=submit]'); await p.waitForTimeout(80);
  s = await store(p); ok(s.goals[0].minimum === '5 min viejo', 'guardar la meta no borra su mínimo viejo');
  // nuevo objetivo: al cambiar de frente cambian los campos
  const two = { ...old, 'fronts/p2':{ name:'THM', status:'active', order:2, created:2 } };
  p.close(); p = await open('light', two); await nav(p, 'metas'); await p.click('.dash[data-act=goal-new]');
  await p.selectOption('#g-front', 'p2'); ok(await p.locator('#g-minimum').count() === 1, 'un frente sin hábito pide mínimo');
  await p.selectOption('#g-front', 'p1'); ok(await p.locator('#g-minimum').count() === 0 && await p.locator('#g-stdmin-habit').count() === 1, 'un frente con hábito muestra el del hábito');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // cambiar de frente y volver no borra el mínimo de la meta
  const twoNo = { 'fronts/p1':{ name:'CCFA', status:'active', order:1, created:1 }, 'fronts/p2':{ name:'THM', status:'active', order:2, created:2 },
    'goals/g1':{ frontId:'p1', title:'Aprobar', start:'2026-10-01', deadline:'2026-10-28', minimum:'10 min', standard:'30 min', weekly:[], premortem:[], created:1 }, 'meta/settings':{}, 'meta/focus':{ days:{} } };
  p = await open('light', twoNo); await nav(p, 'metas'); await p.click('[data-act=goal-sheet]'); await p.click('[data-act=goal-edit]');
  await p.selectOption('#g-front', 'p2'); await p.selectOption('#g-front', 'p1');
  ok(await p.locator('#g-minimum').inputValue() === '10 min', 'cambiar de frente y volver conserva el mínimo');
  await p.click('[data-form=goal] button[type=submit]'); await p.waitForTimeout(80);
  ok((await store(p)).goals[0].minimum === '10 min', 'y al guardar no se borra'); await p.close();
  // hábito viejo sin mínimo: se ve el de la meta, y al editar el hábito viene precargado
  const empty = { ...old, 'habits/h1':{ ...old['habits/h1'], minimum:'', standard:'' } };
  p = await open('light', empty); await nav(p, 'metas'); await p.locator('.goal details summary').first().click();
  ok(/5 min viejo/.test(await p.locator('.goal details:last-of-type').first().textContent()), 'si el hábito no tiene mínimo, se ve el de la meta');
  await nav(p, 'frentes'); await p.click('[data-act=front-sheet][data-id=p1]'); await p.click('[data-act=habit-edit]');
  ok(await p.locator('#h-m-h1').inputValue() === '5 min viejo', 'editar el hábito trae el mínimo de la meta'); await p.close();
  // "+ Hábito" en un proyecto trae el mínimo de la meta
  p = await open('light', twoNo); await nav(p, 'frentes'); await p.click('.front:has-text("CCFA") [data-act=habit-quick]');
  ok(await p.locator('#h-m-q').inputValue() === '10 min' && await p.locator('#h-s-q').inputValue() === '30 min', '"+ Hábito" trae el mínimo y el estándar de la meta'); await p.close();
  // asistente: escribir en "No por ahora" y pasar a "Sí" lleva lo escrito al hábito, sin duplicar
  p = await open('light', { 'meta/settings':{}, 'meta/focus':{ days:{} } });
  await p.click('text=Crear tu primer frente'); await p.fill('#wz-name', 'Inglés'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]');
  await p.fill('#g-title', 'B2'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-habit][data-v="0"]');
  await p.fill('#wz-gmin', '10 min'); await p.fill('#wz-gstd', '30 min'); await p.click('[data-act=wz-habit][data-v="1"]');
  ok(await p.locator('#h-m-w').inputValue() === '10 min', 'de "No por ahora" a "Sí" el hábito trae lo escrito');
  await p.click('[data-act=wz-create]'); await p.waitForTimeout(100);
  s = await store(p); ok(s.habits[0].minimum === '10 min' && !s.goals[0].minimum, 'queda un solo mínimo, en el hábito'); await p.close();
}

// ---------- 5c. tu bloque y el Plan B ----------
console.log('\nTu bloque y el Plan B');
{
  const st = { 'meta/settings':{ fixedTime:'19:30', planBTime:'21:00' }, 'meta/focus':{ days:{} }, 'fronts/p1':{ name:'CCFA', status:'active', order:1, created:1 },
    'tasks/t1':{ title:'Repasar detecciones', frontId:'p1', minutes:45, slot:'critical', date:TODAY, done:false, created:1 } };
  for (const scheme of ['light', 'dark']){
    // reloj simulado que avanza: 20:58 → 21:01, la línea cambia sola
    const p = await b.newPage({ viewport:{ width:390, height:860 }, colorScheme:scheme }); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.clock.install({ time:new Date('2026-10-08T20:58:00') }); await p.addInitScript(s => { window.__SEED = s; }, st);
    await p.goto('file://' + page); await p.clock.runFor(500); await p.waitForSelector('.sec-head');
    const line = () => p.locator('.day-line').first().textContent();
    ok(/Tu bloque: 7:30\s?p\.\s?m\./.test(await line()), `${scheme}: debajo de la fecha dice "Tu bloque: 7:30 p. m." (${await line()})`);
    await p.screenshot({ path:path.join(out, `hoy-bloque-${scheme}.png`) });
    await p.clock.runFor(3 * 60000); await p.clock.runFor(200);
    ok(/Plan B activo: hoy solo el mínimo/.test(await line()) && await p.locator('.day-line.warn').count() === 1, `${scheme}: al pasar las 9:00 p. m. cambia a "Plan B activo" en rojo`);
    await p.screenshot({ path:path.join(out, `hoy-planb-${scheme}.png`) });
    await p.click('.main-task [data-act=done]'); await p.clock.runFor(200);
    ok(/Tu bloque/.test(await line()), `${scheme}: con la Principal hecha vuelve a "Tu bloque"`);
    ok(!p.errs.length, `${scheme}: sin errores ${p.errs.join('|')}`); await p.close();
  }
  // sábado: no aparece
  let p = await b.newPage({ viewport:{ width:390, height:860 } }); await p.clock.setFixedTime(new Date('2026-10-10T18:00:00'));
  await p.addInitScript(s => { window.__SEED = s; }, st); await p.goto('file://' + page); await p.waitForSelector('.sec-head');
  ok(await p.locator('.day-line').count() === 0, 'el fin de semana no aparece la línea'); await p.close();
  // sin hora fija: no se pide nada en Hoy (se elige en Ajustes)
  p = await open('light', { 'meta/settings':{}, 'meta/focus':{ days:{} } });
  ok(await p.locator('.day-line').count() === 0 && !/Elegir tu hora fija/.test(await p.locator('#view').textContent()), 'sin hora fija Hoy no muestra otro recuadro'); await p.close();
  // Plan B sin hora fija, pasada la hora: igual avisa
  p = await open('light', { 'meta/settings':{ planBTime:'19:00' }, 'meta/focus':{ days:{} } });
  ok(/Plan B activo/.test(await p.locator('.day-line').textContent()), 'el Plan B avisa aunque no haya hora fija'); await p.close();
}

// ---------- 6. copia de seguridad ----------
console.log('\nCopia de seguridad');
{
  const seed = { ...base2(), ...readHabit(), 'tasks/t1':{ title:'Repasar detecciones', frontId:'p1', minutes:45, slot:'critical', date:TODAY, done:true, doneAt:TODAY, created:1 },
    'tasks/t2':{ title:'Llamar al banco', frontId:null, minutes:null, slot:null, date:null, done:false, created:2 },
    'goals/g1':{ frontId:'p1', title:'Aprobar la CCFA', start:add(TODAY, -7), deadline:add(TODAY, 20), weekly:[{ text:'Módulo 1', done:true }], premortem:[], created:1 },
    'reviews/2026-09-28':{ done:'Módulo 1', blocked:'', change:'App: botones más grandes', closed:true },
    'meta/settings':{ vision:'Ciberseguridad', fixedTime:'19:30' }, 'meta/focus':{ days:{ [TODAY]:45 } } };
  const dump = p => p.evaluate(() => JSON.stringify(Object.keys(window.__store).sort().map(k => [k, window.__store[k]])));
  // descargar
  let p = await open('light', seed); const before = await dump(p);
  await p.click('[data-act=settings]');
  ok(await p.locator('[data-act=backup]').count() === 1 && /Aún no has guardado/.test(await p.locator('[data-act=backup]').textContent()), 'Ajustes ofrece "Descargar mis datos"');
  await p.screenshot({ path:path.join(out, 'ajustes-datos-light.png') });
  await p.click('[data-act=backup]'); await p.waitForTimeout(80);
  const saved = await p.evaluate(() => window.__saved);
  ok(saved && saved.filename === `ejecucion-${TODAY}.json`, `descarga ejecucion-${TODAY}.json`);
  const file = JSON.parse(saved.data);
  ok(file.app === 'ejecucion' && file.data.fronts.length === 3 && file.data.tasks.length === 2 && file.data.habits.length === 1 && file.data.goals.length === 1 && file.data.reviews.length === 1 && file.data.meta.settings.vision === 'Ciberseguridad', 'el archivo trae todas las colecciones');
  ok((await store(p)) && (await p.evaluate(() => window.__store['meta/settings'].lastBackup)) === TODAY, 'recuerda la fecha de la última copia');
  // el "!" de Tus datos
  await p.click('[data-act=help][data-k=datos]'); ok(/Restaurar desde archivo/.test(await p.locator('.sheet').textContent()), 'el "!" de Tus datos explica descargar y restaurar');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // restaurar en un almacenamiento vacío reproduce el mismo estado
  p = await open('light', { 'tasks/zz':{ title:'Tarea que sobra', frontId:null, minutes:null, slot:null, date:null, done:false, created:9 } });
  await p.click('[data-act=settings]');
  await p.setInputFiles('#restore-file', { name:`ejecucion-${TODAY}.json`, mimeType:'application/json', buffer:Buffer.from(saved.data) });
  await p.waitForSelector('[data-act=restore-do]');
  const sum = await p.locator('.sheet').textContent();
  ok(/3 frentes·2 tareas·1 objetivo·1 hábito·1 revisión/.test(sum) && /Reemplaza todo lo que tienes ahora \(0 frentes·1 tarea/.test(sum), 'muestra el resumen de la copia y de lo actual');
  await p.screenshot({ path:path.join(out, 'restaurar-light.png') });
  await p.click('[data-act=restore-do]'); await p.waitForTimeout(60);
  ok(/Toca otra vez/.test(await p.locator('[data-act=restore-do]').textContent()) && !(await p.evaluate(() => window.__store['fronts/p1'])), 'el primer toque solo pide confirmar');
  await p.click('[data-act=restore-do]'); await p.waitForTimeout(100);
  ok(!(await p.evaluate(() => window.__store['fronts/p1'])), 'dos toques rápidos no restauran (el segundo debe ser deliberado)');
  await p.waitForTimeout(400); await p.click('[data-act=restore-do]'); await p.waitForTimeout(400);
  const after = await p.evaluate(() => JSON.stringify(Object.keys(window.__store).sort().map(k => [k, window.__store[k]])));
  ok(after === before, 'restaurar reproduce exactamente el mismo estado (y borra lo que sobraba)');
  await nav(p, 'frentes'); ok(await p.locator('.front').count() >= 3, 'la app se ve con los datos restaurados');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // si falla a la mitad, queda un aviso fijo y se termina con el mismo archivo
  p = await open('light', {}); await p.evaluate(() => { window.__FAILAT = 4; });
  await p.click('[data-act=settings]');
  await p.setInputFiles('#restore-file', { name:'copia.json', mimeType:'application/json', buffer:Buffer.from(saved.data) }); await p.waitForSelector('[data-act=restore-do]');
  await p.click('[data-act=restore-do]'); await p.waitForTimeout(450); await p.click('[data-act=restore-do]'); await p.waitForTimeout(400);
  ok(/quedó a medias \(3 de \d+\)/.test(await p.locator('.sheet').textContent()), 'si falla a la mitad lo dice fijo en la hoja');
  await p.evaluate(() => { window.__FAILAT = undefined; });
  await p.click('[data-act=restore-do]'); await p.waitForTimeout(450); await p.click('[data-act=restore-do]'); await p.waitForTimeout(400);
  ok((await dump(p)) === before, 'repetir con el mismo archivo termina la restauración');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // archivo que no es una copia
  p = await open('light', seed); await p.click('[data-act=settings]');
  await p.setInputFiles('#restore-file', { name:'otro.json', mimeType:'application/json', buffer:Buffer.from('{"hola":1}') }); await p.waitForTimeout(120);
  ok(/no es una copia de Ejecución/.test(await toastText(p)) && await p.locator('[data-act=restore-do]').count() === 0, 'rechaza un archivo que no es una copia');
  ok((await dump(p)) === before, 'un archivo inválido no cambia nada'); await p.close();
  // sin la capacidad de descargar, el botón no aparece (restaurar sí)
  p = await b.newPage({ viewport:{ width:390, height:860 } }); await p.clock.setFixedTime(new Date(NOW)); await p.addInitScript(() => { window.__NODL = true; });
  await p.goto('file://' + page); await p.waitForSelector('.sec-head'); await p.click('[data-act=settings]');
  ok(await p.locator('[data-act=backup]').count() === 0 && await p.locator('label[for=restore-file]').count() === 1, 'sin descargas se oculta el botón y queda restaurar'); await p.close();
}
// ---------- 6b. congelar y activar (Tarea 8) ----------
console.log('\nCongelar y activar');
{ const dotCls = (p, i) => p.locator('.dot i').nth(i).getAttribute('class'); // TODAY es jueves: L=0 … J=3
  // congelar no borra los fallos que ya tenías
  let p = await open('light', seedGoal({ start:add(TODAY, -6), days:28, levels:seq(add(TODAY, -6), [2,2,2,2]) }));
  ok(/Llevas 2 días sin cumplir/.test(await p.locator('.notices').textContent()) && await dotCls(p, 1) === 'miss' && await dotCls(p, 2) === 'miss', 'antes de congelar: aviso y martes y miércoles en rojo');
  await nav(p, 'frentes'); await p.click('[data-act=front-sheet][data-id=f1]'); await p.click('[data-act=front-freeze]'); await p.waitForTimeout(80); await nav(p, 'hoy');
  ok(await dotCls(p, 1) === 'miss' && await dotCls(p, 2) === 'miss', 'al congelar, los días que ya fallaste siguen en rojo');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // al activar un frente congelado: sin falsa alarma, los días congelados no se pintan de rojo y no hay árbol que salvar
  p = await open('light', seedGoal({ start:add(TODAY, -10), days:28, levels:seq(add(TODAY, -10), [2,2,2,2,2]), frontExtra:{ status:'frozen', pauses:[{ from:add(TODAY, -4) }] } }));
  await nav(p, 'frentes'); await p.click('[data-act=front-activate]'); await p.click('[data-act=activate-go]'); await p.waitForTimeout(80); await nav(p, 'hoy');
  const nts = await p.locator('.notices').textContent().catch(() => '');
  ok(!/sin cumplir|La última vez|marchitando/.test(nts), `al activar no hay falsa alarma ni árbol que salvar ("${nts.trim()}")`);
  ok(await dotCls(p, 0) !== 'miss' && await dotCls(p, 1) !== 'miss' && await dotCls(p, 2) !== 'miss', 'los días congelados no salen en rojo');
  await nav(p, 'metas'); ok(/1 marchito/.test(await p.locator('.forest .forest-count').textContent()), 'el día que fallaste antes de congelar sigue marchito en el bosque');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // congelar saca del plan la Principal, los Extras y lo pendiente; la Principal fallada queda guardada
  const plan = { ...seedGoal({ start:add(TODAY, -3), days:28 }),
    'tasks/a':{ title:'Estudiar módulo 3', frontId:'f1', minutes:45, slot:'critical', date:TODAY, done:false, created:1 },
    'tasks/b':{ title:'Laboratorio 2', frontId:'f1', minutes:30, slot:'secondary', date:add(TODAY, 1), done:false, created:2 },
    'tasks/c':{ title:'Repasar notas', frontId:'f1', minutes:20, slot:'critical', date:add(TODAY, -1), done:false, created:3 },
    'tasks/d':{ title:'Módulo 1', frontId:'f1', minutes:45, slot:'critical', date:add(TODAY, -2), done:true, doneAt:add(TODAY, -2), created:4 } };
  p = await open('light', plan);
  await nav(p, 'frentes'); await p.click('[data-act=front-sheet][data-id=f1]'); await p.click('[data-act=front-freeze]'); const tt = await toastText(p); await p.waitForTimeout(80);
  const ts = Object.fromEntries((await store(p)).tasks.map(t => [t.id, t]));
  ok(/CCFA congelado\. Su hábito queda en pausa\. Salieron 3 tareas de tu plan\./.test(tt), `el aviso dice qué salió del plan ("${tt}")`);
  ok(['a', 'b', 'c'].every(k => !ts[k].slot && !ts[k].date) && ts.d.slot === 'critical' && ts.d.done, 'las pendientes salen del plan y la hecha se queda');
  ok((ts.c.missed || []).includes(add(TODAY, -1)) && !(ts.a.missed || []).length, 'la Principal de ayer sin hacer queda guardada como fallada');
  await nav(p, 'hoy'); ok(await p.locator('.main-task').count() === 0 && !/Pendiente/.test(await p.locator('#view').textContent()), 'Hoy ya no muestra tareas del frente congelado');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  p = await open('light', { ...seedGoal({ start:add(TODAY, -3), days:28, habit:false }), 'tasks/a':plan['tasks/a'] });
  await nav(p, 'frentes'); await p.click('[data-act=front-sheet][data-id=f1]'); await p.click('[data-act=front-freeze]');
  ok((await toastText(p)) === 'CCFA congelado. Salió de tu plan: Estudiar módulo 3.', 'con una sola tarea la nombra'); await p.close();
  // un proyecto sin hábito: la Principal fallada de ayer sigue en rojo después de congelarlo
  p = await open('light', { ...seedGoal({ start:add(TODAY, -3), days:28, habit:false }), 'tasks/c':plan['tasks/c'] });
  ok(await dotCls(p, 2) === 'miss', 'sin hábito, la Principal fallada de ayer está en rojo');
  await nav(p, 'frentes'); await p.click('[data-act=front-sheet][data-id=f1]'); await p.click('[data-act=front-freeze]'); await p.waitForTimeout(80); await nav(p, 'hoy');
  ok(await dotCls(p, 2) === 'miss', 'al congelarlo sigue en rojo'); await p.close();
  // lo que hiciste el día que congelaste sigue contando en la racha
  p = await open('light', { ...base2(), ...readHabit(), 'fronts/h1':{ ...readHabit()['fronts/h1'], status:'frozen', pauses:[{ from:add(TODAY, -1) }] },
    'habits/hb':{ ...readHabit()['habits/hb'], created:add(TODAY, -6), log:Object.fromEntries([-6,-5,-4,-3,-2,-1].map(i => [add(TODAY, i), 'full'])) } });
  await nav(p, 'frentes'); await p.click('.trow [data-act=front-activate][data-id=h1]'); await p.waitForTimeout(80); await nav(p, 'hoy');
  ok(/6 días seguidos/.test(await p.locator('#view').textContent()), 'el hábito del día en que congelaste sigue en la racha'); await p.close();
  // el bosque de un frente congelado no marca hoy; un objetivo vencido no tiene «esta semana»
  p = await open('light', { ...seedGoal({ start:add(TODAY, -6), days:28, levels:seq(add(TODAY, -6), [2,2,2]), frontExtra:{ status:'frozen', pauses:[{ from:add(TODAY, -3) }] } }) });
  await nav(p, 'metas'); ok(await p.locator('.forest .today').count() === 0, 'el bosque de un frente congelado no marca hoy'); await p.close();
  p = await open('light', seedGoal({ start:add(TODAY, -40), days:28 })); await nav(p, 'metas');
  ok(/Plazo vencido/.test(await p.locator('.goal').textContent()) && await p.locator('.goal .trow.cur').count() === 0 && !/esta semana/.test(await p.locator('.goal').textContent()), 'un objetivo vencido no marca «esta semana»');
  await nav(p, 'frentes'); await p.click('[data-act=help][data-k=congelados]'); ok(/2 proyectos activos/.test(await p.locator('.sheet').textContent()) && !/2 frentes activos/.test(await p.locator('.sheet').textContent()), 'la ayuda de Congelados habla de proyectos');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
}
// ---------- 6c. ideas congeladas desde la Bandeja (Tarea 9) ----------
console.log('\nIdeas congeladas');
for (const scheme of ['light', 'dark']){
  const seed = { ...base2(), ...readHabit(), 'fronts/e1':{ name:'eJPT', status:'frozen', order:50, created:4, pauses:[{ from:add(TODAY, -2) }] },
    'tasks/n1':{ title:'Aprender a tocar guitarra', frontId:null, minutes:null, slot:null, date:null, done:false, created:1 },
    'tasks/n2':{ title:'Llamar al banco', frontId:null, minutes:null, slot:null, date:null, done:false, created:2 } };
  const p = await open(scheme, seed), badge = () => p.locator('#inboxBadge').textContent(), t = async id => (await store(p)).tasks.find(x => x.id === id);
  await nav(p, 'bandeja'); await p.click('.trow:has-text("guitarra") [data-act=move-sheet]');
  const sh = await p.locator('.sheet').textContent();
  ok(/^Mover a…\s*Aprender a tocar guitarraCongelar · para algún día/.test(sh) && /eJPT/.test(sh) && !/Leer/.test(sh), `${scheme}: «Mover a…» ofrece Congelar de primero y no ofrece el frente de hábito`);
  await p.click('[data-act=idea-freeze]'); const tt = await toastText(p); await p.waitForTimeout(80);
  let n1 = await t('n1');
  ok(n1.someday === TODAY && !n1.frontId && /Congelada\. La ves en Frentes → Congelados\./.test(tt), `${scheme}: congelar la deja sin frente y con fecha ("${tt}")`);
  ok(await p.locator('#view .trow').count() === 1 && await badge() === '1', `${scheme}: sale de la Bandeja y el punto baja a 1`);
  // Planear mañana: Congelar siempre manda a Ideas (nunca a eJPT) y Borrar pide dos toques
  await nav(p, 'hoy'); await p.click('[data-act=night]');
  const card = p.locator('.sheet .card:has-text("Llamar")');
  ok(await card.locator('[data-act=move]').count() === 2 && !/Leer/.test(await card.textContent()), `${scheme}: en Planear mañana solo salen los proyectos activos`);
  await card.locator('[data-act=np-del]').click(); await p.waitForTimeout(60);
  ok(await t('n2') && /¿Borrar\?/.test(await card.textContent()), `${scheme}: Borrar en Planear mañana pide un segundo toque`);
  await card.locator('[data-act=idea-freeze]').click(); await p.waitForTimeout(80);
  const n2 = await t('n2'); ok(n2.someday === TODAY && !n2.frontId, `${scheme}: Congelar de Planear mañana manda a Ideas, no a eJPT`);
  await p.click('[data-act=close]');
  // Frentes → Congelados → Ideas
  await nav(p, 'frentes'); const det = p.locator('details[data-keep=ideas]');
  ok(/Ideas \(2\)/.test(await det.locator('summary').textContent()) && await p.locator('.front-head, .trow').filter({ hasText:'eJPT' }).count() === 1, `${scheme}: Congelados muestra eJPT y las Ideas (2)`);
  await det.locator('summary').click(); await p.screenshot({ path:path.join(out, `ideas-${scheme}.png`), fullPage:true });
  await det.locator('.trow:has-text("Llamar") [data-act=idea-back]').click(); await p.waitForTimeout(80);
  ok(!(await t('n2')).someday && await badge() === '1' && /De vuelta en la Bandeja/.test(await toastText(p)), `${scheme}: Activar devuelve la idea a la Bandeja`);
  ok(await det.evaluate(d => d.open) && /Ideas \(1\)/.test(await det.locator('summary').textContent()), `${scheme}: el grupo de Ideas sigue abierto al redibujar`);
  await det.locator('[data-act=move-sheet]').click(); await p.click('.sheet [data-act=move][data-front=p1]'); await p.waitForTimeout(80);
  n1 = await t('n1'); ok(n1.frontId === 'p1' && !('someday' in n1), `${scheme}: ⋯ mueve la idea a un frente y deja de ser idea`);
  ok(await p.locator('details[data-keep=ideas]').count() === 0, `${scheme}: sin ideas no aparece el grupo`);
  ok(!p.errs.length && await noScroll(p) === 390, `${scheme}: sin errores ni scroll ` + p.errs.join('|')); await p.close();
}
{ // una nota ya hecha no se puede congelar; en Planear mañana, borrar una nota de abajo no hace saltar la hoja
  const seed = { ...base2() }; for (let i = 1; i <= 9; i++) seed[`tasks/n${i}`] = { title:`Nota ${i}`, frontId:null, minutes:null, slot:null, date:null, done:false, created:i };
  seed['tasks/d1'] = { title:'Pagar la factura', frontId:null, minutes:45, slot:'critical', date:TODAY, done:true, doneAt:TODAY, created:20 };
  const p = await open('light', seed);
  await p.click('.main-task [data-act=task-sheet]'); await p.click('[data-act=move-sheet]');
  ok(await p.locator('[data-act=idea-freeze]').count() === 0, 'una Principal ya hecha no ofrece Congelar'); await p.click('[data-act=close]');
  await p.click('[data-act=night]'); const sh = p.locator('#modal .sheet'); await sh.evaluate(e => { e.scrollTop = e.scrollHeight; });
  const top = await sh.evaluate(e => e.scrollTop), btn = p.locator('[data-act=np-del][data-id=n9]');
  await btn.click(); ok(await sh.evaluate(e => e.scrollTop) === top && (await btn.textContent()) === '¿Borrar?', 'el primer toque no mueve la hoja');
  await btn.click(); await p.waitForTimeout(80); ok(!(await store(p)).tasks.some(x => x.id === 'n9'), 'el segundo toque en el mismo lugar borra la nota'); await p.close();
}
{ // sin frentes congelados también se puede congelar; la copia guarda las ideas
  const p = await open('light', { ...base2(), 'tasks/n1':{ title:'Viajar a Japón', frontId:null, minutes:null, slot:null, date:null, done:false, created:1 } });
  await nav(p, 'bandeja'); await p.click('[data-act=move-sheet]'); ok(!/Sin congelados/.test(await p.locator('.sheet').textContent()), 'sin frentes congelados igual se ofrece Congelar');
  await p.click('[data-act=idea-freeze]'); await p.waitForTimeout(80); await nav(p, 'frentes');
  ok(/Ideas \(1\)/.test(await p.locator('#view').textContent()) && !/Nada congelado/.test(await p.locator('#view').textContent()), 'Congelados muestra la idea y no dice «Nada congelado»');
  await p.click('[data-act=settings]'); await p.click('[data-act=backup]'); await p.waitForTimeout(150);
  const data = JSON.parse((await p.evaluate(() => window.__saved)).data).data;
  ok(data.tasks.some(x => x.id === 'n1' && x.someday === TODAY), 'la copia guarda la idea congelada'); await p.close();
}
// ---------- 6d. frentes congelados sin fechas (Tarea 10) ----------
console.log('\nFrentes congelados sin fechas');
const MON = '2026-10-12'; // TODAY es jueves: el próximo lunes
for (const scheme of ['light', 'dark']){
  // crear un proyecto congelado con cupo libre: sin fechas, sin hábito, sin bosque
  const one = { 'fronts/p1':{ name:'CCFA', status:'active', order:1, created:1 }, 'meta/settings':{}, 'meta/focus':{ days:{} } };
  let p = await open(scheme, one);
  await nav(p, 'frentes'); await p.click('[data-act=front-new]:not([data-frozen])'); await p.fill('#wz-name', 'eJPT');
  ok(await p.locator('[data-act=wz-state][data-v=active].sel').count() === 1, `${scheme}: con cupo libre, el asistente empieza en Activo`);
  await p.click('[data-act=wz-state][data-v=frozen]'); await p.click('[data-act=wz-next]');
  await p.fill('#wz-task', 'Repasar Nmap'); await p.press('#wz-task', 'Enter'); await p.click('[data-act=wz-next]');
  ok(/Paso 3 de 3/.test(await p.locator('.sheet').textContent()) && !(await p.locator('#g-start').isVisible()) && !(await p.locator('#g-weeks').isVisible()), `${scheme}: congelado: 3 pasos y el objetivo no pide fechas ni semanas`);
  await p.screenshot({ path:path.join(out, `congelado-objetivo-${scheme}.png`) });
  await p.fill('#g-title', 'Obtener la eJPT'); await p.fill('#g-why', 'Crecimiento personal'); await p.click('[data-act=wz-create]'); const tt = await toastText(p); await p.waitForTimeout(100);
  let s = await store(p), f = s.fronts.find(x => x.name === 'eJPT'), g = s.goals.find(x => x.frontId === f.id);
  ok(f.status === 'frozen' && f.pauses[0].from === TODAY && !s.habits.length && g.start === null && g.deadline === null && !g.weekly.length && g.why === 'Crecimiento personal', `${scheme}: queda congelado, sin hábito y con el objetivo sin fechas`);
  ok(tt === 'eJPT creado en Congelados. Las fechas las eliges al activarlo.', `${scheme}: el aviso explica cuándo se eligen las fechas ("${tt}")`);
  ok(/Obtener la eJPT/.test(await p.locator('.trow:has-text("eJPT") .tmeta').textContent()), `${scheme}: la fila de Congelados dice su objetivo`);
  await nav(p, 'metas');
  ok(await p.locator('.forest').count() === 0 && /Congelados \(1\)/.test(await p.locator('#view').textContent()) && !/semana/i.test(await p.locator('details[data-keep=metas-cold]').textContent()), `${scheme}: en Metas va plegado en Congelados, sin bosque ni semanas`);
  await p.click('details[data-keep=metas-cold] summary'); ok(/eJPT·Congelado desde el 8 (de )?oct/.test(await p.locator('details[data-keep=metas-cold] .tmeta').textContent()), `${scheme}: dice desde cuándo está congelado`);
  await p.screenshot({ path:path.join(out, `metas-congelados-${scheme}.png`), fullPage:true });
  // editarlo congelado sigue sin pedir fechas
  await p.click('details[data-keep=metas-cold] [data-act=goal-sheet]'); await p.click('[data-act=goal-edit]');
  ok(!(await p.locator('#g-start').isVisible()), `${scheme}: editar el objetivo congelado no pide fechas`);
  await p.fill('#g-title', 'Obtener la eJPT este año'); await p.click('.sheet [type=submit]'); await p.waitForTimeout(80);
  g = (await store(p)).goals.find(x => x.frontId === f.id); ok(g.title === 'Obtener la eJPT este año' && g.start === null, `${scheme}: se guarda sin fechas`);
  // la hoja del frente congelado muestra sus tareas
  await nav(p, 'frentes'); await p.click(`[data-act=front-sheet][data-id="${f.id}"]`);
  ok(/Tareas\s*Repasar Nmap/.test(await p.locator('.sheet').textContent()) && /Eliges las fechas de su objetivo/.test(await p.locator('.sheet').textContent()), `${scheme}: ⋯ de un congelado muestra sus tareas`);
  await p.click('[data-act=close]');
  // activar: la hoja pide las fechas (próximo lunes + 4 semanas) y desde ahí empieza el bosque
  await p.click(`.trow [data-act=front-activate][data-id="${f.id}"]`);
  ok(await p.inputValue('#g-start') === MON && await p.inputValue('#g-deadline') === add(MON, 27), `${scheme}: al activar propone el próximo lunes y 4 semanas`);
  await p.screenshot({ path:path.join(out, `activar-${scheme}.png`) });
  await p.click('[data-act=activate-go]'); const ta = await toastText(p); await p.waitForTimeout(100);
  s = await store(p); f = s.fronts.find(x => x.id === f.id); g = s.goals.find(x => x.frontId === f.id);
  ok(f.status === 'active' && f.pauses[0].to === TODAY && g.start === MON && g.deadline === add(MON, 27) && g.weekly.length === 4, `${scheme}: queda activo con fechas y 4 semanas`);
  ok(/^eJPT activado\. Su bosque empieza el 12 (de )?oct\.$/.test(ta), `${scheme}: el aviso dice cuándo empieza ("${ta}")`);
  await nav(p, 'metas'); ok(await p.locator('.forest').count() === 1 && /Empieza el 12 (de )?oct/.test(await p.locator('#view').textContent()), `${scheme}: en Metas ya tiene su bosque`);
  ok(!p.errs.length && await noScroll(p) === 390, `${scheme}: sin errores ni scroll ` + p.errs.join('|')); await p.close();
}
{ // con 2 proyectos activos: el asistente queda en Congelado y activar deja congelar uno ahí mismo
  const seed = { ...base2(), 'fronts/e1':{ name:'eJPT', status:'frozen', order:50, created:4, pauses:[{ from:add(TODAY, -2) }] },
    'goals/ge':{ frontId:'e1', title:'Obtener la eJPT', start:add(TODAY, -2), deadline:add(TODAY, 25), weekly:[{ text:'', done:false }, { text:'', done:false }, { text:'', done:false }, { text:'', done:false }], premortem:[], created:1 } };
  let p = await open('light', seed);
  await nav(p, 'frentes'); ok(await p.locator('[data-act=front-new][data-frozen="1"]').count() === 1, 'Congelados siempre tiene «Nuevo»');
  await p.click('[data-act=front-new][data-frozen="1"]');
  ok(await p.locator('[data-act=wz-state][data-v=active][disabled]').count() === 1 && await p.locator('[data-act=wz-state][data-v=frozen].sel').count() === 1 && /Ya tienes 2 proyectos activos/.test(await p.locator('.sheet').textContent()), 'con 2 proyectos activos, Activo está apagado y queda Congelado');
  await p.click('[data-act=close]');
  // eJPT (fechas sin avance, como el de tus datos): en Metas va en Congelados y al activarlo empieza de nuevo con la misma duración
  await nav(p, 'metas'); ok(await p.locator('.forest').count() === 0 && /Congelados \(1\)/.test(await p.locator('#view').textContent()), 'un objetivo con fechas de un frente congelado también va en Congelados');
  await nav(p, 'frentes'); await p.click('.trow [data-act=front-activate]');
  const sh = await p.locator('.sheet').textContent();
  ok(await p.inputValue('#g-start') === MON && await p.inputValue('#g-deadline') === add(MON, 27) && !/se corrió/.test(sh), 'sin avance, activar empieza de nuevo con la misma duración');
  ok(/Ya tienes 2 proyectos activos\. Congela uno:/.test(sh) && await p.locator('[data-act=activate-go][data-out]').count() === 2 && await p.locator('.sheet .btn.primary[data-act=activate-go]').count() === 0, 'sin cupo, la hoja ofrece congelar uno de los activos');
  await p.click('[data-act=activate-go][data-out=p2]'); const tt = await toastText(p); await p.waitForTimeout(100);
  const s = await store(p), st = id => s.fronts.find(x => x.id === id).status;
  ok(st('p2') === 'frozen' && st('e1') === 'active' && st('p1') === 'active' && s.goals.find(x => x.id === 'ge').start === MON, 'congela THM, activa eJPT y le pone sus fechas');
  ok(/^THM congelado\. eJPT activado\. Su bosque empieza el 12 (de )?oct\.$/.test(tt), `el aviso dice las dos cosas ("${tt}")`);
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // un congelado sin objetivo y con cupo se activa con un toque, como antes
  p = await open('light', { ...seed, 'fronts/p2':{ ...seed['fronts/p2'], status:'frozen', pauses:[{ from:add(TODAY, -1) }] } });
  await nav(p, 'frentes'); await p.click('.trow [data-act=front-activate][data-id=p2]'); await p.waitForTimeout(80);
  ok((await store(p)).fronts.find(x => x.id === 'p2').status === 'active' && await p.locator('#modal .sheet').count() === 0, 'sin objetivo, Activar sigue siendo un toque');
  // en «Nuevo objetivo», elegir un frente congelado oculta las fechas
  await nav(p, 'metas'); await p.click('[data-act=goal-new]');
  ok(await p.locator('#g-start').isVisible(), 'con un frente activo se piden fechas');
  await p.selectOption('#g-front', 'e1'); ok(!(await p.locator('#g-start').isVisible()) && !(await p.locator('#g-weeks').isVisible()), 'al elegir un frente congelado se ocultan fechas y semanas');
  await p.selectOption('#g-front', 'p1'); ok(await p.locator('#g-start').isVisible(), 'y vuelven al elegir uno activo'); await p.close();
  // hábito congelado desde el asistente: no sale en Hoy ni pide fechas
  p = await open('light', base2()); await nav(p, 'frentes'); await p.click('[data-act=front-new][data-kind=habit]'); await p.fill('#wz-name', 'Guitarra');
  await p.click('[data-act=wz-state][data-v=frozen]'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]');
  ok(!(await p.locator('#g-start').isVisible()), 'un hábito congelado no pide fechas para su meta'); await p.click('[data-act=wz-skip]'); await p.waitForTimeout(100);
  const gf = (await store(p)).fronts.find(x => x.name === 'Guitarra'); ok(gf.status === 'frozen' && gf.kind === 'habit', 'el hábito queda congelado');
  await nav(p, 'hoy'); ok(!/Guitarra/.test(await p.locator('#view').textContent()), 'y no sale en Hoy'); ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
}
{ // arreglos de la revisión de la Tarea 10
  const one = { 'fronts/p1':{ name:'CCFA', status:'active', order:1, created:1 }, 'meta/settings':{}, 'meta/focus':{ days:{} } };
  const W4 = () => [0,1,2,3].map(i => ({ text:`S${i + 1}`, done:false }));
  // dos objetivos en un congelado: al activarlo los dos reciben fechas y la hoja muestra el que ya tenía fechas
  let p = await open('light', { ...one, 'fronts/e1':{ name:'eJPT', status:'frozen', order:50, created:4, pauses:[{ from:add(TODAY, -2) }] },
    'goals/ge':{ frontId:'e1', title:'Obtener la eJPT', start:add(TODAY, -2), deadline:add(TODAY, 25), weekly:W4(), premortem:[], created:1 },
    'goals/gu':{ frontId:'e1', title:'Laboratorio AD', start:null, deadline:null, weekly:[], premortem:[], created:2 } });
  await nav(p, 'frentes'); await p.click('.trow [data-act=front-activate]');
  ok(/Obtener la eJPT/.test(await p.locator('.sheet').textContent()) && /Duración: 4 semanas/.test(await p.locator('.sheet').textContent()), 'la hoja de activar muestra el objetivo que ya tenía fechas y su duración');
  await p.fill('#g-start', add(MON, 14)); ok(await p.inputValue('#g-deadline') === add(MON, 41) && /Duración: 4 semanas/.test(await p.locator('.sheet').textContent()), 'mover el inicio conserva la duración');
  await p.fill('#g-start', MON); await p.click('[data-act=activate-go]'); await p.waitForTimeout(100);
  let gs = Object.fromEntries((await store(p)).goals.map(g => [g.id, g]));
  ok(gs.ge.start === MON && gs.ge.weekly.length === 4 && gs.ge.weekly[3].text === 'S4' && gs.gu.start === MON && gs.gu.deadline === add(MON, 27), 'los dos objetivos quedan con fechas y no se pierden semanas');
  await p.close();
  // con avance: solo el tramo congelado de ahora corre la fecha, y el aviso no dice «empieza hoy»
  p = await open('light', seedGoal({ start:add(TODAY, -20), days:28, levels:seq(add(TODAY, -20), [2]), frontExtra:{ status:'frozen', pauses:[{ from:add(TODAY, -15), to:add(TODAY, -10) }, { from:add(TODAY, -4) }] } }));
  await nav(p, 'frentes'); await p.click('.trow [data-act=front-activate]');
  const sh = await p.locator('.sheet').textContent();
  ok(await p.inputValue('#g-start') === add(TODAY, -20) && await p.inputValue('#g-deadline') === add(TODAY, 11) && /se corrió 4 días/.test(sh) && /Sigue donde ibas/.test(sh), 'con avance solo corre los días del congelado de ahora');
  await p.click('[data-act=activate-go]'); ok((await toastText(p)) === 'CCFA activado. Su bosque sigue donde iba.', 'el aviso dice que el bosque sigue'); await p.close();
  // un objetivo cumplido no revive al activar
  const doneSeed = seedGoal({ start:add(TODAY, -40), days:28, frontExtra:{ status:'frozen', pauses:[{ from:add(TODAY, -20) }] } });
  doneSeed['goals/g1'].weekly = doneSeed['goals/g1'].weekly.map(w => ({ ...w, done:true }));
  p = await open('light', doneSeed);
  await nav(p, 'frentes'); await p.click('.trow [data-act=front-activate]'); await p.waitForTimeout(80);
  ok(await p.locator('#modal .sheet').count() === 0 && (await store(p)).fronts[0].status === 'active', 'un objetivo cumplido no pide fechas: Activar es un toque'); await p.close();
  // asistente: si llenas el hábito y luego pasas a Congelado, el hábito no se crea; el primer paso separa las dos preguntas
  p = await open('light', one); await nav(p, 'frentes'); await p.click('[data-act=front-new]:not([data-frozen])');
  ok(/Tipo/.test(await p.locator('.sheet').textContent()) && /¿Empieza ya\?/.test(await p.locator('.sheet').textContent()), 'el primer paso separa «Tipo» y «¿Empieza ya?»');
  await p.fill('#wz-name', 'THM'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-skip]'); await p.click('[data-act=wz-habit][data-v="1"]');
  for (let i = 0; i < 3; i++) await p.click('[data-act=wz-back]');
  await p.click('[data-act=wz-state][data-v=frozen]'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-create]'); await p.waitForTimeout(100);
  const s2 = await store(p); ok(s2.fronts.some(f => f.name === 'THM' && f.status === 'frozen') && !s2.habits.length, 'el hábito de un paso que ya no se muestra no se crea');
  // formulario: de un frente congelado a uno activo se ve el plan por semanas
  const thm = s2.fronts.find(f => f.name === 'THM').id; await p.click(`[data-act=front-sheet][data-id="${thm}"]`); await p.click('.sheet [data-act=goal-new]');
  ok(!(await p.locator('#g-weeks').isVisible()), 'en un congelado el objetivo no muestra semanas');
  await p.selectOption('#g-front', 'p1'); ok(await p.locator('#g-weeks').isVisible() && await p.locator('#g-start').isVisible(), 'al elegir un frente activo aparecen fechas y semanas');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
}
// ---------- 6e. calma visual ----------
console.log('\nCalma visual');
{ const seed = { ...seedGoal({ start:add(TODAY, -6), days:70, levels:seq(add(TODAY, -6), [2,2,2,2]) }),
    'tasks/old':{ title:'Repasar notas', frontId:'f1', minutes:20, slot:'critical', date:add(TODAY, -1), done:false, created:1 },
    'tasks/old2':{ title:'Leer guía', frontId:'f1', minutes:20, slot:'secondary', date:add(TODAY, -2), done:false, created:2 } };
  seed['goals/g1'].weekly = seed['goals/g1'].weekly.map((w, i) => ({ text:i ? '' : 'Primer módulo', done:false }));
  const p = await open('light', seed);
  ok(await p.locator('.notices .notice').count() === 1 && /Llevas 2 días sin cumplir/.test(await p.locator('.notices').textContent()), 'Hoy muestra un solo aviso: el más importante');
  ok(!/Extras/.test(await p.locator('#view').textContent()), 'sin Principal no aparece Extras');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.info')).borderTopColor) === 'rgba(0, 0, 0, 0)', 'los «!» no tienen círculo');
  await p.click('[data-act=hcheck]'); await p.waitForTimeout(500);
  const nt2 = await p.locator('.notices').textContent(), nl = await p.locator('.notices .notice').count(), late = await p.locator('.main-task.late').count();
  ok(/Pendiente: Leer guía/.test(nt2) && nl === 1 && late === 1, `resuelto el aviso, queda una línea de pendientes y la Principal vencida está en Hoy ("${nt2}", ${nl} avisos, ${late} vencidas)`);
  await nav(p, 'metas'); const g = p.locator('.goal');
  ok(await g.locator('> .list .trow').count() === 1 && /Todas las semanas \(\d+\/10\)/.test(await g.textContent()), 'Metas muestra solo la semana actual y pliega las demás');
  ok(!p.errs.length && await noScroll(p) === 390, 'sin errores ni scroll ' + p.errs.join('|')); await p.close();
}
{ // el paso del objetivo trae una propuesta y explica qué es; un proyecto sin objetivo dice que no tiene bosque
  const p = await open('light', { 'fronts/p1':{ name:'CCFA', status:'active', order:1, created:1 }, 'meta/settings':{}, 'meta/focus':{ days:{} } });
  await nav(p, 'frentes'); ok(/\+ Objetivo · sin él no hay bosque/.test(await p.locator('#view').textContent()), 'un proyecto sin objetivo avisa que no tiene bosque');
  await p.click('[data-act=front-new]:not([data-frozen])'); await p.fill('#wz-name', 'Jr Penetration Tester'); await p.click('[data-act=wz-next]'); await p.click('[data-act=wz-next]');
  ok(await p.inputValue('#g-title') === 'Completar Jr Penetration Tester' && /De aquí salen sus semanas y su bosque/.test(await p.locator('.sheet').textContent()), 'el paso del objetivo trae una propuesta y explica que crea el bosque');
  await p.click('[data-act=wz-skip]'); await p.click('[data-act=wz-back]'); ok(await p.inputValue('#g-title') === '', 'si eliges «Sin objetivo», la propuesta no vuelve'); await p.close();
}
// ---------- 6f. Principales automáticas ----------
console.log('\nPrincipales automáticas');
{ // TODAY es jueves. CCFA: hábito de lunes a viernes. JPT: hábito de jueves a domingo. Cada uno saca solo su siguiente tarea.
  const seed = { 'fronts/a':{ name:'CCFA', status:'active', order:1, created:1 }, 'fronts/b':{ name:'JPT', status:'active', order:2, created:2 },
    'habits/ha':{ name:'CCFA', days:[1,2,3,4,5], frontId:'a', log:{}, order:1, created:add(TODAY, -7) }, 'habits/hb':{ name:'JPT', days:[4,5,6,0], frontId:'b', log:{}, order:2, created:add(TODAY, -7) },
    'tasks/a1':{ title:'Módulo 1', frontId:'a', minutes:45, slot:null, date:null, done:false, created:1 }, 'tasks/a2':{ title:'Módulo 2', frontId:'a', minutes:45, slot:null, date:null, done:false, created:2 },
    'tasks/b2':{ title:'Lab Web', frontId:'b', minutes:60, slot:null, date:null, done:false, created:5 }, 'tasks/b1':{ title:'Lab Kill Chain', frontId:'b', minutes:60, slot:null, date:null, done:false, created:4 },
    'meta/settings':{}, 'meta/focus':{ days:{} } };
  for (const scheme of ['light', 'dark']){
    const p = await open(scheme, seed); await p.waitForTimeout(500);
    const titles = await p.locator('.main-task .mt-title').allTextContents();
    ok(titles.join('|') === 'Módulo 1|Lab Kill Chain', `${scheme}: salen solas 2 Principales, la siguiente tarea de cada proyecto (${titles.join(', ')})`);
    ok(/Principales\s*0\/2/.test(await p.locator('#view').textContent()), `${scheme}: el título dice Principales 0/2`);
    await p.screenshot({ path:path.join(out, `principales-${scheme}.png`) });
    await p.click('.main-task:has-text("Módulo 1") [data-act=done]'); let tt = await toastText(p);
    ok(/Principal hecha\. Te falta la otra\./.test(tt) && await p.evaluate(() => document.querySelectorAll('.dot i')[3].className) !== 'win', `${scheme}: con una hecha el día no está ganado ("${tt}")`);
    await p.waitForTimeout(300); await p.click('.main-task:has-text("Lab Kill Chain") [data-act=done]'); tt = await toastText(p); await p.waitForTimeout(150);
    ok(/Día ganado/.test(tt) && await p.evaluate(() => document.querySelectorAll('.dot i')[3].className) === 'win', `${scheme}: con las dos hechas el día se gana ("${tt}")`);
    await p.waitForTimeout(500); ok((await p.locator('.main-task').count()) === 2, `${scheme}: hechas no se reemplazan por otra el mismo día`);
    ok(!p.errs.length && await noScroll(p) === 390, `${scheme}: sin errores ni scroll ` + p.errs.join('|')); await p.close();
  }
  // lunes: JPT no toca (su hábito es de jueves a domingo), solo sale CCFA; mañana muestra lo que saldrá solo
  const p = await b.newPage({ viewport:{ width:390, height:860 } }); await p.clock.setFixedTime(new Date('2026-10-12T09:00:00')); await p.addInitScript(s => { window.__SEED = s; }, seed);
  await p.goto('file://' + page); await p.waitForSelector('.sec-head'); await p.waitForTimeout(500);
  ok((await p.locator('.main-task .mt-title').allTextContents()).join('|') === 'Módulo 1', 'un proyecto solo sale los días de su hábito');
  ok(!/no tiene tareas/.test(await p.locator('#view').textContent()), 'con tareas en los dos proyectos no hay aviso de proyecto vacío');
  await p.close();
  { // jueves con las dos Principales sin hacer: Mañana (viernes, tocan los dos) muestra la siguiente de cada uno, no repite la de hoy
    const q = await open('light', seed); await q.waitForTimeout(500);
    const tm = q.locator('section.block:has(h2:text-is("Mañana"))'), txt = await tm.textContent();
    ok(/Módulo 2/.test(txt) && /Lab Web/.test(txt) && !/Módulo 1|Lab Kill Chain/.test(txt) && /Sigue después de la de hoy/.test(txt), `Mañana no repite la Principal de hoy, muestra la que sigue (${txt.replace(/\s+/g, ' ').trim()})`);
    await q.click('.main-task:has-text("Módulo 1") [data-act=done]'); await q.waitForTimeout(400);
    ok(/Módulo 2[^]*Saldrá sola mañana/.test(await tm.textContent()), 'hecha la de hoy, la siguiente dice "Saldrá sola mañana"');
    ok(!q.errs.length, 'sin errores ' + q.errs.join('|')); await q.close();
  }
  // JPT sin tareas pendientes: no sale su Principal, pero Hoy lo avisa y "Agregar" lleva a escribirle una; al agregarla sale sola
  const empty = Object.fromEntries(Object.entries(seed).filter(([k]) => !/^tasks\/b/.test(k)));
  for (const h of ['habits/ha', 'habits/hb']) empty[h] = { ...seed[h], created:TODAY }; // sin días fallados: si no, gana el aviso de hábitos
  empty['tasks/b0'] = { title:'Lab viejo', frontId:'b', minutes:60, slot:null, date:null, done:true, doneAt:add(TODAY, -2), created:3 };
  empty['tasks/b9'] = { title:'Idea', frontId:'b', minutes:60, slot:null, date:null, done:false, someday:true, created:9 };
  for (const scheme of ['light', 'dark']){
    const q = await open(scheme, empty); await q.waitForTimeout(500);
    ok((await q.locator('.main-task .mt-title').allTextContents()).join('|') === 'Módulo 1', `${scheme}: el proyecto sin tareas no saca Principal`);
    const nt = await q.locator('.notice').allTextContents();
    ok(nt.length === 1 && /JPT no tiene tareas\. Sin ellas no sale su Principal\./.test(nt[0]), `${scheme}: Hoy avisa que JPT no tiene tareas (${nt.join('|')})`);
    await q.screenshot({ path:path.join(out, `proyecto-vacio-${scheme}.png`) });
    if (scheme === 'light'){
      await q.click('.notice [data-act=front-tasks]');
      ok(await q.evaluate(() => document.activeElement && document.activeElement.id) === 'add-b', '"Agregar" abre Frentes con el campo de nueva tarea de JPT listo');
      await q.keyboard.type('Lab Nmap'); await q.keyboard.press('Enter'); await q.waitForTimeout(200); await nav(q, 'hoy'); await q.waitForTimeout(500);
      const t2 = await q.locator('.main-task .mt-title').allTextContents();
      ok(t2.join('|') === 'Módulo 1|Lab Nmap' && !(await q.locator('.notice').count()), `al agregarla sale sola como Principal y el aviso se va (${t2.join(', ')})`);
    }
    ok(!q.errs.length && await noScroll(q) === 390, `${scheme}: sin errores ni scroll ` + q.errs.join('|')); await q.close();
  }
}
// ---------- 6g. Metas vivas ----------
console.log('\nMetas vivas');
{ // CCFA: 10 semanas con texto; hoy (jueves de la semana 1) terminas la Principal desde Hoy y Metas avanza solo
  const seed = { 'fronts/a':{ name:'CCFA', status:'active', order:1, created:1 },
    'habits/ha':{ name:'CCFA', days:[1,2,3,4,5], frontId:'a', log:{}, order:1, created:add(TODAY, -3) },
    'goals/ga':{ title:'Aprobar el CCFA', frontId:'a', start:add(TODAY, -3), deadline:add(TODAY, 66), trigger:'En el trabajo', why:'Crecer', created:1,
      weekly:Array.from({ length:10 }, (_, i) => ({ text:'Módulo ' + (i + 1), done:false })) },
    'tasks/a1':{ title:'Definir módulos', frontId:'a', minutes:45, slot:'critical', date:TODAY, done:false, created:1 },
    'tasks/a2':{ title:'User management', frontId:'a', minutes:45, slot:null, date:null, done:false, created:2 },
    'meta/settings':{}, 'meta/focus':{ days:{} } };
  for (const scheme of ['light', 'dark']){
    const p = await open(scheme, seed); await p.waitForTimeout(400);
    await nav(p, 'metas'); const g = p.locator('.goal');
    ok(/0\/10 semanas cumplidas/.test(await g.textContent()) && !(await g.locator('> .list .check.on').count()), `${scheme}: antes de hacer nada la semana 1 está sin marcar`);
    ok(await g.locator('> .list .trow').count() === 1 && await g.locator('details[data-keep^=weeks]').evaluate(e => !e.open), `${scheme}: solo se ve esta semana; las otras 9 y el Plan quedan plegados`);
    await nav(p, 'hoy'); await p.click('.main-task:has-text("Definir módulos") [data-act=done]'); await p.waitForTimeout(400); await nav(p, 'metas');
    const t = await g.textContent();
    ok(/1\/10 semanas cumplidas/.test(t) && await g.locator('> .list .check.on').count() === 1 && /✓ Definir módulos/.test(t) && /Todas las semanas \(1\/10\)/.test(t), `${scheme}: al terminar la tarea en Hoy, la semana se marca sola y muestra lo que hiciste`);
    await p.evaluate(() => { document.getElementById('toastRoot').innerHTML = ''; }); await g.screenshot({ path:path.join(out, `metas-vivas-${scheme}.png`) });
    if (scheme === 'light'){
      await g.locator('> .list [data-act=goal-week]').click(); const tt = await toastText(p);
      ok(/se marcó sola/.test(tt) && await g.locator('> .list .check.on').count() === 1, `tocarla no la desmarca: explica que se marcó sola ("${tt}")`);
      await g.locator('summary:text-is("Plan")').click(); await g.locator('summary:has-text("Todas las semanas")').click();
      await nav(p, 'hoy'); await nav(p, 'metas');
      ok(await g.locator('details[data-keep^=plan]').evaluate(e => e.open) && await g.locator('details[data-keep^=weeks]').evaluate(e => e.open), 'lo que abriste sigue abierto al volver a Metas');
      await nav(p, 'semana'); ok(/Se marcó sola: 1 tarea hecha/.test(await p.locator('#view').textContent()), 'Semana también la muestra marcada sola');
    }
    ok(!p.errs.length && await noScroll(p) === 390, `${scheme}: sin errores ni scroll ` + p.errs.join('|')); await p.close();
  }
}
// ---------- 6h. Frentes plegables ----------
console.log('\nFrentes plegables');
{ const seed = { 'fronts/a':{ name:'CCFA', status:'active', order:2, created:1 }, 'fronts/h':{ name:'Leer', kind:'habit', status:'active', order:1, created:1 },
    'habits/hh':{ name:'Leer', days:[1,2,3,4,5], frontId:'h', log:{}, order:1, created:TODAY },
    'meta/settings':{}, 'meta/focus':{ days:{} } };
  for (let i = 1; i <= 6; i++) seed['tasks/t' + i] = { title:'Tarea ' + i, frontId:'a', minutes:45, slot:null, date:null, done:false, created:i };
  for (let i = 1; i <= 2; i++) seed['tasks/d' + i] = { title:'Hecha ' + i, frontId:'a', minutes:45, slot:null, date:null, done:true, doneAt:add(TODAY, -i), created:10 + i };
  for (const scheme of ['light', 'dark']){
    const p = await open(scheme, seed); await p.waitForTimeout(500); await p.click('#nav [data-v=frentes]');
    const fa = p.locator('details.front:has(h2:text-is("CCFA"))'), fh = p.locator('details.front:has(h2:text-is("Leer"))');
    ok(await fa.evaluate(e => e.open) && !(await fh.evaluate(e => e.open)), `${scheme}: el proyecto empieza abierto y el hábito plegado`);
    ok(/6 pendientes\s*·\s*2 hechas/.test(await fa.locator('summary.front-head').textContent()) && /Hábito · lunes a viernes/.test(await fh.locator('summary').textContent()), `${scheme}: el título resume cada frente (${(await fa.locator('summary.front-head .tmeta').textContent())})`);
    const vis = await fa.locator('.front-body > .list > .trow').count();
    ok(vis === 3 && /3 tareas más/.test(await fa.textContent()) && !(await fa.locator('.more-tasks').evaluate(e => e.open)) && !(await fa.locator('details[data-keep^=done]').evaluate(e => e.open)), `${scheme}: a la vista 3 tareas; el resto y las hechas plegadas (${vis})`);
    await p.screenshot({ path:path.join(out, `frentes-plegables-${scheme}.png`) });
    if (scheme === 'light'){
      await fh.locator('summary [data-act=front-sheet]').click(); await p.waitForTimeout(100);
      ok(await p.locator('#modal .sheet').count() === 1 && !(await fh.evaluate(e => e.open)), 'los ⋯ del título abren las opciones sin desplegar el frente');
      await p.click('[data-act=close]'); await fa.locator('summary.front-head h2').click(); await p.waitForTimeout(80);
      await nav(p, 'hoy'); await p.click('#nav [data-v=frentes]');
      ok(!(await fa.evaluate(e => e.open)), 'si cierras un proyecto sigue cerrado al volver a Frentes');
      await fa.locator('.more-tasks').evaluate(e => { e.closest('details.front').open = true; e.open = true; }); await p.waitForTimeout(50);
      await fa.locator('.more-tasks [data-act=done] >> nth=0').click(); await p.waitForTimeout(300);
      ok(await fa.evaluate(e => e.open) && await fa.locator('.more-tasks').evaluate(e => e.open), 'marcar una tarea de la lista plegada no la vuelve a cerrar');
    }
    ok(!p.errs.length && await noScroll(p) === 390, `${scheme}: sin errores ni scroll ` + p.errs.join('|')); await p.close();
  }
}
// ---------- 7. hojas en iPhone ----------
console.log('\nHojas en iPhone');
{ // con su aspecto nativo, el iPhone (RenderThemeIOS) pone a los campos de hora y fecha relleno de .5em y box-sizing:content-box
  // por encima del CSS; aquí se imita en cada campo que siga con aspecto nativo y se mide contra el borde del contenido de la hoja
  const fits = p => p.evaluate(() => { const s = document.querySelector('#modal .sheet'), edge = s.getBoundingClientRect().right - parseFloat(getComputedStyle(s).paddingRight) + .5;
    for (const e of s.querySelectorAll('input[type=date],input[type=time]')) if (getComputedStyle(e).appearance !== 'none') e.style.cssText += ';box-sizing:content-box!important;padding:0 7px!important';
    return s.scrollWidth <= s.clientWidth && [...s.querySelectorAll('input:not([hidden]),textarea,select,.btn,.opt')].every(x => x.getBoundingClientRect().right <= edge); });
  const textFits = p => p.evaluate(() => { const s = document.querySelector('#modal .sheet'), edge = s.getBoundingClientRect().right - parseFloat(getComputedStyle(s).paddingRight) + .5, r = document.createRange();
    r.selectNodeContents(s); return [...r.getClientRects()].every(x => x.right <= edge); });
  for (const scheme of ['light', 'dark']){
    const p = await open(scheme, seedGoal({ start:add(TODAY, -3), days:28 }));
    await p.click('[data-act=settings]'); ok(await fits(p), `${scheme}: Ajustes no se sale por la derecha con los campos de hora del iPhone`);
    await p.screenshot({ path:path.join(out, `ajustes-iphone-${scheme}.png`) }); await p.click('[data-act=close]');
    await nav(p, 'metas'); await p.click('[data-act=goal-sheet]'); await p.click('[data-act=goal-edit]');
    ok(await fits(p), `${scheme}: Editar objetivo no se sale con los campos de fecha del iPhone`); await p.click('[data-act=close]');
    ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
    const w = await open(scheme);
    await w.click('text=Crear tu primer frente'); await w.fill('#wz-name', 'Nuevo'); await w.click('[data-act=wz-next]'); await w.click('[data-act=wz-next]');
    ok(await w.locator('#g-start').count() === 1 && await fits(w), `${scheme}: el paso del objetivo en el asistente no se sale`); await w.close();
  }
  { // un enlace pegado como título baja de línea dentro de la hoja en vez de cortarse
    const url = 'https://tryhackme.com/room/owaspjuiceshopxssadvancedchallenge';
    const p = await open('light', { ...base2(), 'tasks/u1':{ title:url, frontId:'p1', minutes:30, slot:null, date:null, done:false, created:1 } });
    await p.click('text=Elegir tarea principal'); ok(await textFits(p), 'un enlace largo cabe en "Elegir tarea principal"');
    await p.click('[data-act=pick-do] >> nth=0'); await p.waitForTimeout(100); await p.click('.main-task [data-act=task-sheet]');
    ok(await textFits(p), 'un enlace largo cabe en las opciones de la tarea'); ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  }
  // en táctil, con una hoja abierta el fondo no se mueve al arrastrar el dedo; al cerrarla vuelve a moverse desde donde estaba
  const touch = async seed => { const p = await b.newPage({ viewport:{ width:390, height:860 }, hasTouch:true, isMobile:true }); p.setDefaultTimeout(4000); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.clock.setFixedTime(new Date(NOW)); await p.addInitScript(s => { window.__SEED = s; }, seed); await p.goto('file://' + page); await p.waitForSelector('.sec-head'); return p; };
  const p = await touch(seedGoal({ start:add(TODAY, -3), days:28 })); await p.addStyleTag({ content:'main{min-height:3000px}' });
  const cdp = await p.context().newCDPSession(p), sy = () => p.evaluate(() => window.scrollY);
  const settle = async () => { let a = -1, c = await sy(); while (a !== c){ await p.waitForTimeout(120); a = c; c = await sy(); } return c; }; // espera a que termine la inercia
  const drag = async (y, d) => { await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x:195, y }] }); // dedo real: empieza en y y sube d px
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x:195, y:y - d * i / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] }); return settle(); };
  await p.evaluate(() => window.scrollTo(0, 300)); await settle(); await p.tap('[data-act=settings]'); await p.waitForSelector('[data-act=close]');
  const over = () => p.evaluate(() => getComputedStyle(document.documentElement).overflowY);
  ok(await over() === 'hidden', 'con Ajustes abierto la página de atrás queda fija');
  ok(await drag(60, 40) === 300 && await drag(700, 200) === 300, 'arrastrar el dedo sobre el fondo o la hoja no mueve lo de atrás');
  await p.tap('[data-act=close]');
  ok(await over() !== 'hidden' && await sy() === 300, 'al cerrar, la página sigue donde estaba');
  ok(await drag(600, 200) > 300, 'después de cerrar la hoja la página vuelve a desplazarse con el dedo');
  ok(!p.errs.length, 'sin errores ' + p.errs.join('|')); await p.close();
  // el temporizador a pantalla completa también deja quieto el fondo
  const q = await touch({ ...base2(), ...readHabit() }); await q.tap('[data-act=hfocus]');
  ok(await q.evaluate(() => getComputedStyle(document.documentElement).overflowY) === 'hidden', 'con el temporizador abierto el fondo queda fijo');
  await q.tap('[data-act=focus-stop]'); await q.tap('[data-act=focus-finish]'); await q.waitForTimeout(100);
  ok(await q.locator('#focus .focus').count() === 0 && await q.evaluate(() => getComputedStyle(document.documentElement).overflowY) !== 'hidden', 'al cerrar el temporizador se libera');
  ok(!q.errs.length, 'sin errores ' + q.errs.join('|')); await q.close();
}
// escritorio con barra de desplazamiento visible: abrir una hoja no hace saltar la columna
{ const bs = await pw.chromium.launch({ ignoreDefaultArgs:['--hide-scrollbars'] }), p = await bs.newPage({ viewport:{ width:1280, height:800 } });
  await p.clock.setFixedTime(new Date(NOW)); await p.addInitScript(s => { window.__SEED = s; }, seedGoal({ start:add(TODAY, -3), days:28 }));
  await p.goto('file://' + page); await p.waitForSelector('.sec-head'); await p.addStyleTag({ content:'main{min-height:3000px}' });
  const x = () => p.evaluate(() => document.querySelector('main').getBoundingClientRect().x), x0 = await x();
  await p.click('[data-act=settings]'); const x1 = await x(); await p.click('[data-act=close]');
  ok(x0 === x1 && x1 === await x(), `en escritorio la columna no salta al abrir una hoja (${x0} → ${x1})`); await bs.close(); }
// escritorio
{ const p = await open('light', seedGoal({ start:add(TODAY, -16), days:28, levels:pattern(add(TODAY, -16), add(TODAY, -1)) }), 1280);
  await nav(p, 'metas'); await p.screenshot({ path:path.join(out, 'metas-escritorio.png') }); ok(!p.errs.length, 'escritorio sin errores'); await p.close(); }
await b.close();
console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodo bien'); process.exit(fails ? 1 : 0);

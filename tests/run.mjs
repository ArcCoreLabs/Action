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
// escritorio
{ const p = await open('light', seedGoal({ start:add(TODAY, -16), days:28, levels:pattern(add(TODAY, -16), add(TODAY, -1)) }), 1280);
  await nav(p, 'metas'); await p.screenshot({ path:path.join(out, 'metas-escritorio.png') }); ok(!p.errs.length, 'escritorio sin errores'); await p.close(); }
await b.close();
console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodo bien'); process.exit(fails ? 1 : 0);

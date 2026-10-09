// Capturas de todas las vistas con datos realistas. Uso: node tests/vistas.mjs [index.html] [carpeta] → claro y oscuro a 390 px
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = await import('/opt/node-tools/node_modules/playwright/index.mjs'); }
const dir = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(dir, '../index.html'), out = process.argv[3] || path.join(dir, 'out/vistas'); fs.mkdirSync(out, { recursive:true });
const mock = fs.readFileSync(path.join(dir, 'mock.js'), 'utf8'), page = path.join(out, 'vistas.html');
fs.writeFileSync(page, `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style><script>${mock}</script></head><body>${fs.readFileSync(src, 'utf8')}</body></html>`);
const T = '2026-10-08', add = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const log = {}, logR = {}; for (let i = 1; i <= 10; i++){ log[add(T, -i)] = i % 4 ? 'auto' : 'min'; logR[add(T, -i)] = i === 2 ? undefined : 'full'; } log[T] = 'auto';
Object.keys(logR).forEach(k => logR[k] === undefined && delete logR[k]);
const SEED = {
  'fronts/f1':{ name:'CCFA', status:'active', order:1, created:1 }, 'fronts/f2':{ name:'THM Web', status:'active', order:2, created:2 },
  'fronts/f3':{ name:'Leer Dune', status:'active', kind:'habit', order:3, created:3 }, 'fronts/f4':{ name:'Inglés', status:'frozen', order:50, created:4, note:'Después de la CCFA', pauses:[{ from:add(T, -30) }] },
  'tasks/t1':{ title:'Repasar el módulo de detecciones', frontId:'f1', minutes:45, slot:'critical', date:T, done:false, created:1 },
  'tasks/t2':{ title:'Resolver la sala de XSS', frontId:'f2', minutes:60, slot:'secondary', date:T, done:true, doneAt:T, created:2 },
  'tasks/t3':{ title:'Leer la guía de Falcon Fusion', frontId:'f1', minutes:25, slot:'secondary', date:T, done:false, created:3 },
  'tasks/t4':{ title:'Hacer el examen de práctica 1', frontId:'f1', minutes:90, slot:'critical', date:add(T, 1), done:false, created:4 },
  'tasks/t5':{ title:'Tomar notas de IOA vs IOC', frontId:'f1', minutes:45, slot:null, date:null, done:false, created:5 },
  'tasks/t6':{ title:'Sala de SQL injection', frontId:'f2', minutes:45, slot:null, date:null, done:false, created:6 },
  'tasks/t7':{ title:'Llamar al banco', frontId:null, minutes:null, slot:null, date:null, done:false, created:7 },
  'tasks/t8':{ title:'Comprar audífonos', frontId:null, minutes:null, slot:null, date:null, done:false, created:8 },
  'habits/h1':{ name:'CCFA', minimum:'15 min', standard:'45 min', days:[1,2,3,4,5], frontId:'f1', log, order:1, created:add(T, -20) },
  'habits/h2':{ name:'Leer Dune', minutes:20, minMinutes:5, minimum:'5 min', standard:'20 min', days:[0,1,2,3,4,5,6], frontId:'f3', log:logR, time:{ [T]:6 }, order:2, created:add(T, -12) },
  'goals/g1':{ frontId:'f1', title:'Aprobar la CCFA', start:add(T, -17), deadline:add(T, 10), why:'Me lo pidió la empresa', minimum:'15 min', standard:'45 min',
    weekly:[{ text:'Terminar los módulos 1 y 2', done:true }, { text:'Laboratorio de detecciones', done:true }, { text:'Examen de práctica', done:false }, { text:'Repaso final', done:false }], premortem:[], created:1 },
  'goals/g2':{ frontId:'f3', title:'Terminar Dune', start:add(T, -12), deadline:add(T, 8), weekly:[], premortem:[], created:2 },
  'reviews/2026-09-28':{ done:'Terminé el módulo 1', blocked:'Llegué tarde del trabajo', change:'Estudiar antes de cenar', closed:true },
  'meta/settings':{ vision:'Trabajar en ciberseguridad de forma independiente', fixedTime:'19:30', planBTime:'21:00' }, 'meta/focus':{ days:{ [T]:45, [add(T, -1)]:60 } }
};
const b = await pw.chromium.launch();
for (const scheme of ['light', 'dark']){
  const p = await b.newPage({ viewport:{ width:390, height:860 }, colorScheme:scheme }); p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date(T + 'T18:00:00'));
  await p.addInitScript(s => { window.__SEED = s; }, SEED);
  await p.goto('file://' + page); await p.waitForSelector('.sec-head');
  for (const v of ['hoy', 'bandeja', 'frentes', 'metas', 'semana']){
    await p.click(`#nav [data-v=${v}]`); await p.waitForTimeout(80);
    await p.screenshot({ path:path.join(out, `${v}-${scheme}.png`), fullPage:true });
  }
  await p.click('#nav [data-v=hoy]'); await p.click('.main-task [data-act=task-sheet]'); await p.waitForTimeout(60);
  await p.screenshot({ path:path.join(out, `hoja-${scheme}.png`) });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(scheme, 'scrollWidth', sw, errs.length ? 'ERRORES: ' + errs.join(' | ') : 'sin errores');
  await p.close();
}
await b.close();

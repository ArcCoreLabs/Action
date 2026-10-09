// mock.js: db en memoria compatible con lo que usa la app (MEJORAS.md, sección 4)
(function(){
  const store = Object.assign({}, window.__SEED || {}), subs = []; // __SEED: datos iniciales opcionales para las pruebas
  const notify = () => subs.forEach(f => f());
  const mk = p => ({ id:p.split('/').pop(), exists:!!store[p], data:() => store[p] && JSON.parse(JSON.stringify(store[p])), metadata:{} });
  const db = {
    collection: c => ({ onSnapshot(next){ const f = () => { const docs = Object.keys(store).filter(k => k.startsWith(c+'/') && k.split('/').length === 2).map(mk); next({docs, size:docs.length, empty:!docs.length}); }; subs.push(f); setTimeout(f, 10); return () => {}; } }),
    // window.__FAILAT = n: la escritura número n falla con quota_exceeded (para probar restauraciones a medias)
    doc: p => ({ set(d){ if (window.__FAILAT !== undefined && (window.__SETS = (window.__SETS || 0) + 1) === window.__FAILAT) return Promise.reject({ code:'quota_exceeded', message:'lleno' });
                 store[p] = JSON.parse(JSON.stringify(d)); setTimeout(notify); return Promise.resolve(); },
                 delete(){ delete store[p]; setTimeout(notify); return Promise.resolve(); },
                 onSnapshot(next){ const f = () => next(mk(p)); subs.push(f); setTimeout(f, 10); return () => {}; } })
  };
  // downloads simulado: guarda en window.__saved lo que la app ofrece descargar (window.__NODL = true lo apaga)
  const dl = { save: async ({ filename, data }) => { window.__saved = { filename, data:String(data) }; return { status:'saved' }; } };
  window.claude = { use: async n => n === 'db' ? db : n === 'downloads' && !window.__NODL ? dl : null };
  window.__store = store;
})();

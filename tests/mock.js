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

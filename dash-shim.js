// Substitui a API `dash` do painel do Claude, para que painel.js rode igual dentro do app.
// app.js entrega os dados com dash._set('fretes', {...}) e o painel se redesenha.
(function () {
  const calcs = new Map();
  const listeners = [];
  const datasets = {};
  let params = {};
  let defaults = {};

  const run = () => {
    for (const fn of listeners) {
      try { fn(); } catch (e) { console.error(e); }
    }
  };

  window.dash = {
    colors: ['#3b82f6', '#8b93ff', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#fb7185', '#a78bfa'],
    data(id) {
      if (datasets[id]) return datasets[id];
      const c = calcs.get(id);
      if (c) {
        const ins = c.inputs.map((i) => window.dash.data(i));
        const pendente = ins.find((x) => x.status !== 'ok');
        if (pendente) return { status: pendente.status, data: [] };
        try {
          return { status: 'ok', data: c.fn(...ins.map((x) => x.data)) };
        } catch (e) {
          console.error(e);
          return { status: 'error', data: [], message: String(e) };
        }
      }
      return { status: 'loading', data: [] };
    },
    calc(id, def) { calcs.set(id, def); },
    loader() {},
    onData(fn) {
      listeners.push(fn);
      try { fn(); } catch (e) { console.error(e); }
    },
    params() { return { ...params }; },
    setParams(p) { Object.assign(params, p); run(); },
    resetParams() { params = { ...defaults }; run(); },
    refresh() {},
    setLink() {},
    _set(id, value) { datasets[id] = value; run(); },
    _redraw: run,
  };

  let largura = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth !== largura) { largura = window.innerWidth; run(); }
  });
})();

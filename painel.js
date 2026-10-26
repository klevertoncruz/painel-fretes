// Lógica do painel (mesma do painel publicado no Claude). Usa o objeto global `dash` de dash-shim.js.

  dash.calc('periodo', {
    title: 'Período da exportação',
    description: 'Primeira e última data de saída na exportação.',
    inputs: ['fretes'],
    fn: (fretes) => {
      const datas = fretes.map((r) => r.data).sort();
      return [{ inicio: datas[0], fim: datas[datas.length - 1], linhas: fretes.length }];
    },
  });

  // o arquivo chega como texto: converte números e a marca de frota própria
  const numericos = ['linha', 'km_previsto', 'km_realizado', 'dispersao_km_pct', 'peso_kg', 'entregas', 'pernoites', 'valor_carga', 'frete_tabela', 'frete_manual', 'frete_total', 'custo_carga_pct'];
  const norm = (r) => {
    const o = { ...r };
    for (const c of numericos) o[c] = o[c] === '' || o[c] == null ? null : Number(o[c]);
    o.frota_propria = r.frota_propria === true || r.frota_propria === 'sim';
    o.observacao = r.observacao || null;
    for (const c of ['frota', 'transportador', 'rota', 'motorista', 'carregamento']) o[c] = String(r[c] ?? '').trim().replace(/\s+/g, ' ');
    return o;
  };

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const int = new Intl.NumberFormat('pt-BR');
  const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dataBR = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
  const dia = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const opt = (v, f) => v == null || !isFinite(v) ? '—' : f.format(v);
  const fmt = {
    frete_total: (v) => brl.format(v), viagens: (v) => int.format(v), entregas: (v) => int.format(v), km: (v) => int.format(Math.round(v)) + ' km', pct_frete_carga: (v) => opt(v, pct),
    r_km: (v) => opt(v, brl), r_entrega: (v) => opt(v, brl), r_ton: (v) => opt(v, brl),
  };

  // soma as viagens de agregados (com frete) de um grupo de linhas
  const totais = (rows) => {
    const soma = (f) => rows.reduce((s, r) => s + (r[f] || 0), 0);
    const frete = soma('frete_total'), carga = soma('valor_carga'), km = soma('km_realizado'), entregas = soma('entregas'), peso = soma('peso_kg');
    return {
      viagens: rows.length, frete_total: frete, valor_carga: carga, km, entregas, pernoites: soma('pernoites'),
      veiculos: new Set(rows.map((r) => r.frota)).size,
      pct_frete_carga: carga ? frete / carga : null, r_km: km ? frete / km : null,
      r_entrega: entregas ? frete / entregas : null, r_ton: peso ? frete / (peso / 1000) : null,
      frete_medio: rows.length ? frete / rows.length : null,
    };
  };
  const agrupa = (rows, campo) => [...d3.group(rows, (r) => r[campo])].map(([k, g]) => ({ [campo]: k, ...totais(g) }));

  // filtro de datas
  const de = document.getElementById('fq-de'), ate = document.getElementById('fq-ate');
  const mostraDatas = () => {
    if (de !== document.activeElement) de.value = dash.params().inicio ?? '';
    if (ate !== document.activeElement) ate.value = dash.params().fim ?? '';
  };
  de.addEventListener('change', () => { if (de.value && de.validity.valid) dash.setParams({ inicio: de.value }); });
  ate.addEventListener('change', () => { if (ate.value && ate.validity.valid) dash.setParams({ fim: ate.value }); });
  de.addEventListener('blur', mostraDatas);
  ate.addEventListener('blur', mostraDatas);
  document.getElementById('fq-tudo').addEventListener('click', () => dash.resetParams());
  const intervalo = (per) => {
    let ini = dash.params().inicio || per.inicio, fim = dash.params().fim || per.fim;
    if (ini > fim) [ini, fim] = [fim, ini];
    return [ini, fim];
  };

  const failLine = (el) => {
    const d = document.createElement('div'); d.className = 'fq-fail'; d.textContent = 'Failed to load';
    if (el.tagName === 'TBODY') { const tr = document.createElement('tr'); const c = document.createElement('td'); c.colSpan = 9; c.append(d); tr.append(c); el.replaceChildren(tr); } else el.replaceChildren(d);
  };

  // ordenação das tabelas
  const sortState = {
    'fq-rota': { key: 'r_km', dir: -1 },
    'fq-oc': { key: 'data', dir: -1 },
  };
  const textos = ['transportador', 'rota', 'motorista', 'observacao', 'data'];
  let redraw = () => {};
  for (const id of Object.keys(sortState)) {
    document.getElementById(id).querySelector('thead').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-sort]');
      if (!b) return;
      const s = sortState[id];
      if (s.key === b.dataset.sort) s.dir = -s.dir; else { s.key = b.dataset.sort; s.dir = textos.includes(s.key) && s.key !== 'data' ? 1 : -1; }
      redraw();
    });
  }
  const sortRows = (id, rows) => {
    const { key, dir } = sortState[id];
    document.getElementById(id).querySelectorAll('th').forEach((th) => {
      const b = th.querySelector('button');
      if (b && b.dataset.sort === key) th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort');
    });
    return rows.slice().sort((a, b) => {
      const x = a[key], y = b[key];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * dir;
    });
  };
  const td = (text, cls) => { const c = document.createElement('td'); c.textContent = text; if (cls) c.className = cls; return c; };
  const barCell = (v, max, text) => {
    const c = document.createElement('td');
    const w = document.createElement('div'); w.className = 'fq-cellbar';
    const i = document.createElement('i'); i.style.width = (max ? Math.max(2, (v / max) * 100) : 0) + '%'; i.style.background = 'var(--nv-accent)';
    const s = document.createElement('span'); s.textContent = text;
    w.append(i, s); c.append(w); return c;
  };

  // copiar fechamento para o Excel
  let fechAtual = [], faixaAtual = ['', ''];
  const btnCopiar = document.getElementById('fq-copiar');
  btnCopiar.addEventListener('click', () => {
    const n2 = (v) => v == null ? '' : v.toFixed(2).replace('.', ',');
    const n0 = (v) => v == null ? '' : String(Math.round(v));
    const linhas = [['Fechamento de ' + dataBR(faixaAtual[0]) + ' a ' + dataBR(faixaAtual[1])],
      ['Transportador', 'Data saída', 'Nº carga', 'Frota', 'Rota', 'Km previsto', 'Km rodado', 'Dispersão (%)', 'Peso (kg)', 'Valor carga (R$)', 'Entregas', 'Frete s/ diesel (R$)', 'Frete manual (R$)', 'Valor total frete (R$)']];
    for (const g of fechAtual) {
      for (const x of g.viagens) linhas.push([x.transportador, dataBR(x.data), x.carregamento, x.frota, x.rota, n0(x.km_previsto), n0(x.km_realizado), n2(x.dispersao_km_pct), n0(x.peso_kg), n2(x.valor_carga), n0(x.entregas), n2(x.frete_tabela), n2(x.frete_manual), n2(x.frete_total)]);
      linhas.push(['Subtotal ' + g.nome, '', g.viagens.length + ' viagens', '', '', n0(g.t.km_prev), n0(g.t.km), '', n0(g.t.peso), n2(g.t.carga), n0(g.t.entregas), '', '', n2(g.t.frete)]);
    }
    const texto = linhas.map((l) => l.join('\t')).join('\n');
    const ok = () => { btnCopiar.textContent = 'Copiado'; setTimeout(() => { btnCopiar.textContent = 'Copiar tabela'; }, 2000); };
    try {
      navigator.clipboard.writeText(texto).then(ok, () => { btnCopiar.textContent = 'Não foi possível copiar'; });
    } catch (e) { btnCopiar.textContent = 'Não foi possível copiar'; }
  });
  document.getElementById('fq-export').addEventListener('click', () => btnCopiar.click());
  const agSel = document.getElementById('fq-ag'), frotaSel = document.getElementById('fq-frota');
  agSel.addEventListener('change', () => redraw());
  frotaSel.addEventListener('change', () => redraw());
  document.getElementById('fq-limpa').addEventListener('click', () => { agSel.value = ''; frotaSel.value = ''; redraw(); });
  const preenche = (el, todosRotulo, valores) => {
    const atual = valores.includes(el.value) ? el.value : '';
    el.replaceChildren(new Option(todosRotulo, ''), ...valores.map((v) => new Option(v, v)));
    el.value = atual;
    return atual;
  };

  function desenhaDia(rows, ini, fim) {
    const box = document.getElementById('fq-dia');
    box.replaceChildren();
    const W = box.clientWidth;
    if (!W || !rows.length) return;
    const H = 240;
    const max = d3.max(rows, (d) => d.frete_total);
    const y = d3.scaleLinear([0, max], [H - 28, 8]).nice();
    const ticks = y.ticks(4);
    const tk = (v) => v >= 1000 ? 'R$ ' + int.format(v / 1000) + ' mil' : 'R$ ' + int.format(v);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const probe = svg.append('g');
    let left = 0;
    for (const t of ticks) { const n = probe.append('text').style('font-size', 'var(--cds-font-size-caption)').text(tk(t)); left = Math.max(left, n.node().getComputedTextLength()); }
    probe.remove();
    left = Math.ceil(left) + 10;
    const x = d3.scaleBand(rows.map((d) => d.data), [left, W - 4]).padding(0.25);
    const g = svg.append('g');
    g.selectAll('line').data(ticks).join('line').attr('x1', left).attr('x2', W - 4).attr('y1', (t) => y(t)).attr('y2', (t) => y(t)).attr('stroke', 'var(--nv-grid)');
    g.selectAll('text').data(ticks).join('text').attr('x', left - 8).attr('y', (t) => y(t)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', 'var(--nv-muted)').style('font-size', 'var(--cds-font-size-caption)').text(tk);
    const ativo = (d) => d.data >= ini && d.data <= fim;
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (d) => x(d.data)).attr('width', x.bandwidth()).attr('y', (d) => y(d.frete_total)).attr('height', (d) => y(0) - y(d.frete_total))
      .attr('rx', 4).attr('fill', (d) => ativo(d) ? 'var(--nv-accent)' : 'var(--nv-mutedbar)');
    svg.append('line').attr('x1', left).attr('x2', W - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--nv-line)');
    const every = Math.max(1, Math.ceil(42 / x.step()));
    svg.append('g').selectAll('text').data(rows.filter((d, i) => i % every === 0)).join('text')
      .attr('x', (d) => x(d.data) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle')
      .attr('fill', 'var(--nv-muted)').style('font-size', 'var(--cds-font-size-caption)').text((d) => dia(d.data));
    const tip = document.createElement('div'); tip.className = 'fq-tip'; tip.hidden = true; box.append(tip);
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (d) => x(d.data) - (x.step() - x.bandwidth()) / 2).attr('width', x.step()).attr('y', 0).attr('height', H - 20).attr('fill', 'transparent')
      .on('mousemove', (ev, d) => {
        const e = document.createElement('em'); e.textContent = dataBR(d.data);
        const l = document.createElement('div'); l.textContent = brl.format(d.frete_total) + ' em ' + d.viagens + ' viagens';
        tip.replaceChildren(e, l); tip.hidden = false;
        const [mx, my] = d3.pointer(ev, box);
        tip.style.left = Math.min(Math.max(0, mx + 12), W - tip.offsetWidth) + 'px';
        tip.style.top = Math.max(0, my - 48) + 'px';
      })
      .on('mouseleave', () => { tip.hidden = true; });
  }

  const draw = () => {
    mostraDatas();
    const fretes = dash.data('fretes'), per = dash.data('periodo');
    const take = document.getElementById('fq-take');
    const tf = document.querySelector('#fq-fech tbody'), trota = document.querySelector('#fq-rota tbody'), toc = document.querySelector('#fq-oc tbody');
    const box = document.getElementById('fq-dia');

    if (fretes.status === 'error') {
      take.classList.remove('dash-skeleton'); take.textContent = '—';
      document.querySelectorAll('#indicadores b').forEach((b) => { b.classList.remove('dash-skeleton'); b.textContent = '—'; });
      [tf, trota, toc, box].forEach(failLine);
      return;
    }
    if (fretes.status !== 'ok' || per.status !== 'ok') { box.replaceChildren(); return; }

    const p = per.data[0];
    document.getElementById('fq-ini').textContent = dataBR(p.inicio);
    document.getElementById('fq-fim').textContent = dataBR(p.fim);
    for (const el of [de, ate]) { el.min = p.inicio; el.max = p.fim; }
    const [ini, fim] = intervalo(p);
    faixaAtual = [ini, fim];
    if (!dash.params().inicio && de !== document.activeElement) de.value = ini;
    if (!dash.params().fim && ate !== document.activeElement) ate.value = fim;

    const base = fretes.data.map(norm);
    const doPeriodo = base.filter((r) => r.data >= ini && r.data <= fim);
    const ordena = (xs) => [...new Set(xs)].sort((x, y) => x.localeCompare(y, 'pt-BR'));
    const transp = preenche(agSel, 'Todos', ordena(doPeriodo.map((r) => r.transportador)));
    const frota = preenche(frotaSel, 'Todas', ordena(doPeriodo.filter((r) => !transp || r.transportador === transp).map((r) => r.frota)));
    const linhas = base.filter((r) => (!transp || r.transportador === transp) && (!frota || r.frota === frota));
    const todos = linhas.filter((r) => !r.frota_propria && r.frete_total != null);
    const noPeriodo = (r) => r.data >= ini && r.data <= fim;
    const sel = todos.filter(noPeriodo);
    const t = totais(sel);
    document.getElementById('fq-reg').textContent = int.format(sel.length);

    // indicadores
    document.querySelectorAll('#indicadores b').forEach((b) => { b.classList.remove('dash-skeleton'); b.textContent = fmt[b.dataset.k](t[b.dataset.k]); });
    const kmFF = d3.sum(linhas.filter((r) => r.frota_propria && noPeriodo(r)), (r) => r.km_realizado || 0);
    document.getElementById('fq-km-ff').textContent = 'Agregados. Frota própria: ' + int.format(Math.round(kmFF)) + ' km';
    document.getElementById('fq-ff').textContent = int.format(linhas.filter((r) => r.frota_propria && noPeriodo(r)).length);

    // fechamento detalhado por agregado
    const fech = agrupa(sel, 'transportador');
    const nomes = fech.map((x) => x.transportador).sort((x, y) => x.localeCompare(y, 'pt-BR'));
    const subt = (vs) => ({
      km_prev: d3.sum(vs, (r) => r.km_previsto || 0), km: d3.sum(vs, (r) => r.km_realizado || 0), peso: d3.sum(vs, (r) => r.peso_kg || 0),
      carga: d3.sum(vs, (r) => r.valor_carga || 0), entregas: d3.sum(vs, (r) => r.entregas || 0), frete: d3.sum(vs, (r) => r.frete_total || 0),
    });
    fechAtual = nomes.map((nome) => {
      const vs = sel.filter((r) => r.transportador === nome).sort((x, y) => x.data.localeCompare(y.data) || x.linha - y.linha);
      return { nome, viagens: vs, t: subt(vs) };
    });
    const num0 = (v) => v == null ? '—' : int.format(Math.round(v));
    const brlOpt = (v) => v == null ? '—' : brl.format(v);
    const linhaTot = (cls, rotulo, t) => {
      const tr = document.createElement('tr'); tr.className = cls;
      const c = td(rotulo, 'fq-l'); c.colSpan = 4;
      tr.append(c, td(num0(t.km_prev)), td(num0(t.km)), td(''), td(num0(t.peso)), td(brl.format(t.carga)), td(num0(t.entregas)), td(''), td(''), td(brl.format(t.frete)));
      return tr;
    };
    const corpo = [];
    for (const g of fechAtual) {
      const h = document.createElement('tr'); h.className = 'fq-grp';
      const c = td(g.nome + ' · ' + int.format(g.viagens.length) + (g.viagens.length === 1 ? ' viagem' : ' viagens')); c.colSpan = 13; h.append(c);
      corpo.push(h);
      for (const x of g.viagens) {
        const tr = document.createElement('tr'); tr.dataset.key = String(x.linha);
        const d = x.dispersao_km_pct;
        tr.append(td(dataBR(x.data), 'fq-l'), td(x.carregamento, 'fq-l'), td(x.frota, 'fq-l'), td(x.rota, 'fq-l'),
          td(num0(x.km_previsto)), td(num0(x.km_realizado)),
          td(d == null ? '—' : int.format(d) + '%', d >= 50 ? 'fq-bad' : d >= 30 ? 'fq-warn' : ''),
          td(num0(x.peso_kg)), td(brlOpt(x.valor_carga)), td(num0(x.entregas)),
          td(brlOpt(x.frete_tabela)), td(brlOpt(x.frete_manual)), td(brl.format(x.frete_total)));
        corpo.push(tr);
      }
      corpo.push(linhaTot('fq-sub', 'Subtotal ' + g.nome, g.t));
    }
    if (fechAtual.length > 1) corpo.push(linhaTot('fq-tot', 'Total geral', subt(fechAtual.flatMap((g) => g.viagens))));
    tf.replaceChildren(...corpo);

    // rankings por veículo
    const porFrota = [...d3.group(sel, (r) => r.frota)].map(([fr, vs]) => {
      const comPrev = vs.filter((r) => r.km_previsto && r.km_realizado != null);
      const kmPrev = d3.sum(comPrev, (r) => r.km_previsto), kmReal = d3.sum(comPrev, (r) => r.km_realizado);
      const frete = d3.sum(vs, (r) => r.frete_total), carga = d3.sum(vs, (r) => r.valor_carga || 0);
      return {
        frota: fr, transportador: ordena(vs.map((r) => r.transportador)).join(', '), viagens: vs.length,
        pernoites: d3.sum(vs, (r) => r.pernoites || 0), comPernoite: vs.filter((r) => r.pernoites > 0).length,
        kmPrev, kmReal, kmMais: kmReal - kmPrev, pctPernoite: vs.length ? vs.filter((r) => r.pernoites > 0).length / vs.length : null, disp: kmPrev ? (kmReal - kmPrev) / kmPrev : null,
        frete, carga, custo: carga ? frete / carga : null,
      };
    });
    const rk = (id, rows, valor, cells, barra) => {
      const max = d3.max(rows, valor);
      document.getElementById(id).replaceChildren(...rows.map((x, i) => {
        const tr = document.createElement('tr');
        const f = td(x.frota, 'fq-l'); const sm = document.createElement('small'); sm.textContent = x.transportador; f.append(sm);
        tr.append(td(String(i + 1), 'fq-l'), f, ...cells(x), barCell(Math.max(0, valor(x)), max > 0 ? max : 0, barra(x)));
        return tr;
      }));
    };
    rk('rk-pern', porFrota.filter((x) => x.pernoites > 0).sort((a, b) => b.pernoites - a.pernoites || b.comPernoite - a.comPernoite),
      (x) => x.pernoites, (x) => [td(int.format(x.viagens)), td(int.format(x.comPernoite)), td(pct.format(x.pctPernoite))], (x) => int.format(x.pernoites));
    rk('rk-disp', porFrota.filter((x) => x.disp != null).sort((a, b) => b.disp - a.disp),
      (x) => x.disp, (x) => [td(int.format(x.viagens)), td(int.format(Math.round(x.kmPrev))), td(int.format(Math.round(x.kmReal)))], (x) => pct.format(x.disp));
    rk('rk-cust', porFrota.filter((x) => x.custo != null).sort((a, b) => b.custo - a.custo),
      (x) => x.custo, (x) => [td(brl0.format(x.frete)), td(brl0.format(x.carga))], (x) => pct.format(x.custo));

    // frase de resumo
    take.classList.remove('dash-skeleton');
    const top = fech.slice().sort((a, b) => b.frete_total - a.frete_total)[0];
    const b = (text) => { const el = document.createElement('b'); el.textContent = text; return el; };
    const parts = ['De ' + dataBR(ini) + ' a ' + dataBR(fim) + ', o frete dos agregados somou ', b(brl.format(t.frete_total)), ' em ',
      b(int.format(t.viagens)), ' viagens, o equivalente a ', b(opt(t.pct_frete_carga, pct)), ' do valor da carga transportada.'];
    if (top && t.frete_total) parts.push(' O maior valor a pagar é de ', b(top.transportador), ', com ', b(pct.format(top.frete_total / t.frete_total)), ' do total.');
    if (!sel.length) parts.splice(0, parts.length, 'Nenhuma viagem de agregado entre ' + dataBR(ini) + ' e ' + dataBR(fim) + '.');
    take.replaceChildren(...parts);

    // rotas
    const rotas = sortRows('fq-rota', agrupa(sel, 'rota'));
    trota.replaceChildren(...rotas.map((x) => {
      const tr = document.createElement('tr');
      tr.append(td(x.rota, 'fq-l'), td(int.format(x.viagens)), td(opt(x.frete_medio, brl0)), td(opt(x.r_km, brl)), td(opt(x.pct_frete_carga, pct)), td(brl.format(x.frete_total)));
      return tr;
    }));

    // gráfico por dia (todas as datas, período escolhido em destaque)
    const dias = [...d3.rollup(todos, (g) => ({ frete_total: d3.sum(g, (r) => r.frete_total), viagens: g.length }), (r) => r.data)]
      .map(([data, v]) => ({ data, ...v })).sort((a, b) => a.data.localeCompare(b.data));
    desenhaDia(dias, ini, fim);

    // ocorrências
    const oc = sortRows('fq-oc', sel.filter((x) => x.observacao || (x.dispersao_km_pct != null && x.dispersao_km_pct >= 30)));
    toc.replaceChildren(...oc.map((x) => {
      const tr = document.createElement('tr'); tr.dataset.key = String(x.linha);
      const desvio = x.dispersao_km_pct == null ? '—' : int.format(x.dispersao_km_pct) + '%';
      tr.append(td(dataBR(x.data), 'fq-l'), td(x.transportador, 'fq-l'), td(x.motorista, 'fq-l'), td(x.rota, 'fq-l'),
        td(x.km_previsto == null ? '—' : int.format(x.km_previsto)), td(x.km_realizado == null ? '—' : int.format(x.km_realizado)),
        td(desvio, x.dispersao_km_pct >= 50 ? 'fq-bad' : x.dispersao_km_pct >= 30 ? 'fq-warn' : ''),
        td(brl.format(x.frete_total)), td(x.observacao || '', 'fq-wrap'));
      return tr;
    }));
  };
  dash.onData(draw);
  redraw = draw;

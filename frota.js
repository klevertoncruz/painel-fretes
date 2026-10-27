// Aba "Frota própria": viagens das placas FF (FROTA MERVIL), que não entram no fechamento dos agregados.
// Mostra peso, km rodado, dispersão do km programado, viagens, entregas e pernoites, no total e por veículo.

const $ = (id) => document.getElementById(id);
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pctF = (x, sinal = false) => (x == null || !isFinite(x) ? '—' : (sinal && x > 0 ? '+' : '') + dec1.format(x * 100) + '%');
const br = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Totais de um conjunto de viagens da frota própria. Dispersão = km rodado ÷ km programado − 1,
// só nas viagens com os dois km (como no ranking de dispersão do painel).
export function totaisFrota(rs) {
  const soma = (f, xs = rs) => xs.reduce((t, r) => t + (Number(r[f]) || 0), 0);
  const comKm = rs.filter((r) => r.km_previsto > 0 && r.km_realizado != null);
  const o = {
    viagens: rs.length, km: soma('km_realizado'), km_prev: soma('km_previsto'), peso: soma('peso_kg'), entregas: soma('entregas'),
    pernoites: soma('pernoites'), com_pernoite: rs.filter((r) => (r.pernoites || 0) > 0).length,
    km_prev_comp: soma('km_previsto', comKm), km_real_comp: soma('km_realizado', comKm),
  };
  o.dispersao = o.km_prev_comp ? o.km_real_comp / o.km_prev_comp - 1 : null;
  o.media_entregas = o.viagens ? o.entregas / o.viagens : null;
  o.peso_medio = o.viagens ? o.peso / o.viagens : null;
  o.km_medio = o.viagens ? o.km / o.viagens : null;
  o.pct_pernoite = o.viagens ? o.com_pernoite / o.viagens : null;
  return o;
}

export const viagensFrota = (linhas, de, ate) => linhas.filter((r) => r.frota_propria && r.data && r.data >= de && r.data <= ate);

export function porVeiculo(rs) {
  const g = new Map();
  for (const r of rs) { const k = r.frota || '—'; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  return [...g].map(([frota, vs]) => ({ frota, motoristas: [...new Set(vs.map((r) => r.motorista).filter(Boolean))].join(', '), ...totaisFrota(vs) }))
    .sort((a, b) => b.viagens - a.viagens || b.km - a.km);
}

export function iniciarFrota() {
  const raiz = $('aba-frota');
  if (!raiz) return;
  let linhas = [];

  const desenhar = () => {
    const ff = linhas.filter((r) => r.frota_propria && r.data);
    if (!ff.length) { $('ff-resumo').textContent = 'Nenhuma viagem da frota própria (placas FF) na base.'; return; }
    const datas = ff.map((r) => r.data).sort();
    if (!$('ff-de').value) $('ff-de').value = datas[0];
    if (!$('ff-ate').value) $('ff-ate').value = datas[datas.length - 1];
    const de = $('ff-de').value, ate = $('ff-ate').value;
    const noPer = viagensFrota(linhas, de, ate);
    const sel = $('ff-frota'), antes = sel.value;
    const placas = [...new Set(noPer.map((r) => r.frota))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    sel.innerHTML = '<option value="">Todas</option>' + placas.map((p) => `<option${p === antes ? ' selected' : ''}>${esc(p)}</option>`).join('');
    const rs = noPer.filter((r) => !sel.value || r.frota === sel.value);
    const t = totaisFrota(rs);

    $('ff-resumo').textContent = `De ${br(de)} a ${br(ate)}, a frota própria fez ${int.format(t.viagens)} viagens, rodou ${int.format(t.km)} km e levou ${dec1.format(t.peso / 1000)} t em ${int.format(t.entregas)} entregas.`;
    const ind = {
      viagens: int.format(t.viagens), km: int.format(t.km) + ' km', peso: dec1.format(t.peso / 1000) + ' t', entregas: int.format(t.entregas),
      dispersao: pctF(t.dispersao, true), media_entregas: t.media_entregas == null ? '—' : dec1.format(t.media_entregas),
      peso_medio: t.peso_medio == null ? '—' : int.format(t.peso_medio) + ' kg', pernoite: pctF(t.pct_pernoite),
    };
    raiz.querySelectorAll('[data-ff]').forEach((b) => { b.textContent = ind[b.dataset.ff]; });
    $('ff-km-prev').textContent = `Km programado ${int.format(t.km_prev_comp)} · rodado ${int.format(t.km_real_comp)}`;
    $('ff-pern-det').textContent = `${int.format(t.com_pernoite)} de ${int.format(t.viagens)} cargas · ${int.format(t.pernoites)} pernoites`;

    const tdn = (v, cls = '') => `<td class="${cls}">${v}</td>`;
    const linhaV = (x, cls = '') => `<tr class="${cls}">${tdn(esc(x.frota) + (x.motoristas ? `<small>${esc(x.motoristas)}</small>` : ''), 'fq-l')}${tdn(int.format(x.viagens))}${tdn(int.format(x.km_prev))}${tdn(int.format(x.km))}${tdn(pctF(x.dispersao, true), x.dispersao > 0.1 ? 'fq-warn' : '')}${tdn(int.format(x.peso))}${tdn(x.peso_medio == null ? '—' : int.format(x.peso_medio))}${tdn(int.format(x.entregas))}${tdn(x.media_entregas == null ? '—' : dec1.format(x.media_entregas))}${tdn(int.format(x.com_pernoite))}${tdn(pctF(x.pct_pernoite))}</tr>`;
    const vs = porVeiculo(rs);
    $('ff-veic').innerHTML = vs.map((x) => linhaV(x)).join('') + (vs.length > 1 ? linhaV({ frota: 'Total', motoristas: '', ...t }, 'fq-tot') : '');

    $('ff-viag').innerHTML = [...rs].sort((a, b) => b.data.localeCompare(a.data) || String(a.frota).localeCompare(String(b.frota))).map((r) => {
      const disp = r.km_previsto > 0 && r.km_realizado != null ? r.km_realizado / r.km_previsto - 1 : null;
      return `<tr>${tdn(br(r.data), 'fq-l')}${tdn(esc(r.carregamento), 'fq-l')}${tdn(esc(r.frota), 'fq-l')}${tdn(esc(r.motorista), 'fq-l')}${tdn(esc(r.rota), 'fq-l')}${tdn(r.km_previsto == null ? '—' : int.format(r.km_previsto))}${tdn(r.km_realizado == null ? '—' : int.format(r.km_realizado))}${tdn(pctF(disp, true), disp > 0.3 ? 'fq-warn' : '')}${tdn(r.peso_kg == null ? '—' : int.format(r.peso_kg))}${tdn(r.entregas == null ? '—' : int.format(r.entregas))}${tdn(int.format(r.pernoites || 0))}</tr>`;
    }).join('');
    $('ff-qtd').textContent = int.format(rs.length);
  };

  window.dash.onData(() => {
    const d = window.dash.data('fretes');
    if (d.status !== 'ok' || d.data === linhas) return;
    linhas = d.data;
    if (!raiz.hidden) desenhar();
  });
  raiz.addEventListener('ff-abrir', desenhar);
  for (const id of ['ff-de', 'ff-ate', 'ff-frota']) $(id).addEventListener('change', desenhar);
  $('ff-tudo').addEventListener('click', () => { $('ff-de').value = ''; $('ff-ate').value = ''; $('ff-frota').value = ''; desenhar(); });
  $('ff-excel').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet($('ff-tab-veic'), { raw: false }), 'Por veículo');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet($('ff-tab-viag'), { raw: false }), 'Viagens');
    XLSX.writeFile(wb, `frota_propria_${$('ff-de').value}_a_${$('ff-ate').value}.xlsx`);
  });
}

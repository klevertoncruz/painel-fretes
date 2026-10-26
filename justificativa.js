// Aba "Justificativa de custos": monta, mês a mês, os slides da prestação de contas da conta de frete
// (orçado x realizado, volume x reajuste, indicadores da operação) a partir da base de fretes e dos
// números do orçamento que o administrador digita. Os números digitados ficam em justificativas/{AAAA-MM}.
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (x, sinal = true) => (x == null || !isFinite(x) ? '—' : (sinal && x > 0 ? '+' : '') + dec1.format(x * 100) + '%');
const R = (x) => (x == null || !isFinite(x) ? '—' : brl.format(x));
const N = (x) => (x == null || !isFinite(x) ? '—' : int.format(x));
const T = (kg) => (kg == null || !isFinite(kg) ? '—' : dec1.format(kg / 1000) + ' t');
const varr = (a, b) => (a && b != null ? b / a - 1 : null);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// "359.189,87" → 359189.87 ; vazio → null
export function numeroBR(v) {
  let s = String(v ?? '').replace(/R\$|%|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m) => (m ? MESES[Number(m.slice(5, 7)) - 1] + '/' + m.slice(0, 4) : '');
const mesAnterior = (m) => {
  const [a, b] = m.split('-').map(Number);
  return b === 1 ? `${a - 1}-12` : `${a}-${String(b - 1).padStart(2, '0')}`;
};

// Indicadores de um mês, com as mesmas regras do painel: só agregados com valor de frete.
export function resumoMes(linhas, mes) {
  const rs = linhas.filter((r) => !r.frota_propria && r.data && r.data.startsWith(mes) && (r.frete_total || 0) > 0);
  const soma = (f) => rs.reduce((t, r) => t + (Number(r[f]) || 0), 0);
  const comKm = rs.filter((r) => r.km_previsto > 0 && r.km_realizado != null);
  const o = {
    mes, viagens: rs.length, frete: soma('frete_total'), peso: soma('peso_kg'), km: soma('km_realizado'),
    entregas: soma('entregas'), valor_carga: soma('valor_carga'),
    com_pernoite: rs.filter((r) => (r.pernoites || 0) > 0).length,
    km_prev: comKm.reduce((t, r) => t + r.km_previsto, 0), km_real_comp: comKm.reduce((t, r) => t + r.km_realizado, 0),
    linhas: rs,
  };
  o.medio = o.viagens ? o.frete / o.viagens : null;
  o.r_km = o.km ? o.frete / o.km : null;
  o.r_entrega = o.entregas ? o.frete / o.entregas : null;
  o.r_ton = o.peso ? o.frete / (o.peso / 1000) : null;
  o.pct_carga = o.valor_carga ? o.frete / o.valor_carga : null;
  o.pct_pernoite = o.viagens ? o.com_pernoite / o.viagens : null;
  o.dispersao = o.km_prev ? o.km_real_comp / o.km_prev - 1 : null;
  return o;
}

// Junta o que veio da base com o que foi digitado e calcula volume x reajuste.
export function calcular(linhas, mes, j, jAnt) {
  const s = resumoMes(linhas, mes);
  const p = resumoMes(linhas, mesAnterior(mes));
  const nfs = (j.nfs || []).filter((n) => n.valor);
  const totalNfs = nfs.reduce((t, n) => t + n.valor, 0);
  const contabil = j.realizado_contabil ?? null;
  const c = {
    mes, s, p, j, nfs, totalNfs,
    contabil: contabil ?? s.frete,
    realizado: contabil != null ? contabil - totalNfs : s.frete,
    viagens: j.viagens_real ?? s.viagens,
    peso: j.peso_real_kg ?? s.peso,
    orc: j.orcado ?? null, vo: j.viagens_orc ?? null, po: j.peso_orc_kg ?? null,
  };
  c.fonte = contabil != null ? 'valor contábil informado' : 'soma dos fretes do sistema';
  c.medioReal = c.viagens ? c.realizado / c.viagens : null;
  c.pesoMedio = c.viagens ? c.peso / c.viagens : null;
  if (jAnt && (jAnt.realizado_contabil != null || jAnt.viagens_real != null)) {
    const nAnt = (jAnt.nfs || []).reduce((t, n) => t + (n.valor || 0), 0);
    const realAnt = jAnt.realizado_contabil != null ? jAnt.realizado_contabil - nAnt : p.frete;
    const viagAnt = jAnt.viagens_real ?? p.viagens;
    c.medioAnt = viagAnt ? realAnt / viagAnt : null;
  } else c.medioAnt = p.medio;
  c.temOrc = c.orc > 0;
  if (c.temOrc) {
    c.dif = c.realizado - c.orc;
    c.var = c.dif / c.orc;
    c.difContabil = c.contabil - c.orc;
    if (c.vo > 0) {
      c.medioOrc = c.orc / c.vo;
      c.volume = (c.viagens - c.vo) * c.medioOrc;
      c.reajuste = c.dif - c.volume;
      c.custoViagensOrc = c.viagens * c.medioOrc;
    }
    c.pesoMedioOrc = c.po && c.vo ? c.po / c.vo : null;
  }
  return c;
}

export function textoSugerido(c) {
  if (!c.temOrc) return '';
  const partes = [];
  const acima = c.dif > 0;
  const dv = c.vo ? c.viagens - c.vo : null;
  const dp = c.po ? c.peso - c.po : null;
  if (acima) {
    const causa = c.volume != null && c.volume >= c.reajuste ? 'principalmente ao aumento do volume operacional' : 'principalmente ao aumento do custo médio por viagem';
    let t = `O estouro da conta de frete de ${R(c.dif)} (${pct(c.var)}) está relacionado ${causa}`;
    if (dv) t += `, com ${N(Math.abs(dv))} viagens ${dv > 0 ? 'acima' : 'abaixo'} do planejado (${pct(dv / c.vo)})`;
    if (dp) t += ` e ${dp > 0 ? 'um acréscimo' : 'uma redução'} de ${T(Math.abs(dp))} (${pct(dp / c.po)}) no peso transportado`;
    partes.push(t + '.');
  } else {
    let t = `A conta de frete ficou ${R(-c.dif)} abaixo do orçado (${pct(c.var)})`;
    if (dv) t += `, com ${N(c.viagens)} viagens realizadas contra ${N(c.vo)} planejadas`;
    partes.push(t + '.');
  }
  if (c.j.reajuste_pct) partes.push(`Além disso, tivemos um reajuste de ${dec2.format(c.j.reajuste_pct)}% no valor do frete${c.j.reajuste_desde ? ' a partir de ' + c.j.reajuste_desde : ''}, o que eleva o custo médio das viagens.`);
  if (c.medioOrc) {
    let t = `O custo médio por viagem realizado foi de ${R(c.medioReal)}, contra ${R(c.medioOrc)} orçado (${pct(varr(c.medioOrc, c.medioReal))})`;
    if (c.medioAnt) t += ` e ${R(c.medioAnt)} no mês anterior (${pct(varr(c.medioAnt, c.medioReal))})`;
    partes.push(t + '.');
  }
  if (c.volume != null && acima && c.volume > 0 && c.reajuste > 0) {
    partes.push(`Do desvio total, ${R(c.volume)} (${dec1.format((c.volume / c.dif) * 100)}%) vem do volume de viagens e ${R(c.reajuste)} (${dec1.format((c.reajuste / c.dif) * 100)}%) do custo por viagem.`);
  }
  if (c.totalNfs) partes.push(`O realizado contábil de ${R(c.contabil)} inclui ${R(c.totalNfs)} em notas fiscais de outra competência; sem esse efeito, o realizado do mês é ${R(c.realizado)}.`);
  return partes.join('\n\n');
}

// ---------- slides (mesma estrutura gera a tela e o PowerPoint) ----------
export function montarSlides(c) {
  const j = c.j;
  const rod = `${j.cabecalho || 'VIEIRA DISTRIBUIDOR • RPC – MERVIL – LOGÍSTICA'} • PRESTAÇÃO DE CONTAS • ${nomeMes(c.mes).toUpperCase()}`;
  const conta = j.conta || '415007 – Locação de Veículos (PJ)';
  const tom = (x) => (x == null ? '' : x > 0 ? 'ruim' : 'bom');
  const sl = [];
  sl.push({ capa: true, titulo: j.titulo || 'RPC – MERVIL | LOGÍSTICA', sub: nomeMes(c.mes).toUpperCase(), resp: j.responsavel ? 'Responsável: ' + j.responsavel : '', rod });

  if (c.temOrc) {
    const leitura = c.dif > 0
      ? `Acima do orçamento em ${R(c.dif)} (${pct(c.var)}) em relação ao total orçado de ${R(c.orc)}.`
      : `Abaixo do orçamento em ${R(-c.dif)} (${pct(c.var)}) em relação ao total orçado de ${R(c.orc)}.`;
    sl.push({
      titulo: 'Resumo executivo', sub: conta, rod,
      kpis: [
        { r: 'Orçado', v: R(c.orc) }, { r: 'Realizado', v: R(c.realizado) },
        { r: 'Diferença (real. − orç.)', v: (c.dif > 0 ? '+' : '') + R(c.dif), t: tom(c.dif) }, { r: 'Variação', v: pct(c.var), t: tom(c.dif) },
      ],
      kpis2: [
        { r: 'Viagens realizadas', v: N(c.viagens) + (c.vo ? ' de ' + N(c.vo) + ' orçadas' : '') },
        { r: 'Custo médio por viagem', v: R(c.medioReal) },
        { r: 'Peso transportado', v: T(c.peso) },
      ],
      texto: ['LEITURA EXECUTIVA', leitura + ` Realizado considerado: ${c.fonte}${c.totalNfs ? ', sem as notas de outra competência' : ''}.`],
    });
  }

  if (c.totalNfs) {
    sl.push({
      titulo: 'Efeito de competência', sub: 'Notas fiscais de outro mês lançadas nesta competência', rod,
      kpis: [
        { r: 'Realizado contábil', v: R(c.contabil) }, { r: 'Notas de outra competência', v: R(c.totalNfs) },
        { r: 'Realizado ajustado', v: R(c.realizado) },
        ...(c.temOrc ? [{ r: 'Desvio operacional', v: (c.dif > 0 ? '+' : '') + R(c.dif) + ' (' + pct(c.var) + ')', t: tom(c.dif) }] : []),
      ],
      tabela: { cab: ['Fornecedor', 'NF', 'Valor'], linhas: c.nfs.map((n) => [n.fornecedor || '', n.nf || '', R(n.valor)]).concat([['Total', '', R(c.totalNfs)]]) },
      texto: [`O realizado contábil de ${R(c.contabil)} inclui ${R(c.totalNfs)} de ${c.nfs.length} nota(s) fiscal(is) de outra competência. Após retirar esse efeito, o realizado de ${nomeMes(c.mes)} é ${R(c.realizado)}.`],
    });
  }

  if (c.temOrc) {
    const lin = [];
    if (c.vo) lin.push(['Viagens', N(c.vo), N(c.viagens), pct(varr(c.vo, c.viagens))]);
    if (c.po) lin.push(['Peso transportado', T(c.po), T(c.peso), pct(varr(c.po, c.peso))]);
    if (c.pesoMedioOrc) lin.push(['Peso médio por viagem', dec1.format(c.pesoMedioOrc) + ' kg', dec1.format(c.pesoMedio) + ' kg', pct(varr(c.pesoMedioOrc, c.pesoMedio))]);
    if (c.medioOrc) {
      lin.push(['Custo das viagens realizadas', R(c.custoViagensOrc), R(c.realizado), pct(varr(c.custoViagensOrc, c.realizado))]);
      lin.push(['Valor médio por viagem', R(c.medioOrc), R(c.medioReal), pct(varr(c.medioOrc, c.medioReal))]);
    }
    if (c.medioAnt) lin.push(['Valor médio por viagem no mês anterior', R(c.medioAnt), R(c.medioReal), pct(varr(c.medioAnt, c.medioReal))]);
    const an = [];
    if (c.vo && c.viagens > c.vo) an.push('Parte da variação vem do volume de viagens realizado acima do planejamento.');
    if (c.vo && c.viagens < c.vo) an.push('O volume de viagens ficou abaixo do planejamento.');
    if (c.medioOrc) an.push(c.medioReal > c.medioOrc ? 'Mesmo considerando o volume realizado, o custo por viagem ficou acima do parâmetro orçamentário.' : 'O custo por viagem ficou dentro do parâmetro orçamentário.');
    if (c.po) an.push(c.peso > c.po ? 'O peso transportado superou o planejamento, indicando aumento da demanda operacional.' : 'O peso transportado ficou abaixo do planejamento.');
    if (c.j.reajuste_pct) an.push(`Reajuste do frete de ${dec2.format(c.j.reajuste_pct)}%${c.j.reajuste_desde ? ' desde ' + c.j.reajuste_desde : ''}.`);
    sl.push({
      titulo: 'Análise operacional', sub: conta + ' • orçado x realizado', rod,
      kpis: [{ r: 'Orçamento', v: R(c.orc) }, { r: 'Viagens realizadas', v: N(c.viagens) }, { r: 'Realizado', v: R(c.realizado) }, { r: c.dif > 0 ? 'Acima do orçado' : 'Abaixo do orçado', v: (c.dif > 0 ? '+' : '') + R(c.dif), t: tom(c.dif) }],
      tabela: lin.length ? { cab: ['Indicador', 'Planejado', 'Realizado', 'Variação'], linhas: lin } : null,
      grafico: { tipo: 'barras', series: [{ r: 'Orçado', v: c.orc }, { r: 'Realizado', v: c.realizado }] },
      bullets: an,
    });
  }

  if (c.temOrc && c.volume != null) {
    const pv = c.dif ? c.volume / c.dif : null, pr = c.dif ? c.reajuste / c.dif : null;
    const dv = c.viagens - c.vo;
    sl.push({
      titulo: 'Separação do impacto por volume e por custo', sub: conta, rod,
      kpis: [
        { r: 'Orçamento base', v: R(c.orc) },
        { r: `Impacto do volume (${dv >= 0 ? '+' : ''}${N(dv)} viagens)`, v: (c.volume >= 0 ? '+ ' : '') + R(c.volume), t: tom(c.volume) },
        { r: 'Impacto do reajuste / custo por viagem', v: (c.reajuste >= 0 ? '+ ' : '') + R(c.reajuste), t: tom(c.reajuste) },
        { r: 'Realizado', v: R(c.realizado) },
      ],
      grafico: { tipo: 'cascata', passos: [{ r: 'Orçamento', v: c.orc, base: true }, { r: 'Volume', v: c.volume }, { r: 'Custo por viagem', v: c.reajuste }, { r: 'Realizado', v: c.realizado, base: true }] },
      tabela: { cab: ['Componente', 'Impacto', '% do desvio'], linhas: [
        [`Volume (${dv >= 0 ? '+' : ''}${N(dv)} viagens × ${R(c.medioOrc)})`, R(c.volume), pv == null ? '—' : dec1.format(pv * 100) + '%'],
        [`Reajuste / custo por viagem (${R(c.medioOrc)} → ${R(c.medioReal)})`, R(c.reajuste), pr == null ? '—' : dec1.format(pr * 100) + '%'],
        ['Desvio total', R(c.dif), '100%'],
      ] },
    });
  }

  const s = c.s, p = c.p;
  const linhaInd = (rot, a, b, f, menorMelhor = true) => {
    const v = varr(a, b);
    return [rot, f(a), f(b), pct(v), v == null ? '' : (v > 0) === menorMelhor ? 'ruim' : 'bom'];
  };
  sl.push({
    titulo: 'Indicadores da operação', sub: `Base de fretes dos agregados • ${nomeMes(p.mes)} x ${nomeMes(s.mes)}`, rod,
    tabela: { tons: true, cab: ['Indicador', nomeMes(p.mes), nomeMes(s.mes), 'Variação'], linhas: [
      linhaInd('Viagens de agregados', p.viagens, s.viagens, N, false).slice(0, 4).concat(['']),
      linhaInd('Frete total', p.frete, s.frete, R),
      linhaInd('Valor médio por viagem', p.medio, s.medio, R),
      linhaInd('Km rodados', p.km, s.km, N, false).slice(0, 4).concat(['']),
      linhaInd('Custo por km', p.r_km, s.r_km, R),
      linhaInd('Entregas', p.entregas, s.entregas, N, false).slice(0, 4).concat(['']),
      linhaInd('Custo por entrega', p.r_entrega, s.r_entrega, R),
      linhaInd('Peso transportado', p.peso, s.peso, T, false).slice(0, 4).concat(['']),
      linhaInd('Custo por tonelada', p.r_ton, s.r_ton, R),
      ['Frete sobre o valor da carga', pct(p.pct_carga, false), pct(s.pct_carga, false), s.pct_carga != null && p.pct_carga != null ? (s.pct_carga >= p.pct_carga ? '+' : '') + dec2.format((s.pct_carga - p.pct_carga) * 100) + ' p.p.' : '—', s.pct_carga > p.pct_carga ? 'ruim' : 'bom'],
      ['Viagens com pernoite', pct(p.pct_pernoite, false), pct(s.pct_pernoite, false), s.pct_pernoite != null && p.pct_pernoite != null ? (s.pct_pernoite >= p.pct_pernoite ? '+' : '') + dec1.format((s.pct_pernoite - p.pct_pernoite) * 100) + ' p.p.' : '—', s.pct_pernoite > p.pct_pernoite ? 'ruim' : 'bom'],
      ['Km rodado acima do programado', pct(p.dispersao), pct(s.dispersao), s.dispersao != null && p.dispersao != null ? (s.dispersao >= p.dispersao ? '+' : '') + dec1.format((s.dispersao - p.dispersao) * 100) + ' p.p.' : '—', s.dispersao > p.dispersao ? 'ruim' : 'bom'],
    ] },
    texto: ['Valores da base de fretes importada no app (só agregados com valor de frete; frota própria fora). Podem diferir do contábil.'],
  });

  return sl;
}

// Slides que dependem de toda a base (evolução e transportadores) e os textos finais.
export function slidesFinais(c, linhas) {
  const j = c.j;
  const rod = `${j.cabecalho || 'VIEIRA DISTRIBUIDOR • RPC – MERVIL – LOGÍSTICA'} • PRESTAÇÃO DE CONTAS • ${nomeMes(c.mes).toUpperCase()}`;
  const sl = [];
  const meses = [...new Set(linhas.filter((r) => !r.frota_propria && r.data).map((r) => r.data.slice(0, 7)))].sort().filter((m) => m <= c.mes).slice(-6);
  const ms = meses.map((m) => resumoMes(linhas, m));
  if (ms.length > 1) {
    sl.push({
      titulo: 'Evolução mensal', sub: 'Frete dos agregados na base do app', rod,
      grafico: { tipo: 'colunas', series: ms.map((m) => ({ r: nomeMes(m.mes), v: m.frete, destaque: m.mes === c.mes })) },
      tabela: { cab: ['Mês', 'Viagens', 'Frete', 'Médio/viagem', 'R$/km', 'Frete/carga'], linhas: ms.map((m) => [nomeMes(m.mes), N(m.viagens), R(m.frete), R(m.medio), R(m.r_km), pct(m.pct_carga, false)]) },
    });
  }
  const por = (rs) => rs.reduce((mp, r) => { const k = r.transportador || '—'; const o = mp.get(k) || { v: 0, f: 0 }; o.v += 1; o.f += r.frete_total || 0; mp.set(k, o); return mp; }, new Map());
  const a = por(c.p.linhas), b = por(c.s.linhas);
  const nomes = [...new Set([...a.keys(), ...b.keys()])];
  const tr = nomes.map((n) => ({ n, va: a.get(n)?.v || 0, vb: b.get(n)?.v || 0, fa: a.get(n)?.f || 0, fb: b.get(n)?.f || 0 }))
    .map((x) => ({ ...x, d: x.fb - x.fa })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8);
  if (tr.length) {
    sl.push({
      titulo: 'Onde o custo mudou', sub: `Transportadores com maior variação de frete • ${nomeMes(c.p.mes)} x ${nomeMes(c.mes)}`, rod,
      tabela: { tons: true, cab: ['Transportador', 'Viagens ant.', 'Viagens', 'Frete ant.', 'Frete', 'Diferença'], linhas: tr.map((x) => [x.n, N(x.va), N(x.vb), R(x.fa), R(x.fb), (x.d > 0 ? '+' : '') + R(x.d), x.d > 0 ? 'ruim' : 'bom']) },
    });
  }
  const just = (j.justificativa || '').trim() || textoSugerido(c);
  if (just) sl.push({ titulo: 'Justificativa do gestor', sub: j.conta || '415007 – Locação de Veículos (PJ)', rod, texto: just.split(/\n\s*\n/), grande: true });
  const concl = [];
  if (c.temOrc) {
    concl.push(c.dif > 0 ? `${j.conta || '415007 – Locação de Veículos (PJ)'}: ${R(c.dif)} acima do orçado (${pct(c.var)}).` : `${j.conta || '415007 – Locação de Veículos (PJ)'}: ${R(-c.dif)} abaixo do orçado (${pct(c.var)}).`);
    if (c.volume != null && c.dif > 0 && c.volume > 0 && c.reajuste > 0) concl.push(`${dec1.format((c.volume / c.dif) * 100)}% do desvio vem do volume adicional e ${dec1.format((c.reajuste / c.dif) * 100)}% do custo por viagem.`);
    if (c.totalNfs) concl.push(`${R(c.totalNfs)} de notas de outra competência foram retirados da análise.`);
  }
  const acoes = (j.acoes || '').split('\n').map((x) => x.replace(/^[•\-\s]+/, '').trim()).filter(Boolean);
  if (concl.length || acoes.length) sl.push({ titulo: 'Conclusões e ações', sub: nomeMes(c.mes), rod, bullets: concl, bullets2: acoes, rot2: 'AÇÕES E RECOMENDAÇÕES' });
  return sl;
}

// ---------- desenho na tela ----------
function svgBarras(series) {
  const max = Math.max(...series.map((s) => s.v || 0)) || 1;
  const w = 100 / series.length;
  return `<svg viewBox="0 0 400 220" class="jc-svg" role="img" aria-label="${series.map((s) => s.r + ' ' + R(s.v)).join(', ')}">
    <line x1="10" y1="190" x2="390" y2="190" class="jc-eixo"/>
    ${series.map((s, i) => {
      const h = ((s.v || 0) / max) * 150, x = 10 + (i * w + w * 0.2) * 3.8, bw = w * 0.6 * 3.8;
      return `<rect x="${x}" y="${190 - h}" width="${bw}" height="${h}" rx="4" class="${i ? 'jc-b2' : 'jc-b1'}${s.destaque ? ' jc-dest' : ''}"/>
      <text x="${x + bw / 2}" y="${184 - h}" class="jc-vl">${esc(curto(s.v))}</text>
      <text x="${x + bw / 2}" y="208" class="jc-rl">${esc(s.r)}</text>`;
    }).join('')}</svg>`;
}
function svgColunas(series) {
  const max = Math.max(...series.map((s) => s.v || 0)) || 1;
  const w = 380 / series.length;
  return `<svg viewBox="0 0 400 220" class="jc-svg" role="img" aria-label="${series.map((s) => s.r + ' ' + R(s.v)).join(', ')}">
    <line x1="10" y1="190" x2="390" y2="190" class="jc-eixo"/>
    ${series.map((s, i) => {
      const h = ((s.v || 0) / max) * 150, bw = w * 0.62, x = 10 + i * w + (w - bw) / 2;
      return `<rect x="${x}" y="${190 - h}" width="${bw}" height="${h}" rx="3" class="${s.destaque ? 'jc-b1' : 'jc-b0'}"/>
      <text x="${x + bw / 2}" y="${184 - h}" class="jc-vl">${esc(curto(s.v))}</text>
      <text x="${x + bw / 2}" y="208" class="jc-rl">${esc(s.r.replace('/20', '/'))}</text>`;
    }).join('')}</svg>`;
}
function svgCascata(passos) {
  let acc = 0;
  const pts = passos.map((p) => {
    if (p.base) { acc = p.v; return { ...p, y0: 0, y1: p.v }; }
    const a = acc; acc += p.v; return { ...p, y0: Math.min(a, acc), y1: Math.max(a, acc) };
  });
  const max = Math.max(...pts.map((p) => p.y1)) || 1;
  const min = Math.min(0, ...pts.map((p) => p.y0));
  const lo = Math.max(0, Math.min(...pts.filter((p) => !p.base).map((p) => p.y0)) - (max - min) * 0.25);
  const y = (v) => 190 - ((Math.max(v, lo) - lo) / (max - lo)) * 150;
  const w = 380 / pts.length;
  return `<svg viewBox="0 0 400 220" class="jc-svg" role="img" aria-label="${pts.map((p) => p.r + ' ' + R(p.v)).join(', ')}">
    <line x1="10" y1="190" x2="390" y2="190" class="jc-eixo"/>
    ${pts.map((p, i) => {
      const bw = w * 0.6, x = 10 + i * w + (w - bw) / 2, yt = y(p.y1), yb = y(p.y0);
      const cls = p.base ? 'jc-b0' : p.v > 0 ? 'jc-up' : 'jc-down';
      return `<rect x="${x}" y="${yt}" width="${bw}" height="${Math.max(2, yb - yt)}" rx="3" class="${cls}"/>
      <text x="${x + bw / 2}" y="${yt - 6}" class="jc-vl">${esc((p.base ? '' : p.v > 0 ? '+' : '') + curto(p.v))}</text>
      <text x="${x + bw / 2}" y="208" class="jc-rl">${esc(p.r)}</text>`;
    }).join('')}
    ${lo > 0 ? '<text x="12" y="12" class="jc-nota">eixo começa em ' + esc(curto(lo)) + '</text>' : ''}</svg>`;
}
function curto(v) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return 'R$ ' + dec2.format(v / 1e6) + ' mi';
  if (a >= 1e3) return 'R$ ' + dec1.format(v / 1e3) + ' mil';
  return R(v);
}

function htmlSlide(s, i, total) {
  if (s.capa) {
    return `<article class="jc-slide jc-capa" aria-label="Slide ${i + 1}">
      <div class="jc-capa-in"><h2>${esc(s.titulo)}</h2><p class="jc-capa-mes">${esc(s.sub)}</p><p>${esc(s.resp)}</p></div>
      <footer>${esc(s.rod)}</footer></article>`;
  }
  const kp = (ks, cls) => (ks && ks.length ? `<div class="jc-kpis ${cls || ''}">${ks.map((k) => `<div class="jc-kpi ${k.t ? 'jc-' + k.t : ''}"><b>${esc(k.v)}</b><span>${esc(k.r)}</span></div>`).join('')}</div>` : '');
  const tab = s.tabela ? `<table class="jc-tab"><thead><tr>${s.tabela.cab.map((h, k) => `<th${k ? '' : ' class="jc-l"'}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.tabela.linhas.map((l) => {
    const n = s.tabela.cab.length;
    const t = l[n];
    return `<tr>${l.slice(0, n).map((v, k) => `<td class="${k ? '' : 'jc-l'}${k === n - 1 && t ? ' jc-' + t : ''}">${esc(v)}</td>`).join('')}</tr>`;
  }).join('')}</tbody></table>` : '';
  const g = s.grafico ? (s.grafico.tipo === 'barras' ? svgBarras(s.grafico.series) : s.grafico.tipo === 'colunas' ? svgColunas(s.grafico.series) : svgCascata(s.grafico.passos)) : '';
  const tx = s.texto ? s.texto.map((t, k) => (k === 0 && /^[A-ZÁÉÍÓÚÇÃÕ ]+$/.test(t) ? `<h4>${esc(t)}</h4>` : `<p>${esc(t)}</p>`)).join('') : '';
  const bl = (b, rot) => (b && b.length ? `${rot ? `<h4>${esc(rot)}</h4>` : ''}<ul>${b.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const lados = g && tab ? `<div class="jc-2col"><div>${g}</div><div>${tab}</div></div>` : g ? `<div class="jc-2col"><div>${g}</div><div class="jc-txt">${bl(s.bullets)}${tx}</div></div>` : tab;
  const resto = g && !tab ? '' : `<div class="jc-txt ${s.grande ? 'jc-grande' : ''}">${bl(s.bullets, s.bullets2 ? 'PRINCIPAIS PONTOS' : '')}${bl(s.bullets2, s.rot2)}${tx}</div>`;
  return `<article class="jc-slide" aria-label="Slide ${i + 1}">
    <header><h2>${esc(s.titulo)}</h2><p>${esc(s.sub)}</p></header>
    <div class="jc-corpo">${kp(s.kpis)}${kp(s.kpis2, 'jc-kpis2')}${lados}${resto}</div>
    <footer><span>${esc(s.rod)}</span><span>${i + 1}/${total}</span></footer></article>`;
}

// ---------- PowerPoint ----------
let pptxPronto = null;
function carregarPptx() {
  if (window.PptxGenJS) return Promise.resolve();
  pptxPronto ??= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'vendor/pptxgen.bundle.js';
    s.onload = ok; s.onerror = () => { pptxPronto = null; erro(new Error('não consegui baixar a biblioteca do PowerPoint')); };
    document.head.appendChild(s);
  });
  return pptxPronto;
}

export async function gerarPptx(slides, nome) {
  await carregarPptx();
  const pp = new window.PptxGenJS();
  pp.layout = 'LAYOUT_WIDE'; // 13,33 x 7,5 pol
  const AZUL = '1E3A8A', AC = '3B82F6', LIL = '6366F1', CINZA = '64748B', TXT = '0F172A', BOM = '059669', RUIM = 'DC2626';
  const F = 'Calibri';
  for (const s of slides) {
    const p = pp.addSlide();
    if (s.capa) {
      p.background = { color: '0B1020' };
      p.addShape(pp.ShapeType.rect, { x: 0, y: 2.4, w: 13.33, h: 0.08, fill: { color: AC } });
      p.addText(s.titulo, { x: 0.8, y: 2.7, w: 11.7, h: 1.2, fontFace: F, fontSize: 40, bold: true, color: 'FFFFFF' });
      p.addText(s.sub, { x: 0.8, y: 3.9, w: 11.7, h: 0.7, fontFace: F, fontSize: 24, color: '8B93FF', bold: true });
      if (s.resp) p.addText(s.resp, { x: 0.8, y: 4.7, w: 11.7, h: 0.5, fontFace: F, fontSize: 16, color: 'CBD5E1' });
      p.addText(s.rod, { x: 0.8, y: 6.8, w: 11.7, h: 0.4, fontFace: F, fontSize: 10, color: '94A3B8' });
      continue;
    }
    p.background = { color: 'FFFFFF' };
    p.addShape(pp.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: AZUL } });
    p.addText(s.titulo, { x: 0.5, y: 0.08, w: 12.3, h: 0.55, fontFace: F, fontSize: 24, bold: true, color: 'FFFFFF' });
    p.addText(s.sub || '', { x: 0.5, y: 0.58, w: 12.3, h: 0.35, fontFace: F, fontSize: 13, color: 'C7D2FE' });
    p.addText(s.rod, { x: 0.5, y: 7.05, w: 12.3, h: 0.3, fontFace: F, fontSize: 9, color: CINZA });
    let y = 1.25;
    const kpis = (ks, alt) => {
      const n = ks.length, gap = 0.2, w = (12.33 - gap * (n - 1)) / n;
      ks.forEach((k, i) => {
        const x = 0.5 + i * (w + gap);
        p.addShape(pp.ShapeType.roundRect, { x, y, w, h: alt, fill: { color: 'F1F5F9' }, line: { color: 'E2E8F0' }, rectRadius: 0.08 });
        p.addText(k.v, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: alt * 0.55, fontFace: F, fontSize: alt > 0.9 ? 22 : 16, bold: true, color: k.t === 'ruim' ? RUIM : k.t === 'bom' ? BOM : AZUL, fit: 'shrink' });
        p.addText(k.r.toUpperCase(), { x: x + 0.15, y: y + alt * 0.58, w: w - 0.3, h: alt * 0.35, fontFace: F, fontSize: 10, color: CINZA, fit: 'shrink' });
      });
      y += alt + 0.2;
    };
    if (s.kpis) kpis(s.kpis, 1.05);
    if (s.kpis2) kpis(s.kpis2, 0.8);
    const tabela = (x, w) => {
      const n = s.tabela.cab.length;
      const rows = [s.tabela.cab.map((h, k) => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: AC }, align: k ? 'right' : 'left' } }))]
        .concat(s.tabela.linhas.map((l) => l.slice(0, n).map((v, k) => ({ text: String(v), options: { align: k ? 'right' : 'left', color: k === n - 1 && l[n] ? (l[n] === 'ruim' ? RUIM : BOM) : TXT } }))));
      const h = Math.min(6.9 - y, 0.36 * rows.length);
      p.addTable(rows, { x, y, w, h, fontFace: F, fontSize: rows.length > 10 || n > 5 ? 10 : 12, border: { type: 'solid', pt: 0.5, color: 'E2E8F0' }, autoPage: false });
      return 0.36 * rows.length;
    };
    const grafico = (x, w, h) => {
      const g = s.grafico;
      if (g.tipo === 'cascata') {
        const labels = g.passos.map((q) => q.r);
        let acc = 0;
        const base = [], up = [], down = [], tot = [];
        g.passos.forEach((q) => {
          if (q.base) { acc = q.v; base.push(0); tot.push(q.v); up.push(0); down.push(0); return; }
          const a = acc; acc += q.v;
          base.push(Math.min(a, acc)); tot.push(0); up.push(q.v > 0 ? q.v : 0); down.push(q.v < 0 ? -q.v : 0);
        });
        p.addChart(pp.ChartType.bar, [
          { name: 'base', labels, values: base }, { name: 'Total', labels, values: tot },
          { name: 'Aumento', labels, values: up }, { name: 'Redução', labels, values: down },
        ], { x, y, w, h, barGrouping: 'stacked', chartColors: ['FFFFFF', AZUL, RUIM, BOM], showLegend: false, valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLabelFontSize: 11, catAxisLabelFontFace: F });
      } else {
        p.addChart(pp.ChartType.bar, [{ name: 'Valor', labels: g.series.map((q) => q.r), values: g.series.map((q) => Math.round(q.v || 0)) }],
          { x, y, w, h, barDir: 'col', chartColors: g.tipo === 'barras' ? [CINZA, AC] : g.series.map((q) => (q.destaque ? AC : 'A5B4FC')), showValue: true, dataLabelFormatCode: '"R$" #,##0', dataLabelFontSize: 10, valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLabelFontSize: 11, catAxisLabelFontFace: F, showLegend: false });
      }
    };
    const textos = (x, w, yy, h) => {
      const partes = [];
      const add = (t, o) => partes.push({ text: t, options: { breakLine: true, ...o } });
      (s.bullets || []).length && s.bullets2 && add('PRINCIPAIS PONTOS', { bold: true, color: LIL, fontSize: 12 });
      (s.bullets || []).forEach((b) => add(b, { bullet: true, paraSpaceAfter: 6 }));
      if (s.bullets2 && s.bullets2.length) { add(s.rot2, { bold: true, color: LIL, fontSize: 12 }); s.bullets2.forEach((b) => add(b, { bullet: true, paraSpaceAfter: 6 })); }
      (s.texto || []).forEach((t, k) => (k === 0 && /^[A-ZÁÉÍÓÚÇÃÕ ]+$/.test(t) ? add(t, { bold: true, color: LIL, fontSize: 12 }) : add(t, { paraSpaceAfter: 8 })));
      if (partes.length) p.addText(partes, { x, y: yy, w, h, fontFace: F, fontSize: s.grande ? 16 : 13, color: TXT, valign: 'top', fit: 'shrink' });
    };
    const resto = 6.95 - y;
    const notas = s.grafico && s.tabela && (s.bullets || s.texto) ? 1.15 : 0;
    if (s.grafico && s.tabela) { grafico(0.5, 5.6, Math.min(resto - notas, 4.2)); tabela(6.4, 6.43); }
    else if (s.grafico) { grafico(0.5, 6.2, Math.min(resto, 4.4)); textos(7.0, 5.8, y, resto); }
    else if (s.tabela) { const h = tabela(0.5, 12.33); textos(0.5, 12.33, y + h + 0.15, Math.max(0.5, resto - h - 0.15)); }
    else textos(0.5, 12.33, y, resto);
    if (notas) textos(0.5, 12.33, 6.95 - notas + 0.1, notas - 0.1);
  }
  await pp.writeFile({ fileName: nome });
}

// ---------- tela ----------
const CAMPOS = [
  ['titulo', 'Título da capa', 'texto', 'RPC – MERVIL | LOGÍSTICA'],
  ['responsavel', 'Responsável', 'texto', ''],
  ['cabecalho', 'Rodapé dos slides', 'texto', 'VIEIRA DISTRIBUIDOR • RPC – MERVIL – LOGÍSTICA'],
  ['conta', 'Conta', 'texto', '415007 – Locação de Veículos (PJ)'],
  ['orcado', 'Orçamento da conta (R$)', 'reais'],
  ['viagens_orc', 'Viagens orçadas', 'num'],
  ['peso_orc_kg', 'Peso orçado (kg)', 'num'],
  ['realizado_contabil', 'Realizado contábil (R$)', 'reais', '', 'Vazio = soma dos fretes do sistema'],
  ['viagens_real', 'Viagens realizadas', 'num', '', 'Vazio = viagens do sistema'],
  ['peso_real_kg', 'Peso realizado (kg)', 'num', '', 'Vazio = peso do sistema'],
  ['reajuste_pct', 'Reajuste do frete (%)', 'num2'],
  ['reajuste_desde', 'Reajuste desde', 'texto', '', 'ex.: maio/2026'],
];

export function iniciarJustificativa({ db, admin, email }) {
  const raiz = $('aba-just');
  if (!raiz) return;
  let mes = null, dados = {}, dadosAnt = null, linhas = [], slides = [], atual = 0;

  const form = $('jc-campos');
  form.innerHTML = CAMPOS.map(([k, rot, , ph, dica]) => `<div class="fq-field"><label for="jc-${k}">${esc(rot)}</label><input id="jc-${k}" ${['texto'].includes(CAMPOS.find((c) => c[0] === k)[2]) ? '' : 'inputmode="decimal"'} placeholder="${esc(ph || dica || '')}"${admin ? '' : ' readonly'}>${dica ? `<small>${esc(dica)}</small>` : ''}</div>`).join('');
  for (const id of ['jc-nfs', 'jc-justificativa', 'jc-acoes']) $(id).readOnly = !admin;
  raiz.querySelectorAll('.so-admin-jc').forEach((el) => { el.hidden = !admin; });
  $('jc-leitura').hidden = admin;

  const fmt = (k, v) => {
    if (v == null || v === '') return '';
    const tipo = CAMPOS.find((c) => c[0] === k)[2];
    return tipo === 'reais' ? dec2.format(v) : tipo === 'num' ? int.format(v) : tipo === 'num2' ? dec2.format(v) : v;
  };
  const preencher = () => {
    for (const [k, , tipo, ph] of CAMPOS) $('jc-' + k).value = dados[k] != null ? fmt(k, dados[k]) : tipo === 'texto' && ph ? '' : '';
    $('jc-nfs').value = (dados.nfs || []).map((n) => [n.fornecedor, n.nf, dec2.format(n.valor)].join('; ')).join('\n');
    $('jc-justificativa').value = dados.justificativa || '';
    $('jc-acoes').value = dados.acoes || '';
    const quem = dados.atualizado_por ? `Salvo por ${dados.atualizado_por}${dados.atualizado_em?.toDate ? ' em ' + dados.atualizado_em.toDate().toLocaleString('pt-BR') : ''}.` : 'Ainda não há números salvos para este mês.';
    $('jc-salvo').textContent = quem;
  };
  const lerForm = () => {
    const o = {};
    for (const [k, , tipo] of CAMPOS) {
      const v = $('jc-' + k).value.trim();
      o[k] = tipo === 'texto' ? v || null : numeroBR(v);
    }
    o.nfs = $('jc-nfs').value.split('\n').map((l) => l.split(/[;\t]/).map((x) => x.trim())).filter((p) => p.some(Boolean))
      .map((p) => ({ fornecedor: p[0] || '', nf: p.length > 2 ? p[1] : '', valor: numeroBR(p[p.length - 1]) })).filter((n) => n.valor);
    o.justificativa = $('jc-justificativa').value.trim() || null;
    o.acoes = $('jc-acoes').value.trim() || null;
    return o;
  };

  const desenhar = () => {
    if (!mes) return;
    const j = { ...dados, ...lerForm() };
    const c = calcular(linhas, mes, j, dadosAnt);
    slides = montarSlides(c).concat(slidesFinais(c, linhas));
    $('jc-slides').innerHTML = slides.map((s, i) => htmlSlide(s, i, slides.length)).join('');
    $('jc-aviso').textContent = c.temOrc ? '' : 'Preencha o orçamento e as viagens orçadas para aparecerem os slides de orçado x realizado e de volume x reajuste.';
    $('jc-sistema').textContent = `No sistema, ${nomeMes(mes)} tem ${N(c.s.viagens)} viagens de agregados, ${R(c.s.frete)} de frete e ${T(c.s.peso)} transportadas.`;
    if (!$('jc-justificativa').value.trim()) $('jc-justificativa').placeholder = textoSugerido(c) || 'Texto da justificativa';
    if (!raiz.querySelector('.jc-show').hidden) mostrar(atual);
  };

  const abrirMes = async (m) => {
    mes = m;
    $('jc-salvo').textContent = 'Carregando…';
    try {
      const [a, b] = await Promise.all([getDoc(doc(db, 'justificativas', m)), getDoc(doc(db, 'justificativas', mesAnterior(m)))]);
      dados = a.exists() ? a.data() : {};
      dadosAnt = b.exists() ? b.data() : null;
      if (!a.exists() && b.exists()) {
        // traz do mês anterior o que costuma se repetir
        for (const k of ['titulo', 'responsavel', 'cabecalho', 'conta', 'reajuste_pct', 'reajuste_desde', 'orcado', 'viagens_orc', 'peso_orc_kg']) if (b.data()[k] != null) dados[k] = b.data()[k];
      }
      preencher();
      if (!a.exists() && b.exists()) $('jc-salvo').textContent = 'Mês novo: orçamento e textos fixos vieram de ' + nomeMes(mesAnterior(m)) + '. Confira e salve.';
    } catch (e) {
      dados = {}; dadosAnt = null; preencher();
      $('jc-salvo').textContent = 'Não consegui ler os números salvos (' + (e.code || e.message) + '). Confira se as regras do Firestore foram atualizadas.';
    }
    desenhar();
  };

  const atualizarMeses = () => {
    const sel = $('jc-mes');
    const ms = [...new Set(linhas.filter((r) => !r.frota_propria && r.data).map((r) => r.data.slice(0, 7)))].sort().reverse();
    const antes = sel.value;
    sel.innerHTML = ms.map((m) => `<option value="${m}">${nomeMes(m)}</option>`).join('');
    if (!ms.length) return;
    const escolha = ms.includes(antes) ? antes : ms[1] || ms[0];
    sel.value = escolha;
    if (escolha !== mes) abrirMes(escolha); else desenhar();
  };

  window.dash.onData(() => {
    const d = window.dash.data('fretes');
    if (d.status !== 'ok') return;
    if (d.data === linhas) return;
    linhas = d.data;
    if (!raiz.hidden) atualizarMeses();
  });
  raiz.addEventListener('jc-abrir', () => { if (linhas.length && !mes) atualizarMeses(); });
  $('jc-mes').addEventListener('change', (e) => abrirMes(e.target.value));
  let espera;
  raiz.querySelector('.jc-form').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(desenhar, 300); });

  $('jc-salvar').addEventListener('click', async () => {
    if (!mes) return;
    $('jc-salvar').disabled = true;
    try {
      const o = { ...lerForm(), mes, atualizado_em: serverTimestamp(), atualizado_por: email };
      await setDoc(doc(db, 'justificativas', mes), o);
      dados = { ...o, atualizado_em: { toDate: () => new Date() } };
      preencher();
    } catch (e) {
      $('jc-salvo').textContent = 'Não foi possível salvar (' + (e.code || e.message) + '). Confira se as regras do Firestore incluem "justificativas".';
    } finally { $('jc-salvar').disabled = false; }
  });
  $('jc-sugerir').addEventListener('click', () => {
    const c = calcular(linhas, mes, { ...dados, ...lerForm(), justificativa: null }, dadosAnt);
    $('jc-justificativa').value = textoSugerido(c);
    desenhar();
  });
  $('jc-pptx').addEventListener('click', async () => {
    const b = $('jc-pptx');
    b.disabled = true; const t = b.textContent; b.textContent = 'Gerando…';
    try { await gerarPptx(slides, `justificativa_custos_${mes}.pptx`); } catch (e) { $('jc-aviso').textContent = 'Não foi possível gerar o PowerPoint: ' + e.message; }
    b.disabled = false; b.textContent = t;
  });

  // modo apresentação: um slide por vez em tela cheia, setas do teclado ou clique
  const show = raiz.querySelector('.jc-show');
  const mostrar = (i) => {
    atual = Math.max(0, Math.min(slides.length - 1, i));
    $('jc-show-slide').innerHTML = htmlSlide(slides[atual], atual, slides.length);
  };
  const fechar = () => { show.hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  $('jc-apresentar').addEventListener('click', () => {
    if (!slides.length) return;
    show.hidden = false; mostrar(0);
    show.requestFullscreen?.().catch(() => {});
    show.focus();
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) show.hidden = true; });
  show.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); mostrar(atual + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); mostrar(atual - 1); }
    else if (e.key === 'Escape') fechar();
  });
  $('jc-prox').addEventListener('click', () => mostrar(atual + 1));
  $('jc-ant').addEventListener('click', () => mostrar(atual - 1));
  $('jc-fechar').addEventListener('click', fechar);
}

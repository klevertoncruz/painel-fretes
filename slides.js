// Slides da prestação de contas no modelo da apresentação da Vieira (setembro/2026): slide 10 x 5,63 pol, Arial,
// título verde-azulado, linha laranja, caixas de indicador, tabelas verdes e faixa de rodapé.
// Cada slide é uma lista de peças com posição em polegadas; a mesma lista desenha a tela (HTML) e o PowerPoint.

export const COR = {
  teal: '1F7E78', verde: '225B18', laranja: 'F4842D', verm: 'C0392B', cinza: '696969', txt: '232323',
  claro: 'F5F7F4', borda: 'E3E9E8', neutro: 'C9C9C9', barra: 'C9D6C6', branco: 'FFFFFF',
};
export const LARG = 10, ALT = 5.63;
export const LOGO = 'img/logo-vieira.png';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const R = (x) => (x == null || !isFinite(x) ? '—' : brl.format(x));
const N = (x) => (x == null || !isFinite(x) ? '—' : int.format(x));
const pct = (x, sinal = true) => (x == null || !isFinite(x) ? '—' : (sinal && x > 0 ? '+' : '') + dec1.format(x * 100) + '%');
const pct2 = (x) => (x == null || !isFinite(x) ? '—' : (x > 0 ? '+' : '') + dec2.format(x * 100) + '%');
const T1 = (kg) => (kg == null || !isFinite(kg) ? '—' : dec1.format(kg / 1000) + ' t');
const varr = (a, b) => (a && b != null ? b / a - 1 : null);
const sinalR = (x) => (x > 0 ? '+' : '') + R(x);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m) => (m ? MESES[Number(m.slice(5, 7)) - 1] + '/' + m.slice(0, 4) : '');
const Mes = (m) => { const s = nomeMes(m); return s.charAt(0).toUpperCase() + s.slice(1); };

// ---------- peças ----------
const txt = (x, y, w, h, conteudo, o = {}) => ({ t: 'txt', x, y, w, h, paras: typeof conteudo === 'string' ? [[{ text: conteudo }]] : conteudo, size: 11, color: COR.txt, ...o });
const caixa = (x, y, w, h, fill, line, lw = 1.25) => ({ t: 'rect', x, y, w, h, fill, line, lw, r: true });

function base(titulo, sub, rod) {
  return [
    txt(0.35, 0.2, 7.9, 0.42, titulo, { size: 20, b: true, color: COR.teal, v: 'mid' }),
    txt(0.35, 0.6, 7.9, 0.24, sub, { size: 10, color: COR.cinza, v: 'mid' }),
    { t: 'img', x: 8.5, y: 0.16, w: 1.15, h: 0.47 },
    { t: 'line', x: 0.35, y: 0.9, w: 9.3, color: COR.laranja, lw: 1.5 },
    rodape(rod),
  ].flat();
}
const rodape = (texto) => [
  { t: 'rect', x: 0, y: 5.39, w: 10, h: 0.24, fill: COR.teal },
  txt(0.35, 5.39, 9.3, 0.24, texto, { size: 8, b: true, color: COR.branco, v: 'mid' }),
];

// estilo: n = normal (borda verde), d = destaque (fundo verde), r = ruim (borda e valor vermelhos), b = bom (valor verde), z = neutro
function kpi(x, y, w, h, valor, rotulo, est = 'n') {
  const fill = est === 'd' ? COR.verde : COR.claro;
  const line = est === 'r' ? COR.verm : est === 'z' ? COR.neutro : COR.verde;
  const cv = est === 'd' ? COR.branco : est === 'r' ? COR.verm : est === 'z' ? COR.cinza : COR.verde;
  const cr = est === 'd' ? COR.branco : COR.cinza;
  const tam = String(valor).length <= 7 ? 15 : String(valor).length > 16 ? 12 : 14;
  return [
    caixa(x, y, w, h, fill, line),
    txt(x + 0.12, y + 0.08, w - 0.24, h * 0.58, String(valor), { size: tam, b: true, color: cv, v: 'bot' }),
    txt(x + 0.12, y + h * 0.62, w - 0.24, h * 0.34, rotulo.toUpperCase(), { size: 8, b: true, color: cr, v: 'top' }),
  ];
}
const linhaKpis = (y, h, itens) => {
  const n = itens.length, gap = n === 3 ? 0.19 : 0.18, w = (9.3 - gap * (n - 1)) / n;
  return itens.flatMap((k, i) => kpi(0.35 + i * (w + gap), y, w, h, k[0], k[1], k[2]));
};

function painel(x, y, w, h, titulo, paras, o = {}) {
  const tam = o.size || 11;
  return [
    caixa(x, y, w, h, o.fill || COR.claro, o.borda || COR.laranja, 1.5),
    txt(x + 0.18, y + 0.1, w - 0.36, 0.22, titulo, { size: o.tsize || 10, b: true, color: o.tcor || COR.teal, v: 'mid' }),
    txt(x + 0.18, y + 0.38, w - 0.36, h - 0.5, paras, { size: tam, color: COR.txt, v: 'top', gap: o.gap ?? 6 }),
  ];
}

// células: texto ou {text, color, b}; 1ª coluna à esquerda
function tabela(x, y, w, colW, cab, linhas, o = {}) {
  return { t: 'tab', x, y, w, colW, cab, linhas, rowH: o.rowH || 0.26, size: o.size || 10, hsize: o.hsize || 10.5 };
}

const paraTexto = (s) => String(s).split(/\n\s*\n|\n/).filter((p) => p.trim()).map((p) => [{ text: p.trim() }]);
const bullets = (itens, marca = '•') => itens.map((i) => [{ text: marca + ' ' + i }]);
const tamPorTamanho = (s, base, min) => { const n = String(s).length; return n > 1500 ? min : n > 1100 ? (base + min) / 2 : base; };

// ---------- montagem ----------
export function montarSlides(c, linhas, extras, resumoMes, textoSugerido) {
  const j = c.j;
  const unidade = j.cabecalho || 'RPC – MERVIL – LOGÍSTICA';
  const rod = `${unidade}  •  PRESTAÇÃO DE CONTAS  •  ${nomeMes(c.mes).toUpperCase()}`;
  const cod = j.conta_codigo || '415007';
  const nomeConta = j.conta_nome || 'SERV. LOCAÇÃO DE VEICULO (PJ)';
  const curta = j.conta_curta || 'Locação de Veículos';
  const tituloConta = `${cod} – ${curta}`;
  const contaLonga = `${cod} – ${nomeConta}`;
  const acima = c.temOrc && c.dif > 0;
  const tomDif = c.temOrc ? (c.dif > 0 ? 'r' : 'b') : 'n';
  const S = [];

  // 1. capa
  const tit = (j.titulo || 'RPC – MERVIL | LOGÍSTICA').split('|').map((p) => [{ text: p.trim() }]);
  S.push([
    txt(0.6, 0.5, 8.8, 1.35, tit, { size: 32, b: true, color: COR.teal, v: 'mid', gap: 0, lh: 1.0 }),
    { t: 'img', x: 3.35, y: 2.05, w: 3.3, h: 1.36 },
    txt(5.0, 4.55, 4.3, 0.5, nomeMes(c.mes).toUpperCase(), { size: 20, b: true, color: COR.teal, v: 'mid', a: 'r' }),
    txt(0.6, 4.65, 4.8, 0.4, j.responsavel ? 'Responsável: ' + j.responsavel : '', { size: 12, color: COR.cinza, v: 'mid' }),
    rodape(`VIEIRA DISTRIBUIDOR  •  ${unidade}  •  PRESTAÇÃO DE CONTAS`),
  ].flat());

  if (c.temOrc) {
    // 2. resumo executivo
    const leitura = acima
      ? `Acima do orçamento de ${R(c.dif)} (${pct(c.var)}) em relação ao total orçado de ${R(c.orc)}.`
      : `Abaixo do orçamento em ${R(-c.dif)} (${pct(c.var)}) em relação ao total orçado de ${R(c.orc)}.`;
    S.push([
      base('Resumo Executivo', `Prestação de Contas – ${Mes(c.mes)}`, rod),
      linhaKpis(1.14, 0.98, [['1', 'Contas apresentadas'], [R(c.orc), 'Total orçado'], [R(c.realizado), 'Total realizado', 'd'], [pct(c.var), 'Variação %', tomDif === 'r' ? 'r' : 'n']]),
      linhaKpis(2.3, 0.98, [[R(c.dif), 'Diferença (real. − orç.)', tomDif === 'r' ? 'r' : 'n'], [acima ? '1' : '0', 'Contas acima do orçamento', 'r'], [!acima && c.dif < 0 ? '1' : '0', 'Contas abaixo do orçamento'], [c.dif === 0 ? '1' : '0', 'Contas dentro do orçamento', 'z']]),
      painel(0.35, 3.44, 9.3, 1.0, 'LEITURA EXECUTIVA', leitura + (c.totalNfs ? ` Realizado sem ${R(c.totalNfs)} de notas de outra competência.` : '')),
    ].flat());

    // 3. visão geral financeira
    S.push([
      base('Visão Geral Financeira', 'Orçado x Realizado — principais contas', rod),
      { t: 'chart', x: 0.35, y: 1.14, w: 9.3, h: 4.1, cats: [contaLonga], series: [{ name: 'Orçado', values: [c.orc], color: COR.barra }, { name: 'Realizado', values: [c.realizado], color: COR.verde }] },
    ].flat());

    // 4. conta
    const lin = [];
    if (c.medioOrc) {
      lin.push([{ text: 'Custo planejado/viagem: ' }, { text: R(c.medioOrc), b: true }]);
      lin.push([{ text: 'Custo realizado/viagem: ' }, { text: `${R(c.medioReal)} → ${pct2(varr(c.medioOrc, c.medioReal))}`, b: true }]);
    }
    if (c.medioAnt) lin.push([{ text: 'Custo mês anterior: ' }, { text: R(c.medioAnt), b: true }, { text: ' → mês atual ' }, { text: pct2(varr(c.medioAnt, c.medioReal)), b: true }]);
    if (j.reajuste_pct) lin.push([{ text: 'Reajuste do frete: ' }, { text: '+' + dec2.format(j.reajuste_pct) + '%', b: true }, ...(j.reajuste_desde ? [{ text: ' (desde ' + j.reajuste_desde + ')' }] : [])]);
    if (c.vo) lin.push([{ text: 'Viagens: ' }, { text: pct(varr(c.vo, c.viagens)), b: true }]);
    if (c.po) lin.push([{ text: 'Peso transportado: ' }, { text: pct(varr(c.po, c.peso)), b: true }]);
    S.push([
      base(nomeConta, 'Conta ' + cod, rod),
      linhaKpis(1.14, 0.92, [[R(c.orc), 'Orçado'], [R(c.realizado), 'Realizado', 'd'], [R(Math.abs(c.dif)), 'Diferença', tomDif === 'r' ? 'r' : 'n'], [pct(c.var), 'Variação', tomDif === 'r' ? 'r' : 'n']]),
      caixa(0.35, 2.22, 2.6, 0.38, acima ? COR.verm : COR.verde, null),
      txt(0.35, 2.22, 2.6, 0.38, acima ? 'Acima do orçamento' : 'Dentro do orçamento', { size: 11.5, b: true, color: COR.branco, v: 'mid', a: 'c' }),
      painel(0.35, 2.74, 9.3, 2.0, 'JUSTIFICATIVA', lin, { size: lin.length > 5 ? 12 : 13, gap: 0 }),
    ].flat());
  }

  // efeito de competência (notas de outro mês)
  if (c.totalNfs) {
    const linhasNf = c.nfs.map((n) => [n.fornecedor || '', n.nf || '', R(n.valor)]).concat([[{ text: 'Total', b: true }, '', { text: R(c.totalNfs), b: true }]]);
    const hTab = 0.26 * (linhasNf.length + 1);
    S.push([
      base(tituloConta, 'Efeito de competência – notas fiscais de outro mês', rod),
      linhaKpis(1.14, 0.92, [[R(c.contabil), 'Realizado contábil'], [R(c.totalNfs), 'Notas de outra competência', 'r'], [R(c.realizado), 'Realizado ajustado', 'd'], ...(c.temOrc ? [[sinalR(c.dif), 'Desvio operacional', 'd']] : [])]),
      tabela(0.35, 2.22, 9.3, [5.3, 1.6, 2.4], ['Fornecedor', 'NF', 'Valor'], linhasNf),
      painel(0.35, Math.min(2.22 + hTab + 0.16, 4.2), 9.3, Math.max(0.9, 5.25 - Math.min(2.22 + hTab + 0.16, 4.2)), 'EFEITO DE COMPETÊNCIA',
        `O realizado contábil de ${R(c.contabil)} inclui ${R(c.totalNfs)} de ${c.nfs.length === 1 ? 'uma nota fiscal' : c.nfs.length + ' notas fiscais'} de outra competência. Após retirar esse efeito, o realizado ajustado de ${nomeMes(c.mes)} é ${R(c.realizado)}${c.temOrc ? `, com desvio operacional de ${sinalR(c.dif)} (${pct(c.var)})` : ''}.`),
    ].flat());
  }

  if (c.temOrc) {
    // 5. análise operacional
    const lin = [];
    if (c.vo) lin.push(['Viagens', N(c.vo), N(c.viagens), pct(varr(c.vo, c.viagens))]);
    if (c.po) lin.push(['Peso (t)', T1(c.po), T1(c.peso), pct(varr(c.po, c.peso))]);
    if (c.pesoMedioOrc) lin.push(['Peso médio/viagem', dec2.format(c.pesoMedioOrc) + ' kg', dec2.format(c.pesoMedio) + ' kg', pct(varr(c.pesoMedioOrc, c.pesoMedio))]);
    if (c.medioOrc) {
      lin.push(['Custo por viagens realizadas', R(c.custoViagensOrc), R(c.realizado), pct(varr(c.custoViagensOrc, c.realizado))]);
      lin.push(['Valor médio por viagem', R(c.medioOrc), R(c.medioReal), pct(varr(c.medioOrc, c.medioReal))]);
    }
    const an = [];
    if (c.vo && c.viagens > c.vo) an.push('Parte da variação da despesa pode estar relacionada ao volume de viagens realizado acima do planejamento.');
    if (c.vo && c.viagens < c.vo) an.push('O volume de viagens ficou abaixo do planejamento.');
    if (c.medioOrc) an.push(c.medioReal > c.medioOrc ? 'Mesmo considerando o volume efetivamente realizado, o custo apresentou comportamento superior ao parâmetro orçamentário por viagem.' : 'Considerando o volume efetivamente realizado, o custo por viagem ficou dentro do parâmetro orçamentário.');
    if (c.po) an.push(c.peso > c.po ? 'O volume transportado em toneladas superou o planejamento, indicando aumento da demanda operacional.' : 'O volume transportado em toneladas ficou abaixo do planejamento.');
    const yTab = 2.14, hTab = 0.26 * (lin.length + 1);
    const yP = Math.max(3.78, yTab + hTab + 0.12);
    S.push([
      base(tituloConta, 'Análise Operacional', rod),
      linhaKpis(1.14, 0.92, [[R(c.orc), 'Orçamento'], [N(c.viagens), 'Viagens realizadas'], [R(c.realizado), 'Realizado total', 'd'], [sinalR(c.dif), acima ? 'Acima do orçado' : 'Abaixo do orçado', 'd']]),
      lin.length ? tabela(0.35, yTab, 9.3, [3.0, 2.1, 2.1, 2.1], ['Indicador', 'Planejado', 'Realizado', 'Variação'], lin.map((l) => [{ text: l[0], b: true }, ...l.slice(1)])) : [],
      an.length ? painel(0.35, yP, 9.3, 5.3 - yP, 'ANÁLISE', bullets(an), { gap: 4, size: an.length > 3 ? 10 : 11 }) : [],
    ].flat());
  }

  if (c.temOrc && c.volume != null) {
    // 6. separação volume x reajuste
    const dv = c.viagens - c.vo;
    const pv = c.dif ? c.volume / c.dif : null, pr = c.dif ? c.reajuste / c.dif : null;
    const passos = [
      ['', 'ORÇAMENTO', R(c.orc)],
      [c.volume >= 0 ? '+' : '−', `VOLUME (${dv >= 0 ? '+' : ''}${N(dv)} VIAGENS)`, (c.volume >= 0 ? '+ ' : '− ') + R(Math.abs(c.volume))],
      [c.reajuste >= 0 ? '+' : '−', 'REAJUSTE / CUSTO POR VIAGEM', (c.reajuste >= 0 ? '+ ' : '− ') + R(Math.abs(c.reajuste))],
      ['=', 'REALIZADO', R(c.realizado)],
    ];
    const xs = [0.35, 2.73, 5.12, 7.5];
    const fluxo = passos.flatMap((p, i) => {
      const x = xs[i], ult = i === 3;
      return [
        caixa(x, 2.26, 2.15, 1.3, ult ? COR.verde : COR.branco, COR.verde, 1.5),
        txt(x, 2.34, 2.15, 0.3, p[0], { size: 16, b: true, color: COR.laranja, v: 'mid', a: 'c' }),
        txt(x + 0.06, 2.66, 2.02, 0.34, p[1], { size: 8, b: true, color: ult ? COR.branco : COR.txt, v: 'top', a: 'c' }),
        txt(x + 0.06, 3.22, 2.02, 0.28, p[2], { size: 11.5, b: true, color: ult ? COR.branco : COR.verde, v: 'mid', a: 'c' }),
        ...(i < 3 ? [{ t: 'arrow', x: [2.52, 4.91, 7.29][i], y: 2.82, w: 0.18, h: 0.18, fill: COR.laranja }] : []),
      ];
    });
    S.push([
      base(tituloConta, 'Separação do impacto por volume e por reajuste', rod),
      linhaKpis(1.14, 0.9, [[R(c.orc), 'Orçamento base'], [(c.volume >= 0 ? '+ ' : '− ') + R(Math.abs(c.volume)), 'Impacto do volume'], [(c.reajuste >= 0 ? '+ ' : '− ') + R(Math.abs(c.reajuste)), 'Impacto do reajuste']]),
      fluxo,
      tabela(0.35, 4.1, 9.3, [4.5, 2.4, 2.4], ['Componente', 'Impacto', '% do desvio total'], [
        [{ text: 'Volume (viagens)', b: true }, R(c.volume), pv == null ? '—' : dec1.format(pv * 100) + '%'],
        [{ text: 'Reajuste / custo por viagem', b: true }, R(c.reajuste), pr == null ? '—' : dec1.format(pr * 100) + '%'],
      ]),
    ].flat());
  }

  if (extras) S.push(...slidesExtras(c, linhas, rod, resumoMes));

  // 7. justificativa do gestor
  const just = (j.justificativa || '').trim() || textoSugerido(c);
  if (just) {
    S.push([
      base(tituloConta, 'Justificativa do Gestor', rod),
      painel(0.35, 1.14, 9.3, 4.15, 'JUSTIFICATIVA DO GESTOR', paraTexto(just), { size: tamPorTamanho(just, 11, 9), gap: 8 }),
    ].flat());
  }

  // 8. conclusões
  const item = `${contaLonga}: ${R(Math.abs(c.dif ?? 0))} (${pct(c.var)})`;
  const nenhuma = [[{ text: 'Nenhuma conta identificada no período.', color: COR.cinza, size: 10 }]];
  const acoes = (j.acoes || '').split('\n').map((x) => x.replace(/^[•\-➔\s]+/, '').trim()).filter(Boolean);
  const rec = acoes.length ? acoes : c.temOrc && acima ? [`Revisar o planejamento orçamentário da conta ${contaLonga}, que apresentou desvio de ${pct(c.var)} acima do orçado.`] : [];
  if (c.temOrc || acoes.length) {
    const quad = (x, y, cor, titulo, corpo, size = 10) => [
      caixa(x, y, 4.55, 1.9, COR.branco, cor, 1.5),
      txt(x + 0.14, y + 0.08, 4.29, 0.24, titulo, { size: 9.5, b: true, color: cor, v: 'mid' }),
      txt(x + 0.14, y + 0.34, 4.29, 1.48, corpo, { size, color: COR.txt, v: 'top', gap: 4 }),
    ];
    S.push([
      base('Conclusões e Pontos de Atenção', Mes(c.mes), rod),
      quad(0.35, 1.14, COR.verde, 'PRINCIPAIS DESVIOS POSITIVOS (ECONOMIA)', c.temOrc && c.dif < 0 ? bullets([item], '●') : nenhuma),
      quad(5.1, 1.14, COR.verm, 'PRINCIPAIS DESVIOS NEGATIVOS (ACIMA DO ORÇADO)', acima ? bullets([item], '●') : nenhuma),
      quad(0.35, 3.2, COR.teal, 'PONTOS DE ATENÇÃO (MAIOR IMPACTO FINANCEIRO)', c.temOrc ? bullets([item], '●') : nenhuma),
      quad(5.1, 3.2, COR.laranja, 'RECOMENDAÇÕES', rec.length ? bullets(rec, '➔') : nenhuma, rec.length > 3 ? 9 : 9.5),
    ].flat());
  }
  return S;
}

// Slides com dados da base de fretes do app, no mesmo modelo.
function slidesExtras(c, linhas, rod, resumoMes) {
  const S = [];
  const s = c.s, p = c.p;
  const cel = (v, ruim) => (ruim == null ? v : { text: v, color: ruim ? COR.verm : COR.verde });
  const lin = (rot, a, b, f, menorMelhor = true) => { const v = varr(a, b); return [{ text: rot, b: true }, f(a), f(b), cel(pct(v), v == null || !menorMelhor ? null : v > 0)]; };
  const pp = (rot, a, b, f = (x) => pct(x, false)) => {
    const d = a != null && b != null ? b - a : null;
    return [{ text: rot, b: true }, f(a), f(b), cel(d == null ? '—' : (d >= 0 ? '+' : '') + dec2.format(d * 100) + ' p.p.', d == null ? null : d > 0)];
  };
  const linhas1 = [
    lin('Viagens de agregados', p.viagens, s.viagens, N, false), lin('Frete total', p.frete, s.frete, R), lin('Valor médio por viagem', p.medio, s.medio, R),
    lin('Km rodados', p.km, s.km, N, false), lin('Custo por km', p.r_km, s.r_km, R), lin('Entregas', p.entregas, s.entregas, N, false),
    lin('Custo por entrega', p.r_entrega, s.r_entrega, R), lin('Peso transportado', p.peso, s.peso, T1, false), lin('Custo por tonelada', p.r_ton, s.r_ton, R),
    pp('Frete sobre o valor da carga', p.pct_carga, s.pct_carga), pp('Viagens com pernoite', p.pct_pernoite, s.pct_pernoite), pp('Km rodado acima do programado', p.dispersao, s.dispersao, (x) => pct(x)),
  ];
  S.push([
    base('Indicadores da Operação', `Base de fretes dos agregados – ${nomeMes(p.mes)} x ${nomeMes(s.mes)}`, rod),
    tabela(0.35, 1.14, 9.3, [3.3, 2.0, 2.0, 2.0], ['Indicador', Mes(p.mes), Mes(s.mes), 'Variação'], linhas1, { rowH: 0.27, size: 9.5 }),
    txt(0.35, 4.75, 9.3, 0.5, 'Valores da base de fretes importada no app: só agregados com valor de frete, frota própria fora. Podem diferir do realizado contábil.', { size: 9, color: COR.cinza, v: 'mid' }),
  ].flat());

  const meses = [...new Set(linhas.filter((r) => !r.frota_propria && r.data).map((r) => r.data.slice(0, 7)))].sort().filter((m) => m <= c.mes).slice(-6);
  if (meses.length > 1) {
    const ms = meses.map((m) => resumoMes(linhas, m));
    S.push([
      base('Evolução Mensal', 'Frete dos agregados na base do app', rod),
      { t: 'chart', x: 0.35, y: 1.14, w: 4.4, h: 4.1, cats: ms.map((m) => Mes(m.mes)), series: [{ name: 'Frete', values: ms.map((m) => m.frete), color: COR.verde }], legenda: false },
      tabela(4.95, 1.14, 4.7, [1.25, 0.7, 1.5, 1.25], ['Mês', 'Viagens', 'Frete', 'Médio/viagem'], ms.map((m) => [{ text: Mes(m.mes), b: true }, N(m.viagens), R(m.frete), R(m.medio)]), { size: 9.5 }),
      tabela(4.95, 1.14 + 0.26 * (ms.length + 1) + 0.25, 4.7, [1.25, 1.15, 1.15, 1.15], ['Mês', 'R$/km', 'R$/entrega', 'Frete/carga'], ms.map((m) => [{ text: Mes(m.mes), b: true }, R(m.r_km), R(m.r_entrega), pct(m.pct_carga, false)]), { size: 9.5 }),
    ].flat());
  }

  const por = (rs) => rs.reduce((mp, r) => { const k = r.transportador || '—'; const o = mp.get(k) || { v: 0, f: 0 }; o.v += 1; o.f += r.frete_total || 0; mp.set(k, o); return mp; }, new Map());
  const a = por(p.linhas), b = por(s.linhas);
  const tr = [...new Set([...a.keys(), ...b.keys()])].map((n) => ({ n, va: a.get(n)?.v || 0, vb: b.get(n)?.v || 0, fa: a.get(n)?.f || 0, fb: b.get(n)?.f || 0 }))
    .map((x) => ({ ...x, d: x.fb - x.fa })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 12);
  if (tr.length) {
    S.push([
      base('Onde o Custo Mudou', `Transportadores com maior variação de frete – ${nomeMes(p.mes)} x ${nomeMes(s.mes)}`, rod),
      tabela(0.35, 1.14, 9.3, [3.1, 1.1, 1.1, 1.3, 1.3, 1.4], ['Transportador', 'Viagens ant.', 'Viagens', 'Frete ant.', 'Frete', 'Diferença'],
        tr.map((x) => [{ text: x.n, b: true }, N(x.va), N(x.vb), R(x.fa), R(x.fb), { text: sinalR(x.d), color: x.d > 0 ? COR.verm : COR.verde }]), { size: 9.5, rowH: 0.27 }),
    ].flat());
  }
  return S;
}

// ---------- HTML ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const px = (v, total) => (v / total) * 100 + '%';
const fs = (pt) => (pt * 100 / 72 / LARG).toFixed(3) + 'cqw'; // pt → largura do slide
const inch = (v) => (v * 100 / LARG).toFixed(3) + 'cqw';
const pos = (p) => `left:${px(p.x, LARG)};top:${px(p.y, ALT)};width:${px(p.w, LARG)};height:${px(p.h, ALT)};`;
const val = (n) => (typeof n === 'number' ? n : 0);

function htmlPeca(p) {
  if (p.t === 'rect') {
    const raio = p.r ? inch(0.06) : 0; // cantos de 0,06" como no original
    return `<div class="sl-p" style="${pos(p)}background:${p.fill ? '#' + p.fill : 'transparent'};${p.line ? `border:${fs(p.lw)} solid #${p.line};` : ''}border-radius:${raio}"></div>`;
  }
  if (p.t === 'line') return `<div class="sl-p" style="left:${px(p.x, LARG)};top:${px(p.y, ALT)};width:${px(p.w, LARG)};border-top:${fs(p.lw)} solid #${p.color}"></div>`;
  if (p.t === 'img') return `<img class="sl-p" src="${LOGO}" alt="Vieira Distribuidor" style="${pos(p)}object-fit:contain">`;
  if (p.t === 'arrow') return `<div class="sl-p sl-seta" style="${pos(p)}background:#${p.fill}"></div>`;
  if (p.t === 'txt') {
    const just = p.v === 'mid' ? 'center' : p.v === 'bot' ? 'flex-end' : 'flex-start';
    const paras = p.paras.map((runs) => `<p style="margin:0 0 ${fs(p.gap || 0)}">${runs.map((r) => `<span style="${r.b ?? p.b ? 'font-weight:700;' : ''}${r.color ? 'color:#' + r.color + ';' : ''}${r.size ? 'font-size:' + fs(r.size) + ';' : ''}">${esc(r.text)}</span>`).join('')}</p>`).join('');
    return `<div class="sl-p sl-txt" style="${pos(p)}justify-content:${just};text-align:${p.a === 'r' ? 'right' : p.a === 'c' ? 'center' : 'left'};font-size:${fs(p.size)};color:#${p.color};${p.b ? 'font-weight:700;' : ''}line-height:${p.lh || 1.2}">${paras}</div>`;
  }
  if (p.t === 'tab') {
    const tot = p.colW.reduce((a, b) => a + b, 0);
    const cell = (v, k, cab) => {
      const o = typeof v === 'object' && v ? v : { text: v };
      return `<${cab ? 'th' : 'td'} style="text-align:${k ? 'right' : 'left'};${cab ? 'font-size:' + fs(p.hsize) + ';' : ''}${o.b ? 'font-weight:700;' : ''}${o.color ? 'color:#' + o.color : ''}">${esc(o.text)}</${cab ? 'th' : 'td'}>`;
    };
    return `<table class="sl-p sl-tab" style="left:${px(p.x, LARG)};top:${px(p.y, ALT)};width:${px(p.w, LARG)};font-size:${fs(p.size)}">
      <colgroup>${p.colW.map((w) => `<col style="width:${(w / tot) * 100}%">`).join('')}</colgroup>
      <thead><tr style="height:${inch(p.rowH)}">${p.cab.map((h, k) => cell(h, k, true)).join('')}</tr></thead>
      <tbody>${p.linhas.map((l, i) => `<tr style="height:${inch(p.rowH)};background:#${i % 2 ? COR.claro : COR.branco}">${l.map((v, k) => cell(v, k)).join('')}</tr>`).join('')}</tbody></table>`;
  }
  if (p.t === 'chart') return `<div class="sl-p" style="${pos(p)}">${svgGrafico(p)}</div>`;
  return '';
}

function svgGrafico(p) {
  const W = 1000, H = Math.round(1000 * p.h / p.w);
  const leg = p.legenda !== false && p.series.length > 1;
  const fsz = Math.round(W * 9 / 72 / p.w);
  const top = 20, bot = (leg ? 4.5 : 2.8) * fsz, left = 4.6 * fsz, right = 20;
  const max = Math.max(...p.series.flatMap((s) => s.values.map(val))) || 1;
  const passo = Math.pow(10, Math.floor(Math.log10(max / 5)));
  const m = [1, 2, 2.5, 5, 10].map((k) => k * passo).find((k) => max / k <= 10) || passo * 10;
  const topo = Math.ceil(max / m) * m;
  const y = (v) => top + (H - top - bot) * (1 - v / topo);
  const grade = [];
  for (let v = 0; v <= topo + 1e-9; v += m) grade.push(`<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="#${COR.borda}"/><text x="${left - 10}" y="${y(v) + fsz / 3}" text-anchor="end" font-size="${fsz * 0.9}" fill="#${COR.cinza}">${int.format(v)}</text>`);
  const nc = p.cats.length, ns = p.series.length, larg = (W - left - right) / nc;
  const bw = larg / (ns + 0.35); // espaço entre grupos de 35% da largura da barra, como no gráfico original
  const barras = p.cats.map((cName, i) => {
    const x0 = left + i * larg + (larg - bw * ns) / 2;
    return p.series.map((s, k) => `<rect x="${x0 + k * bw}" y="${y(val(s.values[i]))}" width="${bw}" height="${y(0) - y(val(s.values[i]))}" fill="#${s.color}"><title>${esc(s.name)}: ${esc(R(s.values[i]))}</title></rect>`).join('')
      + `<text x="${left + i * larg + larg / 2}" y="${y(0) + fsz * 1.5}" text-anchor="middle" font-size="${fsz}" fill="#${COR.cinza}">${esc(cName)}</text>`;
  }).join('');
  const legenda = leg ? `<g transform="translate(${W / 2},${H - 20})">${p.series.map((s, k) => `<rect x="${(k - ns / 2) * 140 + 10}" y="${-fsz * 0.8}" width="${fsz * 0.8}" height="${fsz * 0.8}" fill="#${s.color}"/><text x="${(k - ns / 2) * 140 + 18 + fsz * 0.8}" y="0" font-size="${fsz * 0.9}" fill="#${COR.cinza}">${esc(s.name)}</text>`).join('')}</g>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="${esc(p.series.map((s) => s.name + ' ' + s.values.map(R).join(', ')).join('; '))}">${grade.join('')}<line x1="${left}" x2="${W - right}" y1="${y(0)}" y2="${y(0)}" stroke="#${COR.neutro}"/>${barras}${legenda}</svg>`;
}

export function htmlSlide(pecas, i, total) {
  return `<article class="sl" aria-label="Slide ${i + 1} de ${total}">${pecas.map(htmlPeca).join('')}</article>`;
}

// ---------- PowerPoint ----------
let pronto = null;
function carregar() {
  if (window.PptxGenJS) return Promise.resolve();
  pronto ??= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'vendor/pptxgen.bundle.js';
    s.onload = ok; s.onerror = () => { pronto = null; erro(new Error('não consegui carregar a biblioteca do PowerPoint')); };
    document.head.appendChild(s);
  });
  return pronto;
}
async function logoDataUrl() {
  const b = await (await fetch(LOGO)).blob();
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
}

export async function gerarPptx(slides, nome) {
  await carregar();
  const logo = await logoDataUrl();
  const pp = new window.PptxGenJS();
  pp.defineLayout({ name: 'VIEIRA', width: LARG, height: ALT });
  pp.layout = 'VIEIRA';
  const F = 'Arial';
  const M = [7.2, 7.2, 3.6, 3.6]; // margens internas padrão do PowerPoint (0,1" e 0,05")
  for (const pecas of slides) {
    const s = pp.addSlide();
    s.background = { color: COR.branco };
    for (const p of pecas) {
      if (p.t === 'rect') {
        s.addShape(p.r ? pp.ShapeType.roundRect : pp.ShapeType.rect, {
          x: p.x, y: p.y, w: p.w, h: p.h, fill: { color: p.fill || COR.branco, transparency: p.fill ? 0 : 100 },
          line: p.line ? { color: p.line, width: p.lw } : { type: 'none' }, ...(p.r ? { rectRadius: 0.06 } : {}),
        });
      } else if (p.t === 'line') {
        s.addShape(pp.ShapeType.line, { x: p.x, y: p.y, w: p.w, h: 0, line: { color: p.color, width: p.lw } });
      } else if (p.t === 'arrow') {
        s.addShape(pp.ShapeType.rightArrow, { x: p.x, y: p.y, w: p.w, h: p.h, fill: { color: p.fill }, line: { type: 'none' } });
      } else if (p.t === 'img') {
        s.addImage({ data: logo, x: p.x, y: p.y, w: p.w, h: p.h, sizing: { type: 'contain', w: p.w, h: p.h } });
      } else if (p.t === 'txt') {
        const runs = [];
        p.paras.forEach((para, k) => para.forEach((r, n) => runs.push({
          text: r.text,
          options: {
            bold: r.b ?? p.b ?? false, color: r.color || p.color, fontSize: r.size || p.size, fontFace: F,
            ...(n === para.length - 1 && k < p.paras.length - 1 ? { breakLine: true } : {}),
            ...(p.gap && n === 0 ? { paraSpaceAfter: p.gap } : {}),
          },
        })));
        s.addText(runs.length ? runs : '', {
          x: p.x, y: p.y, w: p.w, h: p.h, fontFace: F, fontSize: p.size, color: p.color, bold: !!p.b, margin: M,
          align: p.a === 'r' ? 'right' : p.a === 'c' ? 'center' : 'left', valign: p.v === 'mid' ? 'middle' : p.v === 'bot' ? 'bottom' : 'top',
          ...(p.lh ? { lineSpacingMultiple: p.lh } : {}),
        });
      } else if (p.t === 'tab') {
        const cel = (v, k, cab, i) => {
          const o = typeof v === 'object' && v ? v : { text: v };
          return {
            text: String(o.text ?? ''),
            options: cab
              ? { bold: true, color: COR.branco, fill: { color: COR.verde }, align: k ? 'right' : 'left', fontSize: p.hsize }
              : { bold: !!o.b, color: o.color || COR.txt, fill: { color: i % 2 ? COR.claro : COR.branco }, align: k ? 'right' : 'left' },
          };
        };
        const rows = [p.cab.map((h, k) => cel(h, k, true))].concat(p.linhas.map((l, i) => l.map((v, k) => cel(v, k, false, i))));
        s.addTable(rows, {
          x: p.x, y: p.y, w: p.w, colW: p.colW, rowH: p.rowH, fontFace: F, fontSize: p.size, valign: 'middle',
          border: { type: 'solid', pt: 0.75, color: COR.borda }, margin: [0.02, 0.07, 0.02, 0.07], autoPage: false,
        });
      } else if (p.t === 'chart') {
        s.addChart(pp.ChartType.bar, p.series.map((se) => ({ name: se.name, labels: p.cats, values: se.values.map((v) => Math.round(val(v) * 100) / 100) })), {
          x: p.x, y: p.y, w: p.w, h: p.h, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 35,
          chartColors: p.series.map((se) => se.color), showLegend: p.legenda !== false && p.series.length > 1, legendPos: 'b', legendFontSize: 8, legendColor: COR.cinza, legendFontFace: F,
          catAxisLabelColor: COR.cinza, catAxisLabelFontSize: 9, catAxisLabelFontFace: F, valAxisLabelColor: COR.cinza, valAxisLabelFontSize: 8, valAxisLabelFontFace: F,
          valAxisLabelFormatCode: '#,##0', valGridLine: { color: COR.borda, size: 0.75 }, catGridLine: { style: 'none' },
          valAxisLineShow: false, catAxisLineShow: true,
        });
      }
    }
  }
  await pp.writeFile({ fileName: nome });
}

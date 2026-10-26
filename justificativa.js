// Aba "Justificativa de custos": monta, mês a mês, os slides da prestação de contas da conta de frete
// (orçado x realizado, volume x reajuste, indicadores da operação) a partir da base de fretes e dos
// números do orçamento que o administrador digita. Os números digitados ficam em justificativas/{AAAA-MM}.
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { montarSlides, htmlSlide, gerarPptx } from './slides.js';

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

// Período da competência: as datas salvas (a competência não é o mês fechado) ou, sem elas, o mês do calendário.
const fimDoMes = (m) => { const [a, b] = m.split('-').map(Number); return `${m}-${String(new Date(a, b, 0).getDate()).padStart(2, '0')}`; };
export const periodo = (mes, j) => (j && j.periodo_de && j.periodo_ate ? { de: j.periodo_de, ate: j.periodo_ate } : { de: mes + '-01', ate: fimDoMes(mes) });
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const somaMes = (iso) => { const d = new Date(iso + 'T12:00:00'); const dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.toISOString().slice(0, 10); };
export const br = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

// Indicadores de uma competência, com as mesmas regras do painel: só agregados com valor de frete.
export function resumoMes(linhas, mes, per = periodo(mes)) {
  const rs = linhas.filter((r) => !r.frota_propria && r.data && r.data >= per.de && r.data <= per.ate && (r.frete_total || 0) > 0);
  const soma = (f) => rs.reduce((t, r) => t + (Number(r[f]) || 0), 0);
  const comKm = rs.filter((r) => r.km_previsto > 0 && r.km_realizado != null);
  const o = {
    mes, de: per.de, ate: per.ate, viagens: rs.length, frete: soma('frete_total'), peso: soma('peso_kg'), km: soma('km_realizado'),
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
  const s = resumoMes(linhas, mes, periodo(mes, j));
  const p = resumoMes(linhas, mesAnterior(mes), periodo(mesAnterior(mes), jAnt));
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

// ---------- tela ----------
const CAMPOS = [
  ['titulo', 'Título da capa', 'texto', 'RPC – MERVIL | LOGÍSTICA'],
  ['responsavel', 'Responsável', 'texto', ''],
  ['cabecalho', 'Unidade (rodapé)', 'texto', 'RPC – MERVIL – LOGÍSTICA'],
  ['conta_codigo', 'Código da conta', 'texto', '415007'],
  ['conta_nome', 'Nome da conta', 'texto', 'SERV. LOCAÇÃO DE VEICULO (PJ)'],
  ['conta_curta', 'Nome curto da conta', 'texto', 'Locação de Veículos'],
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
  let mes = null, dados = {}, dadosAnt = null, linhas = [], slides = [], atual = 0, docs = {};

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
    const per = periodo(mes, dados);
    $('jc-de').value = per.de; $('jc-ate').value = per.ate;
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
    o.periodo_de = $('jc-de').value || null;
    o.periodo_ate = $('jc-ate').value || null;
    o.justificativa = $('jc-justificativa').value.trim() || null;
    o.acoes = $('jc-acoes').value.trim() || null;
    return o;
  };

  const desenhar = () => {
    if (!mes) return;
    const j = { ...dados, ...lerForm() };
    const c = calcular(linhas, mes, j, dadosAnt);
    const resumoComp = (m) => resumoMes(linhas, m, periodo(m, m === mes ? j : docs[m]));
    slides = montarSlides(c, linhas, $('jc-extras').checked, resumoComp, textoSugerido);
    $('jc-slides').innerHTML = slides.map((s, i) => htmlSlide(s, i, slides.length)).join('');
    $('jc-aviso').textContent = c.temOrc ? '' : 'Preencha o orçamento e as viagens orçadas para aparecerem os slides de orçado x realizado e de volume x reajuste.';
    $('jc-sistema').textContent = `No sistema, a competência ${nomeMes(mes)} (saídas de ${br(c.s.de)} a ${br(c.s.ate)}) tem ${N(c.s.viagens)} viagens de agregados, ${R(c.s.frete)} de frete e ${T(c.s.peso)} transportadas.`;
    if (!$('jc-justificativa').value.trim()) $('jc-justificativa').placeholder = textoSugerido(c) || 'Texto da justificativa';
    if (!raiz.querySelector('.jc-show').hidden) mostrar(atual);
  };

  const abrirMes = async (m) => {
    mes = m;
    $('jc-salvo').textContent = 'Carregando…';
    try {
      const ms = [m]; for (let k = 0; k < 6; k++) ms.push(mesAnterior(ms[ms.length - 1]));
      const lidos = await Promise.all(ms.map((x) => getDoc(doc(db, 'justificativas', x))));
      docs = {}; lidos.forEach((d, k) => { if (d.exists()) docs[ms[k]] = d.data(); });
      const [a, b] = lidos;
      dados = a.exists() ? a.data() : {};
      dadosAnt = b.exists() ? b.data() : null;
      if (!a.exists() && b.exists() && b.data().periodo_ate) {
        // competência nova começa no dia seguinte ao fim da anterior
        dados.periodo_de = somaDias(b.data().periodo_ate, 1);
        dados.periodo_ate = somaMes(b.data().periodo_ate);
      }
      if (!a.exists() && b.exists()) {
        // traz do mês anterior o que costuma se repetir
        for (const k of ['titulo', 'responsavel', 'cabecalho', 'conta_codigo', 'conta_nome', 'conta_curta', 'reajuste_pct', 'reajuste_desde', 'orcado', 'viagens_orc', 'peso_orc_kg']) if (b.data()[k] != null) dados[k] = b.data()[k];
      }
      preencher();
      if (!a.exists() && b.exists()) $('jc-salvo').textContent = 'Mês novo: orçamento e textos fixos vieram de ' + nomeMes(mesAnterior(m)) + '. Confira e salve.';
    } catch (e) {
      dados = {}; dadosAnt = null; docs = {}; preencher();
      $('jc-salvo').textContent = 'Não consegui ler os números salvos (' + (e.code || e.message) + '). Confira se as regras do Firestore foram atualizadas.';
    }
    desenhar();
  };

  const atualizarMeses = () => {
    const sel = $('jc-mes');
    const comDados = [...new Set(linhas.filter((r) => !r.frota_propria && r.data).map((r) => r.data.slice(0, 7)))].sort().reverse();
    if (!comDados.length) return;
    // a competência pode terminar depois da última saída da base, então o mês seguinte também aparece
    const [a, b] = comDados[0].split('-').map(Number);
    const seguinte = b === 12 ? `${a + 1}-01` : `${a}-${String(b + 1).padStart(2, '0')}`;
    const ms = [seguinte, ...comDados];
    const antes = sel.value;
    sel.innerHTML = ms.map((m) => `<option value="${m}">${nomeMes(m)}</option>`).join('');
    const escolha = ms.includes(antes) ? antes : comDados[1] || comDados[0];
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
  $('jc-extras').addEventListener('change', () => desenhar());
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

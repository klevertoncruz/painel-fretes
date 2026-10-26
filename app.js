// Login, leitura da base no Firestore, importação da planilha e correções manuais.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, collection, writeBatch, addDoc, deleteDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const telaLogin = $('login'), telaApp = $('app');
let ehAdmin = false;
let avisoAdmin = '';
let linhasBase = [];
let correcoes = [];

// ---------- login ----------
$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('login-erro').textContent = '';
  $('btn-entrar').disabled = true;
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('senha').value);
  } catch (e) {
    $('login-erro').textContent = mensagemErro(e);
  } finally {
    $('btn-entrar').disabled = false;
  }
});
$('btn-esqueci').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email) { $('login-erro').textContent = 'Digite seu e-mail acima e clique de novo em "Esqueci a senha".'; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    $('login-erro').textContent = 'Enviamos um link para criar uma nova senha em ' + email + '.';
  } catch (e) {
    $('login-erro').textContent = mensagemErro(e);
  }
});
$('btn-sair').addEventListener('click', () => signOut(auth));

function mensagemErro(e) {
  const c = e && e.code ? e.code : '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'E-mail ou senha incorretos.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (c.includes('invalid-email')) return 'Esse e-mail não é válido.';
  if (c.includes('permission-denied')) return 'Seu usuário não tem permissão para isso.';
  return 'Não foi possível concluir: ' + (e && e.message ? e.message : e);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    telaApp.hidden = true;
    telaLogin.hidden = false;
    return;
  }
  telaLogin.hidden = true;
  telaApp.hidden = false;
  $('usuario').textContent = user.email;
  avisoAdmin = '';
  try {
    const adm = await getDoc(doc(db, 'config', 'admins'));
    if (!adm.exists()) {
      avisoAdmin = 'Não achei o documento config/admins no Firestore.';
    } else {
      const campo = adm.data().emails;
      const lista = (Array.isArray(campo) ? campo : [campo]).filter(Boolean).map((e) => String(e).trim().toLowerCase());
      ehAdmin = lista.includes(String(user.email).toLowerCase());
      if (!Array.isArray(campo)) avisoAdmin = 'O campo "emails" de config/admins precisa ser do tipo array.';
      else if (!ehAdmin) avisoAdmin = 'O e-mail ' + user.email + ' não está no campo "emails" de config/admins.';
    }
  } catch (e) {
    ehAdmin = false;
    avisoAdmin = 'Não consegui ler config/admins (' + mensagemErro(e) + '). Confira se as regras do Firestore foram publicadas.';
  }
  document.querySelectorAll('.so-admin').forEach((el) => { el.hidden = !ehAdmin; });
  await carregarBase();
});

// ---------- leitura da base ----------
async function carregarBase() {
  $('status-base').textContent = 'Carregando dados…';
  try {
    const meta = await getDoc(doc(db, 'base', 'meta'));
    if (!meta.exists()) {
      $('status-base').textContent = ehAdmin
        ? 'Nenhuma planilha importada ainda. Use "Importar planilha" para carregar a exportação do sistema.'
        : 'Nenhuma planilha importada ainda. Só administradores podem importar. ' + avisoAdmin;
      linhasBase = [];
      await carregarCorrecoes();
      return;
    }
    const m = meta.data();
    const partes = await getDocs(collection(db, 'base_partes'));
    linhasBase = partes.docs.sort((a, b) => Number(a.id) - Number(b.id)).flatMap((d) => d.data().rows || []);
    const quando = m.importado_em && m.importado_em.toDate ? m.importado_em.toDate().toLocaleString('pt-BR') : '';
    $('status-base').textContent = 'Base: ' + m.arquivo + ' · ' + linhasBase.length + ' linhas · importada em ' + quando + ' por ' + m.importado_por;
    await carregarCorrecoes();
  } catch (e) {
    $('status-base').textContent = mensagemErro(e);
    window.dash._set('fretes', { status: 'error', data: [], message: String(e) });
  }
}

async function carregarCorrecoes() {
  const snap = await getDocs(collection(db, 'correcoes'));
  correcoes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  aplicarEDesenhar();
  desenharCorrecoes();
}

// aplica as correções manuais por número de carregamento, como no painel do Claude
function aplicarEDesenhar() {
  const linhas = linhasBase.map((r) => ({ ...r }));
  for (const c of correcoes) {
    for (const r of linhas) {
      if (!c.conferido && String(r.carregamento).trim() === String(c.carregamento).trim()) r[c.campo] = c.valor;
    }
  }
  window.dash._set('fretes', { status: linhas.length ? 'ok' : 'loading', data: linhas });
  desenharSuspeitos(linhas);
}

// ---------- valores suspeitos ----------
// Mesmos critérios usados na conferência feita no chat: entregas muito acima do normal da rota,
// número que parece ter vindo de outro campo, valor por kg fora da curva e km muito acima do previsto.
const mediana = (xs) => {
  const v = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

function acharSuspeitos(linhas) {
  const agreg = linhas.filter((r) => !r.frota_propria);
  const porRota = new Map();
  for (const r of agreg) {
    if (!porRota.has(r.rota)) porRota.set(r.rota, []);
    porRota.get(r.rota).push(r);
  }
  const medEntRota = new Map([...porRota].map(([k, vs]) => [k, mediana(vs.map((r) => r.entregas))]));
  const medEntGeral = mediana(agreg.map((r) => r.entregas));
  const medPorKg = mediana(agreg.filter((r) => r.valor_carga && r.peso_kg).map((r) => r.valor_carga / r.peso_kg));
  const medPeso = mediana(agreg.map((r) => r.peso_kg));
  const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const limiteSemFrete = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const lista = [];
  const add = (r, campo, motivo) => lista.push({ r, campo, motivo });

  for (const r of agreg) {
    const medE = (r.rota ? medEntRota.get(r.rota) : medEntGeral) || 0;
    if (r.entregas != null && r.valor_carga && Math.abs(r.entregas - r.valor_carga) < 1) {
      add(r, 'entregas', 'O número de entregas é igual ao valor da carga (' + brl.format(r.valor_carga) + '). Parece digitado no campo errado.');
    } else if (r.entregas != null && r.entregas >= Math.max(40, 3 * medE)) {
      add(r, 'entregas', fmt.format(r.entregas) + ' entregas. O normal nesta rota é ' + fmt.format(medE) + '.');
    }
    if (r.peso_kg && r.valor_carga && Math.abs(r.peso_kg - r.valor_carga) < 0.01) {
      add(r, 'peso_kg', 'O peso é igual ao valor da carga. Parece que o valor foi copiado para o peso.');
    } else if (r.peso_kg && medPeso && r.peso_kg > Math.max(20000, 4 * medPeso)) {
      add(r, 'peso_kg', fmt.format(r.peso_kg) + ' kg. O normal é ' + fmt.format(medPeso) + ' kg por carga.');
    }
    if (r.valor_carga && r.peso_kg && medPorKg && r.valor_carga / r.peso_kg > 8 * medPorKg) {
      add(r, 'valor_carga', brl.format(r.valor_carga / r.peso_kg) + ' por kg. O normal é ' + brl.format(medPorKg) + ' por kg. Pode faltar a vírgula ou ter um dígito a mais.');
    }
    if (r.km_realizado != null && r.km_realizado < 0) {
      add(r, 'km_realizado', 'Km rodado negativo.');
    } else if (r.km_realizado != null && r.km_previsto && r.km_realizado > 3 * r.km_previsto && r.km_realizado - r.km_previsto > 150) {
      add(r, 'km_realizado', fmt.format(r.km_realizado) + ' km rodados para ' + fmt.format(r.km_previsto) + ' km previstos.');
    }
    if (r.frete_total == null && r.data && r.data < limiteSemFrete) {
      add(r, 'frete_total', 'Viagem sem valor de frete há mais de 3 dias. Ela fica fora do fechamento.');
    }
  }
  // tira o que já tem correção ou foi marcado como certo para o mesmo carregamento e campo
  const tratados = new Set(correcoes.map((c) => String(c.carregamento).trim() + '|' + c.campo));
  return lista.filter((s) => !tratados.has(String(s.r.carregamento).trim() + '|' + s.campo))
    .sort((p, q) => (q.r.data || '').localeCompare(p.r.data || ''));
}

function desenharSuspeitos(linhas) {
  const lista = ehAdmin ? acharSuspeitos(linhas) : [];
  const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  $('qtd-susp').textContent = String(lista.length);
  $('aviso-susp').hidden = !lista.length;
  $('aviso-susp').textContent = String(lista.length);
  $('aviso-susp').title = lista.length + ' valores suspeitos';
  $('susp-vazio').hidden = lista.length > 0;
  $('lista-suspeitos').replaceChildren(...lista.map((s) => {
    const r = s.r;
    const tr = document.createElement('tr');
    const cel = (t, cls) => { const td = document.createElement('td'); td.textContent = t; if (cls) td.className = cls; return td; };
    tr.append(cel(br(r.data), 'fq-l'), cel(r.carregamento, 'fq-l'), cel(r.frota, 'fq-l'), cel(r.rota || '—', 'fq-l'),
      cel(CAMPOS[s.campo] || s.campo, 'fq-l'), cel(r[s.campo] == null ? '—' : fmt.format(r[s.campo]), 'fq-warn'), cel(s.motivo, 'fq-wrap'));
    const acoes = document.createElement('td');
    const box = document.createElement('div'); box.className = 'acoes-susp';
    const corrigir = document.createElement('button');
    corrigir.type = 'button'; corrigir.className = 'btn-primario'; corrigir.textContent = 'Corrigir';
    corrigir.addEventListener('click', () => {
      $('corr-carga').value = r.carregamento;
      $('corr-campo').value = s.campo;
      $('corr-valor').value = '';
      $('corr-motivo').value = s.motivo;
      $('form-correcao').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('corr-valor').focus();
      $('corr-msg').textContent = 'Digite o valor certo de ' + (CAMPOS[s.campo] || s.campo) + ' do carregamento ' + r.carregamento + ' e clique em Salvar correção.';
    });
    const certo = document.createElement('button');
    certo.type = 'button'; certo.className = 'btn-sec'; certo.textContent = 'Está certo';
    certo.addEventListener('click', async () => {
      certo.disabled = true;
      try {
        await addDoc(collection(db, 'correcoes'), {
          carregamento: String(r.carregamento).trim(), campo: s.campo, valor: r[s.campo] ?? null, antes: r[s.campo] ?? null,
          motivo: 'Conferido: o valor está certo.', conferido: true, criado_por: auth.currentUser.email, criado_em: serverTimestamp(),
        });
        await carregarCorrecoes();
      } catch (e) { certo.disabled = false; $('corr-msg').textContent = mensagemErro(e); }
    });
    box.append(corrigir, certo);
    acoes.append(box);
    tr.append(acoes);
    return tr;
  }));
}

// ---------- importação da planilha ----------
const COLUNAS = {
  carregamento: 'Nº Carregamento', data: 'Data Saída', frota: 'Frota', motorista: 'Motorista', transportador: 'Transportador',
  rota: 'Rota', km_previsto: 'KM Previsto', peso_kg: 'Peso (kg)', entregas: 'Entregas', valor_carga: 'Valor Carga (R$)',
  km_realizado: 'KM Realizado', dispersao_km_pct: 'Dispersão KM (%)', pernoites: 'Qtd. Pernoites', tabela: 'Tabela de Valores',
  frete_tabela: 'Vl. Frete s/ Diesel (R$)', frete_manual: 'Vl. Frete Manual (R$)', frete_total: 'Valor Total Frete (R$)',
  custo_carga_pct: '% Custo / Carga', observacao: 'Observação',
};
const NUMERICOS = ['km_previsto', 'peso_kg', 'entregas', 'valor_carga', 'km_realizado', 'dispersao_km_pct', 'pernoites',
  'frete_tabela', 'frete_manual', 'frete_total', 'custo_carga_pct'];

const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let t = String(v).trim().replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const dataISO = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};
const texto = (v) => (v === null || v === undefined ? '' : String(v).trim().replace(/\s+/g, ' '));

function lerPlanilha(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const nome = wb.SheetNames.includes('Fretes Terceiros') ? 'Fretes Terceiros' : wb.SheetNames[0];
  const brutas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { defval: null, raw: true });
  if (!brutas.length) throw new Error('A planilha está vazia.');
  const faltando = Object.values(COLUNAS).filter((c) => !(c in brutas[0]));
  if (faltando.length) throw new Error('Colunas não encontradas: ' + faltando.join(', ') + '. Confira se é a exportação de Fretes Terceiros.');
  const linhas = [];
  brutas.forEach((b, i) => {
    const r = { linha: i + 2 };
    for (const [campo, col] of Object.entries(COLUNAS)) r[campo] = b[col];
    r.data = dataISO(r.data);
    if (!r.data || !texto(r.transportador)) return;
    for (const c of NUMERICOS) r[c] = numero(r[c]);
    for (const c of ['carregamento', 'frota', 'motorista', 'transportador', 'rota', 'tabela']) r[c] = texto(r[c]);
    r.observacao = texto(r.observacao) || null;
    r.frota_propria = / FF /.test(' ' + r.frota + ' ');
    linhas.push(r);
  });
  return linhas;
}

$('arquivo').addEventListener('change', async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  const aviso = $('status-import');
  aviso.textContent = 'Lendo ' + f.name + '…';
  try {
    const linhas = lerPlanilha(await f.arrayBuffer());
    aviso.textContent = 'Enviando ' + linhas.length + ' linhas…';
    const antigas = await getDocs(collection(db, 'base_partes'));
    const lote = writeBatch(db);
    antigas.docs.forEach((d) => lote.delete(d.ref));
    const TAM = 600;
    let partes = 0;
    for (let i = 0; i < linhas.length; i += TAM) {
      lote.set(doc(db, 'base_partes', String(partes)), { rows: linhas.slice(i, i + TAM) });
      partes += 1;
    }
    lote.set(doc(db, 'base', 'meta'), {
      arquivo: f.name, linhas: linhas.length, partes, importado_em: serverTimestamp(), importado_por: auth.currentUser.email,
    });
    await lote.commit();
    const datas = linhas.map((r) => r.data).sort();
    aviso.textContent = 'Importado: ' + linhas.length + ' linhas, saídas de ' + br(datas[0]) + ' a ' + br(datas[datas.length - 1]) + '.';
    await carregarBase();
    const n = Number($('qtd-susp').textContent) || 0;
    if (n) aviso.textContent += ' ' + n + ' valores suspeitos para conferir em Correções.';
  } catch (e) {
    aviso.textContent = 'Não foi possível importar: ' + (e.code ? mensagemErro(e) : e.message);
  }
});
const br = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

// ---------- correções manuais ----------
const CAMPOS = {
  valor_carga: 'Valor da carga (R$)', peso_kg: 'Peso (kg)', entregas: 'Entregas', km_previsto: 'Km previsto',
  km_realizado: 'Km rodado', pernoites: 'Pernoites', frete_total: 'Valor total do frete (R$)',
};
$('corr-campo').replaceChildren(...Object.entries(CAMPOS).map(([v, t]) => new Option(t, v)));
$('btn-correcoes').addEventListener('click', () => { $('painel-correcoes').hidden = !$('painel-correcoes').hidden; });

$('form-correcao').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const carregamento = $('corr-carga').value.trim();
  const valor = numero($('corr-valor').value);
  const msg = $('corr-msg');
  if (!carregamento || valor === null) { msg.textContent = 'Informe o nº do carregamento e um valor numérico.'; return; }
  const campo = $('corr-campo').value;
  const atual = linhasBase.find((r) => String(r.carregamento).trim() === carregamento);
  if (!atual) { msg.textContent = 'Carregamento ' + carregamento + ' não está na base atual.'; return; }
  try {
    await addDoc(collection(db, 'correcoes'), {
      carregamento, campo, valor, antes: atual[campo] ?? null, motivo: $('corr-motivo').value.trim(),
      criado_por: auth.currentUser.email, criado_em: serverTimestamp(),
    });
    msg.textContent = 'Correção salva.';
    $('form-correcao').reset();
    await carregarCorrecoes();
  } catch (e) { msg.textContent = mensagemErro(e); }
});

$('btn-iniciais').addEventListener('click', async () => {
  const msg = $('corr-msg');
  try {
    const iniciais = await (await fetch('correcoes-iniciais.json')).json();
    const lote = writeBatch(db);
    for (const c of iniciais) {
      lote.set(doc(collection(db, 'correcoes')), { ...c, criado_por: auth.currentUser.email, criado_em: serverTimestamp() });
    }
    await lote.commit();
    msg.textContent = iniciais.length + ' correções carregadas.';
    await carregarCorrecoes();
  } catch (e) { msg.textContent = mensagemErro(e); }
});

function desenharCorrecoes() {
  $('btn-iniciais').hidden = !ehAdmin || correcoes.length > 0;
  const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  $('lista-correcoes').replaceChildren(...correcoes.map((c) => {
    const tr = document.createElement('tr');
    const cel = (t, cls) => { const td = document.createElement('td'); td.textContent = t; if (cls) td.className = cls; return td; };
    tr.append(cel(c.carregamento, 'fq-l'), cel(CAMPOS[c.campo] || c.campo, 'fq-l'), cel(c.antes == null ? '—' : fmt.format(c.antes)),
      cel(c.conferido ? 'conferido' : fmt.format(c.valor)), cel(c.motivo || '', 'fq-wrap'));
    const acao = document.createElement('td');
    if (ehAdmin) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fq-copy'; b.textContent = 'Remover';
      b.addEventListener('click', async () => {
        try { await deleteDoc(doc(db, 'correcoes', c.id)); await carregarCorrecoes(); } catch (e) { $('corr-msg').textContent = mensagemErro(e); }
      });
      acao.append(b);
    }
    tr.append(acao);
    return tr;
  }));
  $('qtd-correcoes').textContent = String(correcoes.length);
}

// ---------- exportar Excel (no app o download funciona) ----------
const exportar = $('fq-export');
const novoExportar = exportar.cloneNode(true);
exportar.replaceWith(novoExportar);
novoExportar.lastChild.textContent = 'Exportar Excel';
novoExportar.addEventListener('click', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet($('fq-fech'), { raw: false }), 'Fechamento');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet($('fq-rota')), 'Rotas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet($('fq-oc')), 'Ocorrências');
  const de = $('fq-de').value, ate = $('fq-ate').value;
  XLSX.writeFile(wb, `fechamento_${de || 'inicio'}_a_${ate || 'fim'}.xlsx`);
});

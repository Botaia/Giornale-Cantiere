/* =====================================================================
   Giornale di Cantiere — interfaccia (app.js)
   Pagine: Accesso · Richiesta di accesso · Elenco cantieri · Cantiere
           (Giornale, Imprese, Registro, PDF) · Utenti e permessi
   Tutti i dati passano da window.api (vedi api.js).
   ===================================================================== */
(function () {
'use strict';
const app = document.getElementById('app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- configurazione ---------- */
const RUOLI = { admin: 'Amministratore', dl: 'Direttore dei Lavori', assistente: 'Assistente DL / Tecnico', cse: 'Coordinatore Sicurezza (CSE)', impresa: 'Impresa', lettura: 'Sola lettura' };
const RUOLI_ASSEGNABILI = ['dl', 'assistente', 'cse', 'impresa', 'lettura'];
const TIPI_LAVORI = { pubblico: 'Lavori pubblici', privato: 'Lavori privati', ambientale: 'Progetto ambientale' };
const TIPI_IMPRESA = ['Affidataria / Appaltatrice', 'Subappalto', 'Subaffidamento', 'Lavoratore autonomo', 'Nolo a caldo', 'Fornitore'];
const CIELO = ['Sereno', 'Poco nuvoloso', 'Nuvoloso', 'Coperto', 'Pioggia debole', 'Pioggia forte', 'Temporale', 'Neve', 'Nebbia', 'Grandine'];

// Pagine della giornata e ruoli che possono scriverci (l'amministratore può tutto)
const SEZ = [
  { k: 'riepilogo', t: 'Riepilogo' },
  { k: 'meteo', t: 'Meteo', who: ['dl', 'assistente', 'impresa'] },
  { k: 'presenze', t: 'Imprese e presenze', who: ['dl', 'assistente', 'impresa'], liste: ['presenze'] },
  { k: 'lavorazioni', t: 'Lavorazioni', who: ['dl', 'assistente', 'impresa'], liste: ['lavorazioni'] },
  { k: 'criticita', t: 'Criticità', who: ['dl', 'assistente', 'impresa', 'cse'], liste: ['criticita'] },
  { k: 'dl', t: 'Direzione lavori', who: ['dl'], liste: ['indicazioni', 'ordini'] },
  { k: 'riserve', t: 'Riserve', who: ['impresa'], liste: ['riserve'] },
  { k: 'cse', t: 'Sicurezza CSE', who: ['cse'], liste: ['cse'] },
  { k: 'verbale', t: 'Verbale', who: ['dl', 'cse', 'assistente'], liste: ['verbale'] }
];
const SEZMAP = Object.fromEntries(SEZ.map(s => [s.k, s]));

// Campi di ogni elenco della giornata
const LISTE = {
  presenze: { t: 'Presenze in cantiere', main: 'impresa', f: [
    { k: 'impresa', l: 'Impresa', type: 'impresa', req: 1 }, { k: 'addetti', l: 'N. addetti', type: 'number' }, { k: 'ore', l: 'Ore lavorate', type: 'number' },
    { k: 'mezzi', l: 'Mezzi e attrezzature', type: 'text', full: 1 }, { k: 'note', l: 'Note', type: 'text', full: 1 }] },
  lavorazioni: { t: 'Lavorazioni eseguite', main: 'descrizione', f: [
    { k: 'impresa', l: 'Impresa esecutrice', type: 'impresa' }, { k: 'area', l: 'Area / WBS', type: 'text' },
    { k: 'descrizione', l: 'Descrizione della lavorazione', type: 'textarea', req: 1, full: 1 }, { k: 'stato', l: 'Stato', type: 'select', o: ['In corso', 'Completata', 'Sospesa'] }] },
  criticita: { t: 'Criticità rilevate', main: 'descrizione', f: [
    { k: 'descrizione', l: 'Descrizione', type: 'textarea', req: 1, full: 1 }, { k: 'gravita', l: 'Gravità', type: 'select', o: ['Bassa', 'Media', 'Alta'] },
    { k: 'impresa', l: 'Impresa coinvolta', type: 'impresa' }, { k: 'azione', l: 'Azione correttiva proposta', type: 'textarea', full: 1 }] },
  indicazioni: { t: 'Indicazioni del Direttore dei Lavori', main: 'testo', f: [
    { k: 'impresa', l: 'Destinatario', type: 'impresa' }, { k: 'testo', l: 'Indicazione', type: 'textarea', req: 1, full: 1 }] },
  ordini: { t: 'Ordini di servizio', main: 'oggetto', f: [
    { k: 'numero', l: 'N. ordine', type: 'text' }, { k: 'impresa', l: 'Impresa', type: 'impresa', req: 1 },
    { k: 'oggetto', l: 'Oggetto e disposizioni', type: 'textarea', req: 1, full: 1 }, { k: 'importo', l: 'Importo (€)', type: 'number', step: '0.01' },
    { k: 'termine', l: 'Termine di esecuzione', type: 'date' }, { k: 'stato', l: 'Stato', type: 'select', o: ['Emesso', 'In esecuzione', 'Eseguito'] }] },
  riserve: { t: 'Riserve dell’impresa', main: 'oggetto', f: [
    { k: 'impresa', l: 'Impresa', type: 'impresa', req: 1 }, { k: 'importo', l: 'Importo richiesto (€)', type: 'number', step: '0.01' },
    { k: 'oggetto', l: 'Oggetto della riserva', type: 'textarea', req: 1, full: 1 }, { k: 'motivazione', l: 'Motivazione', type: 'textarea', full: 1 }] },
  cse: { t: 'Indicazioni del CSE', main: 'descrizione', f: [
    { k: 'tipo', l: 'Tipo', type: 'select', o: ['Prescrizione', 'Verifica', 'Non conformità', 'Sospensione lavorazione', 'Ripresa lavorazione'] },
    { k: 'impresa', l: 'Impresa interessata', type: 'impresa' }, { k: 'descrizione', l: 'Descrizione', type: 'textarea', req: 1, full: 1 }, { k: 'termine', l: 'Da attuare entro', type: 'date' }] },
  verbale: { t: 'Verbali di cantiere', main: 'contenuto', f: [
    { k: 'oggetto', l: 'Oggetto', type: 'text', req: 1, full: 1 }, { k: 'presenti', l: 'Presenti', type: 'text', full: 1 },
    { k: 'contenuto', l: 'Contenuto del verbale', type: 'textarea', req: 1, full: 1 }] }
};

/* ---------- stato ---------- */
const S = { view: 'boot', user: null, cantieri: [], imprese: {}, g: null, gLoaded: false, data: isoToday(), sez: 'riepilogo', cview: 'giornale',
  richieste: [], utenti: [], adminTab: 'richieste', editCant: null, reg: null, loginMode: 'login' };

/* ---------- date e formati ---------- */
function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function isoToday() { return isoOf(new Date()); }
function parseIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseIso(s); d.setDate(d.getDate() + n); return isoOf(d); }
function fmtLong(s) { return parseIso(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function fmtShort(s) { return s ? parseIso(s).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; }
function fmtTime(t) { return new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
function daysBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / 864e5); }
const eur = n => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const eurPdf = n => 'EUR ' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const has = v => v !== '' && v != null;

/* ---------- utilità ---------- */
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200); }
function role() { return (S.user && S.user.ruolo) || 'lettura'; }
const isAdmin = () => role() === 'admin';
function cant() { return S.cantieri.find(c => c.id === S.cantiereId); }
function locked() { return !!(S.g && S.g.chiusura && S.g.chiusura.chiusa); }
function canSez(k) { if (isAdmin()) return true; if (locked()) return false; const s = SEZMAP[k]; return !!(s && s.who && s.who.includes(role())); }
function items(arr) { return (arr || []).filter(v => v && !v.eliminata).slice().sort((a, b) => a.t - b.t); }
function impName(id) { const i = S.imprese[id]; return i ? i.ragione : (id ? 'Impresa rimossa' : ''); }
function sign() { return { t: Date.now(), da: S.user.id, daNome: S.user.nome }; }
function errMsg(e) { return (e && e.message) || 'Operazione non riuscita, riprova.'; }

/* ---------- caricamento dati ---------- */
async function loadCantieri() { S.cantieri = await api.listCantieri(); S.cantLoaded = true; }
async function loadImprese() { const l = await api.listImprese(S.cantiereId); S.imprese = Object.fromEntries(l.map(i => [i.id, i])); }
async function loadGiornata() { S.gLoaded = false; render(); S.g = await api.getGiornata(S.cantiereId, S.data); S.gLoaded = true; }
async function loadAdmin() { const [r, u] = await Promise.all([api.listRichieste(), api.listUtenti()]); S.richieste = r.sort((a, b) => a.t - b.t); S.utenti = u.sort((a, b) => String(a.nome).localeCompare(b.nome)); }
async function loadRegistro() {
  const c = cant(); if (!c) return; S.reg = null; render();
  const days = await api.listGiornate(c.id);
  const R = { cid: c.id, giorni: days.length, ordini: [], riserve: [], crit: [] };
  days.forEach(g => {
    items(g.ordini).forEach(x => R.ordini.push(Object.assign({ data: g.data }, x)));
    items(g.riserve).forEach(x => R.riserve.push(Object.assign({ data: g.data }, x)));
    items(g.criticita).filter(x => !x.risolta).forEach(x => R.crit.push(Object.assign({ data: g.data }, x)));
  });
  S.reg = R; render();
}
// Aggiornamento periodico: mostra le registrazioni degli altri utenti (con il server diventerà tempo reale)
setInterval(async () => {
  if (document.hidden || S.view !== 'cantiere' || S.cview !== 'giornale' || !S.gLoaded) return;
  try { const g = await api.getGiornata(S.cantiereId, S.data); if (JSON.stringify(g) !== JSON.stringify(S.g)) { S.g = g; render(); } } catch (_) {}
}, 30000);

/* ---------- render (conserva quanto digitato nei moduli) ---------- */
let keepNext = true;
function render() {
  const keep = {}; let focusId = null;
  if (keepNext) {
    app.querySelectorAll('input[id],select[id],textarea[id]').forEach(el => { if (el.dataset.keep === '0') return; keep[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    const a = document.activeElement; if (a && a.id && app.contains(a)) focusId = a.id;
  }
  const openDetails = new Set([...app.querySelectorAll('details[id][open]')].map(d => d.id));
  app.innerHTML = view();
  if (keepNext) {
    for (const id in keep) { const el = document.getElementById(id); if (!el) continue; if (el.type === 'checkbox') el.checked = keep[id]; else el.value = keep[id]; }
    openDetails.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
    if (focusId) { const el = document.getElementById(focusId); if (el) el.focus({ preventScroll: true }); }
  }
  keepNext = true;
}
function go(patch) { Object.assign(S, patch); keepNext = false; render(); window.scrollTo({ top: 0 }); }

/* ---------- viste ---------- */
function view() {
  switch (S.view) {
    case 'boot': return gate('<p class="muted">Caricamento in corso…</p>');
    case 'login': return S.loginMode === 'richiesta' ? vRichiesta() : vLogin();
    case 'cantieri': return vCantieri();
    case 'cantiere': return vCantiere();
    case 'admin': return vAdmin();
  }
  return '';
}
const demoBand = () => api.demo ? `<div class="demo-band">Modalità dimostrativa: i dati restano solo su questo dispositivo.</div>` : '';
function gate(inner) { return `<div class="gate"><div class="brand"><span class="label">Registro giornaliero dei lavori</span><h1>Giornale di Cantiere</h1></div>${inner}</div>`; }

function vLogin() {
  return gate(`<form class="card" data-f="login"><h2>Accesso</h2>
    <div class="field"><label for="lg-email">Email</label><input id="lg-email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="lg-pwd">Password</label><input id="lg-pwd" type="password" autocomplete="current-password" required data-keep="0"></div>
    <button class="btn pri" type="submit">Entra</button>
    <p class="small muted">Non hai un account? <button type="button" class="linkbtn" data-a="loginmode" data-v="richiesta">Richiedi l’accesso</button></p>
  </form>
  ${api.demo ? `<div class="notice info small">Account di prova (password <span class="mono">demo</span>): <span class="mono">admin@demo.it</span>, <span class="mono">dl@demo.it</span>, <span class="mono">cse@demo.it</span>, <span class="mono">impresa@demo.it</span>.
    <div style="margin-top:6px"><button type="button" class="linkbtn" data-a="resetdemo">Ripristina i dati di esempio</button></div></div>` : ''}`);
}

function vRichiesta() {
  if (S.richiestaInviata) return gate(`<div class="card stack"><span class="pill warn">In attesa di approvazione</span><h2>Richiesta inviata</h2>
    <p>L’amministratore ti assegnerà ruolo e cantieri. Quando la richiesta sarà approvata potrai entrare con l’email e la password che hai scelto.</p>
    <div><button class="btn" data-a="loginmode" data-v="login">Torna all’accesso</button></div></div>`);
  return gate(`<form class="card" data-f="richiesta"><h2>Richiesta di accesso</h2>
    <p class="muted small">L’amministratore ti abiliterà ai cantieri di tua competenza con i permessi del tuo ruolo.</p>
    <div class="fgrid">
      <div class="field full"><label for="rq-nome">Nome e cognome</label><input id="rq-nome" required autocomplete="name"></div>
      <div class="field"><label for="rq-email">Email</label><input id="rq-email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="rq-pwd">Scegli una password</label><input id="rq-pwd" type="password" minlength="8" required autocomplete="new-password" data-keep="0"></div>
      <div class="field"><label for="rq-ruolo">Ruolo</label><select id="rq-ruolo">${RUOLI_ASSEGNABILI.map(r => `<option value="${r}">${RUOLI[r]}</option>`).join('')}</select></div>
      <div class="field"><label for="rq-ente">Impresa / Ente</label><input id="rq-ente" placeholder="es. Rossi Costruzioni srl"></div>
      <div class="field full"><label for="rq-tel">Telefono</label><input id="rq-tel" inputmode="tel"></div>
      <div class="field full"><label for="rq-note">Cantieri di interesse o note</label><textarea id="rq-note"></textarea></div>
    </div>
    <button class="btn pri" type="submit">Invia la richiesta</button>
    <p class="small muted"><button type="button" class="linkbtn" data-a="loginmode" data-v="login">Ho già un account</button></p>
  </form>`);
}

function header(title, sub, back) {
  return `<header class="top">${demoBand()}<div class="top-in">
    ${back ? `<button class="iconbtn" data-a="${back}" aria-label="Indietro">‹</button>` : ''}
    <div class="top-title"><h1>${esc(title)}</h1>
      <div class="who"><b>${esc(S.user.nome)}</b><span>· ${esc(RUOLI[role()])}</span>${sub || ''}</div></div>
    ${isAdmin() && S.view !== 'admin' ? `<button class="btn sm" data-a="admin">Utenti${S.richieste.length ? ` <span class="pill bad">${S.richieste.length}</span>` : ''}</button>` : ''}
    ${S.view === 'cantieri' ? `<button class="btn sm ghost" data-a="logout">Esci</button>` : ''}
  </div><div class="hazard"></div></header>`;
}

function vCantieri() {
  const list = S.cantieri.slice().sort((a, b) => (a.stato === 'Concluso') - (b.stato === 'Concluso') || String(a.nome).localeCompare(b.nome));
  let body;
  if (!S.cantLoaded) body = `<p class="muted">Caricamento cantieri…</p>`;
  else if (!list.length) body = isAdmin()
    ? `<div class="empty">Non ci sono ancora cantieri. Crea il primo da <b>Utenti › Cantieri</b>, poi assegnalo alle persone che hanno chiesto l’accesso.</div><div><button class="btn pri" data-a="admin" data-tab="cantieri">Crea il primo cantiere</button></div>`
    : `<div class="empty">Non sei ancora assegnato a nessun cantiere. L’amministratore può abilitarti dalla gestione utenti.</div>`;
  else body = `<div class="cant">${list.map(c => `<button class="cant-card" data-a="apri" data-id="${esc(c.id)}">
      <span class="row"><span class="pill ${c.tipo === 'pubblico' ? 'acc' : c.tipo === 'ambientale' ? 'ok' : ''}">${esc(TIPI_LAVORI[c.tipo] || 'Cantiere')}</span>${c.stato && c.stato !== 'Attivo' ? `<span class="pill warn">${esc(c.stato)}</span>` : ''}</span>
      <h3>${esc(c.nome)}</h3>
      <span class="small muted">${esc([c.comune, c.committente].filter(Boolean).join(' · '))}${c.codice ? ` · <span class="mono">${esc(c.codice)}</span>` : ''}</span>
      <span class="arrow">›</span></button>`).join('')}</div>`;
  return header('I tuoi cantieri', '') + `<main class="stack" style="margin-top:16px"><span class="label">Seleziona il cantiere · ${esc(fmtLong(isoToday()))}</span>${body}</main>`;
}

/* ---------- cantiere ---------- */
function vCantiere() {
  const c = cant(); if (!c) return header('Cantiere', '', 'home') + `<p class="muted" style="margin-top:16px">Cantiere non disponibile.</p>`;
  const segs = [['giornale', 'Giornale'], ['imprese', 'Imprese'], ['registro', 'Registro'], ['pdf', 'PDF']];
  const body = S.cview === 'giornale' ? vGiornale(c) : S.cview === 'imprese' ? vImprese() : S.cview === 'registro' ? vRegistro(c) : vPdf(c);
  return `${header(c.nome, c.codice ? `<span class="mono">· ${esc(c.codice)}</span>` : '', 'home')}
  <nav class="seg" aria-label="Sezioni del cantiere">${segs.map(([k, l]) => `<button data-a="cview" data-v="${k}" aria-current="${S.cview === k}">${l}</button>`).join('')}</nav>
  <main class="stack-lg" style="margin-top:14px">${body}</main>`;
}

function count(k) { const g = S.g || {}; if (k === 'meteo') return g.meteo ? 1 : 0; const s = SEZMAP[k]; if (!s || !s.liste) return 0; return s.liste.reduce((n, l) => n + items(g[l]).length, 0); }

function vGiornale(c) {
  const d = parseIso(S.data); const today = isoToday();
  const n = c.dataInizio && S.data >= c.dataInizio ? daysBetween(c.dataInizio, S.data) + 1 : null;
  const tot = Number(c.durata) || 0; const ch = locked();
  const datebar = `<div class="datebar">
    <button class="iconbtn" data-a="giorno" data-n="-1" aria-label="Giorno precedente">‹</button>
    <div class="stamp"><span class="dd">${String(d.getDate()).padStart(2, '0')}</span><span class="dt">
      <b>${esc(d.toLocaleDateString('it-IT', { weekday: 'long' }) + ' · ' + d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }))}</b>
      <span class="row small">${n ? `<span class="daynum">Giornata n. ${n}${tot ? ` / ${tot}` : ''}</span>` : ''}${ch ? '<span class="pill bad">Chiusa</span>' : '<span class="pill ok">Aperta</span>'}${S.data !== today ? `<button class="btn sm ghost" data-a="oggi">Torna a oggi</button>` : ''}</span>
    </span></div>
    <button class="iconbtn" data-a="giorno" data-n="1" aria-label="Giorno successivo" ${S.data >= today ? 'disabled' : ''}>›</button>
  </div>
  <div class="row"><label class="small muted" for="vai-data">Vai alla data</label><input id="vai-data" type="date" max="${today}" value="${S.data}" data-c="vaidata" style="width:auto" data-keep="0"></div>`;
  const chips = `<nav class="tabs" aria-label="Pagine della giornata">${SEZ.map(s => { const cn = s.k === 'riepilogo' ? '' : count(s.k); return `<button class="tab" data-a="sez" data-k="${s.k}" aria-current="${S.sez === s.k}">${s.t}${cn ? `<span class="n">${cn}</span>` : ''}</button>`; }).join('')}</nav>`;
  let inner;
  if (!S.gLoaded) inner = '<p class="muted">Caricamento della giornata…</p>';
  else if (S.sez === 'riepilogo') inner = vRiepilogo();
  else if (S.sez === 'meteo') inner = vMeteo();
  else inner = vSezione(S.sez);
  const lockNote = ch && S.sez !== 'riepilogo' ? `<div class="notice">Giornata chiusa da ${esc(S.g.chiusura.daNome)} il ${esc(new Date(S.g.chiusura.t).toLocaleString('it-IT'))}. ${isAdmin() ? 'Come amministratore puoi ancora modificarla.' : 'Le registrazioni sono in sola lettura.'}</div>` : '';
  return `<section class="stack">${datebar}${chips}</section>${lockNote}${inner}`;
}

function vRiepilogo() {
  const g = S.g || {}; const m = g.meteo;
  const aperte = items(g.criticita).filter(x => !x.risolta).length;
  const add = items(g.presenze).reduce((n, x) => n + (Number(x.addetti) || 0), 0);
  const tiles = [
    ['presenze', 'Addetti presenti', add], ['lavorazioni', 'Lavorazioni', items(g.lavorazioni).length],
    ['criticita', 'Criticità aperte', aperte, aperte > 0], ['dl', 'Ordini di servizio', items(g.ordini).length],
    ['riserve', 'Riserve iscritte', items(g.riserve).length, items(g.riserve).length > 0], ['cse', 'Indicazioni CSE', items(g.cse).length],
    ['verbale', 'Verbali', items(g.verbale).length], ['dl', 'Indicazioni DL', items(g.indicazioni).length]];
  const autori = {}; SEZ.forEach(s => (s.liste || []).forEach(l => items(g[l]).forEach(x => { autori[x.da] = x.daNome; }))); if (m) autori[m.da] = m.daNome;
  const canClose = isAdmin() || role() === 'dl'; const ch = locked();
  let chiusura = '';
  if (canClose && S.g) {
    if (ch) chiusura = `<div><button class="btn sm" data-a="riapri">Riapri la giornata</button></div>`;
    else if (S.confirmClose) chiusura = `<div class="card stack"><p>Chiudendo la giornata le registrazioni diventano in sola lettura per tutti tranne l’amministratore. Confermi?</p><div class="row"><button class="btn dark" data-a="chiudi">Chiudi la giornata</button><button class="btn ghost" data-a="nochiudi">Annulla</button></div></div>`;
    else chiusura = `<div><button class="btn" data-a="chiudiask">Chiudi e firma la giornata</button></div>`;
  }
  return `<section class="stack">
    <div class="card stack"><div class="spread"><span class="label">Meteo</span>${m ? `<span class="pill ${m.lavorabilita === 'Lavorabile' ? 'ok' : m.lavorabilita === 'Non lavorabile' ? 'bad' : 'warn'}">${esc(m.lavorabilita || '')}</span>` : ''}</div>
      ${m ? `<p><b>${esc(m.mattino || '—')}</b> al mattino, <b>${esc(m.pomeriggio || '—')}</b> al pomeriggio. <span class="mono">${has(m.tmin) ? esc(m.tmin) + '°' : '–'} / ${has(m.tmax) ? esc(m.tmax) + '°' : '–'}</span>${has(m.pioggia) ? ` · pioggia <span class="mono">${esc(m.pioggia)} mm</span>` : ''}${m.vento ? ` · vento ${esc(m.vento.toLowerCase())}` : ''}</p>` : `<p class="muted">Meteo non ancora registrato.</p>`}
      ${canSez('meteo') && !m ? `<div><button class="btn sm pri" data-a="sez" data-k="meteo">Registra il meteo</button></div>` : ''}</div>
    <div class="sumgrid">${tiles.map(([k, l, v, al]) => `<button class="sum ${al ? 'alert' : ''}" data-a="sez" data-k="${k}"><div class="v">${v}</div><div class="small muted">${l}</div></button>`).join('')}</div>
    <div class="card stack"><span class="label">Hanno scritto in questa giornata</span>${Object.keys(autori).length ? `<p>${Object.values(autori).map(esc).join(', ')}</p>` : `<p class="muted">Nessuna registrazione. Scegli una pagina qui sopra per iniziare.</p>`}</div>
    ${chiusura}
  </section>`;
}

function vMeteo() {
  const m = (S.g && S.g.meteo) || {}; const can = canSez('meteo'); const dis = can ? '' : 'disabled';
  const sel = (id, opts, v) => `<select id="${id}" ${dis}><option value="">—</option>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  return `<section class="stack"><div class="spread"><h2>Meteo della giornata</h2>${m.t ? `<span class="meta">${esc(m.daNome)} · ${fmtTime(m.t)}</span>` : ''}</div>
  ${can ? '' : `<div class="notice info">Il tuo ruolo può consultare il meteo ma non modificarlo.</div>`}
  <form data-f="meteo" class="card"><div class="fgrid">
    <div class="field"><label for="m-mattino">Mattino</label>${sel('m-mattino', CIELO, m.mattino)}</div>
    <div class="field"><label for="m-pomeriggio">Pomeriggio</label>${sel('m-pomeriggio', CIELO, m.pomeriggio)}</div>
    <div class="field"><label for="m-tmin">Temperatura minima (°C)</label><input id="m-tmin" type="number" step="0.5" value="${esc(m.tmin)}" ${dis}></div>
    <div class="field"><label for="m-tmax">Temperatura massima (°C)</label><input id="m-tmax" type="number" step="0.5" value="${esc(m.tmax)}" ${dis}></div>
    <div class="field"><label for="m-pioggia">Precipitazioni (mm)</label><input id="m-pioggia" type="number" step="0.1" min="0" value="${esc(m.pioggia)}" ${dis}></div>
    <div class="field"><label for="m-vento">Vento</label>${sel('m-vento', ['Assente', 'Debole', 'Moderato', 'Forte'], m.vento)}</div>
    <div class="field full"><label for="m-lav">Condizioni di lavoro</label>${sel('m-lav', ['Lavorabile', 'Parzialmente lavorabile', 'Non lavorabile'], m.lavorabilita)}</div>
    <div class="field full"><label for="m-note">Note (effetti sulle lavorazioni, terreno, ore perse)</label><textarea id="m-note" ${dis}>${esc(m.note)}</textarea></div>
  </div>${can ? `<div><button class="btn pri" type="submit">${m.t ? 'Aggiorna il meteo' : 'Salva il meteo'}</button></div>` : ''}</form></section>`;
}

function fieldHTML(lk, f) {
  const id = `f-${lk}-${f.k}`; const r = f.req ? ' required' : '';
  let input;
  if (f.type === 'textarea') input = `<textarea id="${id}"${r}></textarea>`;
  else if (f.type === 'select') input = `<select id="${id}">${f.o.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'impresa') {
    const imps = Object.values(S.imprese).sort((a, b) => String(a.ragione).localeCompare(b.ragione));
    input = `<select id="${id}"${r}><option value="">${f.req ? 'Seleziona…' : '—'}</option>${imps.map(i => `<option value="${esc(i.id)}">${esc(i.ragione)} (${esc(i.tipo)})</option>`).join('')}</select>`;
  } else input = `<input id="${id}" type="${f.type}"${f.step ? ` step="${f.step}"` : ''}${f.type === 'number' ? ' inputmode="decimal" min="0"' : ''}${r}>`;
  return `<div class="field${f.full ? ' full' : ''}"><label for="${id}">${esc(f.l)}</label>${input}</div>`;
}

function vSezione(k) {
  const s = SEZMAP[k]; const g = S.g || {}; const can = canSez(k);
  const noImp = !Object.keys(S.imprese).length;
  return `<section class="stack-lg"><h2>${esc(s.t)}</h2>
  ${!can && !locked() ? `<div class="notice info">Puoi consultare questa pagina. Le registrazioni spettano a: ${s.who.map(r => RUOLI[r]).join(', ')}.</div>` : ''}
  ${s.liste.map(lk => {
    const L = LISTE[lk]; const list = items(g[lk]); const needImp = L.f.some(f => f.type === 'impresa' && f.req);
    return `<div class="stack">${s.liste.length > 1 ? `<h3>${esc(L.t)}</h3>` : ''}
      ${list.length ? list.map(x => itemHTML(lk, x)).join('') : `<div class="empty">Nessuna registrazione in “${esc(L.t.toLowerCase())}” per questa giornata.</div>`}
      ${can ? (needImp && noImp ? `<div class="notice">Prima registra le imprese del cantiere nella scheda <b>Imprese</b>.</div>` : `<details class="add" id="add-${lk}"><summary>+ Aggiungi a ${esc(L.t.toLowerCase())}</summary>
        <form data-f="list" data-l="${lk}"><div class="fgrid">${L.f.map(f => fieldHTML(lk, f)).join('')}</div><div><button class="btn pri" type="submit">Registra</button></div></form></details>`) : ''}
    </div>`;
  }).join('')}
  </section>`;
}

function itemHTML(lk, x) {
  const L = LISTE[lk]; const main = x[L.main];
  const rows = L.f.filter(f => f.k !== L.main && has(x[f.k]) && !(lk === 'ordini' && ['stato', 'numero', 'importo', 'termine'].includes(f.k))).map(f => {
    let v = x[f.k]; if (f.type === 'impresa') v = impName(v); else if (f.type === 'date') v = fmtShort(v); else if (f.k === 'importo') v = eur(v);
    return `<dt>${esc(f.l.replace(' (€)', ''))}</dt><dd>${esc(v)}</dd>`;
  }).join('');
  const canDel = isAdmin() || (x.da === S.user.id && !locked());
  let extra = '';
  if (lk === 'ordini') {
    extra = `<div class="row"><label class="small muted" for="st-${x.id}">Stato</label>${canSez('dl') ? `<select id="st-${x.id}" data-c="statoordine" data-id="${x.id}" style="width:auto" data-keep="0">${['Emesso', 'In esecuzione', 'Eseguito'].map(o => `<option ${o === x.stato ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<span class="pill ${x.stato === 'Eseguito' ? 'ok' : 'warn'}">${esc(x.stato)}</span>`}</div>`;
  }
  if (lk === 'riserve') {
    if (x.contro) extra = `<div class="card" style="background:var(--surface-2);padding:10px 12px"><span class="label">Controdeduzioni DL</span><p style="white-space:pre-wrap">${esc(x.contro.testo)}</p><span class="meta">${esc(x.contro.daNome)} · ${new Date(x.contro.t).toLocaleString('it-IT')}</span></div>`;
    else if (isAdmin() || (role() === 'dl' && !locked())) extra = `<div class="stack"><label class="small muted" for="cd-${x.id}">Controdeduzioni del Direttore dei Lavori</label><textarea id="cd-${x.id}"></textarea><div><button class="btn sm" data-a="contro" data-id="${x.id}">Registra le controdeduzioni</button></div></div>`;
  }
  if (lk === 'criticita') extra = x.risolta ? `<span class="pill ok">Risolta</span>` : (canSez('criticita') ? `<div><button class="btn sm" data-a="risolta" data-id="${x.id}">Segna come risolta</button></div>` : `<span class="pill bad">Aperta</span>`);
  const head = lk === 'ordini' ? `<span class="row"><span class="pill acc mono">OdS ${esc(x.numero || 's.n.')}</span>${has(x.importo) ? `<span class="mono">${eur(x.importo)}</span>` : ''}${x.termine ? `<span class="small muted">entro il ${fmtShort(x.termine)}</span>` : ''}</span>`
    : lk === 'cse' && x.tipo ? `<span class="pill ${/Sospensione|Non conf/.test(x.tipo) ? 'bad' : 'acc'}">${esc(x.tipo)}</span>`
    : lk === 'lavorazioni' && x.stato ? `<span class="pill ${x.stato === 'Completata' ? 'ok' : x.stato === 'Sospesa' ? 'warn' : ''}">${esc(x.stato)}</span>` : '';
  return `<article class="item ${lk === 'criticita' ? 'sev-' + esc(x.gravita) : ''}">
    ${head}
    <div class="item-main">${esc(L.main === 'impresa' ? impName(main) : main)}</div>
    ${rows ? `<dl class="kv">${rows}</dl>` : ''}
    ${extra}
    <div class="spread"><span class="meta">${esc(x.daNome)} · ${fmtTime(x.t)}</span>${canDel ? `<button class="btn sm ghost danger" data-a="del" data-l="${lk}" data-id="${x.id}">Elimina</button>` : ''}</div>
  </article>`;
}

/* ---------- imprese ---------- */
function vImprese() {
  const imps = Object.values(S.imprese).sort((a, b) => TIPI_IMPRESA.indexOf(a.tipo) - TIPI_IMPRESA.indexOf(b.tipo) || String(a.ragione).localeCompare(b.ragione));
  const can = isAdmin() || role() === 'dl';
  return `<section class="stack"><h2>Imprese del cantiere</h2>
  <p class="small muted">Affidataria, subappalti, subaffidamenti e lavoratori autonomi presenti in cantiere. Compaiono nelle presenze, nelle lavorazioni e negli ordini di servizio.</p>
  ${imps.length ? imps.map(i => `<article class="item"><span class="row"><span class="pill ${i.tipo === TIPI_IMPRESA[0] ? 'acc' : ''}">${esc(i.tipo)}</span>${i.autorizzazione ? `<span class="small muted">Aut. ${esc(i.autorizzazione)}</span>` : ''}</span>
    <div class="item-main">${esc(i.ragione)}</div>
    <dl class="kv">${i.piva ? `<dt>P.IVA</dt><dd class="mono">${esc(i.piva)}</dd>` : ''}${i.referente ? `<dt>Referente</dt><dd>${esc(i.referente)}</dd>` : ''}${i.oggetto ? `<dt>Lavorazioni</dt><dd>${esc(i.oggetto)}</dd>` : ''}</dl>
    ${isAdmin() ? `<div class="row" style="justify-content:flex-end"><button class="btn sm ghost danger" data-a="delimp" data-id="${esc(i.id)}">Rimuovi</button></div>` : ''}</article>`).join('')
    : `<div class="empty">Nessuna impresa registrata. ${can ? 'Aggiungi per prima l’impresa affidataria.' : 'Il Direttore dei Lavori o l’amministratore le registreranno.'}</div>`}
  ${can ? `<details class="add" id="add-impresa" ${imps.length ? '' : 'open'}><summary>+ Aggiungi impresa</summary><form data-f="impresa"><div class="fgrid">
    <div class="field full"><label for="im-rag">Ragione sociale / nominativo</label><input id="im-rag" required></div>
    <div class="field"><label for="im-tipo">Rapporto</label><select id="im-tipo">${TIPI_IMPRESA.map(t => `<option>${t}</option>`).join('')}</select></div>
    <div class="field"><label for="im-piva">P.IVA / C.F.</label><input id="im-piva"></div>
    <div class="field"><label for="im-ref">Referente in cantiere</label><input id="im-ref"></div>
    <div class="field"><label for="im-aut">Estremi autorizzazione (subappalto)</label><input id="im-aut" placeholder="es. prot. 1234 del 02/09/2026"></div>
    <div class="field full"><label for="im-ogg">Lavorazioni affidate</label><input id="im-ogg"></div>
  </div><div><button class="btn pri" type="submit">Aggiungi impresa</button></div></form></details>` : ''}
  </section>`;
}

/* ---------- registro ---------- */
function vRegistro(c) {
  if (!S.reg || S.reg.cid !== c.id) return `<p class="muted">Caricamento del registro…</p>`;
  const R = S.reg; const totO = R.ordini.reduce((n, x) => n + (Number(x.importo) || 0), 0); const totR = R.riserve.reduce((n, x) => n + (Number(x.importo) || 0), 0);
  const imp = id => esc(impName(id));
  return `<section class="stack-lg">
  <div class="spread"><h2>Registro del cantiere</h2><button class="btn sm" data-a="registro">Aggiorna</button></div>
  <div class="sumgrid">
    <div class="sum"><div class="v">${R.giorni}</div><div class="small muted">Giornate registrate</div></div>
    <div class="sum"><div class="v">${R.ordini.length}</div><div class="small muted">Ordini di servizio · ${eur(totO)}</div></div>
    <div class="sum ${R.riserve.length ? 'alert' : ''}"><div class="v">${R.riserve.length}</div><div class="small muted">Riserve · ${eur(totR)}</div></div>
    <div class="sum ${R.crit.length ? 'alert' : ''}"><div class="v">${R.crit.length}</div><div class="small muted">Criticità aperte</div></div>
  </div>
  <div class="stack"><h3>Ordini di servizio</h3>${R.ordini.length ? `<div class="tblwrap"><table><thead><tr><th>Data</th><th>N.</th><th>Impresa</th><th>Oggetto</th><th>Termine</th><th>Stato</th><th class="num">Importo</th></tr></thead><tbody>
    ${R.ordini.map(x => `<tr><td class="mono">${fmtShort(x.data)}</td><td class="mono">${esc(x.numero || '–')}</td><td>${imp(x.impresa)}</td><td>${esc(x.oggetto)}</td><td class="mono">${fmtShort(x.termine)}</td><td><span class="pill ${x.stato === 'Eseguito' ? 'ok' : 'warn'}">${esc(x.stato)}</span></td><td class="num">${has(x.importo) ? eur(x.importo) : '–'}</td></tr>`).join('')}
    <tr><td colspan="6"><b>Totale</b></td><td class="num"><b>${eur(totO)}</b></td></tr></tbody></table></div>` : `<div class="empty">Nessun ordine di servizio emesso.</div>`}</div>
  <div class="stack"><h3>Riserve iscritte</h3>${R.riserve.length ? `<div class="tblwrap"><table><thead><tr><th>Data</th><th>Impresa</th><th>Oggetto</th><th>Controdeduzioni</th><th class="num">Importo</th></tr></thead><tbody>
    ${R.riserve.map(x => `<tr><td class="mono">${fmtShort(x.data)}</td><td>${imp(x.impresa)}</td><td>${esc(x.oggetto)}</td><td>${x.contro ? '<span class="pill ok">Registrate</span>' : '<span class="pill warn">In attesa</span>'}</td><td class="num">${has(x.importo) ? eur(x.importo) : '–'}</td></tr>`).join('')}
    <tr><td colspan="4"><b>Totale</b></td><td class="num"><b>${eur(totR)}</b></td></tr></tbody></table></div>` : `<div class="empty">Nessuna riserva iscritta.</div>`}</div>
  <div class="stack"><h3>Criticità aperte</h3>${R.crit.length ? R.crit.map(x => `<article class="item sev-${esc(x.gravita)}"><span class="meta">${fmtShort(x.data)} · ${esc(x.gravita)}</span><div class="item-main">${esc(x.descrizione)}</div></article>`).join('') : `<div class="empty">Nessuna criticità aperta.</div>`}</div>
  </section>`;
}

/* ---------- PDF ---------- */
function vPdf(c) {
  const from = c.dataInizio && c.dataInizio <= isoToday() ? c.dataInizio : isoToday();
  return `<section class="stack"><h2>Esporta in PDF</h2>
  <p class="small muted">Per ogni giornata: meteo, imprese e presenze, lavorazioni, criticità, indicazioni e ordini di servizio del DL, riserve, indicazioni CSE e verbali, con gli spazi per le firme.</p>
  <div class="card stack"><h3>Giornata selezionata</h3><p style="text-transform:capitalize">${esc(fmtLong(S.data))}</p><div><button class="btn pri" data-a="pdf">Scarica il PDF della giornata</button></div></div>
  <form class="card" data-f="pdfper"><h3>Periodo</h3><div class="fgrid">
    <div class="field"><label for="pdf-dal">Dal</label><input id="pdf-dal" type="date" value="${from}" required></div>
    <div class="field"><label for="pdf-al">Al</label><input id="pdf-al" type="date" value="${isoToday()}" required></div>
  </div><div><button class="btn pri" type="submit">Scarica il PDF del periodo</button></div></form>
  ${S.pdfBusy ? '<p class="muted">Preparazione del PDF…</p>' : ''}</section>`;
}

async function makePdf(from, to) {
  const c = cant(); if (!c) return;
  if (!window.jspdf || !window.jspdf.jsPDF) { toast('Il generatore PDF non si è caricato. Riapri l’app.'); return; }
  if (from > to) { toast('La data iniziale è successiva a quella finale.'); return; }
  S.pdfBusy = true; render();
  try {
    const days = await api.listGiornate(c.id, from, to);
    if (!days.length) { toast('Nessuna giornata registrata nel periodo scelto.'); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14; const ink = [22, 32, 43], mut = [90, 102, 119], acc = [31, 95, 174];
    const imp = id => impName(id) || '';
    days.forEach((g, i) => {
      if (i) doc.addPage();
      let y = M;
      doc.setFillColor(227, 162, 26); doc.rect(0, 0, W, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...mut); doc.text('GIORNALE DEI LAVORI', M, y + 2);
      const n = c.dataInizio && g.data >= c.dataInizio ? daysBetween(c.dataInizio, g.data) + 1 : null;
      if (n) doc.text('Giornata n. ' + n + (Number(c.durata) ? ' / ' + c.durata : ''), W - M, y + 2, { align: 'right' });
      y += 9; doc.setFontSize(16); doc.setTextColor(...ink); const tl = doc.splitTextToSize(c.nome, W - 2 * M); doc.text(tl, M, y);
      y += 6.5 * tl.length; doc.setFontSize(11); doc.setTextColor(...acc); const dl = fmtLong(g.data); doc.text(dl.charAt(0).toUpperCase() + dl.slice(1), M, y);
      y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...mut);
      const info = [c.codice && ('Rif. ' + c.codice), c.committente && ('Committente: ' + c.committente), c.comune, c.dl && ('DL: ' + c.dl), c.cse && ('CSE: ' + c.cse)].filter(Boolean).join('   ·   ');
      if (info) { const ls = doc.splitTextToSize(info, W - 2 * M); doc.text(ls, M, y); y += ls.length * 3.6; }
      if (g.chiusura && g.chiusura.chiusa) { doc.text('Giornata chiusa da ' + g.chiusura.daNome + ' il ' + new Date(g.chiusura.t).toLocaleString('it-IT'), M, y); y += 4; }
      y += 2;
      const sec = (title, head, body, widths) => {
        if (y > 262) { doc.addPage(); y = M; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...ink); doc.text(title.toUpperCase(), M, y + 4); y += 6;
        if (!body.length) { doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...mut); doc.text('Nessuna registrazione.', M, y + 3); y += 7; return; }
        body = body.map(r => r.map(v => v && typeof v === 'object' ? v : String(v == null ? '' : v)));
        doc.autoTable({ startY: y, head: [head], body, margin: { left: M, right: M }, theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, textColor: ink, lineColor: [205, 212, 220], lineWidth: .15, overflow: 'linebreak' },
          headStyles: { fillColor: [236, 239, 243], textColor: mut, fontStyle: 'bold' }, columnStyles: widths || {} });
        y = doc.lastAutoTable.finalY + 5;
      };
      const by = x => x.daNome + ' ' + fmtTime(x.t);
      const m = g.meteo;
      sec('Condizioni meteo', ['Mattino', 'Pomeriggio', 'T min/max', 'Pioggia', 'Vento', 'Condizioni di lavoro'],
        m ? [[m.mattino || '', m.pomeriggio || '', (has(m.tmin) ? m.tmin + '°' : '–') + ' / ' + (has(m.tmax) ? m.tmax + '°' : '–'), has(m.pioggia) ? m.pioggia + ' mm' : '', m.vento || '', m.lavorabilita || '']].concat(m.note ? [[{ content: 'Note: ' + m.note, colSpan: 6 }]] : []) : []);
      sec('Imprese e presenze', ['Impresa', 'Rapporto', 'Addetti', 'Ore', 'Mezzi e attrezzature', 'Note'], items(g.presenze).map(x => [imp(x.impresa), (S.imprese[x.impresa] || {}).tipo || '', x.addetti, x.ore, x.mezzi || '', x.note || '']));
      sec('Lavorazioni eseguite', ['Impresa', 'Area / WBS', 'Descrizione', 'Stato', 'Registrato da'], items(g.lavorazioni).map(x => [imp(x.impresa), x.area || '', x.descrizione, x.stato || '', by(x)]), { 2: { cellWidth: 70 } });
      sec('Criticità', ['Gravità', 'Descrizione', 'Azione correttiva', 'Esito', 'Registrato da'], items(g.criticita).map(x => [x.gravita || '', x.descrizione, x.azione || '', x.risolta ? 'Risolta' : 'Aperta', by(x)]), { 1: { cellWidth: 60 } });
      sec('Indicazioni del Direttore dei Lavori', ['Destinatario', 'Indicazione', 'Registrato da'], items(g.indicazioni).map(x => [imp(x.impresa), x.testo, by(x)]), { 1: { cellWidth: 110 } });
      sec('Ordini di servizio', ['N.', 'Impresa', 'Oggetto', 'Importo', 'Termine', 'Stato'], items(g.ordini).map(x => [x.numero || 's.n.', imp(x.impresa), x.oggetto, has(x.importo) ? eurPdf(x.importo) : '', fmtShort(x.termine), x.stato || '']), { 2: { cellWidth: 70 }, 3: { halign: 'right' } });
      sec('Riserve dell\'impresa', ['Impresa', 'Oggetto e motivazione', 'Importo', 'Controdeduzioni DL'], items(g.riserve).map(x => [imp(x.impresa), x.oggetto + (x.motivazione ? '\n' + x.motivazione : ''), has(x.importo) ? eurPdf(x.importo) : '', x.contro ? x.contro.testo + '\n(' + x.contro.daNome + ')' : 'In attesa']), { 1: { cellWidth: 65 }, 2: { halign: 'right' } });
      sec('Indicazioni del CSE', ['Tipo', 'Impresa', 'Descrizione', 'Entro il', 'Registrato da'], items(g.cse).map(x => [x.tipo || '', imp(x.impresa), x.descrizione, fmtShort(x.termine), by(x)]), { 2: { cellWidth: 70 } });
      sec('Verbali di cantiere', ['Oggetto', 'Presenti', 'Contenuto', 'Redatto da'], items(g.verbale).map(x => [x.oggetto, x.presenti || '', x.contenuto, by(x)]), { 2: { cellWidth: 80 } });
      if (y > 250) { doc.addPage(); y = M; }
      y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...mut);
      const cols = ['Il Direttore dei Lavori', 'Per l\'Impresa affidataria', 'Il Coordinatore per la Sicurezza']; const cw = (W - 2 * M) / 3;
      cols.forEach((t, j) => { const x = M + j * cw; doc.text(t, x, y); doc.setDrawColor(150, 160, 170); doc.line(x, y + 12, x + cw - 8, y + 12); });
    });
    const tot = doc.getNumberOfPages();
    for (let p = 1; p <= tot; p++) { doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...mut); doc.text(c.nome + ' · Giornale dei lavori', M, 290); doc.text('Pag. ' + p + ' di ' + tot, W - M, 290, { align: 'right' }); }
    const slug = String(c.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'cantiere';
    const fname = 'Giornale_' + slug + '_' + from + (from !== to ? '_' + to : '') + '.pdf';
    if (window.AndroidBridge && window.AndroidBridge.savePdf) {
      // App Android: il PDF passa al telefono, che lo salva e apre "Condividi" (Drive, email, WhatsApp...)
      window.AndroidBridge.savePdf(fname, doc.output('datauristring').split(',')[1]);
    } else {
      doc.save(fname);
    }
  } catch (e) { console.warn(e); toast('Non è stato possibile creare il PDF.'); }
  finally { S.pdfBusy = false; render(); }
}

/* ---------- amministrazione ---------- */
function vAdmin() {
  const tabs = [['richieste', `Richieste${S.richieste.length ? ` <span class="n">${S.richieste.length}</span>` : ''}`], ['utenti', 'Utenti'], ['cantieri', 'Cantieri']];
  const cantChecks = (pref, sel, tutti) => `<div class="checks"><label><input type="checkbox" id="${pref}-tutti" ${tutti ? 'checked' : ''}> Tutti i cantieri</label>${S.cantieri.map(c => `<label><input type="checkbox" id="${pref}-c-${esc(c.id)}" ${(sel || []).includes(c.id) ? 'checked' : ''}> ${esc(c.nome)}</label>`).join('')}</div>`;
  let body = '';
  if (S.adminTab === 'richieste') {
    body = S.richieste.length ? S.richieste.map(r => `<article class="card stack">
      <div class="spread"><h3>${esc(r.nome)}</h3><span class="meta">${new Date(r.t).toLocaleString('it-IT')}</span></div>
      <dl class="kv"><dt>Email</dt><dd>${esc(r.email)}</dd><dt>Ruolo richiesto</dt><dd>${esc(RUOLI[r.ruolo] || r.ruolo)}</dd>${r.ente ? `<dt>Impresa / Ente</dt><dd>${esc(r.ente)}</dd>` : ''}${r.tel ? `<dt>Telefono</dt><dd class="mono">${esc(r.tel)}</dd>` : ''}${r.note ? `<dt>Note</dt><dd>${esc(r.note)}</dd>` : ''}</dl>
      <div class="field"><label for="ap-${esc(r.id)}-ruolo">Ruolo assegnato</label><select id="ap-${esc(r.id)}-ruolo">${RUOLI_ASSEGNABILI.map(x => `<option value="${x}" ${x === r.ruolo ? 'selected' : ''}>${RUOLI[x]}</option>`).join('')}</select></div>
      <div class="field"><span class="small muted">Cantieri abilitati</span>${S.cantieri.length ? cantChecks('ap-' + r.id, [], false) : '<span class="small muted">Crea prima un cantiere.</span>'}</div>
      <div class="row"><button class="btn pri" data-a="approva" data-id="${esc(r.id)}">Approva l’accesso</button><button class="btn ghost danger" data-a="rifiuta" data-id="${esc(r.id)}">Rifiuta</button></div></article>`).join('')
      : `<div class="empty">Nessuna richiesta in attesa. Invia ai collaboratori l’indirizzo dell’app: dalla pagina di accesso potranno richiedere un account, che comparirà qui.</div>`;
  } else if (S.adminTab === 'utenti') {
    const us = S.utenti.filter(u => u.id !== S.user.id);
    body = us.length ? us.map(u => `<article class="card stack">
      <div class="spread"><h3>${esc(u.nome)}</h3>${u.attivo === false ? '<span class="pill bad">Sospeso</span>' : '<span class="pill ok">Attivo</span>'}</div>
      <p class="small muted">${esc(u.email)}${u.ente ? ` · ${esc(u.ente)}` : ''}${u.tel ? ` · <span class="mono">${esc(u.tel)}</span>` : ''}</p>
      <div class="field"><label for="ut-${esc(u.id)}-ruolo">Ruolo</label><select id="ut-${esc(u.id)}-ruolo">${RUOLI_ASSEGNABILI.map(x => `<option value="${x}" ${x === u.ruolo ? 'selected' : ''}>${RUOLI[x]}</option>`).join('')}</select></div>
      <div class="field"><span class="small muted">Cantieri abilitati</span>${cantChecks('ut-' + u.id, u.cantieri, u.tutti)}</div>
      <div class="row"><button class="btn pri" data-a="salvautente" data-id="${esc(u.id)}">Salva i permessi</button>
      <button class="btn ghost ${u.attivo === false ? '' : 'danger'}" data-a="sospendi" data-id="${esc(u.id)}" data-v="${u.attivo === false ? '1' : '0'}">${u.attivo === false ? 'Riattiva' : 'Sospendi l’accesso'}</button></div></article>`).join('')
      : `<div class="empty">Nessun utente abilitato oltre a te.</div>`;
  } else {
    const e = S.editCant ? S.cantieri.find(c => c.id === S.editCant) || {} : {};
    const v = k => esc(e[k] == null ? '' : e[k]);
    body = `${S.cantieri.map(c => `<article class="item"><div class="spread"><div><div class="item-main">${esc(c.nome)}</div><span class="small muted">${esc(TIPI_LAVORI[c.tipo] || '')} · ${esc(c.stato || 'Attivo')}</span></div><button class="btn sm" data-a="editcant" data-id="${esc(c.id)}">Modifica</button></div></article>`).join('')}
    <form class="card" data-f="cantiere"><h3>${S.editCant ? 'Modifica cantiere' : 'Nuovo cantiere'}</h3><div class="fgrid">
      <div class="field full"><label for="ca-nome">Nome del cantiere</label><input id="ca-nome" required value="${v('nome')}" placeholder="es. Bonifica area ex Fornace – lotto 2"></div>
      <div class="field"><label for="ca-tipo">Tipo di lavori</label><select id="ca-tipo">${Object.entries(TIPI_LAVORI).map(([k, l]) => `<option value="${k}" ${e.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="ca-cod">CUP / CIG / Commessa</label><input id="ca-cod" value="${v('codice')}"></div>
      <div class="field"><label for="ca-comm">Committente / Stazione appaltante</label><input id="ca-comm" value="${v('committente')}"></div>
      <div class="field"><label for="ca-com">Comune e indirizzo</label><input id="ca-com" value="${v('comune')}"></div>
      <div class="field"><label for="ca-rup">RUP / Responsabile dei lavori</label><input id="ca-rup" value="${v('rup')}"></div>
      <div class="field"><label for="ca-dl">Direttore dei Lavori</label><input id="ca-dl" value="${v('dl')}"></div>
      <div class="field"><label for="ca-cse">Coordinatore sicurezza (CSE)</label><input id="ca-cse" value="${v('cse')}"></div>
      <div class="field"><label for="ca-imp">Importo contrattuale (€)</label><input id="ca-imp" type="number" step="0.01" min="0" value="${v('importo')}"></div>
      <div class="field"><label for="ca-ini">Data consegna lavori</label><input id="ca-ini" type="date" value="${v('dataInizio')}"></div>
      <div class="field"><label for="ca-dur">Durata contrattuale (giorni)</label><input id="ca-dur" type="number" min="0" value="${v('durata')}"></div>
      <div class="field"><label for="ca-stato">Stato</label><select id="ca-stato">${['Attivo', 'Sospeso', 'Concluso'].map(s => `<option ${e.stato === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div><div class="row"><button class="btn pri" type="submit">${S.editCant ? 'Salva le modifiche' : 'Crea il cantiere'}</button>${S.editCant ? '<button class="btn ghost" type="button" data-a="nuovocant">Annulla</button>' : ''}</div></form>`;
  }
  return header('Utenti e permessi', '', 'home') + `<nav class="tabs" style="margin-top:6px">${tabs.map(([k, l]) => `<button class="tab" data-a="admintab" data-v="${k}" aria-current="${S.adminTab === k}">${l}</button>`).join('')}</nav><main class="stack" style="margin-top:10px">${body}</main>`;
}

/* ---------- azioni ---------- */
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const num = v => v === '' ? '' : Number(v);
function readCantChecks(pref) {
  const tutti = !!(document.getElementById(pref + '-tutti') || {}).checked;
  const cantieri = S.cantieri.filter(c => { const el = document.getElementById(pref + '-c-' + c.id); return el && el.checked; }).map(c => c.id);
  return { tutti, cantieri };
}
async function refreshG() { S.g = await api.getGiornata(S.cantiereId, S.data); render(); }

async function act(a, d) {
  try {
    switch (a) {
      case 'loginmode': go({ loginMode: d.v, richiestaInviata: false }); break;
      case 'resetdemo': api.resetDemo(); toast('Dati di esempio ripristinati'); break;
      case 'logout': await api.logout(); go({ user: null, view: 'login', loginMode: 'login', cantieri: [], cantLoaded: false }); break;
      case 'home': await loadCantieri(); go({ view: 'cantieri', cview: 'giornale' }); break;
      case 'admin': await Promise.all([loadAdmin(), loadCantieri()]); go({ view: 'admin', adminTab: d.tab || S.adminTab, editCant: null }); break;
      case 'admintab': go({ adminTab: d.v, editCant: null }); break;
      case 'apri': S.cantiereId = d.id; S.data = isoToday(); S.sez = 'riepilogo'; S.cview = 'giornale'; S.reg = null; S.confirmClose = false;
        go({ view: 'cantiere' }); await Promise.all([loadImprese(), loadGiornata()]); render(); break;
      case 'cview': go({ cview: d.v }); if (d.v === 'registro') await loadRegistro(); if (d.v === 'giornale') { await loadGiornata(); render(); } break;
      case 'sez': go({ sez: d.k }); break;
      case 'giorno': { const nd = addDays(S.data, Number(d.n)); if (nd > isoToday()) return; S.data = nd; S.confirmClose = false; keepNext = false; await loadGiornata(); keepNext = false; render(); break; }
      case 'oggi': S.data = isoToday(); keepNext = false; await loadGiornata(); keepNext = false; render(); break;
      case 'del': await api.delVoce(S.cantiereId, S.data, d.l, d.id); await refreshG(); toast('Registrazione eliminata'); break;
      case 'risolta': await api.updVoce(S.cantiereId, S.data, 'criticita', d.id, { risolta: true, risoltaDa: S.user.id, risoltaT: Date.now() }); await refreshG(); toast('Criticità segnata come risolta'); break;
      case 'contro': { const t = val('cd-' + d.id); if (!t) { toast('Scrivi il testo delle controdeduzioni.'); return; }
        await api.updVoce(S.cantiereId, S.data, 'riserve', d.id, { contro: Object.assign({ testo: t }, sign()) }); await refreshG(); toast('Controdeduzioni registrate'); break; }
      case 'chiudiask': S.confirmClose = true; render(); break;
      case 'nochiudi': S.confirmClose = false; render(); break;
      case 'chiudi': await api.setChiusura(S.cantiereId, S.data, Object.assign({ chiusa: true }, sign())); S.confirmClose = false; await refreshG(); toast('Giornata chiusa'); break;
      case 'riapri': await api.setChiusura(S.cantiereId, S.data, { chiusa: false, riapertaDa: S.user.id, riapertaT: Date.now() }); await refreshG(); toast('Giornata riaperta'); break;
      case 'delimp': await api.delImpresa(d.id); await loadImprese(); render(); toast('Impresa rimossa'); break;
      case 'approva': { const r = S.richieste.find(x => x.id === d.id); if (!r) return; const ch = readCantChecks('ap-' + r.id);
        await api.approva(r.id, { ruolo: val('ap-' + r.id + '-ruolo') || r.ruolo, tutti: ch.tutti, cantieri: ch.cantieri }); await loadAdmin(); render(); toast('Accesso approvato per ' + r.nome); break; }
      case 'rifiuta': await api.rifiuta(d.id); await loadAdmin(); render(); toast('Richiesta rifiutata'); break;
      case 'salvautente': { const ch = readCantChecks('ut-' + d.id); await api.updUtente(d.id, { ruolo: val('ut-' + d.id + '-ruolo'), tutti: ch.tutti, cantieri: ch.cantieri }); await loadAdmin(); render(); toast('Permessi aggiornati'); break; }
      case 'sospendi': await api.updUtente(d.id, { attivo: d.v === '1' }); await loadAdmin(); render(); toast(d.v === '1' ? 'Accesso riattivato' : 'Accesso sospeso'); break;
      case 'editcant': go({ editCant: d.id }); break;
      case 'nuovocant': go({ editCant: null }); break;
      case 'registro': await loadRegistro(); break;
      case 'pdf': makePdf(S.data, S.data); break;
    }
  } catch (e) { console.warn(a, e); toast(errMsg(e)); }
}

async function submit(form) {
  const f = form.dataset.f;
  try {
    if (f === 'login') { const u = await api.login(val('lg-email'), document.getElementById('lg-pwd').value); await enter(u); return; }
    if (f === 'richiesta') {
      await api.richiediAccesso({ nome: val('rq-nome'), email: val('rq-email'), password: document.getElementById('rq-pwd').value, ruolo: val('rq-ruolo'), ente: val('rq-ente'), tel: val('rq-tel'), note: val('rq-note') });
      go({ richiestaInviata: true }); return;
    }
    if (f === 'meteo') {
      await api.setMeteo(S.cantiereId, S.data, Object.assign({ mattino: val('m-mattino'), pomeriggio: val('m-pomeriggio'), tmin: num(val('m-tmin')), tmax: num(val('m-tmax')), pioggia: num(val('m-pioggia')), vento: val('m-vento'), lavorabilita: val('m-lav'), note: val('m-note') }, sign()));
      await refreshG(); toast('Meteo salvato'); return;
    }
    if (f === 'list') {
      const lk = form.dataset.l; const L = LISTE[lk]; const it = {};
      for (const fd of L.f) { const v = val(`f-${lk}-${fd.k}`); if (fd.req && !v) { toast('Compila il campo “' + fd.l + '”.'); return; } it[fd.k] = fd.type === 'number' ? num(v) : v; }
      await api.addVoce(S.cantiereId, S.data, lk, Object.assign(it, sign()));
      form.querySelectorAll('input,textarea').forEach(el => { el.value = ''; }); form.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
      const det = form.closest('details'); if (det) det.open = false;
      await refreshG(); toast('Registrato'); return;
    }
    if (f === 'impresa') {
      await api.addImpresa(S.cantiereId, { ragione: val('im-rag'), tipo: val('im-tipo'), piva: val('im-piva'), referente: val('im-ref'), autorizzazione: val('im-aut'), oggetto: val('im-ogg'), da: S.user.id });
      form.querySelectorAll('input').forEach(el => { el.value = ''; }); await loadImprese(); render(); toast('Impresa aggiunta'); return;
    }
    if (f === 'cantiere') {
      const data = { nome: val('ca-nome'), tipo: val('ca-tipo'), codice: val('ca-cod'), committente: val('ca-comm'), comune: val('ca-com'), rup: val('ca-rup'), dl: val('ca-dl'), cse: val('ca-cse'), importo: num(val('ca-imp')), dataInizio: val('ca-ini'), durata: num(val('ca-dur')), stato: val('ca-stato') };
      if (S.editCant) data.id = S.editCant;
      await api.saveCantiere(data); await loadCantieri(); toast(S.editCant ? 'Cantiere aggiornato' : 'Cantiere creato'); go({ editCant: null }); return;
    }
    if (f === 'pdfper') { makePdf(val('pdf-dal'), val('pdf-al')); return; }
  } catch (e) { console.warn(f, e); toast(errMsg(e)); }
}

app.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; e.preventDefault(); act(b.dataset.a, b.dataset); });
app.addEventListener('submit', e => { e.preventDefault(); submit(e.target); });
app.addEventListener('change', e => {
  const el = e.target; const c = el.dataset && el.dataset.c; if (!c) return;
  if (c === 'vaidata' && el.value && el.value <= isoToday()) { S.data = el.value; keepNext = false; loadGiornata().then(() => { keepNext = false; render(); }); }
  if (c === 'statoordine') api.updVoce(S.cantiereId, S.data, 'ordini', el.dataset.id, { stato: el.value }).then(refreshG).then(() => toast('Stato aggiornato')).catch(err => toast(errMsg(err)));
});

/* ---------- avvio ---------- */
async function enter(u) {
  S.user = u;
  await loadCantieri();
  if (isAdmin()) { try { await loadAdmin(); } catch (_) {} }
  go({ view: 'cantieri' });
}
(async function boot() {
  try { const u = await api.me(); if (u) await enter(u); else go({ view: 'login' }); }
  catch (e) { console.warn(e); go({ view: 'login' }); toast('Server non raggiungibile. Riprova tra poco.'); }
})();
})();

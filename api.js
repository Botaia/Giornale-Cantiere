/* =====================================================================
   Giornale di Cantiere — livello dati (api.js)

   Due modalità, scelte da sole:
   - REALE: quando l'app è aperta dall'API (server.js), che fornisce
     config.js con { demo: false }. I dati vanno al database PostgreSQL.
   - DIMOSTRATIVA: in tutti gli altri casi (GitHub Pages, app Android,
     file aperto da solo). I dati restano nel browser di questo dispositivo;
     le password demo sono in chiaro: NON usare dati reali.
   Accanto a ogni funzione è indicato l'indirizzo dell'API usato.
   ===================================================================== */
(function () {
  'use strict';

  const CONF = window.GDC_CONFIG || {};
  const DEMO = CONF.demo !== false;
  const API_BASE = CONF.apiBase || 'api';   // relativo all'indirizzo dell'app
  const KEY = 'gdc-demo-v1';
  const SESSION = 'gdc-sessione';

  /* ---------- archivio dimostrativo ---------- */
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function minusDays(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  const COMMITTENTE_DEMO = { id: 'u_com', email: 'committente@demo.it', pwd: 'demo', nome: 'Committente Demo', ente: 'Comune (esempio)', ruolo: 'committenza', tutti: false, cantieri: ['c_demo1'], attivo: true };
  const OPERAIO_DEMO = { id: 'u_op', email: 'operaio@demo.it', pwd: 'demo', nome: 'Operaio Demo', ente: 'Impresa Esempio srl', ruolo: 'operaio', tutti: false, cantieri: ['c_demo1'], attivo: true };

  function seed() {
    const c1 = 'c_demo1';
    return {
      utenti: [
        { id: 'u_admin', email: 'admin@demo.it', pwd: 'demo', nome: 'Amministratore Demo', ruolo: 'admin', tutti: true, cantieri: [], attivo: true },
        { id: 'u_dl', email: 'dl@demo.it', pwd: 'demo', nome: 'Ing. Direttore Demo', ruolo: 'dl', tutti: false, cantieri: [c1], attivo: true },
        { id: 'u_cse', email: 'cse@demo.it', pwd: 'demo', nome: 'Geom. CSE Demo', ruolo: 'cse', tutti: false, cantieri: [c1], attivo: true },
        { id: 'u_imp', email: 'impresa@demo.it', pwd: 'demo', nome: 'Capocantiere Demo', ente: 'Impresa Esempio srl', ruolo: 'impresa', tutti: false, cantieri: [c1], attivo: true },
        OPERAIO_DEMO,
        COMMITTENTE_DEMO
      ],
      richieste: [],
      cantieri: [
        { id: c1, nome: 'Cantiere dimostrativo – riqualificazione area verde', tipo: 'ambientale', codice: 'DEMO-001', committente: 'Comune (esempio)',
          comune: 'Via Esempio 1', rup: '', dl: 'Ing. Direttore Demo', cse: 'Geom. CSE Demo', importo: 250000, dataInizio: minusDays(20), durata: 180, stato: 'Attivo' }
      ],
      imprese: [
        { id: 'i_demo1', cantiereId: c1, ragione: 'Impresa Esempio srl', tipo: 'Affidataria / Appaltatrice', piva: '', referente: 'Capocantiere Demo', autorizzazione: '', oggetto: 'Opere a verde e movimenti terra' },
        { id: 'i_demo2', cantiereId: c1, ragione: 'Scavi Esempio snc', tipo: 'Subappalto', piva: '', referente: '', autorizzazione: 'prot. 000 (esempio)', oggetto: 'Scavi e rinterri' }
      ],
      giornate: {}
    };
  }
  function load() {
    try {
      const s = localStorage.getItem(KEY);
      if (s) {
        const d = JSON.parse(s);
        // dati dimostrativi creati con la versione precedente: aggiunge l'account operaio di prova
        for (const extra of [OPERAIO_DEMO, COMMITTENTE_DEMO]) {
          if (!d.utenti.some(u => u.id === extra.id || u.email === extra.email)) { d.utenti.push(Object.assign({}, extra)); save(d); }
        }
        return d;
      }
    } catch (_) {}
    const d = seed(); save(d); return d;
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) {} }
  const clone = o => JSON.parse(JSON.stringify(o));
  const wait = (v) => new Promise(r => setTimeout(() => r(clone(v)), 60));
  function fail(msg) { const e = new Error(msg); e.code = 'refused'; return Promise.reject(e); }
  function pub(u) { if (!u) return null; const { pwd, ...rest } = u; return rest; }
  function me(d) { let id = null; try { id = localStorage.getItem(SESSION); } catch (_) {} return d.utenti.find(u => u.id === id && u.attivo !== false) || null; }
  function gKey(cid, data) { return cid + '__' + data; }

  /* chiamata reale al server (usata quando DEMO = false) */
  async function http(method, path, body) {
    let r;
    try {
      r = await fetch(API_BASE + path, {
        method, credentials: 'include', cache: 'no-store',
        headers: Object.assign({ 'X-Requested-With': 'giornale' }, body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (_) {
      const e = new Error('Server non raggiungibile. Controlla la connessione e riprova.'); e.code = 'rete'; throw e;
    }
    if (!r.ok) {
      let msg = r.statusText;
      try { const j = await r.json(); if (j && j.errore) msg = j.errore; } catch (_) {}
      const e = new Error(msg); e.code = r.status === 401 ? 'auth' : r.status === 403 ? 'refused' : 'server'; throw e;
    }
    return r.status === 204 ? null : r.json();
  }

  const api = {
    demo: DEMO,
    meteoAuto: !DEMO && CONF.meteoAuto === true,   // meteo automatico OpenWeather attivo sul server

    // POST /api/cantieri/:id/giornate/:data/meteo/automatico   (legge subito il meteo da OpenWeather)
    async meteoAutomatico(cid, data) {
      if (DEMO) return fail('Il meteo automatico funziona solo con il server.');
      return http('POST', `/cantieri/${cid}/giornate/${data}/meteo/automatico`, {});
    },
    // GET /api/geocodifica?q=comune   (posizione del cantiere)
    async geocodifica(testo) {
      if (DEMO) return fail('La ricerca della posizione funziona solo con il server.');
      return http('GET', '/geocodifica?q=' + encodeURIComponent(testo));
    },

    /* ---------- accesso ---------- */
    // POST /api/login {email,password} -> utente
    async login(email, password) {
      if (!DEMO) return http('POST', '/login', { email, password });
      const d = load(); const u = d.utenti.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase() && x.pwd === password);
      if (!u) return fail('Email o password non corretti.');
      if (u.attivo === false) return fail('Il tuo accesso è sospeso. Contatta l’amministratore.');
      try { localStorage.setItem(SESSION, u.id); } catch (_) {}
      return wait(pub(u));
    },
    // POST /api/logout
    async logout() { if (!DEMO) return http('POST', '/logout'); try { localStorage.removeItem(SESSION); } catch (_) {} return wait(null); },
    // GET /api/me -> utente o 401
    async me() { if (!DEMO) { try { return await http('GET', '/me'); } catch (e) { if (e.code === 'auth') return null; throw e; } } return wait(pub(me(load()))); },
    // POST /api/richieste {nome,email,password,ruolo,ente,tel,note}
    async richiediAccesso(r) {
      if (!DEMO) return http('POST', '/richieste', r);
      const d = load(); const em = String(r.email).trim().toLowerCase();
      if (d.utenti.some(u => u.email.toLowerCase() === em) || d.richieste.some(x => x.email.toLowerCase() === em)) return fail('Esiste già un account o una richiesta con questa email.');
      d.richieste.push(Object.assign({ id: uid('r_'), t: Date.now() }, r, { email: em })); save(d); return wait(true);
    },

    /* ---------- cantieri ---------- */
    // GET /api/cantieri (il server restituisce solo quelli abilitati)
    async listCantieri() {
      if (!DEMO) return http('GET', '/cantieri');
      const d = load(); const u = me(d); if (!u) return wait([]);
      return wait(d.cantieri.filter(c => !c.eliminato && (u.ruolo === 'admin' || u.tutti || (u.cantieri || []).includes(c.id))));
    },
    // POST /api/cantieri  |  PUT /api/cantieri/:id   (solo amministratore)
    async saveCantiere(c) {
      if (!DEMO) return c.id ? http('PUT', '/cantieri/' + c.id, c) : http('POST', '/cantieri', c);
      const d = load(); if (me(d)?.ruolo !== 'admin') return fail('Solo l’amministratore gestisce i cantieri.');
      if (c.id) { const i = d.cantieri.findIndex(x => x.id === c.id); d.cantieri[i] = Object.assign(d.cantieri[i], c); }
      else d.cantieri.push(Object.assign({ id: uid('c_'), creato: Date.now() }, c));
      save(d); return wait(true);
    },

    /* ---------- imprese ---------- */
    // GET /api/cantieri/:id/imprese
    async listImprese(cid) { if (!DEMO) return http('GET', `/cantieri/${cid}/imprese`); return wait(load().imprese.filter(i => i.cantiereId === cid)); },
    // POST /api/cantieri/:id/imprese  (DL, amministratore)
    async addImpresa(cid, imp) {
      if (!DEMO) return http('POST', `/cantieri/${cid}/imprese`, imp);
      const d = load(); d.imprese.push(Object.assign({ id: uid('i_'), cantiereId: cid, t: Date.now() }, imp)); save(d); return wait(true);
    },
    // DELETE /api/imprese/:id  (amministratore)
    async delImpresa(id) { if (!DEMO) return http('DELETE', '/imprese/' + id); const d = load(); d.imprese = d.imprese.filter(i => i.id !== id); save(d); return wait(true); },

    /* ---------- giornate ---------- */
    // GET /api/cantieri/:id/giornate/:data -> giornata o null
    async getGiornata(cid, data) { if (!DEMO) return http('GET', `/cantieri/${cid}/giornate/${data}`); return wait(load().giornate[gKey(cid, data)] || null); },
    // GET /api/cantieri/:id/giornate?dal=&al=
    async listGiornate(cid, dal, al) {
      if (!DEMO) return http('GET', `/cantieri/${cid}/giornate?dal=${dal || ''}&al=${al || ''}`);
      const g = Object.values(load().giornate).filter(x => x.cantiereId === cid && (!dal || x.data >= dal) && (!al || x.data <= al));
      return wait(g.sort((a, b) => a.data < b.data ? -1 : 1));
    },
    // POST /api/cantieri/:id/giornate/:data/:lista   (aggiunge una voce: lavorazioni, ordini, riserve...)
    async addVoce(cid, data, lista, voce) {
      if (!DEMO) return http('POST', `/cantieri/${cid}/giornate/${data}/${lista}`, voce);
      const d = load(); const k = gKey(cid, data); const g = d.giornate[k] || (d.giornate[k] = { cantiereId: cid, data, creato: Date.now() });
      const id = uid('v_'); (g[lista] || (g[lista] = [])).push(Object.assign({ id }, voce)); save(d); return wait({ id });
    },
    // PATCH /api/cantieri/:id/giornate/:data/:lista/:voceId
    async updVoce(cid, data, lista, id, patch) {
      if (!DEMO) return http('PATCH', `/cantieri/${cid}/giornate/${data}/${lista}/${id}`, patch);
      const d = load(); const g = d.giornate[gKey(cid, data)]; const v = g && (g[lista] || []).find(x => x.id === id);
      if (!v) return fail('Voce non trovata.'); Object.assign(v, patch); save(d); return wait(true);
    },
    // DELETE /api/cantieri/:id/giornate/:data/:lista/:voceId  (la voce resta archiviata come eliminata)
    async delVoce(cid, data, lista, id) {
      if (!DEMO) return http('DELETE', `/cantieri/${cid}/giornate/${data}/${lista}/${id}`);
      return api.updVoce(cid, data, lista, id, { eliminata: true, eliminataT: Date.now() });
    },
    // POST /api/cantieri/:id/giornate/:data/messaggi/:msgId/letto   ("Ho letto" / "Visto")
    async segnaLetto(cid, data, id) {
      if (!DEMO) return http('POST', `/cantieri/${cid}/giornate/${data}/messaggi/${id}/letto`, {});
      const d = load(); const u = me(d); const g = d.giornate[gKey(cid, data)]; const m = g && (g.messaggi || []).find(x => x.id === id);
      if (!u || !m) return fail('Messaggio non trovato.');
      m.letture = Object.assign({}, m.letture, { [u.id]: { nome: u.nome, t: Date.now() } }); save(d); return wait(true);
    },
    // PUT /api/cantieri/:id/giornate/:data/meteo
    async setMeteo(cid, data, meteo) {
      if (!DEMO) return http('PUT', `/cantieri/${cid}/giornate/${data}/meteo`, meteo);
      const d = load(); const k = gKey(cid, data); const g = d.giornate[k] || (d.giornate[k] = { cantiereId: cid, data, creato: Date.now() });
      g.meteo = meteo; save(d); return wait(true);
    },
    // PUT /api/cantieri/:id/giornate/:data/chiusura {chiusa}
    async setChiusura(cid, data, chiusura) {
      if (!DEMO) return http('PUT', `/cantieri/${cid}/giornate/${data}/chiusura`, chiusura);
      const d = load(); const k = gKey(cid, data); const g = d.giornate[k] || (d.giornate[k] = { cantiereId: cid, data, creato: Date.now() });
      g.chiusura = chiusura; save(d); return wait(true);
    },

    /* ---------- amministrazione utenti ---------- */
    // GET /api/richieste
    async listRichieste() { if (!DEMO) return http('GET', '/richieste'); return wait(load().richieste.map(({ password, ...r }) => r)); },
    // POST /api/richieste/:id/approva {ruolo,tutti,cantieri}
    async approva(id, perm) {
      if (!DEMO) return http('POST', `/richieste/${id}/approva`, perm);
      const d = load(); const r = d.richieste.find(x => x.id === id); if (!r) return fail('Richiesta non trovata.');
      d.utenti.push({ id: uid('u_'), email: r.email, pwd: r.password, nome: r.nome, ente: r.ente, tel: r.tel, ruolo: perm.ruolo, tutti: perm.tutti, cantieri: perm.cantieri, attivo: true, approvato: Date.now() });
      d.richieste = d.richieste.filter(x => x.id !== id); save(d); return wait(true);
    },
    // DELETE /api/richieste/:id
    async rifiuta(id) { if (!DEMO) return http('DELETE', '/richieste/' + id); const d = load(); d.richieste = d.richieste.filter(x => x.id !== id); save(d); return wait(true); },
    // GET /api/utenti
    async listUtenti() { if (!DEMO) return http('GET', '/utenti'); return wait(load().utenti.map(pub)); },
    // PATCH /api/utenti/:id {ruolo,tutti,cantieri,attivo}
    async updUtente(id, patch) {
      if (!DEMO) return http('PATCH', '/utenti/' + id, patch);
      const d = load(); const u = d.utenti.find(x => x.id === id); if (!u) return fail('Utente non trovato.'); Object.assign(u, patch); save(d); return wait(true);
    },

    /* solo modalità dimostrativa: riporta i dati di esempio allo stato iniziale */
    // DELETE /api/cantieri/:id   (archivia il cantiere: sparisce dall'app, i dati restano)
    async delCantiere(id) {
      if (!DEMO) return http('DELETE', '/cantieri/' + id);
      const d = load(); const c = d.cantieri.find(x => x.id === id); if (c) c.eliminato = Date.now(); save(d); return wait(true);
    },
    // POST /api/utenti   (nuovo utente creato dall'amministratore)
    async addUtente(u) {
      if (!DEMO) return http('POST', '/utenti', u);
      const d = load(); const em = String(u.email).trim().toLowerCase();
      if (d.utenti.some(x => x.email.toLowerCase() === em)) return fail('Esiste già un utente con questa email.');
      if (String(u.password || '').length < 8) return fail('La password provvisoria deve avere almeno 8 caratteri.');
      d.utenti.push({ id: uid('u_'), email: em, pwd: u.password, nome: u.nome, ente: u.ente, tel: u.tel, ruolo: u.ruolo, tutti: !!u.tutti, cantieri: u.cantieri || [], attivo: true });
      save(d); return wait(true);
    },
    // POST /api/cantieri/:id/giornate/:data/:lista/:voceId/foto   (immagine già ridotta dall'app)
    async addFoto(cid, data, lista, voceId, blob) {
      if (!DEMO) {
        let r;
        try {
          r = await fetch(`${API_BASE}/cantieri/${cid}/giornate/${data}/${lista}/${voceId}/foto`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Requested-With': 'giornale' }, body: blob });
        } catch (_) { const e = new Error('Server non raggiungibile.'); e.code = 'rete'; throw e; }
        if (!r.ok) { let m = r.statusText; try { m = (await r.json()).errore || m; } catch (_) {} const e = new Error(m); e.code = r.status === 401 ? 'auth' : 'server'; throw e; }
        return r.json();
      }
      // dimostrativa: la foto (già ridotta) resta nel browser
      const url = await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsDataURL(blob); });
      const d = load(); const u = me(d); const g = d.giornate[gKey(cid, data)]; const v = g && (g[lista] || []).find(x => x.id === voceId);
      if (!v) return fail('Registrazione non trovata.');
      (v.foto || (v.foto = [])).push({ id: uid('f_'), url, t: Date.now(), da: u.id, daNome: u.nome });
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) { return fail('Spazio del browser esaurito: in modalità dimostrativa le foto occupano molto. Elimina qualche foto o ripristina i dati di esempio.'); }
      return wait({ id: v.foto[v.foto.length - 1].id });
    },
    // DELETE /api/foto/:id
    async delFoto(cid, data, lista, voceId, fotoId) {
      if (!DEMO) return http('DELETE', '/foto/' + fotoId);
      const d = load(); const g = d.giornate[gKey(cid, data)]; const v = g && (g[lista] || []).find(x => x.id === voceId);
      if (v && v.foto) v.foto = v.foto.filter(f => f.id !== fotoId); save(d); return wait(true);
    },

    resetDemo() { try { localStorage.removeItem(KEY); localStorage.removeItem(SESSION); } catch (_) {} }
  };

  window.api = api;
})();

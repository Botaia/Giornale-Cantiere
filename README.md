# Giornale di Cantiere — scheletro della web app

App web installabile (PWA) per il giornale dei lavori: funziona su iPhone, iPad, Android e computer.

## Cosa c'è

```
giornale-cantiere/
├── index.html            pagina principale
├── manifest.webmanifest  nome, icone e colori per l'installazione sul telefono
├── sw.js                 service worker (installazione e avvio con rete scarsa)
├── css/style.css         grafica
├── js/api.js             livello dati: oggi SIMULATO, domani collegato al server
├── js/app.js             interfaccia: pagine, moduli, PDF
└── icons/                icone dell'app
```

Pagine già pronte:

- **Accesso** con email e password, e **richiesta di accesso** per i nuovi utenti
- **Elenco cantieri**, filtrato in base ai cantieri abilitati
- **Cantiere** con data automatica, numero di giornata e quattro schede:
  - **Giornale**: riepilogo, meteo, imprese e presenze, lavorazioni, criticità, direzione lavori (indicazioni e ordini di servizio), riserve, sicurezza CSE, verbale
  - **Imprese**: affidataria, subappalto, subaffidamento, lavoratore autonomo, nolo a caldo
  - **Registro**: ordini di servizio, riserve e criticità aperte di tutto il cantiere, con i totali in euro
  - **PDF**: esportazione di una giornata o di un periodo, con gli spazi per le firme
- **Utenti e permessi** (solo amministratore): approvazione delle richieste, ruoli, cantieri abilitati, sospensione degli accessi, gestione dei cantieri

## Provarla sul tuo PC

Il service worker richiede che l'app sia servita da un server web: aprire `index.html` con un doppio clic non basta.

Dalla cartella `giornale-cantiere` esegui uno di questi comandi:

```
python -m http.server 8080
```
oppure, se hai Node.js:
```
npx serve -l 8080
```

Poi apri **http://localhost:8080** nel browser.

Account di prova (password `demo`):

| Email | Ruolo |
|---|---|
| admin@demo.it | Amministratore |
| dl@demo.it | Direttore dei Lavori |
| cse@demo.it | Coordinatore Sicurezza |
| impresa@demo.it | Impresa |

In modalità dimostrativa i dati restano solo nel browser che stai usando. Il link **Ripristina i dati di esempio**, nella pagina di accesso, riporta tutto allo stato iniziale. Non inserire dati reali: le password di prova sono salvate in chiaro.

## Provarla sul telefono

Il telefono deve essere sulla stessa rete Wi-Fi del PC. Apri `http://<indirizzo-IP-del-PC>:8080`.

L'installazione come app richiede HTTPS, quindi sarà possibile quando l'app sarà sul server aziendale con un certificato:

- **Android (Chrome):** menu ⋮ › *Installa app*
- **iPhone/iPad (Safari):** Condividi › *Aggiungi alla schermata Home*

## Prossimi passi

1. **Database:** script SQL per PostgreSQL, da eseguire con pgAdmin, con tabelle per utenti, cantieri, imprese, giornate e voci.
2. **API:** un piccolo servizio Node.js che implementa gli endpoint indicati nei commenti di `js/api.js`: login con password cifrate, controllo dei permessi per ruolo e cantiere sul server, registro delle modifiche.
3. **Collegamento:** in `js/api.js` imposta `DEMO = false`. L'interfaccia non cambia.
4. **Server aziendale:** pubblicazione con HTTPS e backup automatico del database.

# GASS Pagamenti

Sistema di gestione finanziaria per gruppi di acquisto solidale (GAS).

## Panoramica

GASS Pagamenti è un'applicazione web completa per la gestione di:
- Registrazione consegne e transazioni
- Tracciamento saldi partecipanti (crediti e debiti)
- Storico completo delle operazioni
- Calcolo automatico cassa e compensazioni
- Audit trail completo delle modifiche

## Caratteristiche

- **Responsive Design**: Interfaccia ottimizzata per mobile e desktop
- **Calcoli Automatici**: Cassa e compensazioni gestiti automaticamente
- **Sicurezza**: Autenticazione con sessioni, password cifrate
- **Tracciabilità**: Registrazione di tutte le modifiche (chi, quando)
- **Database Locale**: SQLite, nessuna dipendenza cloud
- **Deploy Semplice**: Container Docker ready

## Documentazione

- **[Manuale Utente](docs/MANUALE_UTENTE.md)** - Guida completa per utilizzatori
- **[Documentazione Tecnica](docs/TECHNICAL.md)** - Riferimento per sviluppatori
- **[Guida Deploy](DEPLOYMENT.md)** - Istruzioni per installazione e configurazione

## Quick Start

### Requisiti

- Node.js v18 o superiore
- Docker (opzionale, consigliato per produzione)

### Installazione Locale

```bash
# Clona il repository
git clone <repository-url>
cd gass

# Installa dipendenze
npm install

# Avvia in modalità sviluppo
npm run dev
```

L'applicazione sarà disponibile su http://localhost:3000

**Credenziali predefinite**:
- Username: `admin`
- Password: `admin`

⚠️ **IMPORTANTE**: Cambiare la password predefinita al primo accesso.

### Deploy con Docker

```bash
# Build immagine
docker-compose build

# Avvia il servizio
docker-compose up -d
```

Il database sarà persistito in `./data/gass.db`.

Per dettagli completi, vedere [DEPLOYMENT.md](DEPLOYMENT.md).

### Gestione Password

Per cambiare la password dell'utente admin (o altri utenti):

**Locale**:
```bash
node change-password.js admin NuovaPassword123
```

**Docker**:
```bash
docker exec gass node change-password.js admin NuovaPassword123
```

Lo script:
- Valida l'esistenza dell'utente
- Genera hash bcrypt sicuro (12 rounds)
- Aggiorna il database
- Mostra conferma dell'operazione

⚠️ **Sicurezza**: Utilizzare sempre password forti in produzione.

## Stack Tecnologico

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: SQLite3 (better-sqlite3)
- **Autenticazione**: express-session + bcrypt
- **Architettura**: MVC pattern

### Frontend
- **Linguaggio**: Vanilla JavaScript (ES6+)
- **Design**: CSS responsive (mobile-first)
- **Pattern**: Component-based senza framework

## Struttura Progetto

```
gass/
├── server/
│   ├── config/          # Database e configurazione
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   └── middleware/      # Auth, user agent detection
├── public/
│   ├── js/
│   │   ├── shared/      # Codice condiviso
│   │   ├── consegna.js  # Mobile views
│   │   └── *-desktop.js # Desktop views
│   ├── *.html           # Pagine HTML
│   └── style*.css       # Fogli di stile
├── docs/                # Documentazione
├── data/                # Database SQLite (gitignored)
└── server.js            # Entry point
```

## Sviluppo

### Comandi Disponibili

```bash
npm run dev        # Sviluppo con auto-restart (nodemon)
npm start          # Produzione
npm test           # Esegui test (se configurati)
```

### Convenzioni

- I campi cassa sono **sempre readonly** - valori calcolati automaticamente
- I campi compensazione sono **system-managed** - no override manuale
- Sviluppare sempre per **mobile E desktop** contemporaneamente
- Test su viewports mobile (412px) e desktop (1920px)

## Sicurezza

- ✅ Password cifrate con bcrypt (12 rounds)
- ✅ Sessioni sicure (httpOnly, secure in produzione)
- ✅ Audit trail completo (created_by, updated_by, timestamps)
- ✅ Protezione API con middleware autenticazione
- ✅ Gestione transazioni database per integrità dati

⚠️ **Mai committare**:
- `data/` (database con dati sensibili)
- `update-admin-password.js` (script con password in chiaro)
- Credenziali o secrets

## Contribuire

Per contribuire al progetto:

1. Leggere [TECHNICAL.md](docs/TECHNICAL.md) per l'architettura
2. Seguire le convenzioni di sviluppo in [CLAUDE.md](CLAUDE.md)
3. Testare su mobile e desktop
4. Commit con messaggi semantici: `feat:`, `fix:`, `docs:`, `refactor:`

## Versione

**Versione Corrente**: 1.4

**Changelog Recente**:
- v1.4 (Nov 2025): Sistema audit tracking completo
- v1.3 (Nov 2025): Riorganizzazione architettura MVC
- v1.2 (Nov 2025): Sistema autenticazione e sessioni
- v1.1 (Nov 2025): Compensazione automatica bidirezionale
- v1.0 (Nov 2025): Release iniziale con SQLite

## Licenza

[Specificare licenza]

## Supporto

Per problemi o domande:
- Consultare [Manuale Utente](docs/MANUALE_UTENTE.md)
- Vedere [Documentazione Tecnica](docs/TECHNICAL.md)
- Aprire una issue su GitHub

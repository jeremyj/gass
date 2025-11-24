# GASS Pagamenti - Manuale Utente

## Introduzione

GASS Pagamenti è un sistema di gestione finanziaria per gruppi di acquisto solidale (GAS). Il sistema permette di:
- Registrare le consegne e i movimenti di cassa
- Tenere traccia dei saldi dei partecipanti (crediti e debiti)
- Consultare lo storico delle transazioni
- Gestire i pagamenti al produttore

## Primi Passi

### Primo Accesso

1. Aprire l'applicazione nel browser
2. Effettuare il login con le credenziali fornite
   - **Username predefinito**: `admin`
   - **Password predefinita**: `admin`
3. **IMPORTANTE**: Cambiare la password predefinita al primo accesso

### Cambiare la Password

Per motivi di sicurezza, contattare l'amministratore del sistema per modificare la password.

### Navigazione

L'applicazione si adatta automaticamente al dispositivo utilizzato:

#### Versione Mobile
- Navigazione tramite barra inferiore con tre schede:
  - **Consegna**: Registra nuove consegne
  - **Saldi**: Visualizza i saldi dei partecipanti
  - **Storico**: Consulta le consegne passate

#### Versione Desktop
- Navigazione tramite menu superiore con le stesse tre sezioni
- Layout ottimizzato per schermi più grandi

## Funzionalità

### 1. Consegna - Registrazione Transazioni

La pagina Consegna permette di registrare i movimenti per una data specifica.

#### Dati Giornata (Cassa)

Tre campi di sola lettura che vengono calcolati automaticamente dal sistema:

**Trovato in Cassa**
- Denaro trovato in cassa all'inizio della giornata
- Corrisponde al "Lasciato in Cassa" della consegna precedente
- Se è la prima consegna, il valore è 0

**Pagato Produttore**
- Importo totale pagato al produttore
- Calcolato automaticamente sommando tutti i "Conto Produttore" dei partecipanti
- Si aggiorna in tempo reale quando si inseriscono i movimenti

**Lasciato in Cassa**
- Denaro rimasto in cassa alla fine della giornata
- Calcolato come: `Trovato + Incassato - Pagato`
- Dove `Incassato` è la somma degli importi saldati da tutti i partecipanti

**Note Giornata**
- Campo opzionale per annotazioni sulla consegna
- Può essere salvato indipendentemente dai movimenti tramite il pulsante "Salva Note"

#### Registrare un Movimento

Per registrare un movimento per un partecipante:

1. **Selezionare il partecipante** dalla lista
2. Si apre un modulo con:
   - Saldo iniziale del partecipante
   - Campi per inserire i dati del movimento
   - Anteprima del nuovo saldo

3. **Compilare i campi principali**:

   **Conto Produttore** (obbligatorio)
   - Importo totale dovuto al produttore per la merce ricevuta
   - Questo è l'importo della spesa, indipendentemente da quanto viene pagato

   **Importo Saldato**
   - Denaro effettivamente consegnato dal partecipante
   - Può essere uguale, maggiore o minore del Conto Produttore

4. **Il sistema calcola automaticamente**:

   **Lascia Credito / Lascia Debito**
   - Se l'importo saldato è maggiore del conto produttore → si crea un credito
   - Se l'importo saldato è minore del conto produttore → si crea un debito
   - Questi campi sono di sola lettura e calcolati automaticamente

#### Gestione Crediti e Debiti

Il sistema gestisce automaticamente i crediti e debiti esistenti:

**Compensazione Automatica Bidirezionale**

Il sistema compensa automaticamente crediti e debiti nelle due direzioni:

1. **Quando si crea un credito ma il partecipante ha un debito**:
   - Esempio: Partecipante ha 7€ di debito, Conto=15€, Importo=22€
   - Il sistema automaticamente:
     - Spunta "Salda intero debito"
     - Popola "Debito saldato" con 7€
     - Mostra il partecipante "in pari" (saldo 0€)

2. **Quando si crea un debito ma il partecipante ha un credito**:
   - Esempio: Partecipante ha 10€ di credito, Conto=18€, Importo=5€
   - Il sistema automaticamente:
     - Spunta "Usa intero credito"
     - Popola "Usa credito" con 10€
     - Mostra "Lascia debito" di 3€ (invece di 13€)

**Sezioni Credito e Debito**

A seconda del saldo del partecipante, potrebbero apparire:

- **Sezione CREDITO** (solo se il partecipante ha credito):
  - ☑️ **Usa intero credito**: Spuntato automaticamente quando il sistema usa tutto il credito disponibile
  - **Usa credito**: Importo di credito utilizzato (sola lettura, gestito dal sistema)

- **Sezione DEBITO** (solo se il partecipante ha debito):
  - ☑️ **Salda intero debito**: Spuntato automaticamente quando il sistema salda tutto il debito
  - **Debito saldato**: Importo di debito saldato (sola lettura, gestito dal sistema)

**Nota**: I campi "Usa credito" e "Debito saldato" sono sempre disabilitati perché vengono gestiti automaticamente dal sistema. Questo garantisce che i calcoli siano sempre corretti e coerenti.

#### Salvataggio

- **Pulsante "Salva Movimento"**: Salva il movimento del partecipante corrente
- **Pulsante "Annulla"**: Chiude il modulo senza salvare
- **Pulsante "Salva Note"**: Appare quando si modificano le note giornata, permette di salvare solo le note senza dover salvare movimenti

#### Cambio Data con Partecipante Aperto

Funzionalità avanzata per confrontare transazioni:
- Se si cambia data mentre un partecipante è aperto, il sistema:
  - Carica automaticamente i dati del partecipante per la nuova data
  - Mantiene aperto il modulo del partecipante
  - Aggiorna tutti i campi (saldo, movimenti) per la nuova data
- Utile per confrontare rapidamente le transazioni dello stesso partecipante in date diverse

### 2. Saldi - Panoramica Bilanci

La pagina Saldi mostra una panoramica dei saldi di tutti i partecipanti.

#### Visualizzazione Saldi Attuali

- Lista di tutti i partecipanti con i loro saldi correnti
- Codifica a colori:
  - **Rosso**: Saldo negativo (debito verso il gruppo)
  - **Verde**: Saldo positivo (credito del partecipante)
  - **Grigio**: Saldo a zero (in pari)
- Data dell'ultima modifica per ciascun partecipante

#### Visualizzazione Storica

Per vedere i saldi in una data passata:
1. Utilizzare il selettore di data in alto
2. Selezionare la data desiderata
3. Il sistema ricalcola automaticamente i saldi come erano in quella data

Questo è utile per:
- Verificare i saldi in un momento specifico del passato
- Controllare l'evoluzione dei saldi nel tempo

### 3. Storico - Consultazione Cronologica

La pagina Storico permette di consultare tutte le consegne registrate.

#### Visualizzazione

- Le consegne sono mostrate in ordine cronologico inverso (più recenti in alto)
- Per ogni consegna viene visualizzata:
  - Data
  - Dati cassa (trovato, pagato, lasciato)
  - Lista dei movimenti dei partecipanti

#### Indicatore Note

Quando un movimento ha una nota associata, viene visualizzato un indicatore ℹ️ accanto al nome del partecipante.

#### Dettagli Movimento

Per ogni movimento vengono mostrati:
- **Conto**: Conto produttore (importo della spesa)
- **Pagato**: Importo saldato dal partecipante
- **Salda debito**: Eventuale debito saldato
- **Usa credito**: Eventuale credito utilizzato
- **Nuovo saldo**: Saldo finale dopo il movimento

#### Eliminazione Consegna

È possibile eliminare una consegna tramite il pulsante di eliminazione.

**ATTENZIONE**:
- L'eliminazione è permanente
- Il sistema ricalcola automaticamente tutti i saldi successivi
- Verificare attentamente prima di eliminare

### 4. Uso del Calendario

Il calendario è disponibile in tutte le sezioni per facilitare la selezione delle date.

#### Selezione Data

1. Cliccare sul campo data o sull'icona calendario
2. Utilizzare le frecce per navigare tra i mesi
3. Cliccare sulla data desiderata

#### Indicatori Visivi

Il calendario mostra:
- **Sfondo verde**: Date con consegne registrate
- **Evidenziazione**: Data oggi
- **Selezione**: Data attualmente selezionata

#### Apertura Mese Corrente

Il calendario si apre sempre sul mese corrente per facilitare l'accesso alle date recenti.

#### Persistenza Data

La data selezionata viene mantenuta quando si cambia sezione:
- Se si seleziona una data in Consegna e si passa a Saldi, la data rimane la stessa
- Questo facilita la consultazione coerente dei dati attraverso le diverse sezioni

### 5. Gestione Partecipanti

(Funzionalità amministrative - contattare l'amministratore del sistema)

## Comprendere i Calcoli dei Saldi

Il sistema calcola automaticamente i saldi applicando in sequenza i movimenti di ciascuna consegna.

### Come Funziona un Movimento

Ogni movimento può modificare il saldo di un partecipante in questi modi:

1. **Creazione di credito**: Quando si paga più di quanto si deve
   - Esempio: Conto Produttore 15€, Importo Saldato 20€ → Credito di 5€

2. **Creazione di debito**: Quando si paga meno di quanto si deve
   - Esempio: Conto Produttore 20€, Importo Saldato 15€ → Debito di 5€

3. **Utilizzo di credito esistente**: Il credito viene automaticamente utilizzato per ridurre nuovi debiti

4. **Saldo di debito esistente**: I pagamenti vengono automaticamente applicati per ridurre i debiti

### Esempio Pratico

Situazione iniziale:
- Giovanni ha un credito di 10€

Consegna del 20/11:
- Conto Produttore: 18€
- Importo Saldato: 5€
- Calcolo: 5€ - 18€ = -13€ (nuovo debito potenziale)

Il sistema automaticamente:
1. Rileva che Giovanni ha 10€ di credito
2. Usa i 10€ di credito per ridurre il debito
3. Risultato finale: Debito di 3€ (13€ - 10€)

Questo assicura che crediti e debiti siano sempre gestiti correttamente senza interventi manuali.

## Sicurezza e Tracciamento

### Sistema di Autenticazione

- **Sessioni**: Le sessioni durano 7 giorni
- **Disconnessione automatica**: Dopo un periodo di inattività
- **Password sicure**: Utilizzare sempre password complesse

### Tracciamento Modifiche

Il sistema registra automaticamente:
- Chi ha creato ogni consegna
- Chi ha modificato ogni record
- Data e ora di ogni operazione

Questo garantisce:
- Tracciabilità completa delle operazioni
- Possibilità di audit in caso di necessità
- Trasparenza nella gestione del gruppo

## Risoluzione Problemi

### Non Riesco ad Accedere

1. Verificare che username e password siano corretti
2. Controllare che la sessione non sia scaduta
3. Contattare l'amministratore per reimpostare la password

### I Calcoli Non Sembrano Corretti

Il sistema calcola automaticamente tutti i valori. Se i calcoli sembrano errati:

1. Verificare che tutti i movimenti siano stati inseriti correttamente
2. Controllare lo storico per vedere l'evoluzione dei saldi
3. Utilizzare la visualizzazione storica per verificare i saldi in date passate

Se il problema persiste, contattare l'amministratore.

### La Data Si Resetta Quando Cambio Sezione

La data dovrebbe essere mantenuta automaticamente tra le sezioni. Se questo non accade:

1. Verificare che il browser permetta l'uso di localStorage
2. Cancellare la cache del browser
3. Contattare l'amministratore se il problema persiste

### Non Vedo i Campi di Compensazione

I campi "Usa credito" e "Debito saldato" sono sempre presenti ma disabilitati:
- Sono visibili in tutti i movimenti
- Vengono popolati automaticamente quando applicabile
- Non possono essere modificati manualmente per garantire l'integrità dei dati

## Supporto

Per assistenza o segnalazioni di problemi, contattare l'amministratore del sistema.

## Note Sulla Versione

Sistema GASS Pagamenti - Versione 1.4
- Sistema di autenticazione implementato
- Tracciamento audit completo
- Compensazione automatica bidirezionale crediti/debiti
- Indicatori note nello storico
- Campi cassa di sola lettura con calcolo automatico

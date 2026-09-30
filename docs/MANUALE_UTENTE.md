# GASS Pagamenti - Manuale Utente

## Introduzione

GASS Pagamenti è un sistema di gestione finanziaria per gruppi di acquisto solidale (GAS). Il sistema permette di:
- Registrare le consegne e i movimenti di cassa
- Tenere traccia dei saldi dei partecipanti (crediti e debiti)
- Consultare lo storico delle transazioni
- Gestire i pagamenti al produttore

## Primi Passi

### Primo Accesso

Una guida di una pagina per chi inizia è su https://gass.x86.it/inbreve (non serve il login).

1. Aprire https://gass.x86.it e toccare **Accedi**
2. Nella pagina di Authentik inserire il nome utente e la password provvisoria ricevuti dall'amministratore
3. Al primo accesso GASS chiede di scegliere una nuova password (almeno 8 caratteri), da scrivere due volte, poi **Salva password**

Dalla volta successiva si entra con il nome utente e la nuova password.

### Cambiare la Password

- **Accesso con Authentik** (tutti i partecipanti): la password si cambia su https://auth.x86.it, dalle impostazioni del proprio utente.
- **Account locale** (solo amministratore): link **Cambia password** nel menu in alto (sul telefono, icona a forma di chiave nell'intestazione), poi password attuale e nuova password (minimo 8 caratteri).

### Navigazione

L'applicazione si adatta automaticamente al dispositivo utilizzato:

#### Versione Mobile
- L'intestazione mostra il nome utente, l'icona della chiave (cambia password, solo account locali) e l'icona di uscita (**Esci**)
- Navigazione tramite barra inferiore con tre schede:
  - **Consegna**: Registra nuove consegne
  - **Saldi**: Visualizza i saldi dei partecipanti
  - **Storico**: Consulta le consegne passate

#### Versione Desktop
- Navigazione tramite menu superiore: **Consegna**, **Saldi**, **Storico** e, solo per gli amministratori, **Attività**; a destra il nome utente, **Cambia password** (solo account locali) ed **Esci**
- Layout ottimizzato per schermi più grandi

#### Intestazione stagionale e importi
- Ogni pagina ha un'intestazione scura i cui colori seguono la stagione della data selezionata (autunno set–nov, inverno dic–feb, primavera mar–mag, estate giu–ago), con la verdura del mese sotto la data. La riga sopra la data dice "Consegna di oggi" / "Saldi di oggi" per oggi, "Consegna di" / "Saldi al" per un'altra data; l'anno compare solo se non è quello corrente.
- Gli importi sono nel formato italiano ("11,50 €", senza decimali se interi: "8 €"). Nei campi si può scrivere la virgola o il punto; il campo mostra la virgola.
- Colori dei saldi (non cambiano con la stagione): **blu** con "+" e la parola "credito", **rosso vino** con "−" e la parola "debito", **grigio** "0 € in pari".

## Funzionalità

### 1. Consegna - Registrazione Transazioni

La pagina Consegna permette di registrare i movimenti per una data specifica.

#### Dati Giornata (Cassa)

La cassa è una somma calcolata automaticamente dal sistema, non si scrive nulla:

**Trovato**
- Denaro trovato in cassa all'inizio della giornata
- Corrisponde a "In cassa" (desktop: "Lasciato in cassa") della consegna precedente
- Se è la prima consegna, il valore è 0

**+ Incassato**
- Somma degli importi saldati da tutti i partecipanti

**− Pagato** (desktop: "Pagato al produttore")
- Importo totale pagato al produttore
- Calcolato sommando tutti i "Conto produttore" dei partecipanti
- Si aggiorna in tempo reale quando si inseriscono i movimenti

**= In cassa** (desktop: "Lasciato in cassa")
- Denaro rimasto in cassa alla fine della giornata
- Calcolato come: `Trovato + Incassato - Pagato`
- Se il valore è negativo viene evidenziato con l'avviso "Cassa negativa"

**Note della giornata**
- Campo opzionale per annotazioni sulla consegna
- Su desktop può essere salvato indipendentemente dai movimenti tramite il pulsante "Salva note", che appare quando le note cambiano

**Mobile**: la cassa è la riga in cima alla pagina; sotto ci sono lo stato ("Consegna aperta" / "Consegna chiusa") con i link **Chiudi consegna** / **Riapri consegna** (e **Annulla consegna** per gli amministratori) e le Note della giornata.

**Desktop**: la colonna a sinistra contiene la cassa e le note; lo stato e i pulsanti Chiudi / Riapri / Annulla consegna sono nell'intestazione, accanto a **Cambia data**.

#### Registrare un Movimento

Se per la data non esiste ancora una consegna, premere **Nuova consegna**.

I movimenti sono elencati sotto **Chi ha ritirato** (mobile) o **Movimenti** (desktop): ogni riga mostra partecipante, conto, pagato e l'esito ("+1 € credito" / "−1 € debito"). Toccare (mobile) o cliccare (desktop) una riga per modificarla. Su desktop la tabella ha le colonne Partecipante, Conto produttore, Importo saldato, Lascia credito, Lascia debito, Usa credito, Salda debito, Note, più la riga **Totale**; gli zeri sono mostrati come "–".

Per registrare un movimento per un partecipante:

1. **Selezionare il partecipante** da **+ Aggiungi partecipante**
2. Si apre il modulo (su mobile a tutto schermo, con freccia indietro; su desktop sotto la tabella) con:
   - Il nome e un'etichetta con la situazione prima di oggi ("prima di oggi: credito +5 €", "debito −5 €" o "in pari")
   - Due campi grandi per inserire i dati del movimento
   - Le righe calcolate e il riquadro con l'esito

3. **Compilare i campi principali**:

   **Conto produttore** (obbligatorio)
   - Importo totale dovuto al produttore per la merce ricevuta
   - Questo è l'importo della spesa, indipendentemente da quanto viene pagato

   **Importo saldato**
   - Denaro effettivamente consegnato dal partecipante
   - Può essere uguale, maggiore o minore del Conto produttore

4. **Il sistema calcola automaticamente** il riquadro dell'esito:

   **Lascia credito / Lascia debito / Esito: saldato, niente da riportare**
   - Se l'importo saldato è maggiore del conto produttore → si crea un credito
   - Se l'importo saldato è minore del conto produttore → si crea un debito
   - Sono valori calcolati, non modificabili

#### Gestione Crediti e Debiti

Il sistema gestisce automaticamente i crediti e debiti esistenti:

**Compensazione Automatica Bidirezionale**

Il sistema compensa automaticamente crediti e debiti nelle due direzioni:

1. **Quando si crea un credito ma il partecipante ha un debito**:
   - Esempio: Partecipante ha 7€ di debito, Conto=15€, Importo=22€
   - Il sistema automaticamente:
     - Mostra la nota "Debito saldato per intero"
     - Mostra "Esito: saldato, niente da riportare" (saldo 0€)

2. **Quando si crea un debito ma il partecipante ha un credito**:
   - Esempio: Partecipante ha 10€ di credito, Conto=18€, Importo=5€
   - Il sistema automaticamente:
     - Mostra la nota "Credito usato per intero"
     - Mostra "Lascia debito" di 3€ (invece di 13€)

**Righe calcolate**

Sotto i due campi compaiono, come semplice testo, solo le righe rilevanti per il partecipante e per l'importo inserito:

- **Usa parte del credito**: compare solo quando si usa una parte del credito
- **Salda parte del debito**: compare solo quando si salda una parte del debito
- Note come "Credito dopo oggi: X €", "Credito totale dopo oggi: X €", "Debito dopo oggi: X €", "Debito totale dopo oggi: X €" mostrano il nuovo saldo in tempo reale

Nelle tabelle dei movimenti (Consegna, Storico, Saldi) la colonna **Salda Debito** mostra quanto debito è stato pagato in quella consegna, e **Lascia Debito** solo il debito nuovo. Esempio: debito di 26,73€ pagato per 17,74€ → Salda Debito 17,74€, Lascia Debito vuoto; i 8,99€ ancora dovuti restano nel saldo.

#### Chiusura e Riapertura Consegna

Dopo aver registrato tutti i movimenti, è possibile chiudere la consegna:

- **Chiudi consegna**: Blocca tutte le modifiche per la giornata. Qualsiasi utente può chiudere una consegna. Prima di chiudere viene mostrato un riepilogo (movimenti, incassato, pagato, lasciato in cassa) da confermare.
- **Riapri consegna** (solo amministratori): Sblocca la consegna per permettere modifiche successive.

Quando una consegna è chiusa, lo stato diventa "Consegna chiusa" e non è più possibile modificarla: su mobile l'elenco resta visibile in sola lettura, senza il controllo per aggiungere partecipanti.

#### Salvataggio

- **Pulsante "Salva movimento"**: Salva il movimento del partecipante corrente
- **Pulsante "Annulla"**: Chiude il modulo senza salvare
- **Pulsante "Salva note"** (desktop): Appare quando si modificano le note della giornata, permette di salvare solo le note senza dover salvare movimenti

#### Cambio Data con Partecipante Aperto

Funzionalità avanzata per confrontare transazioni:
- Se si cambia data (**Cambia data**) mentre un partecipante è aperto, il sistema:
  - Carica automaticamente i dati del partecipante per la nuova data
  - Mantiene aperto il modulo del partecipante
  - Aggiorna tutti i campi (saldo, movimenti) per la nuova data
- Utile per confrontare rapidamente le transazioni dello stesso partecipante in date diverse

### 2. Saldi - Panoramica Bilanci

La pagina Saldi mostra una panoramica dei saldi di tutti i partecipanti.

#### Visualizzazione Saldi Attuali

- **Mobile**: in cima due totali ("Crediti, N persone +X €" e "Debiti, N persone −X €"), poi la lista **Partecipanti**
- **Desktop**: tabella con Partecipante, Username (solo amministratori), Saldo (etichetta con segno e parola), Ultimo movimento e le azioni come link di testo
- Colori: **blu** = credito (+), **rosso vino** = debito (−), **grigio** = "0 € in pari"

#### Storico Transazioni

Ogni partecipante può visualizzare il proprio storico movimenti:

- **Mobile**: Toccare il nome del partecipante per vedere i dettagli e le transazioni
- **Desktop**: Cliccare il link "Transazioni" per aprire la tabella completa

Per ogni transazione vengono mostrati: data, conto produttore, importo saldato, credito/debito lasciato, uso credito, debito saldato e il saldo risultante (colonna "Saldo dopo").

Le modifiche manuali del saldo fatte da un amministratore compaiono come **Rettifica manuale** con la data e l'importo della correzione. Restano valide anche se in seguito viene eliminata una consegna.

Tutti gli utenti autenticati possono visualizzare le transazioni di qualsiasi partecipante.

#### Visualizzazione Storica

Per vedere i saldi in una data passata:
1. Premere **Cambia data** in alto
2. Selezionare la data desiderata
3. Il sistema ricalcola automaticamente i saldi come erano in quella data

Questo è utile per:
- Verificare i saldi in un momento specifico del passato
- Controllare l'evoluzione dei saldi nel tempo

### 3. Storico - Consultazione Cronologica

La pagina Storico permette di consultare tutte le consegne registrate.

#### Visualizzazione

- Le consegne sono mostrate in ordine cronologico inverso (più recenti in alto)
- **Mobile**: ogni consegna mostra la data completa e "aperta/chiusa, in cassa X €"; toccandola si espande con la riga della cassa (Trovato + Incassato − Pagato = In cassa) e la lista dei partecipanti con l'esito
- **Desktop**: ogni consegna ha il titolo con la data, l'etichetta Aperta/Chiusa, la colonna della cassa a sinistra e la tabella dei movimenti con la riga Totale a destra

#### Indicatore Note

Quando un movimento ha una nota associata, viene visualizzato un indicatore accanto al nome del partecipante.

#### Dettagli Movimento

Per ogni movimento vengono mostrati:
- **Conto**: Conto produttore (importo della spesa)
- **Pagato**: Importo saldato dal partecipante
- **Salda debito**: Eventuale debito saldato
- **Usa credito**: Eventuale credito utilizzato
- **Nuovo saldo**: Saldo finale dopo il movimento

#### Eliminazione Consegna

Solo un amministratore può eliminare una consegna già salvata, con **Annulla consegna** nella pagina Consegna.

**ATTENZIONE**:
- L'eliminazione è permanente
- Il sistema ricalcola automaticamente tutti i saldi successivi
- Verificare attentamente prima di eliminare

### 4. Uso del Calendario

Il calendario è disponibile in tutte le sezioni per facilitare la selezione delle date.

#### Selezione Data

1. Premere **Cambia data**
2. Utilizzare le frecce per navigare tra i mesi
3. Cliccare sulla data desiderata

#### Indicatori Visivi

Il calendario mostra:
- **Sfondo colorato con sottolineatura**: Date con consegne registrate (legenda "Con consegna")
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

### Non Vedo le Righe di Compensazione

Le righe "Usa parte del credito" e "Salda parte del debito" sono visibili solo quando applicabili:
- Appaiono solo dopo aver inserito un importo saldato
- Vengono calcolate automaticamente dal sistema
- Non possono essere modificate manualmente per garantire l'integrità dei dati
- Se il partecipante non ha credito/debito preesistente, non compaiono

## Supporto

Per assistenza o segnalazioni di problemi, contattare l'amministratore del sistema.

## Note Sulla Versione

Sistema GASS Pagamenti - Versione 2.11.0
- Nuova grafica "Stagioni": l'intestazione cambia colore con la stagione della data scelta, importi nel formato 11,50 €, crediti in blu e debiti in rosso vino sempre con segno e parola
- Visualizzazione transazioni aperta a tutti gli utenti autenticati (non solo amministratori)
- Storico transazioni per partecipante nella pagina Saldi (mobile e desktop)
- Cambio password autonomo per tutti gli utenti (link Cambia password)
- Chiusura/riapertura consegne con blocco modifiche
- Gestione utenti completa per amministratori (Saldi → Modifica Utente)
- Righe di compensazione credito/debito visibili solo quando rilevanti
- Selezione data persistente tra le sezioni
- Layout ottimizzato per mobile e desktop

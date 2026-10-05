# GASS Pagamenti - Manuale Utente

## Introduzione

GASS Pagamenti è un sistema di gestione finanziaria per gruppi di acquisto solidale (GAS). Il sistema permette di:
- Registrare le consegne e i movimenti di cassa
- Tenere traccia dei saldi dei partecipanti (crediti e debiti)
- Consultare lo storico delle transazioni
- Gestire i pagamenti al produttore

## Primi Passi

### Primo Accesso

Il video del primo accesso, turni compresi, è su https://gass.x86.it/comefunziona (non serve il login). Sotto ogni video c'è l'elenco dei capitoli: tocca un capitolo per saltare a quel punto; il link (es. https://gass.x86.it/comefunziona#t=1:33) si può mandare a chi serve. Per gli amministratori, le funzioni in più (da computer) sono in un video su https://gass.x86.it/admin-video.

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
- Navigazione tramite barra inferiore con quattro schede:
  - **Consegna**: Registra nuove consegne
  - **Saldi**: Visualizza i saldi dei partecipanti
  - **Storico**: Consulta le consegne passate
  - **Turni**: Chi fa la consegna nelle prossime settimane

#### Versione Desktop
- Navigazione tramite menu superiore: **Consegna**, **Saldi**, **Storico**, **Turni** e, solo per gli amministratori, **Attività**; a destra il nome utente, **Cambia password** (solo account locali) ed **Esci**
- Layout ottimizzato per schermi più grandi

#### Intestazione stagionale e importi
- Ogni pagina ha un'intestazione scura i cui colori seguono la stagione della data mostrata (autunno set–nov, inverno dic–feb, primavera mar–mag, estate giu–ago), con il disegno di un frutto o di una verdura di stagione che cambia ogni settimana. La riga sopra la data dice "Consegna di oggi" / "Saldi di oggi" per oggi, "Consegna di <giorno>" per una consegna di un altro giorno; l'anno compare solo se non è quello corrente.
- Gli importi sono nel formato italiano ("11,50 €", senza decimali se interi: "8 €"). Nei campi si può scrivere la virgola o il punto; il campo mostra la virgola.
- Colori dei saldi (non cambiano con la stagione): **blu** con "+" e la parola "credito", **rosso vino** con "−" e la parola "debito", **grigio** "0 € in pari". Nella tabella Saldi del desktop solo l'importo con il segno, o "–".

## Funzionalità

### 1. Consegna - Registrazione Transazioni

La pagina Consegna permette di registrare i movimenti di una giornata. Dal menu si apre da sola sul giorno giusto: l'ultimo giorno di turno fino a oggi (le settimane segnate "niente consegna" non contano), se quel giorno non ha ancora una consegna o ce l'ha ancora aperta, così il giorno dopo il turno la trovi lì per inserire i movimenti o chiuderla. Se l'ultima consegna è già chiusa si apre su oggi, con **Nuova consegna** (per esempio per una consegna straordinaria). Le consegne passate si aprono da **Storico**.

In cima alla pagina, un riquadro elenca in una frase le altre consegne ancora aperte ("Sono ancora aperte le consegne di …"); ogni data è un link che apre quella consegna.

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

**− Uscite di cassa** (compare solo se ci sono)
- Soldi presi dalla cassa per altro, per esempio le quote teatro portate al teatro
- Si scrivono sotto le note: importo e motivo (il motivo è obbligatorio), poi **Salva**. Il **+** accanto all'ultima riga aggiunge un'altra uscita (es. 45 teatro e 20 tofu); per toglierne una basta svuotarla

**= In cassa** (desktop: "Lasciato in cassa")
- Denaro rimasto in cassa alla fine della giornata
- Calcolato come: `Trovato + Incassato - Pagato - Uscite`
- Se il valore è negativo viene evidenziato con l'avviso "Cassa negativa"

**Note della giornata**
- Campo opzionale per annotazioni sulla consegna
- Note e uscite di cassa si salvano indipendentemente dai movimenti con il pulsante **Salva**, che appare quando cambiano

**Mobile**: la cassa è la riga in cima alla pagina; sotto ci sono lo stato ("Consegna aperta" / "Consegna chiusa") con i link **Chiudi consegna** / **Riapri consegna** (e **Annulla consegna** per gli amministratori) e le Note della giornata.

**Desktop**: la colonna a sinistra contiene la cassa e le note; lo stato e i pulsanti Chiudi / Riapri / Annulla consegna sono nell'intestazione.

#### Registrare un Movimento

Se per il giorno non esiste ancora una consegna, premere **Nuova consegna**.

I movimenti sono elencati sotto **Chi ha ritirato** (mobile) o **Movimenti** (desktop): ogni riga mostra partecipante, conto, pagato e l'esito ("+1 € credito" / "−1 € debito"); su mobile, quando ci sono, anche "salda debito", "usa credito" e "quota teatro". Chi ha pagato solo la quota teatro senza ritirare ha una riga a parte ("solo teatro" su mobile). Toccare (mobile) o cliccare (desktop) una riga per modificarla. Su desktop la tabella ha le colonne Partecipante, Conto produttore, Importo saldato, Lascia credito, Lascia debito, Usa credito, Salda debito, Quota teatro, Note, più la riga **Totale**; gli zeri sono mostrati come "–".

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

- **Chiudi consegna**: Blocca tutte le modifiche per la giornata. Qualsiasi utente può chiudere una consegna. Prima di chiudere viene mostrato un riepilogo (movimenti, incassato, pagato, lasciato in cassa) da confermare. Nella stessa conferma si sceglie se mandare il report del turno su Telegram e per email (le caselle sono già spuntate; compaiono solo i canali attivi). Se un amministratore riapre e richiude la consegna dopo averla modificata, arriva un nuovo report segnato "(corretto)".
- **Riapri consegna** (solo amministratori): Sblocca la consegna per permettere modifiche successive. Per una consegna passata: aprirla da **Storico** e usare **Riapri consegna** nell'intestazione.

Anche a consegna chiusa l'elenco mostra la quota teatro di ciascuno e il totale "Quote teatro … a parte" della cassa. Quando una consegna è chiusa, lo stato diventa "Consegna chiusa" e non è più possibile modificarla: su mobile l'elenco resta visibile in sola lettura, senza il controllo per aggiungere partecipanti.

#### Salvataggio

- **Pulsante "Salva movimento"**: Salva il movimento del partecipante corrente
- **Pulsante "Annulla"**: Chiude il modulo senza salvare
- **Pulsante "Salva"** (sotto note e uscite di cassa): Appare quando si modificano, salva note e uscite senza dover salvare movimenti

### 2. Saldi - Panoramica Bilanci

La pagina Saldi mostra una panoramica dei saldi di tutti i partecipanti, sempre a oggi. Lo storico di una persona è in **Transazioni**.

#### Visualizzazione Saldi Attuali

- **Mobile**: in cima due totali ("Crediti, N persone +X €" e "Debiti, N persone −X €"), poi la lista **Partecipanti**
- **Desktop**: tabella con Partecipante, Username (solo amministratori), Saldo (importo con segno, o "–"), Quota teatro (✗ = uno o più semestri da pagare, ✓ = tutto pagato, – = nessuna quota questo semestre, ad esempio chi è "no turni"; l'importo al passaggio del mouse), Ultimo movimento e le azioni come link di testo
- Colori: **blu** = credito (+), **rosso vino** = debito (−), **grigio** = "0 € in pari"

#### Transazioni

Ogni partecipante può visualizzare il proprio storico movimenti:

- **Mobile**: Toccare il nome del partecipante per vedere i dettagli e le transazioni
- **Desktop**: Cliccare il link "Transazioni" per aprire la tabella completa

Per ogni transazione vengono mostrati: data, conto produttore, importo saldato, credito/debito lasciato, uso credito, debito saldato e il saldo risultante (colonna "Saldo dopo").

Le modifiche manuali del saldo fatte da un amministratore compaiono come **Rettifica manuale** con la data e l'importo della correzione. Restano valide anche se in seguito viene eliminata una consegna.

Tutti gli utenti autenticati possono visualizzare le transazioni di qualsiasi partecipante.

### 3. Storico - Consultazione Cronologica

La pagina Storico permette di consultare tutte le consegne registrate.

#### Visualizzazione

Lo Storico è un indice: una riga per consegna, in ordine cronologico inverso (più recenti in alto). Non mostra i movimenti: toccando (mobile) o cliccando (desktop) una riga si apre quella consegna nella pagina Consegna, in sola lettura se è chiusa. Il pulsante indietro del browser o del telefono riporta allo Storico.

- **Mobile**: consegne raggruppate per mese ("Ottobre 2026"); ogni riga mostra il giorno, l'etichetta aperta/chiusa, le persone, la quota teatro (se c'è) e "in cassa X €". In cima: "Tocca una consegna per vederne il dettaglio" (per gli amministratori "… o riaprirla").
- **Desktop**: una tabella con Consegna, Stato, Persone, Trovato, Incassato, Pagato, In cassa, Quota teatro. In cima: "Clic su una consegna per vederne il dettaglio" (per gli amministratori "… o riaprirla").
- Una cassa negativa è in rosso, come nella pagina Consegna
- Per riaprire una consegna chiusa (amministratori): aprirla e usare **Riapri consegna**

#### Indicatore Note

Quando un movimento ha una nota associata, viene visualizzato un indicatore accanto al nome del partecipante.

#### Dettagli Movimento

Aprendo una consegna, per ogni movimento vengono mostrati:
- **Conto**: Conto produttore (importo della spesa)
- **Pagato**: Importo saldato dal partecipante
- **Salda debito**: Eventuale debito saldato
- **Usa credito**: Eventuale credito utilizzato
- **Quota teatro**: quota teatro pagata in quella consegna; chi ha pagato solo la quota compare con una riga a parte
- **Nuovo saldo**: Saldo finale dopo il movimento

#### Eliminazione Consegna

Solo un amministratore può eliminare una consegna già salvata, con **Annulla consegna** nella pagina Consegna.

**ATTENZIONE**:
- L'eliminazione è permanente
- Il sistema ricalcola automaticamente tutti i saldi successivi
- Verificare attentamente prima di eliminare

### 4. Gestione Partecipanti

Solo amministratori, da desktop: Saldi → **Modifica utente**.

- **Elimina utente**: solo per chi non ha mai avuto movimenti né rettifiche di saldo
- **Stato** (tre schede): **Attivo** accede, ordina e fa i turni; **No turni** partecipa al GASS (accede, ordina, compare in "Aggiungi partecipante") ma non fa i turni e non deve la quota teatro dei semestri nuovi; in Saldi, su mobile e desktop, ha l'etichetta **no turni** accanto al nome; **Disattivato** è per chi lascia il gruppo: non accede, non compare più in Saldi né in "Aggiungi partecipante". I movimenti passati restano nello Storico e nelle consegne. Se ha ancora un credito o un debito, la conferma lo mostra; i totali di Saldi continuano a contarlo
- Passando a No turni o disattivando, i turni futuri dell'utente restano **da coprire**
- Tornando ad **Attivo** l'attesa per il turno riparte da quel giorno
- Per rivedere i disattivati spuntare **Mostra disattivati** in Saldi (compaiono in grigio)

### 5. Turni

Le consegne sono di martedì. **Turni** elenca i prossimi 6 mesi con i due turnisti di ciascuna consegna; la tua riga è segnata **TU**. Etichette: **riunione** (riunione GASS), un giorno diverso dal martedì se la consegna è stata spostata, **niente consegna**, **da coprire** (turnista mancante). **Mostra turni passati** (su desktop e mobile) aggiunge gli ultimi 3 mesi, in grigio e in sola lettura. Da desktop tutti modificano tutti i turni (sotto); da mobile si cambiano solo i propri.

#### Chi decide le coppie

Con la **generazione automatica** attiva, le settimane nuove si riempiono da sole: tocca a chi aspetta da più tempo dall'ultimo turno e il compagno è, tra i 3 successivi in attesa, quello con cui ha fatto meno turni (a sorte in caso di parità). Se una consegna salta, la coppia è la prima in coda per la volta successiva. Con la generazione automatica **in pausa**, le settimane nuove arrivano vuote (**da coprire**) e i nomi li sceglie un amministratore. In entrambi i casi le settimane già visibili non cambiano da sole.

#### I tuoi turni (mobile)

Tocca **cambia** sulla tua riga. Poi:

- **scambia con…**: mettiti prima d'accordo con qualcuno, poi sceglilo: prende il tuo turno e tu prendi il suo primo turno da oggi. L'elenco mostra solo chi ha un turno da oggi in poi e non è già in quella consegna
- **sposta al…**: passi a un'altra data che ha un posto libero; il tuo posto resta da coprire
- **Non posso**: lasci il turno, il posto resta da coprire

Ogni azione chiede conferma e resta nel registro Attività.

#### Modifiche (tutti, desktop)

- **Nomi**: ogni nome è un menu; scegli la persona o **da coprire**. Riempire un posto libero è immediato, sostituire o togliere un nome chiede conferma. Per uno scambio cambia i nomi in tutte e due le date
- **Giorno**: sposta la consegna in un altro giorno della settimana, segna **niente consegna**, **riunione GASS** o aggiunge una nota. Con niente consegna la coppia torna libera ed è la prima in coda

Ogni modifica resta nel registro Attività. Le consegne passate non si modificano.

#### Solo amministratori (desktop)

- **Generazione automatica dei turni**: la casella sopra la tabella la mette in pausa o la riattiva (chiede conferma). In pausa, "niente consegna" toglie solo i due nomi da quella data, senza toccare la coda
- **Note**: il riquadro sopra la tabella, per appunti liberi (affiancamenti, chi non può…). Lo scrivono gli amministratori da desktop, lo leggono tutti su desktop e mobile
- **Pause**: un periodo senza consegne (ad esempio le feste). Le settimane già scritte nel periodo diventano niente consegna; eliminando la pausa le settimane mancanti si rigenerano, quelle già segnate niente consegna restano tali e si ripristinano da **Giorno**

### 6. Quota teatro

Ogni gassista paga una quota a semestre (gennaio–giugno, luglio–dicembre) per l'affitto del teatro. I soldi vanno in una **cassa teatro** separata: non entrano nella cassa della consegna.

#### Pagare alla consegna (tutti)

Nella scheda del partecipante, se ha quote da pagare, c'è il tasto **Quota teatro** con il totale dovuto. Toccandolo si vedono i semestri dovuti, dal più vecchio. Scrivi l'**importo versato**: copre i semestri in ordine; se non basta l'ultimo resta parziale, se avanza va in anticipo sui semestri successivi. **Registra quota** chiede conferma. La quota si registra sempre dentro una consegna aperta: se la consegna è appena iniziata e non ancora salvata, viene salvata in quel momento. Il pagamento è indipendente dal movimento: si può pagare la quota senza fare la spesa; se il riquadro è aperto e non hai registrato niente, **Salva movimento** chiede conferma. Con la cassa compare **Quote teatro di questa consegna, a parte dalla cassa**: il totale delle quote registrate in questa consegna, che non entrano nella sua cassa. Annullando la consegna si annullano anche le sue quote.

In **Saldi** ogni partecipante ha la sua situazione: su mobile, sotto il nome, **deve** (con l'importo) o **anticipo**; su desktop, nella colonna **Quota teatro**, ✗ se deve ancora qualche semestre, ✓ se ha pagato tutto e – se questo semestre non ha quota (l'importo al passaggio del mouse). In alto il totale delle quote mancanti.

#### Pagina Teatro (amministratori, desktop)

- In alto: quanto c'è **nel bussolotto** (cassa teatro), le quote del semestre in corso, le quote mancanti
- La **griglia** gassisti × semestri (gli ultimi due; **Mostra semestri precedenti** per vedere quelli più vecchi): righe in ordine alfabetico, i disattivati in fondo; in ogni casella **✓** verde = pagato, **✗** rosso = manca qualcosa (versato/dovuto al passaggio del mouse), grigio **–** = non dovuto o non era nel GASS. Clic su una casella per cambiare quanto deve: una quota ridotta (ad esempio chi entra a metà semestre), **Non dovuto** o **Non era nel GASS**
- Clic sull'intestazione di un semestre per cambiarne la **quota**: vale per chi ha la quota piena, le ridotte restano. Un semestre nuovo parte dalla quota dell'ultimo e la devono tutti gli attivi; i "no turni" no. Nel semestre in corso la quota segue lo stato: chi torna **Attivo** la deve, chi passa a No turni o Disattivato non la deve più, se non ha già pagato e non ha una quota impostata a mano. I semestri passati non cambiano
- **Note** per persona, come nel vecchio foglio
- **Registro cassa teatro**: le quote pagate (con la × per eliminare un pagamento sbagliato) e le voci aggiunte a mano, ad esempio l'affitto versato (uscita) con chi l'ha portato

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
3. Aprire la consegna da Storico per vedere i movimenti di quel giorno

Se il problema persiste, contattare l'amministratore.

### Non Vedo le Righe di Compensazione

Le righe "Usa parte del credito" e "Salda parte del debito" sono visibili solo quando applicabili:
- Appaiono solo dopo aver inserito un importo saldato
- Vengono calcolate automaticamente dal sistema
- Non possono essere modificate manualmente per garantire l'integrità dei dati
- Se il partecipante non ha credito/debito preesistente, non compaiono

## Supporto

Per assistenza o segnalazioni di problemi, contattare l'amministratore del sistema.

## Note Sulla Versione

Sistema GASS Pagamenti - Versione 2.27.5
- Telefono: l'importo delle quote teatro della consegna resta su una riga

Versione 2.27.4
- Attività mostra i cambi di stato con i nomi dell'app ("no turni" invece di "sospeso")

Versione 2.27.3
- Capitoli sotto i video: tocca un capitolo per saltare a quella parte; i link ai capitoli si possono condividere

Versione 2.27.2
- Video aggiornati alla versione attuale: il video del primo accesso mostra anche quota teatro, uscite di cassa e come scambiare un turno; la pagina /v2.17 non c'è più
- La spiegazione ⓘ delle uscite di cassa compare una volta sola

Versione 2.27.1
- Il report del turno su Telegram arriva nell'argomento **App** del gruppo Gass

Versione 2.27.0
- Spiegazioni ⓘ accanto ad alcune voci (uscite di cassa, quote teatro, modifica saldo, stato utente, griglia del teatro): toccala o cliccala per leggerla, tocca altrove per chiuderla

Versione 2.26.0
- Uscite di cassa: importo e motivo dei soldi presi dalla cassa (es. quote portate al teatro), anche più di una con **+**, tolte da In cassa

Versione 2.25.0
- Chiudi consegna può mandare il report del turno su Telegram e per email

Versione 2.24.3
- Consegna: all'apertura la cassa mostra – finché i dati non sono caricati, e non compare più per un attimo **Chiudi consegna**

Versione 2.24.2
- Quota teatro: nel semestre in corso segue lo stato dell'utente (chi diventa attivo la deve, chi smette di esserlo no, se non ha pagato)

Versione 2.24.1
- Teatro: nella griglia ✗ = da pagare, – = non dovuto; in Saldi (desktop) – per chi non ha quota questo semestre
- Storico: tolti i link **Dettaglio** e **Riapri consegna** dalle righe; si apre la consegna toccandola, e lì c'è **Riapri consegna**

Versione 2.24.0
- **Turni**: da desktop tutti modificano tutti i turni (nomi e **Giorno**); pause, generazione automatica e note restano agli amministratori
- Turni: prossimi 6 mesi; **Mostra turni passati** (ultimi 3 mesi) per tutti, anche su mobile
- Lo stato **Sospeso** si chiama **No turni**: in Saldi e Teatro non è più in grigio, solo un'etichetta accanto al nome

Versione 2.23.1
- Storico: **Dettaglio** su ogni riga (si apre anche da tastiera o in una nuova scheda); tolto **Completa consegna**, che apriva la stessa pagina; cassa negativa in rosso
- Il riquadro delle consegne aperte è una frase sola

Versione 2.23.0
- **Storico** è un indice con una riga per consegna: toccandola si apre nella pagina Consegna
- **Consegna** si apre da sola sul giorno giusto, senza calendario; un riquadro avvisa delle altre consegne ancora aperte
- Quota teatro per persona nell'elenco della consegna, anche a consegna chiusa
- **Saldi** è sempre a oggi: lo storico di una persona è in **Transazioni**

Versione 2.19.0
- **Quota teatro**: pagamento alla consegna, situazione in Saldi, pagina **Teatro** per gli amministratori con griglia dei semestri e registro della cassa teatro
- Turni: gli amministratori possono mostrare i turni passati

Versione 2.18.0
- **Turni** mostra le prossime 24 settimane
- Sul proprio turno: **scambia con…**, **sposta al…** (una data con un posto libero), **Non posso** (il posto resta da coprire)
- Gli amministratori scelgono i nomi dai menu della tabella e possono mettere in pausa la generazione automatica dei turni
- Riquadro **Note** sopra i turni, scritto dagli amministratori e visibile a tutti

Versione 2.17.0
- Nuova scheda **Turni** con le coppie delle prossime 12 settimane; gli amministratori le modificano da desktop
- Stato utente a tre valori: attivo, sospeso, disattivato (Saldi → Modifica utente)

Versione 2.16.2
- Saldi su mobile: toccando un nome si vedono le transazioni; il modulo per cambiare il saldo si apre solo con il pulsante **Modifica saldo** (amministratori)

Versione 2.16.1
- Saldi, data passata: l'avviso "Modifica saldo compare solo alla data di oggi" è in cima alla pagina, anche su mobile (per gli amministratori)

Versione 2.16.0
- Gli amministratori possono disattivare un utente (Saldi → Modifica utente → Disattiva) invece di eliminarlo

Versione 2.15.1
- Storico: **Completa consegna** sulle consegne ancora aperte e, per gli amministratori, **Riapri consegna** su quelle chiuse
- Storico su mobile: la cassa è una voce per riga
- Testi più piccoli ingranditi ancora

Versione 2.12.0
- Testi più grandi; il disegno dell'intestazione cambia ogni settimana tra frutta e verdura di stagione
- Il link **Riapri consegna** a volte non compariva agli amministratori su mobile: corretto
- Le cifre della cassa (Trovato, Incassato, Pagato, In cassa) non sono più campi toccabili

Versione 2.11.0
- Nuova grafica "Stagioni": l'intestazione cambia colore con la stagione della data scelta, importi nel formato 11,50 €, crediti in blu e debiti in rosso vino sempre con segno e parola
- Visualizzazione transazioni aperta a tutti gli utenti autenticati (non solo amministratori)
- Storico transazioni per partecipante nella pagina Saldi (mobile e desktop)
- Cambio password autonomo per tutti gli utenti (link Cambia password)
- Chiusura/riapertura consegne con blocco modifiche
- Gestione utenti completa per amministratori (Saldi → Modifica Utente)
- Righe di compensazione credito/debito visibili solo quando rilevanti
- Selezione data persistente tra le sezioni
- Layout ottimizzato per mobile e desktop

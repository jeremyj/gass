# GASS - Manuale degli amministratori

Questo manuale contiene solo le funzioni degli amministratori. Le funzioni di tutti i gassisti e i termini sono nel [Manuale dei gassisti](MANUALE_PARTECIPANTI.md).

Video brevi, uno per argomento: [funzioni degli amministratori](https://gass.x86.it/admin-video). Ogni sezione ha il link al suo video.

Quasi tutte le funzioni degli amministratori sono solo sul computer. Sul telefono, un amministratore può riaprire ed eliminare una consegna.

## Diventare amministratore

Non puoi dare o togliere il ruolo di amministratore da GASS. Per chi entra con Authentik, il ruolo viene dal gruppo `gass-admin` di Authentik. GASS legge il gruppo a ogni accesso.

## Consegne

### Riaprire una consegna chiusa

Video: [Riaprire una consegna, 0:13](https://gass.x86.it/admin-video#riaprire).

1. Apri la consegna (dalla pagina Consegna o da **Storico**).
2. Premi **Riapri consegna**.
3. Fai le correzioni.
4. Premi **Chiudi consegna**.

Se il resoconto è diverso, GASS manda un resoconto con l'indicazione "(corretto)". Il resoconto corretto contiene solo le **Rettifiche rispetto al report del …** e la riga **In cassa ora**. Ogni rettifica è un valore cambiato, con il valore di prima e quello di ora (per esempio "Marco B: conto produttore 0 → 23,50"). Se non è cambiato nessun importo, GASS non manda niente: la finestra di chiusura non mostra la casella del resoconto e scrive "il report non parte". Per le consegne chiuse prima della versione 2.30.0, GASS manda di nuovo tutto il resoconto.

Se la correzione cambia la cassa, GASS aggiorna anche le consegne dopo: il **Trovato** di ogni consegna è l'**In cassa** della consegna di prima. Non devi riaprire le consegne dopo.

### Togliere la foto di uno scontrino

Video: [Togliere uno scontrino, 0:15](https://gass.x86.it/admin-video#scontrini).

Un amministratore può togliere qualsiasi foto, anche se non l'ha scattata. La consegna deve essere aperta: se è chiusa, riaprila prima.

1. Apri la scheda del gassista nella consegna.
2. Premi **×** sulla foto e conferma.

Se la prima foto del giorno arriva prima di ogni **Salva**, GASS crea la consegna. Se è una consegna sbagliata, eliminala come sotto.

Le foto del **Quaderno** sono diverse: un amministratore può aggiungerle e toglierle anche dopo la chiusura, senza riaprire la consegna.

### Eliminare una consegna

**AVVERTENZA:** L'eliminazione cancella la consegna, le sue spese, le sue uscite di cassa, le sue quote teatro, le foto dei suoi scontrini e del quaderno. Non puoi recuperare questi dati.

1. Apri la consegna.
2. Premi **Elimina consegna**.
3. Controlla il riepilogo.
4. Conferma.

GASS calcola di nuovo il saldo dei gassisti di quella consegna. Le spese cancellate restano nel registro **Attività**.

## Saldi

### Modificare un saldo

Video: [Correggere un saldo, 0:16](https://gass.x86.it/admin-video#saldo).

Usa questa funzione solo per correggere un errore che non è in una consegna.

1. Apri **Saldi**.
2. Sul computer, premi il pulsante **Modifica utente** sulla riga del gassista. Sul telefono non puoi modificare il saldo.
3. Scrivi il saldo corretto in **Saldo**. Per un debito, scrivi − prima dell'importo. Per un saldo in pari, scrivi 0.
4. Premi **Salva**.

GASS registra la differenza come **Rettifica manuale** con la data di oggi. La rettifica resta valida anche se una consegna viene eliminata.

## Gassisti

### Aggiungere un gassista

1. Apri **Saldi** sul computer.
2. Premi **+ Aggiungi gassista**.
3. Scrivi il **Nome completo**, lo **Username** e la **Password**.
4. Premi **Aggiungi gassista**.

Per l'accesso con Authentik, lo username in Authentik deve essere uguale allo username in GASS. Usa le stesse lettere, le stesse maiuscole, e nessun suffisso (per esempio `@gass.local`). Se lo username è diverso, l'accesso con Authentik non funziona.

### Modificare un gassista

1. Apri **Saldi** sul computer.
2. Premi **Modifica utente** sulla riga del gassista.
3. Cambia il nome, la password, il **Saldo** o lo **Stato**.
4. Premi **Salva**.

Non puoi cambiare lo username.

**Nuova password** cambia la password di GASS. Non cambia la password di Authentik.

### Stato del gassista

Video: [Stato degli utenti, 0:28](https://gass.x86.it/admin-video#stato).

| Stato | Accede | Fa i turni | Deve la quota teatro | Visibile in Saldi |
|---|---|---|---|---|
| Attivo | Sì | Sì | Sì | Sì |
| No turni | Sì | No | No (semestri nuovi) | Sì, con l'etichetta "no turni" |
| Disattivato | No | No | No | Solo con **Mostra disattivati** |

- Quando un gassista non è più attivo, i suoi turni futuri diventano **da coprire**.
- Quando un gassista torna attivo, l'attesa per il suo prossimo turno comincia da quel giorno.
- Nel semestre in corso, la quota teatro segue lo stato. Una quota già pagata o cambiata a mano non cambia.

Usa **Disattivato** per un gassista che lascia il GASS. Le sue consegne passate restano.

### Eliminare un gassista

Puoi eliminare solo un gassista senza spese, senza rettifiche e senza quote teatro pagate. Per gli altri, usa lo stato **Disattivato**.

1. Premi **Modifica utente**.
2. Premi **Elimina utente**.
3. Conferma.

## Turni

Video: [Turni: cambiare i nomi, 0:18](https://gass.x86.it/admin-video#turni), [Spostare una consegna (Modifica giorno), 0:15](https://gass.x86.it/admin-video#giorno), [Note sui turni, 0:09](https://gass.x86.it/admin-video#note), [Pause, 0:26](https://gass.x86.it/admin-video#pause).

Sul computer, nella pagina **Turni**:

| Funzione | Procedura |
|---|---|
| Nomi | Le settimane nuove sono **da coprire**. Un amministratore sceglie i nomi dai menu. |
| Note | Scrivi nel riquadro **Note**. Premi **Salva note**. Tutti i gassisti leggono le note. |
| Pausa | In **Pause**, scrivi le date **Dal** e **Al** e una nota. Premi **Aggiungi pausa**. Le settimane della pausa diventano **niente consegna**. |
| Consegna saltata | Una consegna passata non è stata fatta? Spunta **Mostra turni passati**. Premi **Modifica giorno** su quella data e segna **niente consegna**, oppure aggiungi una pausa. GASS rifiuta se in quella data c'è una consegna registrata. Per annullare, premi **Modifica giorno** e togli **niente consegna**: i turnisti restano **da coprire**. Solo un amministratore modifica le consegne passate, anche dal telefono, e non i loro nomi. |

Quando elimini una pausa, GASS crea di nuovo le settimane mancanti. Le settimane segnate **niente consegna** a mano restano così. Per ripristinarle, premi **Modifica giorno**.

## Teatro

Video: [Quota teatro, 0:24](https://gass.x86.it/admin-video#teatro).

La pagina **Teatro** (sottotitolo "Quote e cassa teatro") mostra la **Nella cassa teatro** e la griglia gassisti × semestri. I riquadri **Versato per il …** e **Ancora da versare (tutti i semestri)** mostrano i totali in euro.

| Simbolo | Significato |
|---|---|
| ✓ | Pagato. |
| ✗ | Manca una parte. |
| – | Non dovuto, o il gassista non era nel GASS. |

La griglia mostra gli ultimi due semestri. Per vedere i semestri più vecchi, usa **Mostra semestri precedenti**.

### Cambiare quanto deve un gassista

1. Premi la casella del gassista e del semestre.
2. Scrivi l'importo in **Quanto deve (€)**, o scegli **Non dovuto** o **Non era nel GASS**.
3. Premi **Salva**.

Usa un importo ridotto, per esempio, per un gassista che entra a metà semestre.

### Cambiare la quota di un semestre

1. Premi l'intestazione del semestre.
2. Scrivi la quota nuova in **Quota (€)**.
3. Premi **Salva**.

La quota nuova vale per i gassisti con la quota piena. Le quote ridotte non cambiano. Un semestre nuovo comincia con la quota del semestre precedente.

### Registro cassa teatro

Video: [Registro cassa teatro, 0:17](https://gass.x86.it/admin-video#cassa-teatro).

Il registro mostra le quote pagate e le voci scritte a mano.

1. Scegli il **Tipo**: **Uscita (es. affitto versato)** o **Entrata**.
2. Scrivi la **Data**, l'**Importo** e la **Descrizione**.
3. Premi **Aggiungi voce**.

Per cancellare un pagamento sbagliato, premi **×** sulla riga del pagamento.

## Altobelli

Video: [Foglio Altobelli, 0:52](https://gass.x86.it/admin-video#altobelli).

La pagina **Altobelli** compara il foglio di Altobelli con i conti produttore in GASS. La pagina è **sperimentale**: controlla sempre il risultato sul foglio.

### Impostare il foglio

Altobelli apre un foglio nuovo ogni anno.

1. Copia il link del foglio. Il foglio deve essere condiviso con chi ha il link.
2. Incolla il link in **Link del foglio**.
3. Premi **Salva link**.

### Controllare una consegna

1. Scegli la **Consegna**. GASS sceglie la scheda del foglio con la stessa data.
2. Se Leonardo ha scritto gli ordini in un'altra scheda, scegli la scheda giusta in **Scheda del foglio**. Il menu mostra tutte le schede, anche quelle nascoste. GASS ricorda la scelta per quella consegna.
3. Premi **Aggiorna**.
4. Compara **Somma effettivi (riga per riga)** con **Somma conti in GASS**.
5. Per vedere solo le righe diverse, usa **Mostra solo le differenze**.

GASS somma gli effettivi riga per riga. Il **Totale scritto nel foglio** può essere sbagliato, perché la formula del foglio a volte non contiene tutte le righe.

### Associare un nome del foglio a un gassista

Quando un nome del foglio è uguale al nome di un gassista in GASS, GASS associa il nome automaticamente. GASS non considera maiuscole, spazi e "&" (uguale a "e"). Quando GASS non trova il gassista di un nome del foglio:

1. Nel menu **a chi corrisponde?**, scegli il gassista.
2. Premi **Associa**.

GASS usa l'associazione anche nelle consegne successive.

## Attività

Video: [Attività, 0:08](https://gass.x86.it/admin-video#attivita).

La pagina **Attività** mostra il registro delle operazioni: consegne create, chiuse, riaperte ed eliminate, spese, cambi di saldo, gassisti, turni e quote teatro. La colonna **Fatto da** dice chi ha fatto la modifica. Usa il registro per trovare chi ha fatto una modifica e quando.

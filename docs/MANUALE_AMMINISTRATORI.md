# GASS - Manuale degli amministratori

Lingua: italiano semplificato, regole ASD-STE100 (frasi brevi, un'azione per passo, gli stessi termini sempre). Questo manuale contiene solo le funzioni degli amministratori. Le funzioni di tutti i partecipanti e i termini sono in [MANUALE_PARTECIPANTI.md](MANUALE_PARTECIPANTI.md).

Video delle funzioni degli amministratori: https://gass.x86.it/admin-video.

Quasi tutte le funzioni degli amministratori sono solo sul computer. Sul telefono, un amministratore può riaprire e annullare una consegna e modificare un saldo.

## Diventare amministratore

Non puoi dare o togliere il ruolo di amministratore da GASS. Per chi entra con Authentik, il ruolo viene dal gruppo `gass-admin` di Authentik. GASS legge il gruppo a ogni accesso.

## Consegne

### Riaprire una consegna chiusa

1. Apri la consegna (dalla pagina Consegna o da **Storico**).
2. Premi **Riapri consegna**.
3. Fai le correzioni.
4. Premi **Chiudi consegna**.

Se il resoconto è diverso, GASS lo manda di nuovo con l'indicazione "(corretto)".

### Annullare una consegna

**AVVERTENZA:** L'annullamento cancella la consegna, le sue spese, le sue uscite di cassa e le sue quote teatro. Non puoi recuperare questi dati.

1. Apri la consegna.
2. Premi **Annulla consegna**.
3. Controlla il riepilogo.
4. Conferma.

GASS calcola di nuovo il saldo dei partecipanti di quella consegna. Le spese cancellate restano nel registro **Attività**.

## Saldi

### Modificare un saldo

Usa questa funzione solo per correggere un errore che non è in una consegna.

1. Apri **Saldi**.
2. Premi **Modifica saldo** sulla riga del partecipante.
3. Scrivi il saldo corretto. Per un debito, scrivi − prima dell'importo.
4. Premi **Salva**.

GASS registra la differenza come **Rettifica manuale** con la data di oggi. La rettifica resta valida anche se una consegna viene annullata.

## Partecipanti

### Aggiungere un partecipante

1. Apri **Saldi** sul computer.
2. Premi **+ Aggiungi partecipante**.
3. Scrivi il **Nome completo**, lo **Username** e la **Password**.
4. Premi **Aggiungi partecipante**.

Per l'accesso con Authentik, lo username in Authentik deve essere uguale allo username in GASS. Usa le stesse lettere, le stesse maiuscole, e nessun suffisso (per esempio `@gass.local`). Se lo username è diverso, l'accesso con Authentik non funziona.

### Modificare un partecipante

1. Apri **Saldi** sul computer.
2. Premi **Modifica utente** sulla riga del partecipante.
3. Cambia il nome, la password o lo **Stato**.
4. Premi **Salva**.

Non puoi cambiare lo username.

**Nuova password** cambia la password di GASS. Non cambia la password di Authentik.

### Stato del partecipante

| Stato | Accede | Fa i turni | Deve la quota teatro | Visibile in Saldi |
|---|---|---|---|---|
| Attivo | Sì | Sì | Sì | Sì |
| No turni | Sì | No | No (semestri nuovi) | Sì, con l'etichetta "no turni" |
| Disattivato | No | No | No | Solo con **Mostra disattivati** |

- Quando un partecipante non è più attivo, i suoi turni futuri diventano **da coprire**.
- Quando un partecipante torna attivo, l'attesa per il suo prossimo turno comincia da quel giorno.
- Nel semestre in corso, la quota teatro segue lo stato. Una quota già pagata o cambiata a mano non cambia.

Usa **Disattivato** per un partecipante che lascia il GASS. Le sue consegne passate restano.

### Eliminare un partecipante

Puoi eliminare solo un partecipante senza spese, senza rettifiche e senza quote teatro pagate. Per gli altri, usa lo stato **Disattivato**.

1. Premi **Modifica utente**.
2. Premi **Elimina utente**.
3. Conferma.

## Turni

Sul computer, nella pagina **Turni**:

| Funzione | Procedura |
|---|---|
| Generazione automatica | Usa la casella **Generazione automatica dei turni**. Quando è spenta, le settimane nuove sono **da coprire** e un amministratore sceglie i nomi. |
| Note | Scrivi nel riquadro **Note**. Premi **Salva note**. Tutti i partecipanti leggono le note. |
| Pausa | In **Pause**, scrivi le date **Dal** e **Al** e una nota. Premi **Aggiungi pausa**. Le settimane della pausa diventano **niente consegna**. |

Le settimane già visibili non cambiano quando cambi la generazione automatica.

Quando elimini una pausa, GASS crea di nuovo le settimane mancanti. Le settimane segnate **niente consegna** a mano restano così. Per ripristinarle, usa il menu **Giorno**.

## Teatro

La pagina **Teatro** mostra la cassa del teatro e la griglia partecipanti × semestri.

| Simbolo | Significato |
|---|---|
| ✓ | Pagato. |
| ✗ | Manca una parte. Passa il mouse sulla casella per vedere versato e dovuto. |
| – | Non dovuto, o il partecipante non era nel GASS. |

La griglia mostra gli ultimi due semestri. Per vedere i semestri più vecchi, usa **Mostra semestri precedenti**.

### Cambiare quanto deve un partecipante

1. Premi la casella del partecipante e del semestre.
2. Scrivi l'importo in **Quanto deve (€)**, o scegli **Non dovuto** o **Non era nel GASS**.
3. Premi **Salva**.

Usa un importo ridotto, per esempio, per un partecipante che entra a metà semestre.

### Cambiare la quota di un semestre

1. Premi l'intestazione del semestre.
2. Scrivi la quota nuova.
3. Premi **Salva**.

La quota nuova vale per i partecipanti con la quota piena. Le quote ridotte non cambiano. Un semestre nuovo comincia con la quota del semestre precedente.

### Registro cassa teatro

Il registro mostra le quote pagate e le voci scritte a mano.

1. Scegli il **Tipo**: **Uscita (es. affitto versato)** o **Entrata**.
2. Scrivi la **Data**, l'**Importo** e la **Descrizione**.
3. Premi **Aggiungi voce**.

Per cancellare un pagamento sbagliato, premi **×** sulla riga del pagamento.

## Altobelli

La pagina **Altobelli** compara il foglio di Altobelli con i conti produttore in GASS.

### Impostare il foglio

Altobelli apre un foglio nuovo ogni anno.

1. Copia il link del foglio. Il foglio deve essere condiviso con chi ha il link.
2. Incolla il link in **Link del foglio**.
3. Premi **Salva link**.

### Controllare una consegna

1. Scegli la **Consegna** e la **Scheda** del foglio.
2. Premi **Aggiorna**.
3. Compara **Σ effettivi (riga per riga)** con **Σ conti in GASS**.
4. Per vedere solo le righe diverse, usa **Mostra solo le differenze**.

GASS somma gli effettivi riga per riga. Il **Totale scritto nel foglio** può essere sbagliato, perché la formula del foglio a volte non contiene tutte le righe.

### Associare un nome del foglio a un partecipante

Quando GASS non trova il partecipante di un nome del foglio:

1. Nel menu **a chi corrisponde?**, scegli il partecipante.
2. Premi **Associa**.

GASS usa l'associazione anche nelle consegne successive.

## Attività

La pagina **Attività** mostra il registro delle operazioni: consegne create, chiuse, riaperte e annullate, spese, cambi di saldo, partecipanti, turni e quote teatro. Usa il registro per trovare chi ha fatto una modifica e quando.

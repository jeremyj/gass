# GASS - Manuale dei gassisti

Video brevi, uno per argomento: [primo accesso, consegna, scontrini, saldi e turni](https://gass.x86.it/comefunziona). Ogni sezione ha il link al suo video.

Funzioni degli amministratori: [Manuale degli amministratori](MANUALE_AMMINISTRATORI.md).

## Termini

| Termine | Significato |
|---|---|
| Gassista | Una persona del GASS. Ogni gassista ha un account e un saldo. |
| Consegna | Un giorno di distribuzione della merce. Normalmente è il martedì. |
| Turno | I due gassisti che gestiscono una consegna. |
| Conto produttore | Il costo della merce che il gassista prende. È l'importo effettivo nel foglio Altobelli. |
| Importo saldato | I soldi che il gassista dà alla consegna. |
| Saldo | La situazione del gassista: credito (blu, +) o debito (rosso, −). |
| Cassa | I soldi nella scatola della consegna. |
| Entrate/uscite di cassa | Soldi che escono dalla cassa (**esce**) o entrano nella cassa (**entra**) per un motivo diverso dalla spesa. |
| Quaderno | Il quaderno dove il turno scrive i conti a mano. La sua foto è la controprova della cassa. |
| Quota teatro | La quota per l'affitto del teatro. Si paga ogni semestre (gennaio–giugno, luglio–dicembre). |
| Cassa teatro | I soldi delle quote teatro. È separata dalla cassa della consegna. |

## Accesso

Video: [Primo accesso e nuova password, 0:53](https://gass.x86.it/comefunziona#primo-accesso).

1. Apri https://gass.x86.it.
2. Premi **Accedi**.
3. Scrivi il nome utente e la password.
4. Al primo accesso, scrivi due volte una password nuova (minimo 8 caratteri).
5. Premi **Salva password**.

Per cambiare la password, vai su https://auth.x86.it, nelle impostazioni del tuo utente.

GASS funziona su telefono e su computer. Sul telefono le pagine sono nella barra in basso. Sul computer le pagine sono nel menu in alto.

| Pagina | Funzione |
|---|---|
| Consegna | Registra la spesa e i pagamenti di una consegna. |
| Saldi | Mostra il saldo e i movimenti di ogni gassista. |
| Storico | Mostra tutte le consegne. |
| Turni | Mostra chi fa ogni turno. |

Il simbolo ⓘ accanto ad alcune voci apre una spiegazione. Tocca in un altro punto per chiuderla.

Se la pagina si ricarica prima di **Salva** (per esempio quando torni dalla fotocamera), GASS rimette quello che hai scritto e mostra "Ho ripreso quello che avevi scritto e non era salvato". Controlla i valori e premi **Salva**. GASS non conserva mai le password.

## Consegna

### Aprire la consegna

Video: [Aprire una consegna, 0:24](https://gass.x86.it/comefunziona#consegna).

La pagina Consegna si apre sulla consegna giusta: l'ultimo turno fino a oggi, se è ancora aperto. Se l'ultima consegna è chiusa, la pagina si apre su oggi.

1. Apri **Consegna**.
2. Se la consegna non esiste ancora, premi **Nuova consegna**.

Un riquadro in alto mostra le altre consegne ancora aperte. Premi una data per aprire quella consegna.

Sul telefono, in alto ci sono lo stato della consegna e i pulsanti **Elimina consegna** (solo amministratori) e **Chiudi consegna**. Sotto c'è un riepilogo: conto produttore, quote teatro, entrate e uscite di cassa con il motivo. Premi **Cassa, quaderno e note** per aprire la cassa completa, il quaderno, le entrate/uscite di cassa e le note (la pagina **Cassa e note**). Premi **‹** per tornare alla pagina. Sul computer queste parti sono nella colonna a sinistra. Quando la consegna è chiusa, la cassa completa va in cima alla pagina e il riepilogo mostra solo il pulsante **Cassa, quaderno e note**. Sul telefono puoi ancora premere una riga di *Chi ha ritirato*: la scheda si apre in sola lettura, con il pulsante **Chiudi**. Note, scontrini e quota teatro compaiono solo se ci sono. Sul computer il riquadro **Entrate/uscite di cassa** non compare: le entrate e le uscite restano nella cassa.

### Registrare la spesa di un gassista

Video: [Registrare un pagamento, 0:32](https://gass.x86.it/comefunziona#pagamento).

1. Premi **+ Aggiungi gassista**.
2. Scegli il gassista.
3. Scrivi il **Conto produttore**.
   - Se il foglio Altobelli ha l'importo effettivo, sopra il campo c'è il bottone verde **Foglio Altobelli: X €**. Premi il bottone per scrivere l'importo nel campo. Quando il conto è uguale, GASS mostra **Uguale al foglio Altobelli**.
   - Se il foglio non ha l'importo, il campo vuoto mostra **arrotonda: ,01-,05 → ,00 · ,06-,09 → ,10**: scrivi il totale dello scontrino arrotondato ai 10 centesimi, come Altobelli. Per esempio, 20,82 diventa 20,80, 21,05 diventa 21,00 e 21,08 diventa 21,10.
4. Scrivi l'**Importo saldato**.
5. Controlla la riga **Prima di oggi** (credito, debito o in pari) e l'esito: credito, debito o **In pari**.
6. Premi **Salva movimento**.
7. Ripeti i passi da 1 a 6 per ogni gassista.

GASS calcola il credito e il debito. Non puoi scrivere questi valori.

- Se il gassista ha un debito e paga di più, GASS usa la differenza per il debito.
- Se il gassista ha un credito e paga di meno, GASS usa il credito.

Esempio: Giovanni ha 10 € di credito. Il conto è 18 €. Giovanni paga 5 €. GASS usa i 10 € di credito. Il nuovo saldo è 3 € di debito.

Per correggere una spesa, premi la riga del gassista nell'elenco **Chi ha ritirato**. Cambia i valori. Premi **Salva movimento**.

### Fotografare gli scontrini

Video: [Fotografare uno scontrino, 0:33](https://gass.x86.it/comefunziona#scontrini).

Nella scheda del gassista, sotto le **Note**, c'è il riquadro **Scontrini**.

1. Apri la scheda del gassista.
2. Premi **Fotografa** (telefono) o **Allega scontrino** (computer). Sul telefono si apre un menu: scegli **Foto** per scattare una foto, o **File** per scegliere foto che hai già. Sul computer puoi anche trascinare l'immagine nel riquadro.
3. Aspetta che la scritta "carico…" sparisca.

GASS salva la foto subito, anche se non premi **Salva movimento**. Puoi allegare al massimo 3 foto per gassista in una consegna. Premi una foto per vederla grande.

Per togliere una foto, premi **×** sulla foto e conferma. Solo chi ha scattato la foto o un amministratore può toglierla. Quando la consegna è chiusa, non puoi aggiungere o togliere foto.

Nell'elenco del giorno, il numero accanto all'icona della fotocamera dice quante foto ha il gassista. Premi **Vedi i N scontrini** sotto l'elenco per aprire la galleria della consegna.

### Registrare la quota teatro

Video: [Quota teatro, 0:21](https://gass.x86.it/comefunziona#teatro).

La scheda del gassista mostra il riquadro **Quota teatro** quando il gassista deve una quota.

1. Apri la scheda del gassista.
2. Scrivi la quota in **Importo**.
3. Controlla il riquadro **Ha dato in tutto X €**. Mostra la somma dell'importo saldato e della quota teatro.
4. Metti i soldi della quota nella cassa teatro, non nella cassa della consegna.
5. Premi **Salva movimento**.

GASS paga prima il semestre più vecchio. Se l'importo è maggiore della quota, la differenza è un anticipo.

Il gassista può pagare solo la quota. In questo caso lascia vuoti il conto e l'importo saldato.

Se il gassista non deve quote, premi **+ Quota teatro (anticipo)** per registrare un anticipo.

Per togliere una quota sbagliata, scrivi 0 e premi **Salva movimento**.

### Registrare entrate e uscite di cassa

Video: [Entrate/uscite di cassa, 1:03](https://gass.x86.it/comefunziona#uscite).

Usa **Entrate/uscite di cassa** quando togli soldi dalla cassa o metti soldi nella cassa per un motivo diverso dalla spesa. Sul telefono, premi prima **Cassa, quaderno e note**.

1. In **Entrate/uscite di cassa**, scegli **− esce** (soldi che escono dalla cassa) o **+ entra** (soldi che entrano in cassa). Puoi anche scrivere − o + prima dell'importo.
2. Scrivi l'importo.
3. Scrivi il motivo. Il motivo è obbligatorio.
4. Per un'altra riga, premi **+**.
5. Premi **Salva**.

Se manca l'importo o il motivo, GASS dice quale riga devi completare, per esempio "Scrivi il motivo dei 32,80 € entrati in cassa".

Esempio: il conto Altobelli è 357,20 €. Dai ad Altobelli 357 €. Scegli **+ entra**, scrivi 0,20, motivo "arrotondamento Altobelli".

Esempio: nel foglio Altobelli c'è una riga con un importo negativo, per esempio −29,80 €. È un credito: Altobelli toglie questo importo dal totale. Non scrivere la riga negativa nel conto della persona. Scegli **+ entra**, scrivi 29,80, motivo "credito Altobelli".

Per togliere una riga, cancella l'importo e il motivo. Premi **Salva**.

### Controllare la cassa

GASS calcola la cassa. Non puoi scrivere questi valori. Sul telefono la cassa completa è in **Cassa, quaderno e note**; quando la consegna è chiusa è in alto nella pagina.

| Valore | Calcolo |
|---|---|
| Trovato | "In cassa" della consegna precedente. |
| + Incassato | La somma degli importi saldati. |
| − Pagato | La somma dei conti produttore. |
| Uscite di cassa | La somma delle uscite (−), con i motivi. |
| Entrate di cassa | La somma delle entrate (+), con i motivi. |
| = In cassa | Trovato + Incassato − Pagato − uscite + entrate. |

1. Conta i soldi nella cassa.
2. Compara il totale con **In cassa**.
3. Se i valori sono diversi, controlla le spese e le entrate/uscite di cassa.
4. Se la differenza continua, scrivi la causa nelle **Note della giornata**.

Se **In cassa** è negativo, GASS mostra l'avviso "Cassa negativa".

### Fotografare il quaderno

Il riquadro **Quaderno** è sotto la cassa (sul telefono, in **Cassa, quaderno e note**). Fotografa la pagina del quaderno con i conti della consegna: è la controprova della cassa.

1. Premi **Fotografa** (telefono) o **Allega foto** (computer). Sul computer puoi anche trascinare l'immagine nel riquadro.
2. Attendi che la miniatura non mostri più "carico…".

Puoi aggiungere al massimo 4 foto. Per togliere una foto, premi **×** sulla foto e conferma. Puoi togliere solo le foto che hai scattato.

Dopo la chiusura, solo chi ha chiuso la consegna o un amministratore può aggiungere o togliere foto del quaderno.

### Chiudere la consegna

Video: [Chiudere la consegna, 0:28](https://gass.x86.it/comefunziona#chiudere).

**AVVERTENZA:** Dopo la chiusura, non puoi cambiare la consegna. Solo un amministratore può riaprirla.

1. Controlla che tutte le spese siano registrate.
2. Premi **Chiudi consegna**.
3. Controlla il riepilogo. Se non ci sono foto del quaderno, GASS lo ricorda: premi **Fotografa prima** per fare la foto, poi premi di nuovo **Chiudi consegna**.
4. Scegli dove mandare il resoconto (per esempio Telegram).
5. Conferma.

## Saldi

Video: [Saldi, 0:16](https://gass.x86.it/comefunziona#saldi).

La pagina Saldi mostra la situazione di oggi.

- Sul telefono, premi un nome per vedere i movimenti.
- Sul computer, premi **Movimenti** sulla riga del gassista.

I movimenti mostrano ogni consegna e il **Saldo dopo** (sul telefono: "saldo dopo:"). Una correzione dell'amministratore ha il nome **Rettifica manuale**. Una quota teatro pagata è nel giorno del pagamento, con il semestre che copre: per esempio "quota teatro 10 € (copre 2° sem. 2026)". **acconto** vuol dire che il semestre non è ancora pagato tutto, **anticipo** che il pagamento è per un semestre futuro, **vecchio foglio** che il pagamento viene dal foglio di prima di GASS. La quota teatro va nella cassa teatro e non cambia il saldo.

I movimenti partono dal 14/09/2026, la prima consegna in GASS. Sul telefono ci sono le ultime 12, senza il credito usato e il debito saldato. Sul computer ci sono tutte, 15 per pagina, con tutte le colonne. Il saldo si modifica solo dal computer.

Colonna **Quota teatro** (computer):

| Simbolo | Significato |
|---|---|
| ✗ 10 € | Il gassista deve una o più quote. La cifra è quanto manca. |
| ✓ | Il gassista ha pagato tutto. |
| – | Il gassista non ha quota in questo semestre. |

Sul telefono, sotto il nome, GASS mostra "quota teatro: deve X €" o "quota teatro: anticipo X € per il 1° sem. 2027". Un anticipo vuol dire che il gassista ha pagato tutto e ha già versato una parte del semestre successivo. Sul computer, tieni il puntatore sopra la ✓ per vedere l'anticipo.

## Storico

Video: [Storico e galleria degli scontrini, 0:30](https://gass.x86.it/comefunziona#storico).

Lo Storico mostra una riga per ogni consegna. Le consegne più recenti sono in alto.

1. Apri **Storico**.
2. Premi una riga. GASS apre quella consegna nella pagina Consegna.

Una consegna chiusa si apre solo in lettura.

Se la consegna ha foto di scontrini, la riga mostra il link **N scontrini** (colonna **Scontrini** sul computer). Il link apre la galleria: prima le foto del quaderno, poi le foto divise per gassista. Premi una foto per vederla grande. Usa **Prec.** e **Succ.**, oppure scorri con il dito (telefono) o usa le frecce ← → (computer).

## Turni

Video: [Turni, 0:09](https://gass.x86.it/comefunziona#turni).

La pagina Turni mostra i prossimi 6 mesi. La tua riga ha l'etichetta **TU**.

| Etichetta | Significato |
|---|---|
| da coprire | Manca un turnista. |
| niente consegna | Quella settimana non c'è consegna. |
| riunione | Riunione GASS. |

Per vedere gli ultimi 3 mesi, premi **Mostra turni passati**.

### Cambiare un turno (telefono)

Video: [Scambiare un turno, 0:33](https://gass.x86.it/comefunziona#scambio).

1. Premi la riga della consegna (o **Apri** a destra).
2. Scegli i nomi in **Turnista 1** e **Turnista 2**. Se sostituisci o togli un nome, conferma (**Sostituisci** o **Togli il nome**).
3. Per cambiare il giorno, premi **Modifica giorno**.
4. Premi **Chiudi**.

Sotto i menu della tua riga, **Il tuo turno** ha anche queste azioni:
   - **scambia con…**: la persona scelta prende il tuo turno. Tu prendi il suo primo turno da oggi. Prima parla con quella persona.
   - **sposta al…**: vai a un'altra data con un posto libero. Il tuo posto resta da coprire.
   - **Salta turno**: lasci il turno. Il posto resta da coprire.

Conferma l'azione.

### Cambiare un turno (computer)

Sul computer puoi cambiare tutti i turni futuri.

1. Premi un nome nella tabella.
2. Scegli la persona o **da coprire**.
3. Se GASS chiede una conferma, conferma.

Per uno scambio, cambia i nomi nelle due date.

Per cambiare il giorno della consegna, premi **Modifica giorno**. Il menu permette anche di segnare **niente consegna** (conferma con **Segna niente consegna**) o **riunione**.

Non puoi cambiare i turni passati.

## Problemi

| Problema | Azione |
|---|---|
| Non puoi accedere. | Controlla nome utente e password. Se non funziona, chiama un amministratore. |
| Non puoi cambiare una consegna. | La consegna è chiusa. Chiama un amministratore. |
| Un saldo non è corretto. | Apri i **Movimenti** del gassista. Trova la consegna sbagliata. Chiama un amministratore. |
| Il gassista non è nell'elenco. | Chiama un amministratore. |

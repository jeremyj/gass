# GASS - Manuale dei partecipanti

Video, 4 minuti: [primo accesso, consegna, saldi e turni](https://gass.x86.it/comefunziona).

Funzioni degli amministratori: [Manuale degli amministratori](MANUALE_AMMINISTRATORI.md).

## Termini

| Termine | Significato |
|---|---|
| Partecipante | Una persona del GASS. Ogni partecipante ha un account e un saldo. |
| Consegna | Un giorno di distribuzione della merce. Normalmente è il martedì. |
| Turno | I due partecipanti che gestiscono una consegna. |
| Conto produttore | Il costo della merce che il partecipante prende. È l'importo effettivo nel foglio Altobelli. |
| Importo saldato | I soldi che il partecipante dà alla consegna. |
| Saldo | La situazione del partecipante: credito (blu, +) o debito (rosso, −). |
| Cassa | I soldi nella scatola della consegna. |
| Uscita di cassa | Soldi che escono dalla cassa o entrano nella cassa per un motivo diverso dalla spesa. |
| Quota teatro | La quota per l'affitto del teatro. Si paga ogni semestre (gennaio–giugno, luglio–dicembre). |
| Bussolotto | La cassa del teatro. È separata dalla cassa della consegna. |

## Accesso

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
| Saldi | Mostra il saldo e le transazioni di ogni partecipante. |
| Storico | Mostra tutte le consegne. |
| Turni | Mostra chi fa ogni turno. |

Il simbolo ⓘ accanto ad alcune voci apre una spiegazione. Tocca in un altro punto per chiuderla.

## Consegna

### Aprire la consegna

La pagina Consegna si apre sulla consegna giusta: l'ultimo turno fino a oggi, se è ancora aperto. Se l'ultima consegna è chiusa, la pagina si apre su oggi.

1. Apri **Consegna**.
2. Se la consegna non esiste ancora, premi **Nuova consegna**.

Un riquadro in alto mostra le altre consegne ancora aperte. Premi una data per aprire quella consegna.

### Registrare la spesa di un partecipante

1. Premi **+ Aggiungi partecipante**.
2. Scegli il partecipante.
3. Scrivi il **Conto produttore**.
4. Scrivi l'**Importo saldato**.
5. Controlla l'esito: credito, debito o "saldato".
6. Premi **Salva movimento**.
7. Ripeti i passi da 1 a 6 per ogni partecipante.

GASS calcola il credito e il debito. Non puoi scrivere questi valori.

- Se il partecipante ha un debito e paga di più, GASS usa la differenza per il debito.
- Se il partecipante ha un credito e paga di meno, GASS usa il credito.

Esempio: Giovanni ha 10 € di credito. Il conto è 18 €. Giovanni paga 5 €. GASS usa i 10 € di credito. Il nuovo saldo è 3 € di debito.

Per correggere una spesa, premi la riga del partecipante nell'elenco **Chi ha ritirato** (telefono) o **Movimenti** (computer). Cambia i valori. Premi **Salva movimento**.

### Fotografare gli scontrini

Nella scheda del partecipante, sotto le **Note**, c'è il riquadro **Scontrini**.

1. Apri la scheda del partecipante.
2. Premi **Fotografa** (telefono) o **Allega scontrino** (computer). Sul telefono si apre un menu: scegli **Foto** per scattare una foto, o **File** per scegliere foto che hai già. Sul computer puoi anche trascinare l'immagine nel riquadro.
3. Aspetta che la scritta "carico…" sparisca.

GASS salva la foto subito, anche se non premi **Salva movimento**. Puoi allegare al massimo 3 foto per partecipante in una consegna. Premi una foto per vederla grande.

Per togliere una foto, premi **×** sulla foto e conferma. Solo chi ha scattato la foto o un amministratore può toglierla. Quando la consegna è chiusa, non puoi aggiungere o togliere foto.

Nell'elenco del giorno, il numero accanto all'icona della fotocamera dice quante foto ha il partecipante. Premi **Vedi i N scontrini** sotto l'elenco per aprire la galleria della consegna.

### Registrare la quota teatro

La scheda del partecipante mostra il riquadro **Quota teatro** quando il partecipante deve una quota.

1. Apri la scheda del partecipante.
2. Scrivi l'importo in **Versato per il teatro**.
3. Controlla il riquadro **Ha dato X €**. Mostra quanto va nella cassa e quanto va nel bussolotto.
4. Metti i soldi della quota nel bussolotto, non nella cassa.
5. Premi **Salva movimento**.

GASS paga prima il semestre più vecchio. Se l'importo è maggiore della quota, la differenza è un anticipo.

Il partecipante può pagare solo la quota. In questo caso lascia vuoti il conto e l'importo saldato.

Se il partecipante non deve quote, premi **+ Quota teatro (anticipo)** per registrare un anticipo.

Per togliere una quota sbagliata, scrivi 0 e premi **Salva movimento**.

### Registrare un'uscita di cassa

Usa un'uscita di cassa quando togli soldi dalla cassa o metti soldi nella cassa per un motivo diverso dalla spesa.

1. Sotto le **Note della giornata**, scrivi l'importo.
2. Scrivi il motivo. Il motivo è obbligatorio.
3. Scegli **esce** (soldi tolti) o **entra** (soldi messi). Puoi anche scrivere − o + prima dell'importo.
4. Per un'altra uscita, premi **+**.
5. Premi **Salva**.

Esempio: il conto Altobelli è 357,20 €. Dai ad Altobelli 357 €. Scrivi 0,20 **entra**, motivo "arrotondamento Altobelli".

Per togliere un'uscita, cancella l'importo e il motivo. Premi **Salva**.

### Controllare la cassa

GASS calcola la cassa. Non puoi scrivere questi valori.

| Valore | Calcolo |
|---|---|
| Trovato | "In cassa" della consegna precedente. |
| + Incassato | La somma degli importi saldati. |
| − Pagato | La somma dei conti produttore. |
| Uscite di cassa | Le uscite (−) e le entrate (+). |
| = In cassa | Trovato + Incassato − Pagato − uscite + entrate. |

1. Conta i soldi nella cassa.
2. Compara il totale con **In cassa**.
3. Se i valori sono diversi, controlla le spese e le uscite di cassa.
4. Se la differenza continua, scrivi la causa nelle **Note della giornata**.

Se **In cassa** è negativo, GASS mostra l'avviso "Cassa negativa".

### Chiudere la consegna

**AVVERTENZA:** Dopo la chiusura, non puoi cambiare la consegna. Solo un amministratore può riaprirla.

1. Controlla che tutte le spese siano registrate.
2. Premi **Chiudi consegna**.
3. Controlla il riepilogo.
4. Scegli dove mandare il resoconto (per esempio Telegram).
5. Conferma.

## Saldi

La pagina Saldi mostra la situazione di oggi.

- Sul telefono, premi un nome per vedere le transazioni.
- Sul computer, premi **Transazioni** sulla riga del partecipante.

Le transazioni mostrano ogni consegna e il **Saldo dopo**. Una correzione dell'amministratore ha il nome **Rettifica manuale**.

Colonna **Quota teatro** (computer):

| Simbolo | Significato |
|---|---|
| ✗ | Il partecipante deve una o più quote. |
| ✓ | Il partecipante ha pagato tutto. |
| – | Il partecipante non ha quota in questo semestre. |

Sul telefono, sotto il nome, GASS mostra "deve X €" o "anticipo".

## Storico

Lo Storico mostra una riga per ogni consegna. Le consegne più recenti sono in alto.

1. Apri **Storico**.
2. Premi una riga. GASS apre quella consegna nella pagina Consegna.

Una consegna chiusa si apre solo in lettura.

Se la consegna ha foto di scontrini, la riga mostra il link **N scontrini** (colonna **Scontrini** sul computer). Il link apre la galleria: le foto sono divise per partecipante. Premi una foto per vederla grande. Usa **Prec.** e **Succ.**, oppure scorri con il dito (telefono) o usa le frecce ← → (computer).

## Turni

La pagina Turni mostra i prossimi 6 mesi. La tua riga ha l'etichetta **TU**.

| Etichetta | Significato |
|---|---|
| da coprire | Manca un turnista. |
| niente consegna | Quella settimana non c'è consegna. |
| riunione | Riunione GASS. |

Per vedere gli ultimi 3 mesi, premi **Mostra turni passati**.

### Cambiare il tuo turno (telefono)

1. Premi **cambia** sulla tua riga.
2. Scegli un'azione:
   - **scambia con…**: la persona scelta prende il tuo turno. Tu prendi il suo primo turno da oggi. Prima parla con quella persona.
   - **sposta al…**: vai a un'altra data con un posto libero. Il tuo posto resta da coprire.
   - **Non posso**: lasci il turno. Il posto resta da coprire.
3. Conferma.

### Cambiare un turno (computer)

Sul computer puoi cambiare tutti i turni futuri.

1. Premi un nome nella tabella.
2. Scegli la persona o **da coprire**.
3. Se GASS chiede una conferma, conferma.

Per uno scambio, cambia i nomi nelle due date.

Per cambiare il giorno della consegna, usa il menu **Giorno**. Il menu permette anche di segnare **niente consegna** o **riunione GASS**.

Non puoi cambiare i turni passati.

## Problemi

| Problema | Azione |
|---|---|
| Non puoi accedere. | Controlla nome utente e password. Se non funziona, chiama un amministratore. |
| Non puoi cambiare una consegna. | La consegna è chiusa. Chiama un amministratore. |
| Un saldo non è corretto. | Apri le **Transazioni** del partecipante. Trova la consegna sbagliata. Chiama un amministratore. |
| Il partecipante non è nell'elenco. | Chiama un amministratore. |

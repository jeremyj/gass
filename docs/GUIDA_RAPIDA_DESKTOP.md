---
title: "GASS Torpignattara - Guida Rapida (Desktop)"
date: "Settembre 2026"
---

# Accesso

Apri il browser e vai su **https://gass.x86.it**. Clicca **Accedi** e inserisci nome utente e password. Al primo accesso usa la password provvisoria ricevuta: GASS ti chiede di sceglierne una nuova (almeno 8 caratteri).

Video del primo accesso: **https://gass.x86.it/comefunziona**. Novità della 2.17 (turni): **https://gass.x86.it/v2.17**.

Per cambiare la password in seguito vai su **https://auth.x86.it**, nelle impostazioni del tuo utente.

![](screenshots/01-login.png){ width=50% }

**Navigazione:** menu in alto — *Consegna*, *Saldi*, *Storico* (e *Attività* per gli amministratori); a destra il tuo nome, *Cambia password* (solo account locali) ed *Esci*. L'intestazione scura cambia colore con la stagione.

---

# Consegna

Pagina principale per registrare i movimenti giornalieri. La pagina si apre da sola sull'ultimo giorno di turno fino a oggi, se non ha ancora una consegna o ce l'ha aperta; altrimenti su oggi. Se non esiste ancora una consegna, appare il pulsante **Nuova consegna** — cliccalo per iniziare. In cima un riquadro avvisa delle altre consegne ancora aperte ("Sono ancora aperte le consegne di …", con le date come link). Le consegne passate si aprono da **Storico**.

## Dati Giornata (Cassa)

La colonna a sinistra mostra la cassa come una somma, calcolata automaticamente dal sistema (non si scrive nulla):

- **Trovato in cassa** — il lasciato della consegna precedente
- **+ Incassato** — somma degli importi saldati
- **− Pagato al produttore** — somma dei conti produttore di tutti i movimenti del giorno
- **− Uscite di cassa** — solo se ci sono: soldi presi dalla cassa per altro (es. quote portate al teatro)
- **= Lasciato in cassa** — trovato + incassato - pagato - uscite

Sotto, le **Note della giornata** e le **Uscite di cassa** (importo e motivo), con **Salva** quando cambiano. Lo stato (*Consegna aperta* / *chiusa*) e i pulsanti Chiudi / Riapri / Annulla consegna sono nell'intestazione.

## Registrare un Movimento

1. Nella sezione **Movimenti** seleziona il **partecipante** da **+ Aggiungi partecipante** (per modificare un movimento già inserito, clicca la sua riga nella tabella)
2. Sotto la tabella si apre il modulo: inserisci il **Conto produttore** (quanto deve al produttore)
3. Inserisci l'**Importo saldato** (quanto porta oggi)
4. Il sistema calcola automaticamente eventuali **Lascia credito** o **Lascia debito** e lo mostra nel riquadro finale
5. Clicca **Salva movimento**

La tabella ha le colonne Partecipante, Conto produttore, Importo saldato, Lascia credito, Lascia debito, Usa credito, Salda debito, Quota teatro, Note e la riga **Totale**; gli zeri sono mostrati come "–".

> Se il partecipante ha un debito o credito pregressi, il sistema li compensa automaticamente — controlla il riepilogo prima di salvare.

![Consegna del 24/02 con i movimenti della giornata](screenshots/02-consegna.png){ width=100% }

## Chiudere la Consegna

Dopo aver inserito tutti i movimenti clicca **Chiudi consegna** e conferma il riepilogo per bloccare la giornata. Se la cassa è negativa compare l'avviso "Cassa negativa": controlla i movimenti prima di chiudere. Solo un amministratore può riaprirla: la apre da **Storico** e usa **Riapri consegna** nell'intestazione.

---

# Saldi

Panoramica dei saldi di tutti i partecipanti. **Blu** con "+" = credito, **rosso vino** con "−" = debito, "–" = in pari.

Clicca **Transazioni** per vedere lo storico movimenti di un partecipante.

![Pagina Saldi con tabella partecipanti](screenshots/03-saldi.png){ width=100% }

---

# Storico

Indice delle consegne dalla più recente, in una tabella con Consegna, Stato, Persone, Trovato, Incassato, Pagato, In cassa e Quota teatro. Clicca una riga per aprire la consegna nella pagina Consegna (il tasto indietro riporta qui). Una cassa negativa è in rosso.

![Pagina Storico](screenshots/05-storico.png){ width=100% }

---

# Turni

I prossimi 6 mesi con i due turnisti di ogni consegna (martedì). La tua riga è segnata **TU**; **da coprire** = manca un turnista; **riunione** = riunione GASS. **Mostra turni passati** aggiunge gli ultimi 3 mesi.

Tutti scelgono i nomi di ogni consegna futura dai menu della tabella (sostituire o togliere un nome chiede conferma; per uno scambio cambia i nomi in tutte e due le date). **Giorno** sposta la consegna, la segna **niente consegna** o **riunione GASS**, aggiunge una nota.

Gli amministratori mettono in pausa la **Generazione automatica dei turni** (in pausa, le settimane nuove arrivano da coprire), scrivono il riquadro **Note** sopra la tabella (lo leggono tutti) e gestiscono le **Pause** in fondo.

---

# Quota teatro

Ogni semestre (gennaio–giugno, luglio–dicembre) si paga una quota per l'affitto del teatro, in una cassa separata da quella della consegna. Nella scheda del partecipante, **Quota teatro** mostra i semestri dovuti: scrivi l'importo versato (copre i semestri dal più vecchio; quello che avanza è un anticipo) e **Registra quota**. In **Saldi** la colonna **Quota teatro** ha ✓ per chi ha pagato tutto, ✗ per chi deve ancora qualche semestre e – per chi questo semestre non ha quota.

---

# Solo per Amministratori

| Funzione | Come accedervi |
|---|---|
| Riaprire consegna chiusa | Storico → clicca la consegna → **Riapri consegna** |
| Eliminare una consegna salvata | Consegna → **Annulla consegna** |
| Quote teatro: griglia, quote ridotte, cassa teatro | **Teatro** (menu in alto) |
| Modificare un saldo | Saldi → **Modifica saldo** |
| Aggiungere partecipanti | Saldi → **+ Aggiungi partecipante** |
| Modificare utenti | Saldi → **Modifica utente** |
| Eliminare un utente | Saldi → **Modifica utente** → **Elimina utente** (solo se non ha movimenti né rettifiche di saldo) |
| Togliere dai turni / disattivare / riattivare un utente | Saldi → **Modifica utente** → Stato (**Attivo**, **No turni**, **Disattivato**); per vedere i disattivati spuntare **Mostra disattivati** |
| Pause e generazione automatica dei turni, note | Turni → **Generazione automatica**, **Note**, **Pause** |
| Log attività | Menu → **Attività** |

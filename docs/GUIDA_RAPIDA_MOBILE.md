---
title: "GASS Torpignattara - Guida Rapida (Mobile)"
date: "Settembre 2026"
---

# Accesso

Apri il browser e vai su **https://gass.x86.it**. Clicca **Accedi** e inserisci nome utente e password. Al primo accesso usa la password provvisoria ricevuta: GASS ti chiede di sceglierne una nuova (almeno 8 caratteri).

Video del primo accesso: **https://gass.x86.it/comefunziona**. Novità della 2.17 (turni): **https://gass.x86.it/v2.17**.

Per cambiare la password in seguito vai su **https://auth.x86.it**, nelle impostazioni del tuo utente.

![](screenshots/01-login.png){ width=50% }

**Navigazione:** barra in basso con tre schede — *Consegna*, *Saldi*, *Storico*. In alto compaiono il tuo nome, la chiave (cambia password, solo account locali) e l'icona di uscita (*Esci*). L'intestazione scura cambia colore con la stagione.

---

# Consegna

La pagina si apre da sola sull'ultimo giorno di turno fino a oggi, se non ha ancora una consegna o ce l'ha aperta; altrimenti su oggi. Se non esiste ancora una consegna, appare il pulsante **Nuova consegna**. In cima un riquadro avvisa delle altre consegne ancora aperte ("La consegna di … è ancora aperta. Completala ›"). Le consegne passate si aprono da **Storico**.

In cima la riga della cassa mostra i totali della giornata come una somma: Trovato, + Incassato, − Pagato, = In cassa — tutti calcolati automaticamente, non si inserisce nulla. Sotto, lo stato (*Consegna aperta* / *Consegna chiusa*) e le *Note della giornata*.

![](screenshots/m02-consegna.png){ width=45% }

## Registrare un Movimento

1. Nella sezione **Chi ha ritirato** seleziona il **partecipante** da **+ Aggiungi partecipante** (per modificare un movimento già inserito, tocca la sua riga)
2. Si apre il modulo a tutto schermo — inserisci:
   - **Conto produttore** (quanto deve al produttore)
   - **Importo saldato** (quanto porta oggi)
3. Il sistema calcola automaticamente credito o debito residuo e lo mostra nel riquadro finale (*Lascia credito*, *Lascia debito* o *Esito: saldato*). Nell'elenco *Chi ha ritirato* ogni riga mostra conto e pagato e, quando ci sono, *salda debito*, *usa credito* e *quota teatro*; chi ha pagato solo la quota ha una riga *solo teatro*
4. Clicca **Salva movimento**

> Se il partecipante ha debiti/crediti pregressi, vengono compensati automaticamente.

![Modulo di inserimento per un partecipante con debito](screenshots/m02b-movimento.png){ width=45% }

## Chiudere la Consegna

Dopo aver salvato almeno un movimento, sotto la riga della cassa compare il link **Chiudi consegna** — cliccalo e conferma il riepilogo per bloccare la giornata. Solo un amministratore può riaprirla: in **Storico** con **Riapri consegna**, oppure aprendola da Storico e usando **Riapri consegna** qui. Se la cassa è negativa compare l'avviso "Cassa negativa": controlla i movimenti prima di chiudere.

![Conferma di chiusura con il riepilogo](screenshots/m02c-chiudi.png){ width=45% }

---

# Saldi

In cima i totali dei crediti e dei debiti, poi la lista **Partecipanti** con il saldo attuale. **+** blu con "credito" = credito, **−** rosso vino con "debito" = debito, grigio "in pari".

**Tocca un nome** per vedere il dettaglio e lo storico movimenti di quel partecipante.

![Saldi e dettaglio partecipante](screenshots/m04-saldi-expanded.png){ width=45% }

---

# Storico

Indice delle consegne, raggruppate per mese e dalla più recente: per ognuna data, stato (aperta/chiusa), persone, quota teatro e cassa. Tocca una consegna per aprirla nella pagina Consegna (il tasto indietro riporta qui); se è ancora aperta, **Completa consegna** la apre allo stesso modo.

![Pagina Storico](screenshots/m05-storico.png){ width=45% }

---

# Turni

Le prossime 24 settimane con i due turnisti di ogni consegna (martedì). La tua riga è segnata **TU**; **da coprire** = manca un turnista; **riunione** = riunione GASS.

Sul tuo turno tocca **cambia**: **scambia con…** (prima mettiti d'accordo con qualcuno: prende il tuo turno e tu il suo primo turno da oggi), **sposta al…** (una data con un posto libero) o **Non posso** (il posto resta da coprire). Ogni azione chiede conferma. Se ci sono, le **Note** sui turni compaiono sopra l'elenco. Le altre modifiche le fanno gli amministratori, da desktop.

---

# Quota teatro

Ogni semestre (gennaio–giugno, luglio–dicembre) si paga una quota per l'affitto del teatro, in una cassa separata da quella della consegna. Nella scheda del partecipante, **Quota teatro** mostra i semestri dovuti: scrivi l'importo versato (copre i semestri dal più vecchio; quello che avanza è un anticipo) e **Registra quota**. In **Saldi**, sotto ogni nome, la situazione della quota.

---

# Solo per Amministratori

| Funzione | Come accedervi |
|---|---|
| Riaprire consegna chiusa | Storico → **Riapri consegna** (sulla riga della consegna) |
| Eliminare una consegna salvata | Consegna → **Annulla consegna** |
| Modificare un saldo | Saldi → tocca il nome → **Modifica saldo** |

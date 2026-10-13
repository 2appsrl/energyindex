import sys
sys.path.insert(0, "/private/tmp/claude-501/-Users-semronzoni-Desktop-1RangerDea-Claude-EnergyIndex/fa87b8e7-f437-43c9-b37c-6c91605ce8d6/scratchpad")
from report_lib import *
OUT = "/private/tmp/claude-501/-Users-semronzoni-Desktop-1RangerDea-Claude-EnergyIndex/fa87b8e7-f437-43c9-b37c-6c91605ce8d6/scratchpad/"

MET = ("Documento interno · settembre 2026 · Cambi del 1° settembre 2026: 1 GBP = 1,167 EUR, "
       "1 USD = 0,863 EUR, 1 JPY = 0,005387 EUR. Fonti puntuali in fondo al documento.")

# elettricità famiglie, €/kWh tutto incluso
EL = [("Regno|Unito",0.40,RED),("Germania",0.39,RED),("Media UE",0.29,MUTED),("Italia",0.28,GAS),
      ("Francia",0.25,NAVY),("Giappone",0.20,NAVY),("Spagna",0.19,ELEC),("Stati|Uniti",0.16,ELEC)]
GA = [("Spagna",0.086,ELEC),("Regno|Unito",0.106,NAVY),("Germania",0.120,NAVY),
      ("Media UE",0.123,MUTED),("Francia",0.128,NAVY),("Italia",0.148,RED)]

b = []
b.append(cover("Energy Index · Ricerca di mercato", "Sette mercati<br/>a confronto",
  "Regno Unito, Spagna, Francia, Germania, Stati Uniti, Giappone e Italia. Quanto si paga, "
  "come è fatta la bolletta, chi protegge il consumatore e — soprattutto — dove i dati "
  "sono accessibili abbastanza da costruirci sopra qualcosa.",
  [("2×","fra il mercato più caro<br/>e il più economico"),
   ("3","modelli di protezione<br/>del consumatore"),
   ("1","banca dati pubblica<br/>completa delle offerte"),
   ("7","mercati analizzati")], MET))

b.append(f"""<section><h2><span class="n">01</span>Come leggere questo confronto</h2><div class="rule"></div>
<p class="lead">Mettere in fila sette mercati è utile ma insidioso: ogni Paese misura l'energia
in modo diverso. Prima dei numeri, le avvertenze che li rendono onesti.</p>
<div class="box warn"><b>Quattro cose da sapere prima di guardare i grafici.</b>
<ul style="margin-top:2mm;margin-bottom:0">
<li><b>Le date non coincidono.</b> I dati europei comparabili di Eurostat si fermano al secondo semestre 2025; i prezzi nazionali sono di settembre 2026. Un mercato può sembrare più caro solo perché il suo dato è più recente.</li>
<li><b>La quota fissa è spalmata.</b> Dove esiste un corrispettivo fisso — quasi ovunque — l'ho ripartito su un consumo tipico per ottenere un prezzo al kWh confrontabile. Cambiando il consumo di riferimento, l'ordine può cambiare.</li>
<li><b>I cambi contano.</b> Sterlina, dollaro e yen sono convertiti al 1° settembre 2026. Una variazione del cambio sposta le colonne senza che nulla sia cambiato nei mercati.</li>
<li><b>Il Giappone è drogato dai sussidi.</b> Il prezzo che i giapponesi vedono in bolletta è ridotto da uno sconto pubblico ancora attivo: il dato non è un prezzo di mercato.</li>
</ul></div>
<p>Con queste cautele, i numeri restano indicativi degli <b>ordini di grandezza</b> e delle
distanze relative, che è ciò che serve per decidere dove valga la pena guardare. Non sono, e non
possono essere, una classifica al centesimo.</p>
</section>""")

b.append(f"""<section><h2><span class="n">02</span>Quanto costa l'elettricità</h2><div class="rule"></div>
<div class="fig">{bars_v(EL," €",2,"€/kWh famiglie, tutto incluso")}
<div class="cap">Prezzo dell'elettricità per uso domestico, euro al kWh, imposte e quota fissa
incluse. Germania e media UE: Eurostat, secondo semestre 2025. Regno Unito: price cap
ottobre 2026 su consumo convenzionale. Altri: prezzi nazionali di riferimento, settembre 2026.</div></div>
<p class="lead">Fra il mercato più caro e quello più economico c'è un fattore due e mezzo, e le
ragioni non sono quelle che ci si aspetta.</p>
<h3>Perché il Regno Unito e la Germania stanno in cima</h3>
<p>Per motivi opposti. Nel <b>Regno Unito</b> il prezzo dell'elettricità è fissato quasi sempre
dalle centrali a gas, che sono l'impianto marginale: quando il gas rincara, rincara tutto, anche
l'energia prodotta dal vento. In <b>Germania</b> il problema non è la generazione ma il fisco:
un terzo della bolletta sono tasse e oneri, il carico più alto dei sette mercati.</p>
<h3>Perché Stati Uniti e Spagna stanno in fondo</h3>
<p>Gli <b>Stati Uniti</b> hanno gas domestico abbondante e a buon mercato grazie alla produzione
da scisto — un vantaggio strutturale che si riflette su tutta la filiera. La <b>Spagna</b> combina
una quota altissima di rinnovabili con la maggiore capacità di rigassificazione d'Europa, che le
ha permesso di diversificare le forniture quando gli altri erano legati ai gasdotti russi.</p>
<div class="box"><b>Il dato che conta per voi.</b> L'Italia sta poco sopra la media europea e
sensibilmente sotto Regno Unito e Germania. Significa che un osservatorio prezzi italiano si
rivolge a un pubblico meno «arrabbiato» di quello britannico o tedesco: dove la bolletta fa più
male, l'attenzione al confronto fra offerte è strutturalmente più alta, e con essa la domanda
di strumenti che aiutino a orientarsi.</div>
</section>""")

b.append(f"""<section><h2><span class="n">03</span>Quanto costa il gas</h2><div class="rule"></div>
<div class="fig">{bars_v(GA," €",3,"€/kWh famiglie, tutto incluso")}
<div class="cap">Prezzo del gas per uso domestico, euro al kWh, imposte incluse. Fonte: Eurostat,
secondo semestre 2025; Spagna e Germania convertite da euro per gigajoule; Regno Unito calcolato
dal price cap di ottobre 2026. Stati Uniti e Giappone non sono confrontabili su questa base:
il primo fattura in therm, il secondo importa tutto via nave con una struttura tariffaria diversa.</div></div>
<p>La graduatoria si ribalta rispetto all'elettricità: il <b>Regno Unito</b>, quarto per costo
dell'elettricità, è secondo più economico sul gas. E l'<b>Italia</b>, in media sull'elettricità,
paga il gas più caro dei mercati confrontati.</p>
<div class="box"><b>Perché il ribaltamento è interessante.</b> Dimostra che «energia cara» non è
una proprietà del Paese ma di ciascuna filiera. Il Regno Unito ha gas relativamente economico ed
elettricità carissima proprio perché quel gas, bruciato per fare elettricità, ne fissa il prezzo
sommandosi a oneri di rete e politiche molto più alti della media. Un confronto che guardi solo
alla bolletta elettrica racconterebbe metà della storia.</div>
</section>""")

b.append(f"""<section><h2><span class="n">04</span>Chi protegge il consumatore</h2><div class="rule"></div>
<p class="lead">È la differenza istituzionale più importante, e divide i sette mercati in tre
famiglie.</p>
<table>
<tr><th style="width:30mm">Modello</th><th style="width:34mm">Dove</th><th>Come funziona</th></tr>
<tr><td><b>Tetto al prezzo</b></td><td>Regno Unito</td>
<td>Ofgem fissa ogni trimestre il massimo per prezzo unitario e quota fissa. Non limita la bolletta totale. Protegge chi non sceglie, ma <b>non è il prezzo migliore</b>: le offerte fisse stanno mediamente sotto</td></tr>
<tr><td><b>Tariffa regolata</b></td><td>Francia, Spagna, Italia, Giappone</td>
<td>Esiste un prezzo amministrato accanto al mercato libero. In Francia è fisso e rivisto due volte l'anno; in Spagna cambia ogni quarto d'ora; in Giappone resta come salvaguardia in bassa tensione</td></tr>
<tr><td><b>Nessuna protezione</b></td><td>Germania, gran parte degli Stati Uniti</td>
<td>Nessun tetto né riferimento. In Germania chi non sceglie finisce nella fornitura di base, che è <b>quasi sempre la più cara</b>. Negli Stati regolamentati americani il prezzo lo approva la commissione statale, ma il cliente <b>non può cambiare fornitore</b></td></tr>
</table>
<div class="box"><b>La Francia ha inventato la terza via, ed è quella che vi riguarda.</b>
Quando ha abolito la tariffa regolata del gas nel 2023, il regolatore non ha lasciato il vuoto:
pubblica ogni mese un <b>prezzo di riferimento non vincolante</b>, che non protegge nessuno e non
obbliga nessuno. Serve solo perché il consumatore possa giudicare se l'offerta che ha in mano è
ragionevole. È esattamente la funzione di un osservatorio indipendente — con la differenza che
lì la svolge lo Stato. Dove lo Stato non la svolge, quel posto è vuoto.</div>
<h3>Con che frequenza cambia il prezzo di riferimento</h3>
<table>
<tr><th>Mercato</th><th>Aggiornamento</th><th>Conseguenza per un osservatorio</th></tr>
<tr><td><b>Spagna</b></td><td>Ogni 15 minuti, 96 prezzi al giorno dal 2026</td><td>Contenuto quotidiano garantito, ma il terreno è già affollato</td></tr>
<tr><td><b>Regno Unito</b></td><td>Trimestrale, con annunci a febbraio, maggio, agosto, novembre</td><td>Quattro momenti di attenzione mediatica altissima all'anno</td></tr>
<tr><td><b>Italia</b></td><td>Trimestrale per i servizi di tutela</td><td>Simile al Regno Unito, con meno risonanza</td></tr>
<tr><td><b>Francia</b></td><td>Semestrale, febbraio e agosto</td><td>Poco adatto a un cruscotto quotidiano</td></tr>
<tr><td><b>Germania</b></td><td>Nessun riferimento: ogni fornitore quando vuole</td><td>Niente su cui ancorare una notizia ricorrente</td></tr>
</table>
</section>""")

b.append(f"""<section><h2><span class="n">05</span>Come è fatta la bolletta</h2><div class="rule"></div>
<p class="lead">Tutti i mercati hanno una parte fissa e una variabile, ma quello su cui si calcola
la parte fissa cambia — e cambia molto.</p>
<table>
<tr><th style="width:26mm">Mercato</th><th style="width:44mm">Su cosa si paga la quota fissa</th><th>Struttura del prezzo variabile</th></tr>
<tr><td><b>Regno Unito</b></td><td>Al giorno, uguale per tutti nella stessa regione</td><td>Prezzo unico al kWh. <b>La quota fissa varia molto per regione</b>: fino a 95 £/anno di differenza</td></tr>
<tr><td><b>Italia</b></td><td>Quota fissa annua più oneri di sistema</td><td>Prezzo al kWh, con componenti perequative</td></tr>
<tr><td><b>Spagna</b></td><td>Sulla <b>potenza contrattata</b> in kW, su due fasce</td><td>Tre fasce orarie: punta, piano, valle. Fine settimana tutto in fascia economica</td></tr>
<tr><td><b>Francia</b></td><td>Sui <b>kVA sottoscritti</b>: più potenza, più abbonamento</td><td>Base, oppure ore piene e vuote, oppure Tempo con giorni colorati</td></tr>
<tr><td><b>Germania</b></td><td>Quota mensile fissa</td><td>Prezzo unico al kWh</td></tr>
<tr><td><b>Stati Uniti</b></td><td>Quota mensile in dollari</td><td>Spesso a <b>scaglioni crescenti</b> o con fasce orarie; per le imprese pesa il corrispettivo sulla punta</td></tr>
<tr><td><b>Giappone</b></td><td>Sull'<b>amperaggio contrattato</b></td><td><b>Tre scaglioni crescenti</b>: più consumi, più cara ogni unità. Più adeguamento carburante mensile</td></tr>
</table>
<div class="box"><b>Il Giappone è l'unico che punisce chi consuma di più.</b> Ovunque il prezzo
unitario è piatto o scende con i volumi; in Giappone sale su tre scaglioni. È una scelta
deliberata di un Paese che importa quasi tutta la sua energia primaria, e ribalta la logica
commerciale a cui siamo abituati in Europa.</div>
</section>""")

b.append(f"""<section><h2><span class="n">06</span>Quanto sono accessibili i dati</h2><div class="rule"></div>
<p class="lead">Questa è la tabella che conta davvero per decidere dove costruire. Un mercato
interessante con dati chiusi vale meno di un mercato noioso con dati aperti.</p>
<table>
<tr><th style="width:24mm">Mercato</th><th style="width:30mm">Prezzo all'ingrosso</th><th style="width:38mm">Offerte al dettaglio</th><th>Dati di sistema</th></tr>
<tr><td><b>Italia</b></td><td>GME, <b>aperto</b></td><td><b>Portale Offerte ARERA: banca dati pubblica completa</b></td><td>Terna, buoni</td></tr>
<tr><td><b>Spagna</b></td><td>OMIE, <b>aperto</b></td><td>Parziale, nessun registro completo</td><td>Red Eléctrica, API aperte ottime</td></tr>
<tr><td><b>Regno Unito</b></td><td><b>Chiuso</b>: N2EX ed EPEX sotto licenza commerciale</td><td>Nessun registro. Ofgem pubblica solo il cap; Octopus espone un'API pubblica ottima</td><td><b>Elexon e NESO, i migliori d'Europa</b></td></tr>
<tr><td><b>Francia</b></td><td>EPEX, sotto licenza</td><td>Nessun registro; la CRE pubblica tariffe regolate e prezzo di riferimento gas</td><td>RTE, buoni</td></tr>
<tr><td><b>Germania</b></td><td>EPEX, sotto licenza</td><td>Nessun registro, e <b>circa mille fornitori</b> da raccogliere uno per uno</td><td>SMARD, buono</td></tr>
<tr><td><b>Stati Uniti</b></td><td>ERCOT, PJM, CAISO: <b>aperti</b></td><td>Solo in alcuni Stati, formati diversi</td><td><b>EIA, probabilmente i migliori al mondo</b></td></tr>
<tr><td><b>Giappone</b></td><td>JEPX</td><td>Nessun registro</td><td>Limitati e in giapponese</td></tr>
</table>
<div class="box"><b>La scoperta più importante di questa ricerca.</b> L'Italia è l'unico dei sette
mercati che abbia una <b>banca dati pubblica e completa delle offerte al dettaglio</b>. Il Portale
Offerte ARERA, che voi date per scontato perché ci lavorate sopra da anni, <b>non ha equivalenti
altrove</b>. Ovunque andiate, il confronto fra offerte va ricostruito fornitore per fornitore,
via API dove esistono e via scraping dove non esistono. È il vincolo che più di ogni altro
determina il costo di ingresso in un nuovo mercato.</div>
</section>""")

b.append(f"""<section><h2><span class="n">07</span>Dove ha senso andare</h2><div class="rule"></div>
<p class="lead">Mettendo insieme prezzo, struttura, protezione del consumatore e accessibilità
dei dati, i sette mercati si ordinano abbastanza nettamente.</p>
<table>
<tr><th style="width:26mm">Mercato</th><th style="width:22mm">Giudizio</th><th>Perché</th></tr>
<tr><td><b>Regno Unito</b></td><td><b>Primo candidato</b></td>
<td>Bollette fra le più alte, quindi attenzione altissima. Dati di sistema eccellenti e gratuiti. Un riferimento pubblico trimestrale — il price cap — su cui ancorare contenuto ricorrente. Una community tecnica che linka e condivide. Il punto debole è l'assenza di un registro delle offerte</td></tr>
<tr><td><b>Germania</b></td><td><b>Secondo</b></td>
<td>Il divario fra chi sceglie e chi no è il più ampio di tutti: quasi nove centesimi al kWh. Nessuna protezione e nessun riferimento pubblico significa che lo spazio è completamente vuoto. Ma mille fornitori da raccogliere sono un ostacolo serio</td></tr>
<tr><td><b>Stati Uniti</b></td><td><b>Solo uno Stato</b></td>
<td>Dati pubblici straordinari, ma cinquanta regolatori. Ha senso solo scegliendo un singolo Stato liberalizzato — il Texas è il candidato naturale — e trattandolo come un Paese a sé</td></tr>
<tr><td><b>Spagna</b></td><td><b>Terreno occupato</b></td>
<td>Dati ottimi e pubblico già educato ai prezzi variabili, ma esistono già molti siti che mostrano il prezzo orario. Entrare richiede un angolo diverso dal semplice prezzo del giorno</td></tr>
<tr><td><b>Francia</b></td><td><b>Poco spazio</b></td>
<td>Il regolatore occupa già la funzione di riferimento indipendente con il prix repère, e il ritmo semestrale non alimenta un cruscotto quotidiano</td></tr>
<tr><td><b>Giappone</b></td><td><b>Non ora</b></td>
<td>Barriera linguistica, dati poco accessibili e prezzi distorti dai sussidi pubblici</td></tr>
</table>
<h3>Le cinque cose da portarsi via</h3>
<ul>
<li>Fra il mercato più caro e il più economico c'è un <b>fattore due e mezzo</b>, e le ragioni sono strutturali: chi fissa il prezzo marginale e quanto pesa il fisco.</li>
<li>«Energia cara» non è una proprietà del Paese ma della singola filiera: il Regno Unito ha elettricità carissima e gas fra i più economici.</li>
<li>Esistono <b>tre modelli di protezione</b> — tetto, tariffa regolata, niente — e il modello determina se ha senso un osservatorio indipendente.</li>
<li>La <b>Francia dimostra che la funzione di benchmark indipendente è necessaria</b>: dove il mercato non la produce, la produce il regolatore. Dove non la produce nessuno, il posto è libero.</li>
<li>L'<b>Italia è l'unico mercato con una banca dati pubblica completa delle offerte</b>. È un vantaggio che avete solo in casa e che non ritroverete altrove.</li>
</ul>
<p class="src" style="margin-top:6mm"><b>Fonti.</b> Eurostat, statistiche sui prezzi di elettricità
e gas, secondo semestre 2025 · Ofgem, price cap ottobre-dicembre 2026 e State of the Market
gennaio 2026 · ARERA per i prezzi di riferimento italiani · CRE ed EDF per le tariffe francesi ·
CNMC e OMIE per la Spagna · Bundesnetzagentur e rilevazioni di mercato per la Germania ·
U.S. Energy Information Administration per gli Stati Uniti · TEPCO e METI per il Giappone ·
cambi Frankfurter/BCE al 1° settembre 2026. Dati raccolti a settembre 2026.</p>
</section>""")

open(f"{OUT}rep_confronto.html","w",encoding="utf-8").write(page("Sette mercati a confronto", "".join(b)))
print("confronto generato")

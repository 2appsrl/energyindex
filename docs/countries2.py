import sys
sys.path.insert(0, "/private/tmp/claude-501/-Users-semronzoni-Desktop-1RangerDea-Claude-EnergyIndex/fa87b8e7-f437-43c9-b37c-6c91605ce8d6/scratchpad")
from report_lib import *

MET = ("Documento interno · settembre 2026 · Dati pubblici, fonti citate in fondo al documento. "
       "I prezzi energetici cambiano con frequenza almeno trimestrale: le cifre vanno rilette con la data accanto.")
OUT = "/private/tmp/claude-501/-Users-semronzoni-Desktop-1RangerDea-Claude-EnergyIndex/fa87b8e7-f437-43c9-b37c-6c91605ce8d6/scratchpad/"
R = []

# ═══════════════════════════ GERMANIA ═══════════════════════════
b = []
b.append(cover("Energy Index · Ricerca di mercato", "Il mercato dell'energia<br/>in Germania",
  "Come è fatta una bolletta luce e gas, domestica e business. Il mercato più frammentato "
  "d'Europa, dove non esiste alcun prezzo regolato e le tasse pesano un terzo del conto.",
  [("33,4 ct","al kWh, tariffe con<br/>garanzia 12 mesi"),
   ("33,9%","peso di tasse<br/>e oneri"),
   ("~1.000","fornitori attivi,<br/>quasi tutti municipali"),
   ("9,3 ct","costo di rete<br/>al kWh, −15%")], MET))

b.append(f"""<section><h2><span class="n">01</span>Come è organizzato il mercato</h2><div class="rule"></div>
<p class="lead">La Germania è l'opposto della Francia: nessun prezzo regolato, nessun operatore
dominante, e un panorama di fornitori così frammentato da non avere paragoni in Europa.</p>
<table>
<tr><th style="width:34mm">Anello</th><th>Chi c'è</th><th>Come si forma il prezzo</th></tr>
<tr><td><b>Generazione</b></td><td>Eolico e solare in quota molto alta, carbone in uscita, gas, nucleare ormai spento</td>
<td>Borsa EPEX SPOT. L'alta penetrazione rinnovabile produce forte volatilità, con prezzi negativi frequenti nelle ore di sole e vento</td></tr>
<tr><td><b>Rete</b></td><td>Quattro operatori di trasmissione, centinaia di distributori locali</td>
<td><b>Netzentgelte</b> regolate, molto diverse da zona a zona: il Nord ventoso paga di più per le reti</td></tr>
<tr><td><b>Vendita</b></td><td>I grandi gruppi — E.ON, EnBW, Vattenfall — accanto a circa <b>mille Stadtwerke</b>, le utility municipali</td>
<td>Totalmente libero. Nessuna tariffa amministrata: esiste solo la <b>Grundversorgung</b>, la fornitura di base che si applica a chi non ha mai scelto</td></tr>
<tr><td><b>Cliente</b></td><td>Oltre 40 milioni di famiglie</td>
<td>Sceglie liberamente. Il confronto fra offerte è uno sport nazionale, sostenuto da comparatori molto usati</td></tr>
</table>
<div class="box"><b>La particolarità tedesca: nessuno fissa il prezzo.</b> A differenza di Regno
Unito, Francia, Spagna e Italia, in Germania <b>non esiste alcun tetto né tariffa di riferimento</b>.
Il Bundesnetzagentur regola le reti e vigila sul mercato, ma non tocca il prezzo finale. L'unica
rete di protezione è la Grundversorgung, la fornitura di base garantita dal fornitore storico
locale — che però è quasi sempre <b>la tariffa più cara disponibile</b>. In Germania non scegliere
è la scelta più costosa, ed è l'esatto contrario del meccanismo britannico.</div>
</section>""")

b.append(f"""<section><h2><span class="n">02</span>La bolletta domestica <span class="tag">B2C</span></h2><div class="rule"></div>
<p class="lead">Struttura semplice — quota fissa mensile più prezzo al kWh — ma con un carico
fiscale che è il tratto distintivo del mercato tedesco.</p>
<div class="kpi">
<div><b>33,43 ct</b><span>al kWh, tariffe con<br/>garanzia dodici mesi</span></div>
<div><b>24,6 ct</b><span>al kWh, migliori offerte<br/>per nuovi clienti</span></div>
<div><b>15,4 ct</b><span>costo di approvvigionamento<br/>dell'energia</span></div>
<div><b>19%</b><span>IVA</span></div>
</div>
<div class="box warn"><b>Quasi nove centesimi di differenza fra chi sceglie e chi no.</b>
La forbice fra i 33,43 centesimi delle tariffe consolidate e i 24,6 centesimi delle migliori
offerte per nuovi clienti è enorme: su un consumo familiare tipico significa parecchie centinaia
di euro l'anno. In un mercato senza prezzo regolato, la differenza fra il cliente attento e quello
inerte è molto più grande che altrove — ed è la ragione per cui i comparatori tedeschi hanno tanto
peso.</div>
<h3>Come si compone il prezzo</h3>
<div class="fig">{stacked([("Approvvigionamento e vendita",41.3,ELEC),("Reti e misura",24.8,CYAN),("Tasse, imposte e oneri",33.9,VIO)])}
<div class="cap">Composizione del prezzo dell'elettricità per uso domestico, 2026. Fonte:
rilevazioni di mercato tedesche su dati Bundesnetzagentur.</div></div>
<p>Un terzo del conto sono tasse e oneri: IVA al 19%, imposta sull'elettricità, contributo di
concessione ai Comuni e una serie di prelievi che finanziano cogenerazione, allacciamenti offshore
e sconti agli energivori. La vecchia <b>EEG-Umlage</b>, l'onere per le rinnovabili che a lungo è
stata la voce più pesante, è stata abolita nel 2022 e spostata sul bilancio federale — un
trasferimento del costo dalla bolletta alle imposte generali.</p>
<h3>Le reti costano meno grazie a un intervento pubblico</h3>
<p>Nel 2026 i costi di rete scendono a una media di <b>9,3 centesimi al kWh</b>, circa il 15% in
meno dell'anno precedente. La riduzione non è un fatto di mercato ma una scelta politica: il
Governo federale ha iniziato a sussidiare le tariffe di rete, con un risparmio stimato fino a
<b>cento euro l'anno</b> per famiglia.</p>
</section>""")

b.append(f"""<section><h2><span class="n">03</span>Il gas</h2><div class="rule"></div>
<p class="lead">Il gas tedesco paga il conto più salato d'Europa occidentale in termini di
dipendenza storica: fino al 2022 arrivava in larghissima parte dalla Russia via gasdotto.</p>
<div class="fig">{bars_v([("Spagna",0.0858,ELEC),("Germania",0.1198,NAVY),("Media UE",0.1228,MUTED),("Italia",0.1481,GAS),("Paesi Bassi",0.1719,RED)]," €",4,"€/kWh famiglie")}
<div class="cap">Prezzo del gas per uso domestico, euro al kWh, tutto incluso. Fonte: Eurostat;
Germania e Spagna convertite da euro per gigajoule.</div></div>
<p>La struttura della bolletta gas ricalca quella elettrica: <b>Grundpreis</b> mensile più
<b>Arbeitspreis</b> al kWh. Sopra si sommano l'imposta sull'energia, gli oneri di stoccaggio
introdotti dopo la crisi per finanziare il riempimento dei depositi, e soprattutto il
<b>prezzo nazionale della CO2</b> sui combustibili da riscaldamento, che cresce ogni anno secondo
una traiettoria fissata per legge. È una voce destinata a pesare sempre di più e che rende il
riscaldamento a gas progressivamente meno competitivo rispetto alla pompa di calore — che è
esattamente l'effetto voluto.</p>
</section>""")

b.append(f"""<section><h2><span class="n">04</span>La bolletta business <span class="tag gas">B2B</span></h2><div class="rule"></div>
<table>
<tr><th style="width:38mm">Aspetto</th><th>Famiglie</th><th>Imprese</th></tr>
<tr><td><b>Prezzo regolato</b></td><td>Nessuno, solo Grundversorgung come default</td><td><b>Nessuno.</b> Tutto negoziato</td></tr>
<tr><td><b>IVA</b></td><td>19%, non recuperabile</td><td>19%, detraibile</td></tr>
<tr><td><b>Oneri</b></td><td>Pieni</td><td>Forti <b>esenzioni per gli energivori</b>: le imprese a consumo intensivo pagano una frazione degli oneri di rete e dei prelievi, un regime storicamente contestato in sede europea</td></tr>
<tr><td><b>Struttura</b></td><td>Quota fissa + prezzo al kWh</td><td>Sopra una certa soglia si aggiunge il <b>Leistungspreis</b>, un corrispettivo sulla punta di potenza prelevata</td></tr>
</table>
<div class="box"><b>Dove si gioca la partita per un'impresa tedesca.</b> Non nel prezzo
dell'energia ma nella <b>punta di potenza</b>: superare per pochi quarti d'ora la punta abituale
può far salire il costo annuale in modo sproporzionato. Da qui l'enorme diffusione di sistemi di
<i>peak shaving</i> e di gestione dei carichi nell'industria tedesca. È un mercato dove i dati di
consumo ad alta frequenza hanno un valore economico immediato e riconosciuto.</div>
</section>""")

b.append(f"""<section><h2><span class="n">05</span>Chi vende energia</h2><div class="rule"></div>
<p class="lead">Nessun operatore domina: è il mercato più frammentato d'Europa, e la ragione è
storica.</p>
<p>Accanto ai grandi gruppi — <b>E.ON</b>, <b>EnBW</b>, <b>Vattenfall</b>, con RWE concentrata
sulla generazione — operano circa <b>mille Stadtwerke</b>, le aziende municipalizzate che in molte
città tedesche gestiscono elettricità, gas, acqua e talvolta trasporti. Sono radicate nel
territorio, spesso di proprietà comunale, e godono di una fedeltà del cliente che nessun operatore
nazionale riesce a scalfire del tutto.</p>
<p>La conseguenza pratica è che <b>non esiste un prezzo tedesco</b>: esistono migliaia di listini
locali, e il prezzo che una famiglia paga dipende in modo determinante dalla città in cui vive e
dal fornitore storico di quella città.</p>
<div class="box"><b>Cosa significa per un osservatorio prezzi.</b> La frammentazione è insieme
l'ostacolo e l'opportunità. Ostacolo, perché costruire un confronto completo significa raccogliere
listini da centinaia di operatori, senza alcuna banca dati pubblica che li aggreghi — non esiste
un equivalente del portale ARERA italiano. Opportunità, perché proprio in un mercato così
disordinato la trasparenza vale di più: <b>il divario fra chi sceglie e chi non sceglie è di quasi
nove centesimi al kWh</b>, il più ampio fra i mercati esaminati.</div>
<h3>In sintesi, le cinque cose da ricordare</h3>
<ul>
<li><b>Nessun prezzo regolato</b>: l'unica protezione è la fornitura di base, che è quasi sempre la tariffa più cara.</li>
<li>Un terzo della bolletta sono <b>tasse e oneri</b>: il carico fiscale più alto fra i mercati analizzati.</li>
<li>Il mercato è <b>frammentato in circa mille fornitori</b>, in larga parte municipali: non esiste un prezzo nazionale.</li>
<li>Le reti nel 2026 costano il 15% in meno, ma per <b>decisione politica</b>, non per dinamica di mercato.</li>
<li>Per le imprese la variabile critica non è il prezzo ma la <b>punta di potenza</b>.</li>
</ul>
<p class="src" style="margin-top:6mm"><b>Fonti.</b> Bundesnetzagentur per reti e monitoraggio del
mercato · rilevazioni di mercato tedesche sulla composizione del prezzo 2026 · Eurostat per i
prezzi gas comparati · comparatori tedeschi per le offerte a nuovi clienti. Dati aggiornati a
settembre 2026.</p>
</section>""")
R.append(("germania", "Mercato energia Germania", "".join(b)))

# ═══════════════════════════ STATI UNITI ═══════════════════════════
b = []
b.append(cover("Energy Index · Ricerca di mercato", "Il mercato dell'energia<br/>negli Stati Uniti",
  "Come è fatta una bolletta luce e gas, domestica e business. Perché parlare di «mercato "
  "americano» al singolare è fuorviante: sono cinquanta mercati con regole diverse.",
  [("18,44 ¢","al kWh, media<br/>residenziale nazionale"),
   ("12,35–52 ¢","escursione fra<br/>Idaho e Hawaii"),
   ("+6,2%","in un anno"),
   ("50","mercati regolati<br/>separatamente")], MET))

b.append(f"""<section><h2><span class="n">01</span>Non esiste un mercato americano</h2><div class="rule"></div>
<p class="lead">È la premessa da cui parte qualunque ragionamento serio: negli Stati Uniti la
regolazione dell'energia al dettaglio è competenza dei singoli Stati, e gli Stati hanno fatto
scelte opposte.</p>
<table>
<tr><th style="width:42mm">Modello</th><th>Come funziona</th><th>Dove</th></tr>
<tr><td><b>Stati regolamentati</b></td><td>Un'unica utility verticalmente integrata produce, trasporta e vende. Le tariffe le approva la commissione statale in udienze pubbliche. Il cliente <b>non può scegliere</b> il fornitore</td>
<td>La maggioranza degli Stati, soprattutto Sud-Est e Ovest</td></tr>
<tr><td><b>Stati liberalizzati</b></td><td>La rete resta al monopolista regolato, ma la vendita è aperta: il cliente sceglie fra decine di operatori. La bolletta separa <b>trasporto</b> e <b>fornitura</b></td>
<td>Texas, Pennsylvania, Ohio, Illinois, New York, Massachusetts e altri</td></tr>
</table>
<div class="box"><b>Il caso Texas è a sé.</b> ERCOT, la rete texana, è deliberatamente isolata
dalle due grandi interconnessioni nazionali per restare fuori dalla giurisdizione federale. Ha il
mercato retail più competitivo del Paese, con <b>oltre cento operatori</b> e un livello di
concorrenza che comprime i prezzi, ma anche la fragilità che si è vista durante la tempesta
invernale del 2021.</p></div>
<ul>
<li><b>FERC</b> — l'autorità federale: regola il mercato all'ingrosso e il trasporto interstatale, non le tariffe al dettaglio.</li>
<li><b>Commissioni statali</b> — approvano le tariffe residenziali Stato per Stato, con procedimenti pubblici che durano mesi.</li>
<li><b>EIA</b> — l'agenzia federale di statistica: pubblica gratuitamente dati eccellenti su prezzi per Stato, per settore e per mese. È probabilmente la migliore fonte pubblica di dati energetici al mondo.</li>
</ul>
</section>""")

us_states = [("Idaho",12.35),("Media|nazionale",18.44),("Nordest|(media)",25.91),("Hawaii",52.00)]
b.append(f"""<section><h2><span class="n">02</span>Quanto pagano gli americani</h2><div class="rule"></div>
<p class="lead">La media nazionale dice poco: fra lo Stato più economico e quello più caro c'è un
fattore quattro.</p>
<div class="fig">{bars_v([(n,v,(ELEC if i==0 else NAVY if i==1 else GAS if i==2 else RED)) for i,(n,v) in enumerate(us_states)]," ¢",2,"centesimi per kWh")}
<div class="cap">Prezzo medio residenziale dell'elettricità, centesimi di dollaro per kWh,
settembre 2026. Fonte: elaborazioni su dati EIA.</div></div>
<div class="kpi">
<div><b>18,44 ¢</b><span>media nazionale<br/>residenziale</span></div>
<div><b>+6,2%</b><span>rispetto a<br/>un anno prima</span></div>
<div><b>25,91 ¢</b><span>Nordest, la regione<br/>più cara: +38%</span></div>
<div><b>52,00 ¢</b><span>Hawaii: +182%<br/>sulla media</span></div>
</div>
<h3>Perché le differenze sono così grandi</h3>
<ul>
<li><b>Mix di generazione</b> — chi ha idroelettrico abbondante, come il Nord-Ovest, paga poco; chi brucia petrolio importato, come le Hawaii, paga moltissimo.</li>
<li><b>Isolamento</b> — le Hawaii non sono connesse a nessuna rete continentale: ogni kWh nasce sull'isola.</li>
<li><b>Densità</b> — servire clienti dispersi su territori vasti costa di più in rete.</li>
<li><b>Scelte regolatorie</b> — quanto la commissione statale consente all'utility di recuperare in tariffa cambia il conto finale.</li>
</ul>
<h3>Come è fatta una bolletta americana</h3>
<table>
<tr><th style="width:44mm">Voce</th><th>Cosa copre</th></tr>
<tr><td><b>Customer charge</b></td><td>Quota fissa mensile in dollari, indipendente dal consumo</td></tr>
<tr><td><b>Energy / supply charge</b></td><td>L'energia consumata, in ¢/kWh. Negli Stati liberalizzati è la voce che si può cambiare scegliendo un altro fornitore</td></tr>
<tr><td><b>Delivery / distribution</b></td><td>Trasporto e distribuzione: resta al monopolista locale anche dove il mercato è aperto</td></tr>
<tr><td><b>Tasse e supplementi</b></td><td>Imposte statali e locali, più eventuali oneri per efficienza energetica e programmi sociali</td></tr>
</table>
<p>Molte utility applicano <b>scaglioni crescenti</b>, in cui il prezzo sale oltre certe soglie di
consumo, oppure tariffe orarie che distinguono le ore di punta. La California è il laboratorio più
avanzato su questo fronte, con tariffe che penalizzano fortemente i consumi nel tardo pomeriggio
estivo, quando il solare cala e la domanda dei condizionatori esplode.</p>
</section>""")

b.append(f"""<section><h2><span class="n">03</span>Gas e settore business</h2><div class="rule"></div>
<p class="lead">Sul gas gli Stati Uniti giocano un campionato diverso da quello europeo: sono il
primo produttore mondiale, e i prezzi interni lo riflettono.</p>
<p>La produzione da scisto ha reso il gas americano strutturalmente più economico di quello
europeo, con conseguenze che vanno ben oltre la bolletta: è uno dei fattori del divario di
competitività industriale fra le due sponde dell'Atlantico. Il gas domestico viene fatturato in
<b>therm</b> o in <b>Mcf</b>, unità di misura del contenuto energetico e del volume che non hanno
equivalente diretto nel sistema europeo, e distribuito da utility locali regolate a livello statale.</p>
<h3>Il settore business</h3>
<table>
<tr><th style="width:38mm">Aspetto</th><th>Residenziale</th><th>Commerciale e industriale</th></tr>
<tr><td><b>Prezzo</b></td><td>18,44 ¢/kWh in media</td><td>Sensibilmente più basso: la grande industria paga una frazione del prezzo residenziale</td></tr>
<tr><td><b>Struttura</b></td><td>Quota fissa + energia + trasporto</td><td>Si aggiunge il <b>demand charge</b>, un corrispettivo sulla punta di potenza che in molti casi pesa più dell'energia stessa</td></tr>
<tr><td><b>Scelta</b></td><td>Solo negli Stati liberalizzati</td><td>Più diffusa: molti Stati aprono la scelta alle imprese anche dove i residenziali non ce l'hanno</td></tr>
</table>
<div class="box"><b>Il demand charge è la specificità americana.</b> Un'impresa non paga solo
quanta energia consuma, ma anche quanto è alto il suo <b>picco di prelievo</b> nel mese, misurato
tipicamente su intervalli di quindici minuti. Un singolo quarto d'ora anomalo può determinare una
quota rilevante della bolletta mensile. È la ragione per cui il mercato americano dello storage a
batteria commerciale è cresciuto molto prima di quello europeo: la batteria non serve a risparmiare
energia, serve a tagliare il picco.</div>
</section>""")

b.append(f"""<section><h2><span class="n">04</span>Chi vende energia e dove sta andando</h2><div class="rule"></div>
<p>Il panorama è composto da <b>utility private quotate</b> — gruppi come NextEra, Duke, Southern,
Dominion, Exelon, American Electric Power — affiancate da <b>utility municipali</b> di proprietà
pubblica e da <b>cooperative elettriche</b> che servono gran parte delle aree rurali, nate con
l'elettrificazione delle campagne negli anni Trenta. Negli Stati liberalizzati si aggiungono i
<i>retail energy providers</i>, che comprano all'ingrosso e rivendono senza possedere reti.</p>
<h3>Le tre dinamiche in corso</h3>
<ul>
<li><b>I data center stanno cambiando la domanda.</b> Dopo vent'anni di consumi elettrici piatti, la crescita dei centri di calcolo sta facendo risalire la domanda in modo netto in alcune aree, con ricadute sui prezzi e sulle richieste di nuova capacità.</li>
<li><b>I prezzi risalgono.</b> Il +6,2% su base annua riflette investimenti in rete, adeguamento agli eventi climatici estremi e maggiore domanda: dopo anni di stabilità, la bolletta americana è tornata a essere un tema politico.</li>
<li><b>Il divario territoriale si allarga.</b> Le regioni con reti vecchie e forte esposizione a uragani e incendi scaricano in tariffa costi di resilienza che altrove non esistono.</li>
</ul>
<div class="box"><b>Cosa significa per un osservatorio prezzi.</b> Gli Stati Uniti hanno la
migliore disponibilità di dati pubblici gratuiti al mondo: l'EIA pubblica prezzi per Stato,
settore e mese con API aperte e documentate, e i gestori di rete come ERCOT, PJM e CAISO
espongono prezzi nodali in tempo reale. Il problema non è la scarsità dei dati ma la
<b>frammentazione regolatoria</b>: un confronto fra offerte ha senso solo dentro un singolo Stato
liberalizzato, e ogni Stato è di fatto un progetto a sé. Chi vuole entrare deve scegliere <b>uno
Stato</b>, non un Paese — e il Texas è il candidato naturale, per numero di operatori e apertura
del mercato.</div>
<h3>In sintesi, le cinque cose da ricordare</h3>
<ul>
<li>Non esiste un mercato americano: esistono <b>Stati regolamentati</b>, dove non si può scegliere il fornitore, e Stati liberalizzati.</li>
<li>Fra lo Stato più economico e quello più caro c'è un <b>fattore quattro</b>: dai 12,35 ai 52 centesimi.</li>
<li>La bolletta separa quota fissa, energia e trasporto; solo l'energia è contendibile.</li>
<li>Per le imprese la voce decisiva è il <b>demand charge</b> sulla punta di potenza, non il prezzo dell'energia.</li>
<li>I dati pubblici sono eccellenti e gratuiti, ma la frammentazione impone di scegliere un singolo Stato.</li>
</ul>
<p class="src" style="margin-top:6mm"><b>Fonti.</b> U.S. Energy Information Administration per
prezzi medi per Stato e settore · rilevazioni di mercato su tariffe residenziali, settembre 2026 ·
documentazione ERCOT, PJM e CAISO per la struttura dei mercati all'ingrosso. Dati aggiornati a
settembre 2026.</p>
</section>""")
R.append(("usa", "Mercato energia Stati Uniti", "".join(b)))

# ═══════════════════════════ GIAPPONE ═══════════════════════════
jp_tiers = [("fino a|120 kWh",29.80,ELEC),("da 120|a 300 kWh",36.60,NAVY),("oltre|300 kWh",40.49,RED)]
b = []
b.append(cover("Energy Index · Ricerca di mercato", "Il mercato dell'energia<br/>in Giappone",
  "Come è fatta una bolletta luce e gas, domestica e business. Un mercato liberalizzato da "
  "dieci anni ma ancora dominato dai dieci monopolisti regionali storici.",
  [("¥29,8–40,5","al kWh, tre scaglioni<br/>crescenti"),
   ("¥1.144","quota fissa mensile<br/>contratto 40 ampere"),
   ("10","ex monopolisti<br/>regionali"),
   ("2016","apertura del mercato<br/>alle famiglie")], MET))

b.append(f"""<section><h2><span class="n">01</span>Come è organizzato il mercato</h2><div class="rule"></div>
<p class="lead">Il Giappone ha liberalizzato tardi e in modo graduale. La struttura regionale
ereditata dal monopolio pesa ancora su tutto.</p>
<table>
<tr><th style="width:34mm">Anello</th><th>Chi c'è</th><th>Come si forma il prezzo</th></tr>
<tr><td><b>Generazione</b></td><td>Forte dipendenza da gas naturale liquefatto e carbone importati; nucleare in lenta riattivazione dopo Fukushima; solare in crescita</td>
<td>Borsa <b>JEPX</b>. La dipendenza dalle importazioni rende il prezzo molto sensibile al cambio e al costo del GNL</td></tr>
<tr><td><b>Rete</b></td><td>Le società di rete separate dai dieci gruppi regionali, coordinate da <b>OCCTO</b></td>
<td>Tariffe regolate. Le connessioni fra regioni sono limitate, e il Paese è diviso fra <b>due frequenze diverse</b>, 50 e 60 hertz</td></tr>
<tr><td><b>Vendita</b></td><td>I dieci ex monopolisti — TEPCO, Kansai, Chubu, Kyushu e gli altri — più i <i>shin-denryoku</i>, i nuovi entranti</td>
<td>Libero dal 2016, ma con una <b>tariffa regolata di salvaguardia</b> ancora disponibile in bassa tensione</td></tr>
<tr><td><b>Cliente</b></td><td>Circa 60 milioni di contratti</td>
<td>Può scegliere, ma la quota degli storici resta preponderante</td></tr>
</table>
<div class="box"><b>Due frequenze, un problema.</b> Il Giappone orientale funziona a 50 hertz e
quello occidentale a 60, eredità delle prime forniture di macchinari tedeschi e americani nell'Ottocento.
Le due metà del Paese possono scambiarsi energia solo attraverso poche stazioni di conversione con
capacità limitata. È il motivo per cui una crisi di generazione in una regione non può essere
compensata liberamente dall'altra, e spiega la persistenza di mercati regionali molto distinti.</div>
</section>""")

b.append(f"""<section><h2><span class="n">02</span>La bolletta domestica <span class="tag">B2C</span></h2><div class="rule"></div>
<p class="lead">La bolletta giapponese ha quattro componenti, e due di queste non esistono in
nessun mercato europeo.</p>
<h3>Il prezzo cresce con il consumo</h3>
<div class="fig">{bars_v(jp_tiers," ¥",2,"yen per kWh, TEPCO")}
<div class="cap">Scaglioni tariffari standard TEPCO per uso domestico, yen per kWh. Il prezzo
unitario aumenta al crescere del consumo mensile. Fonte: TEPCO Energy Partner.</div></div>
<p>La progressività è deliberata: la tariffa è costruita per rendere costoso il consumo elevato,
in un Paese che dipende dalle importazioni per quasi tutta l'energia primaria. È l'opposto della
logica europea, dove il prezzo unitario è tendenzialmente piatto e semmai scende con i volumi.</p>
<h3>Le quattro voci</h3>
<table>
<tr><th style="width:46mm">Voce</th><th>Come funziona</th></tr>
<tr><td><b>Quota base</b><br/><span class="src">基本料金</span></td><td>Dipende dall'<b>amperaggio contrattato</b>, non dai kW: circa ¥1.144 al mese per un contratto da 40 ampere. Chi riduce l'amperaggio paga meno ogni mese</td></tr>
<tr><td><b>Consumo</b><br/><span class="src">電力量料金</span></td><td>Tre scaglioni crescenti</td></tr>
<tr><td><b>Adeguamento carburante</b><br/><span class="src">燃料費調整額</span></td><td>Correzione mensile, <b>positiva o negativa</b>, che ribalta sul cliente le variazioni del costo di GNL, carbone e petrolio con qualche mese di ritardo</td></tr>
<tr><td><b>Onere rinnovabili</b><br/><span class="src">再エネ賦課金</span></td><td>Circa ¥4 al kWh, finanzia gli incentivi al fotovoltaico</td></tr>
</table>
<div class="box warn"><b>L'adeguamento carburante è la voce che spiega tutto.</b> È un
meccanismo automatico che trasferisce sul consumatore le oscillazioni del costo dei combustibili
importati. Nei periodi di GNL a buon mercato riduce la bolletta; nel 2022-2023, con il crollo dello
yen e i prezzi del gas alle stelle, ha prodotto rincari così violenti da costringere il Governo a
introdurre <b>sussidi diretti</b>. Ad agosto 2026 è ancora attivo uno sconto pubblico di
<b>3,50 yen al kWh</b> per le utenze in bassa tensione: significa che il prezzo che i giapponesi
vedono in bolletta non è quello reale di mercato.</div>
</section>""")

b.append(f"""<section><h2><span class="n">03</span>Business, gas e prospettive</h2><div class="rule"></div>
<h3>Il settore business</h3>
<p>Per le imprese la liberalizzazione è arrivata prima, nel 2000 per l'alta tensione, e la
concorrenza è più matura. La struttura tariffaria aggiunge un corrispettivo sulla <b>potenza
massima prelevata</b>, calcolato tipicamente sul picco più alto degli ultimi dodici mesi: una punta
isolata continua quindi a pesare sulla bolletta per un anno intero. È un incentivo fortissimo al
controllo dei carichi, e ha reso il Giappone un mercato precoce per i sistemi di gestione
dell'energia negli edifici.</p>
<h3>Il gas</h3>
<p>Il mercato del gas domestico è stato liberalizzato nel 2017, un anno dopo l'elettricità. Il
Giappone è storicamente il primo o secondo importatore mondiale di <b>GNL</b>: non avendo gasdotti
internazionali, tutto il gas arriva via nave. La bolletta ha una struttura simile a quella
elettrica, con quota fissa, consumo a scaglioni e un adeguamento legato al costo della materia
prima importata. La penetrazione del gas nel riscaldamento è però molto più bassa che in Europa:
gran parte delle case giapponesi si scalda con climatizzatori elettrici, spesso stanza per stanza.</p>
<h3>Dove sta andando il mercato</h3>
<ul>
<li><b>I nuovi entranti hanno subito una selezione dura.</b> Dopo il boom seguito all'apertura del 2016, la crisi dei prezzi del 2022 ha spazzato via molti operatori privi di generazione propria, che compravano su JEPX e rivendevano a prezzo fisso. Gli ex monopolisti ne sono usciti rafforzati.</li>
<li><b>Il nucleare torna lentamente.</b> Ogni riattivazione di reattore riduce la dipendenza dal GNL e ha effetti diretti sui costi di sistema.</li>
<li><b>I sussidi pubblici distorcono il segnale di prezzo.</b> Con sconti governativi ancora attivi nel 2026, capire quale sia il prezzo «vero» richiede di scorporare l'intervento pubblico.</li>
</ul>
<div class="box"><b>Cosa significa per un osservatorio prezzi.</b> Il Giappone è il mercato più
difficile fra quelli esaminati: barriera linguistica, dati pubblici meno accessibili e meno
strutturati che in Europa e negli Stati Uniti, e un prezzo al consumo alterato da sussidi
governativi che cambiano nel tempo. In compenso la <b>logica a scaglioni</b> e l'adeguamento
carburante rendono il conto della bolletta molto meno intuitivo che altrove: c'è un bisogno reale
di strumenti che spieghino quanto si sta pagando e perché. È un mercato da valutare più avanti,
non da aggredire per primo.</div>
<h3>In sintesi, le cinque cose da ricordare</h3>
<ul>
<li>Il prezzo unitario <b>cresce con il consumo</b>, su tre scaglioni: l'opposto della logica europea.</li>
<li>La quota fissa dipende dall'<b>amperaggio contrattato</b>, non dalla potenza in kW.</li>
<li>L'<b>adeguamento carburante</b> ribalta automaticamente sul cliente il costo del GNL importato.</li>
<li>Il prezzo visibile in bolletta è <b>scontato da sussidi pubblici</b> tuttora attivi.</li>
<li>Il Paese è diviso fra <b>due frequenze elettriche</b>, il che limita gli scambi fra le sue due metà.</li>
</ul>
<p class="src" style="margin-top:6mm"><b>Fonti.</b> TEPCO Energy Partner per struttura tariffaria
e adeguamenti carburante 2026 · Kyushu Electric Power per la documentazione sul meccanismo di
adeguamento · METI e Commissione di vigilanza sui mercati elettrico e gas per l'assetto
regolatorio · JEPX per i prezzi di borsa. Dati aggiornati a settembre 2026.</p>
</section>""")
R.append(("giappone", "Mercato energia Giappone", "".join(b)))

for slug, title, body in R:
    open(f"{OUT}rep_{slug}.html","w",encoding="utf-8").write(page(title, body))
print("generati:", ", ".join(s for s,_,_ in R))

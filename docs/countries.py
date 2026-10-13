import sys
sys.path.insert(0, "/private/tmp/claude-501/-Users-semronzoni-Desktop-1RangerDea-Claude-EnergyIndex/fa87b8e7-f437-43c9-b37c-6c91605ce8d6/scratchpad")
from report_lib import *

MET = ("Documento interno · settembre 2026 · Dati pubblici, fonti citate in fondo al documento. "
       "I prezzi energetici cambiano con frequenza almeno trimestrale: le cifre vanno rilette con la data accanto.")
R = []   # (nomefile, titolo, html)

# ═══════════════════════════ SPAGNA ═══════════════════════════
es_hist = [("2021",0.106),("2022",0.169),("2023",0.126),("2024",0.093),("2025",0.101),("2026|(in corso)",0.110)]
b = []
b.append(cover("Energy Index · Ricerca di mercato", "Il mercato dell'energia<br/>in Spagna",
  "Come è fatta una bolletta luce e gas, domestica e business. Chi vende energia, "
  "quanto pagano i clienti e come funziona il mercato regolato più dinamico d'Europa.",
  [("0,19 €","prezzo medio finale<br/>luce al kWh, 2026"),
   ("28%","quota Endesa,<br/>primo operatore"),
   ("24%","ha cambiato fornitore<br/>nel 2024"),
   ("96","prezzi al giorno<br/>dal 2026")], MET))

b.append(f"""<section><h2><span class="n">01</span>Come è organizzato il mercato</h2><div class="rule"></div>
<p class="lead">La Spagna è il Paese europeo dove il prezzo all'ingrosso arriva più direttamente
in bolletta. Chi sta nel mercato regolato paga un prezzo che cambia ogni quarto d'ora.</p>
<table>
<tr><th style="width:34mm">Anello</th><th>Chi c'è</th><th>Come si forma il prezzo</th></tr>
<tr><td><b>Generazione</b></td><td>Forte peso di eolico e solare, nucleare in uscita programmata, idroelettrico, cicli combinati a gas</td>
<td>Borsa <b>OMIE</b>, condivisa con il Portogallo nel mercato iberico MIBEL. Dal 2026 le sessioni sono a <b>15 minuti</b>: 96 prezzi al giorno anziché 24</td></tr>
<tr><td><b>Rete</b></td><td>Red Eléctrica per la trasmissione, distributori regionali legati ai grandi gruppi</td>
<td>Pedaggi e oneri fissati dalla CNMC, uguali su tutto il territorio nazionale</td></tr>
<tr><td><b>Vendita</b></td><td>Comercializadoras libere, più le <b>Comercializadoras de Referencia</b> che possono offrire il prezzo regolato</td>
<td>Doppio binario: <b>PVPC</b> regolato e indicizzato, oppure mercato libero a prezzo negoziato</td></tr>
<tr><td><b>Cliente</b></td><td>Circa 28 milioni di punti di fornitura elettrici</td>
<td>Sceglie fra PVPC e mercato libero. L'autoconsumo pesa ormai il 5% della domanda</td></tr>
</table>
<div class="box"><b>La particolarità spagnola: il PVPC.</b> È una tariffa regolata ma
<b>non fissa</b>: segue il mercato ora per ora. Dopo la crisi del 2022 il meccanismo è stato
riformato per smorzare gli sbalzi, mescolando al prezzo spot una quota di contratti a termine
a tre, sei e dodici mesi. Resta comunque l'unico prezzo regolato d'Europa che si muove
quotidianamente: il consumatore spagnolo è abituato all'idea che l'energia costi diversamente
a seconda dell'ora, cosa che altrove è ancora una nicchia.</div>
<ul><li><b>CNMC</b> — il regolatore: fissa pedaggi e oneri, vigila sul mercato retail.</li>
<li><b>OMIE</b> — il gestore della borsa elettrica iberica, pubblica i prezzi orari e ora quartorari.</li>
<li><b>Red Eléctrica</b> — l'operatore di sistema, pubblica dati aperti su domanda e mix di generazione.</li></ul>
</section>""")

b.append(f"""<section><h2><span class="n">02</span>La bolletta domestica <span class="tag">B2C</span></h2><div class="rule"></div>
<p class="lead">La bolletta spagnola ha una struttura a due gambe che ricorda quella italiana,
con una differenza importante: si paga per la <b>potenza impegnata</b>, non solo per l'energia.</p>
<h3>Le voci che la compongono</h3>
<table>
<tr><th style="width:44mm">Voce</th><th>Come si calcola</th></tr>
<tr><td><b>Término de potencia</b></td><td>€/kW all'anno sulla potenza contrattata, su due fasce. È un costo che si paga anche a consumo zero: è il vero corrispettivo fisso</td></tr>
<tr><td><b>Término de energía</b></td><td>€/kWh consumato. Nel PVPC varia ogni quarto d'ora; nel mercato libero è fisso o indicizzato</td></tr>
<tr><td><b>Alquiler del contador</b></td><td>Noleggio del contatore, pochi euro l'anno</td></tr>
<tr><td><b>Impuesto eléctrico</b></td><td>Imposta sull'elettricità, applicata sulla somma di potenza ed energia</td></tr>
<tr><td><b>IVA</b></td><td>21%, tornata all'aliquota ordinaria dopo le riduzioni temporanee del periodo di crisi</td></tr>
</table>
<h3>Le tre fasce orarie</h3>
<p>La tariffa di accesso domestica, chiamata <b>2.0TD</b>, divide la giornata in tre fasce per
l'energia — <i>punta</i>, <i>llano</i> e <i>valle</i> — e in due per la potenza. Nei fine settimana
e nei festivi vale tutto il giorno la fascia più economica. È un sistema che premia chi sposta i
consumi, e spiega perché in Spagna lavastoviglie e lavatrici notturne siano un'abitudine diffusa.</p>
<div class="kpi">
<div><b>~0,11 €</b><span>componente energia<br/>media PVPC 2026</span></div>
<div><b>~0,19 €</b><span>prezzo finale al kWh<br/>tutto incluso</span></div>
<div><b>da 0,10 €</b><span>migliori offerte fisse<br/>sul mercato libero</span></div>
<div><b>21%</b><span>IVA sull'elettricità</span></div>
</div>
<div class="box warn"><b>Attenzione al confronto fra i due numeri.</b> Lo 0,11 € è la sola
componente energia; lo 0,19 € è quanto esce davvero dalla tasca una volta aggiunti potenza,
oneri e imposte. È una distinzione che i comparatori spagnoli tendono a sfumare, e che rende
difficile capire quanto si stia risparmiando davvero passando da una tariffa all'altra.</div>
<h3>Il prezzo dell'energia negli ultimi anni</h3>
<div class="fig">{timeline(es_hist, "€/kWh, componente energia", 3, hi="2026|(in corso)")}
<div class="cap">Prezzo medio annuo della componente energia nel mercato regolato, €/kWh.
Il 2022 riflette il picco della crisi del gas; il 2024 il minimo grazie a rinnovabili abbondanti
e domanda debole. Valori indicativi ricostruiti su medie annue.</div></div>
</section>""")

b.append(f"""<section><h2><span class="n">03</span>La bolletta business <span class="tag gas">B2B</span></h2><div class="rule"></div>
<p class="lead">Per le imprese non esiste alcun prezzo regolato: si negozia tutto, e la
struttura tariffaria diventa più articolata all'aumentare della potenza.</p>
<table>
<tr><th style="width:38mm">Aspetto</th><th>Famiglie</th><th>Imprese</th></tr>
<tr><td><b>Prezzo regolato</b></td><td>PVPC disponibile fino a 10 kW</td><td><b>Nessuno</b> sopra i 10 kW: solo mercato libero</td></tr>
<tr><td><b>Fasce orarie</b></td><td>Tre fasce (2.0TD)</td><td>Fino a <b>sei fasce</b> per le tariffe di media e alta tensione (3.0TD, 6.1TD)</td></tr>
<tr><td><b>Potenza</b></td><td>Due fasce di potenza contrattata</td><td>Sei fasce, con penali per i superamenti: la gestione della potenza diventa una voce di costo gestibile</td></tr>
<tr><td><b>IVA</b></td><td>21%, non recuperabile</td><td>21%, ma <b>detraibile</b></td></tr>
<tr><td><b>Durata</b></td><td>Libera, nessuna penale sul PVPC</td><td>Contratti annuali o pluriennali, spesso indicizzati a OMIE con uno spread</td></tr>
</table>
<div class="box"><b>Dove sta il margine di ottimizzazione per un'impresa spagnola.</b>
Non tanto nel prezzo dell'energia, che è quello di mercato per tutti, quanto nella
<b>potenza contrattata per fascia</b> e nella distribuzione dei consumi fra le sei fasce orarie.
Un'azienda che sposta i carichi e dimensiona bene la potenza può ridurre la bolletta senza
cambiare fornitore. È esattamente il tipo di analisi che richiede dati orari — e che nessuno
offre gratuitamente.</div>
</section>""")

b.append(f"""<section><h2><span class="n">04</span>Chi vende energia</h2><div class="rule"></div>
<p class="lead">Il mercato domestico resta concentrato nelle mani dei tre gruppi storici,
ma gli operatori indipendenti guadagnano quota ogni anno.</p>
<div class="two"><div><h3>Quote di vendita elettrica</h3>
{bars_h([("Endesa",28),("Iberdrola",23),("Naturgy",8),("Altri",41)], ELEC)}</div>
<div><h3>Numeri del mercato</h3>
<div style="font-size:9.6pt;line-height:1.85;padding-top:3mm">
<b>24%</b> dei consumatori ha cambiato fornitore nel 2024<br/>
<b>+48%</b> la crescita degli autoconsumatori<br/>
<b>5%</b> la quota di domanda coperta da autoconsumo<br/>
<b>×2</b> l'autoconsumo collettivo rispetto al 2023</div></div></div>
<div class="cap">Fonte: CNMC, informe di supervisione dei mercati retail di gas ed elettricità, 2024-2025.</div>
<h3>Un mercato che si muove</h3>
<p>Il dato più interessante non è la concentrazione ma la <b>mobilità</b>: quasi un cliente su
quattro cambia fornitore in un anno, una percentuale che nel Regno Unito si vede solo nei momenti
di annuncio del price cap e che in Italia è ancora più bassa. Il segmento domestico resta comunque
concentrato: le comercializadoras non tradizionali crescono in tutti i segmenti, ma partono da
lontano.</p>
<h3>L'autoconsumo è la vera trasformazione</h3>
<p>Con il 5% della domanda coperta da impianti di autoconsumo e una crescita del 48% in un anno,
la Spagna è il mercato europeo dove il fotovoltaico residenziale e industriale sta cambiando più
in fretta la fisionomia della domanda. L'autoconsumo collettivo — più famiglie o imprese che
condividono un impianto — è raddoppiato in dodici mesi.</p>
<div class="box"><b>Cosa significa per un osservatorio prezzi.</b> La Spagna è il mercato con
i dati pubblici più ricchi e accessibili d'Europa: OMIE pubblica i prezzi di borsa, Red Eléctrica
pubblica domanda e generazione in tempo reale con API aperte, e il PVPC è per definizione un dato
pubblico ufficiale. Il passaggio ai 96 prezzi giornalieri del 2026 moltiplica per quattro la
granularità disponibile. Il rovescio della medaglia è che <b>esistono già molti siti</b> che
mostrano il prezzo orario: il terreno è occupato, e per entrarci serve un angolo diverso dal
semplice «prezzo della luce oggi».</div>
</section>""")

b.append(f"""<section><h2><span class="n">05</span>Il gas</h2><div class="rule"></div>
<p class="lead">Sul gas la Spagna è messa molto meglio della media europea: è fra i mercati
occidentali dove le famiglie pagano meno.</p>
<div class="fig">{bars_v([("Ungheria|(minimo UE)",0.0340,ELEC),("Spagna",0.0858,NAVY),("Media UE",0.1228,MUTED),("Germania",0.1198,GAS),("Italia",0.1481,RED)],
" €",4,"€/kWh famiglie")}
<div class="cap">Prezzo del gas per uso domestico, euro al kWh, tutto incluso. Dati Eurostat,
secondo semestre 2025; Spagna e Germania convertite da euro per gigajoule (dicembre 2024).</div></div>
<p>Il gas domestico segue una logica simile all'elettricità: esiste una tariffa regolata per i
piccoli consumatori, la <b>TUR</b>, accanto alle offerte di mercato libero. La struttura della
bolletta ricalca quella elettrica, con un termine fisso legato allo scaglione di consumo e un
termine variabile al kWh, più imposta sugli idrocarburi e IVA al 21%.</p>
<p>La ragione strutturale del vantaggio spagnolo è la <b>diversificazione degli approvvigionamenti</b>:
la Spagna ha la più ampia capacità di rigassificazione d'Europa e importa da molte origini diverse,
il che l'ha resa meno vulnerabile allo shock del 2022 rispetto ai Paesi che dipendevano dai
gasdotti russi.</p>
</section>

<section><h2><span class="n">06</span>Dove sta andando il mercato</h2><div class="rule"></div>
<div class="kpi">
<div><b>96</b><span>prezzi al giorno<br/>dal 2026</span></div>
<div><b>5%</b><span>della domanda<br/>da autoconsumo</span></div>
<div><b>+48%</b><span>autoconsumatori<br/>in un anno</span></div>
<div><b>24%</b><span>tasso di cambio<br/>fornitore annuo</span></div>
</div>
<h3>Il quarto d'ora cambia le regole</h3>
<p>Dal 2026 il mercato elettrico spagnolo funziona a intervalli di quindici minuti anziché orari:
ogni giorno si pubblicano <b>96 prezzi</b>. È un cambiamento che moltiplica per quattro la
granularità disponibile e apre spazio a prodotti di flessibilità che prima non erano
rappresentabili in tariffa.</p>
<h3>L'autoconsumo è la trasformazione più profonda</h3>
<p>Con il 5% della domanda ormai coperta da impianti propri e una crescita del 48% in un anno,
la Spagna sta cambiando la fisionomia stessa della curva di carico. L'autoconsumo collettivo è
raddoppiato in dodici mesi.</p>
<h3>In sintesi, le cinque cose da ricordare</h3>
<ul>
<li>Il PVPC è l'unico prezzo regolato d'Europa che <b>cambia ogni quarto d'ora</b>: il consumatore spagnolo è già abituato ai prezzi variabili.</li>
<li>Si paga per la <b>potenza impegnata</b>, non solo per l'energia: è una voce che si paga anche a consumo zero.</li>
<li>Le tre fasce orarie premiano chi sposta i consumi, e il fine settimana è tutto in fascia economica.</li>
<li>Il mercato domestico è concentrato — Endesa, Iberdrola e Naturgy — ma con una <b>mobilità altissima</b>: un cliente su quattro cambia fornitore ogni anno.</li>
<li>Sul gas la Spagna è avvantaggiata grazie alla capacità di rigassificazione e alla diversificazione delle fonti.</li>
</ul>
<p class="src" style="margin-top:6mm"><b>Fonti.</b> CNMC, informi di supervisione dei mercati
minoristi e dei cambi di comercializador · OMIE per i prezzi di borsa · dati PVPC pubblicati
dalle Comercializadoras de Referencia · Eurostat per i prezzi gas comparati · rilevazioni OCU e
comparatori spagnoli per i prezzi finali di mercato libero. Dati aggiornati a settembre 2026.</p>
</section>""")
R.append(("spagna", "Mercato energia Spagna", "".join(b)))

# ═══════════════════════════ FRANCIA ═══════════════════════════
b = []
b.append(cover("Energy Index · Ricerca di mercato", "Il mercato dell'energia<br/>in Francia",
  "Come è fatta una bolletta luce e gas, domestica e business. Perché il nucleare rende "
  "la Francia un caso a parte, e cosa cambia ora che il meccanismo ARENH è finito.",
  [("0,20 €","tariffa regolata<br/>al kWh, opzione base"),
   ("190 €","abbonamento annuo<br/>contatore 6 kVA"),
   ("1.331 €","bolletta tipo annua<br/>5.700 kWh"),
   ("2","revisioni tariffarie<br/>l'anno")], MET))

b.append(f"""<section><h2><span class="n">01</span>Come è organizzato il mercato</h2><div class="rule"></div>
<p class="lead">La Francia è il mercato europeo più anomalo: liberalizzato sulla carta, ma
dominato da un operatore pubblico che produce la maggior parte dell'elettricità con il nucleare.</p>
<table>
<tr><th style="width:34mm">Anello</th><th>Chi c'è</th><th>Come si forma il prezzo</th></tr>
<tr><td><b>Generazione</b></td><td><b>EDF</b>, di proprietà pubblica, con il parco nucleare più grande d'Europa; idroelettrico, eolico e solare in crescita</td>
<td>Il costo del nucleare è largamente indipendente dal prezzo del gas: è la ragione per cui l'elettricità francese ha retto meglio alla crisi</td></tr>
<tr><td><b>Rete</b></td><td>RTE per la trasmissione, Enedis per la distribuzione (circa il 95% del territorio)</td>
<td><b>TURPE</b>, la tariffa di rete fissata dalla CRE</td></tr>
<tr><td><b>Vendita</b></td><td>EDF con le tariffe regolate, più Engie, TotalEnergies e operatori alternativi</td>
<td>Doppio binario: <b>TRV</b> regolato (Tarif Bleu) oppure offerte di mercato</td></tr>
<tr><td><b>Cliente</b></td><td>Circa 38 milioni di siti elettrici</td>
<td>Il TRV resta il riferimento psicologico anche per chi ha un'offerta di mercato</td></tr>
</table>
<div class="box"><b>Il grande cambiamento: la fine dell'ARENH.</b> Per oltre un decennio EDF è
stata obbligata a rivendere ai concorrenti una quota della sua produzione nucleare a un prezzo
politico, molto sotto mercato. Quel meccanismo, chiamato ARENH, <b>è terminato con il 2025</b>:
al suo posto è subentrato un accordo che lega il prezzo del nucleare a un riferimento di lungo
periodo con redistribuzione dei sovraprofitti. È la riforma più rilevante del mercato francese
degli ultimi vent'anni, e ridisegna la competitività degli operatori alternativi, che vivevano
in larga parte di quel prezzo agevolato.</div>
</section>""")

b.append(f"""<section><h2><span class="n">02</span>La bolletta domestica <span class="tag">B2C</span></h2><div class="rule"></div>
<p class="lead">Due voci come nel Regno Unito, ma con una differenza sostanziale: la parte fissa
non è uguale per tutti, dipende dalla <b>potenza sottoscritta</b>.</p>
<div class="kpi">
<div><b>0,2001 €</b><span>al kWh, opzione base<br/>contatore 3-6 kVA</span></div>
<div><b>0,1985 €</b><span>al kWh, opzione base<br/>contatore 9-36 kVA</span></div>
<div><b>15,86 €</b><span>abbonamento mensile<br/>6 kVA</span></div>
<div><b>20%</b><span>IVA sul consumo</span></div>
</div>
<h3>Come si costruisce la bolletta</h3>
<div class="calc"><span class="m">Abbonamento</span>   12 mesi × 15,86 € = <span class="a">190,32 €</span><br/>
<span class="m">Consumo</span>      5.700 kWh × 0,2001 € = <span class="g">1.140,57 €</span><br/>
<span class="m">──────────────────────────────────────────────</span><br/>
<span class="m">Bolletta tipo annua, IVA inclusa</span>    <b>≈ 1.331 €</b></div>
<h3>Le voci dietro il prezzo</h3>
<ul>
<li><b>Abonnement</b> — quota fissa che cresce con i kVA sottoscritti. Sovradimensionare la potenza costa ogni mese.</li>
<li><b>TURPE</b> — la tariffa di rete, incorporata nel prezzo, fissata dal regolatore.</li>
<li><b>Accise sull'elettricità</b> — l'imposta di consumo, che ha sostituito la vecchia CSPE. È la leva con cui il Governo ha ammortizzato la crisi, azzerandola e poi ripristinandola gradualmente.</li>
<li><b>CTA</b> — contributo che finanzia il regime previdenziale dei lavoratori del settore elettrico e gasiero.</li>
<li><b>IVA</b> — 20% sul consumo. Sull'abbonamento si applica un'aliquota ridotta.</li>
</ul>
<div class="box"><b>Base, Heures Creuses o Tempo.</b> Il cliente francese sceglie fra tre
strutture tariffarie: prezzo unico tutto il giorno, prezzo doppio con otto ore notturne
scontate, oppure <b>Tempo</b>, che assegna a ogni giorno dell'anno un colore — blu, bianco o
rosso — con prezzi che nei giorni rossi diventano molto alti. Tempo è un meccanismo di flessibilità
in uso da decenni, mentre altrove le tariffe dinamiche sono una novità recente: la Francia ha
un pubblico già educato all'idea che il prezzo cambi nel tempo.</div>
<h3>Le revisioni</h3>
<p>Le tariffe regolate si aggiornano <b>due volte l'anno</b>, a febbraio e ad agosto, ed è in
quelle due date che si concentra tutta l'attenzione mediatica. È un ritmo molto meno frequente
del trimestre britannico e dell'aggiornamento continuo spagnolo: rende il mercato francese più
prevedibile, e le notizie sui prezzi più concentrate.</p>
</section>""")

b.append(f"""<section><h2><span class="n">03</span>La bolletta business <span class="tag gas">B2B</span></h2><div class="rule"></div>
<p class="lead">Le tariffe regolate per le imprese sono state progressivamente abolite: oggi
sopravvivono solo per i clienti più piccoli.</p>
<table>
<tr><th style="width:38mm">Aspetto</th><th>Famiglie</th><th>Imprese</th></tr>
<tr><td><b>Tariffa regolata</b></td><td>TRV disponibile fino a 36 kVA</td><td>Solo microimprese sotto i 36 kVA; sopra, <b>esclusivamente mercato libero</b></td></tr>
<tr><td><b>Gas</b></td><td>TRV gas <b>abolito nel 2023</b>; resta un «prix repère» pubblicato dalla CRE come riferimento</td><td>Solo mercato libero</td></tr>
<tr><td><b>IVA</b></td><td>20%, non recuperabile</td><td>20%, detraibile</td></tr>
<tr><td><b>Struttura</b></td><td>Abbonamento + consumo</td><td>Prezzo negoziato, spesso con copertura a termine su più annualità</td></tr>
</table>
<div class="box warn"><b>Il «prix repère» è un'idea che vale la pena studiare.</b> Quando la
Francia ha abolito la tariffa regolata del gas, il regolatore non ha lasciato il vuoto: ha
iniziato a pubblicare mensilmente un <b>prezzo di riferimento</b>, non vincolante, che serve al
consumatore per capire se l'offerta che ha in mano è ragionevole. È esattamente la funzione che
un osservatorio indipendente può svolgere in un mercato dove nessuno la svolge — e in Francia
la svolge il regolatore stesso, il che dimostra che il bisogno è riconosciuto.</div>
</section>""")

b.append(f"""<section><h2><span class="n">04</span>Chi vende energia</h2><div class="rule"></div>
<p class="lead">EDF resta dominante nel segmento domestico, con una posizione che non ha
paragoni in Europa occidentale.</p>
<p>L'operatore storico serve tuttora la maggioranza delle famiglie francesi, in gran parte
attraverso la tariffa regolata. Gli sfidanti principali sono <b>Engie</b>, l'ex incumbent del
gas, e <b>TotalEnergies</b>, affiancati da operatori alternativi la cui competitività dipendeva
in misura significativa dall'accesso agevolato al nucleare tramite l'ARENH. Con la fine di quel
meccanismo, il posizionamento di questi operatori è tutto da ridefinire.</p>
<h3>Cosa rende la Francia diversa</h3>
<ul>
<li><b>Il prezzo non lo fa il gas.</b> Con un parco di generazione a prevalenza nucleare, il costo dell'elettricità francese è meno esposto alle oscillazioni del metano. Durante la crisi ciò ha protetto i consumatori, ma i problemi di disponibilità dei reattori nel 2022 hanno mostrato che la protezione non è automatica.</li>
<li><b>Lo Stato interviene direttamente.</b> Le tariffe regolate sono uno strumento di politica economica: nel biennio di crisi il Governo ha usato il «bouclier tarifaire» per limitare gli aumenti per decreto.</li>
<li><b>Il riscaldamento è elettrico.</b> Una quota molto alta di abitazioni francesi si scalda con l'elettricità, il che rende la domanda invernale fortemente sensibile alla temperatura e crea picchi che non si vedono altrove.</li>
</ul>
<div class="box"><b>Cosa significa per un osservatorio prezzi.</b> La Francia offre un dato
pubblico eccellente e centralizzato — le tariffe regolate e il prix repère della CRE sono
ufficiali, gratuiti e citabili — ma il ritmo semestrale delle revisioni rende poco interessante
un cruscotto «prezzo di oggi». Il valore, semmai, sta nel confronto fra offerte di mercato e
riferimento regolato, e nell'analisi dell'impatto della riforma post-ARENH: un terreno
analitico, più che informativo quotidiano.</div>
</section>""")

b.append(f"""<section><h2><span class="n">05</span>Il gas</h2><div class="rule"></div>
<p class="lead">Sul gas la Francia è sopra la media europea, e ha fatto una scelta regolatoria
che vale la pena studiare: abolire la tariffa regolata sostituendola con un riferimento pubblico.</p>
<div class="fig">{bars_v([("Spagna",0.0858,ELEC),("Media UE",0.1228,MUTED),("Parigi",0.1280,NAVY),("Italia",0.1481,RED),("Paesi Bassi",0.1719,GAS)],
" €",4,"€/kWh famiglie")}
<div class="cap">Prezzo del gas per uso domestico, euro al kWh, tutto incluso. Fonte: Eurostat,
secondo semestre 2025; il dato di Parigi è un rilevamento su capitali europee di inizio 2026.</div></div>
<h3>Dalla tariffa regolata al «prix repère»</h3>
<p>La tariffa regolata del gas è stata <b>abolita a luglio 2023</b>. Al suo posto la CRE pubblica
ogni mese un <b>prezzo di riferimento</b>: non è vincolante per nessun operatore, non protegge
nessuno, serve unicamente perché il consumatore possa capire se l'offerta che ha in mano è
ragionevole. È una soluzione elegante a un problema che tutti i mercati liberalizzati hanno —
in assenza di un prezzo amministrato, come fa una persona a sapere se sta pagando troppo?</p>
<p>Va sottolineato quanto sia rilevante come precedente: il regolatore francese ha
istituzionalizzato la funzione di <b>benchmark indipendente</b>, riconoscendo che il mercato da
solo non la produce.</p>
</section>

<section><h2><span class="n">06</span>Dove sta andando il mercato</h2><div class="rule"></div>
<div class="kpi">
<div><b>2025</b><span>anno di chiusura<br/>del meccanismo ARENH</span></div>
<div><b>2 volte</b><span>revisione tariffe<br/>l'anno, febbraio e agosto</span></div>
<div><b>2023</b><span>abolizione tariffa<br/>regolata gas</span></div>
<div><b>~38 mln</b><span>siti elettrici<br/>domestici</span></div>
</div>
<h3>La riforma del nucleare ridisegna la concorrenza</h3>
<p>La fine dell'ARENH è il fatto strutturale del momento. Per anni gli operatori alternativi hanno
costruito la propria offerta su elettricità nucleare acquistata a prezzo politico; ora quel canale
non esiste più nella vecchia forma. Il nuovo assetto lega il prezzo del nucleare a un riferimento
di lungo periodo con redistribuzione dei sovraprofitti sopra determinate soglie. Le conseguenze sui
prezzi al dettaglio si vedranno nelle revisioni dei prossimi trimestri.</p>
<h3>Il riscaldamento elettrico rende la domanda ipersensibile al freddo</h3>
<p>Una quota molto elevata di abitazioni francesi si scalda con l'elettricità. Questo produce
picchi di domanda invernali che non hanno paragone in Europa, e rende la Francia il Paese dove
la <b>temperatura</b> è la variabile predittiva più importante per il sistema elettrico.</p>
<h3>In sintesi, le cinque cose da ricordare</h3>
<ul>
<li>Il prezzo francese <b>non lo fa il gas</b>: con un parco a prevalenza nucleare, il costo è meno esposto alle oscillazioni del metano.</li>
<li>La quota fissa dipende dalla <b>potenza sottoscritta</b>: sovradimensionare il contatore costa ogni mese.</li>
<li>Le tariffe si rivedono <b>due volte l'anno</b>, a febbraio e agosto: molto meno frequente del trimestre britannico.</li>
<li>Con <b>Tempo</b> la Francia ha tariffe dinamiche da decenni: il pubblico è già educato all'idea che il prezzo cambi.</li>
<li>Sul gas il regolatore pubblica un <b>prezzo di riferimento</b> non vincolante: la funzione di benchmark indipendente è riconosciuta come necessaria.</li>
</ul>
<p class="src" style="margin-top:6mm"><b>Fonti.</b> CRE per le tariffe regolate, il TURPE e il
prix repère gas · EDF per i prezzi del Tarif Bleu in vigore dal 1° agosto 2026 · Eurostat per i
prezzi gas comparati · rilevazioni comparatori francesi per le offerte di mercato. Dati
aggiornati a settembre 2026.</p>
</section>""")
R.append(("francia", "Mercato energia Francia", "".join(b)))

for slug, title, body in R:
    open(f"/private/tmp/claude-501/-Users-semronzoni-Desktop-1RangerDea-Claude-EnergyIndex/fa87b8e7-f437-43c9-b37c-6c91605ce8d6/scratchpad/rep_{slug}.html","w",encoding="utf-8").write(page(title, body))
print("generati:", ", ".join(s for s,_,_ in R))

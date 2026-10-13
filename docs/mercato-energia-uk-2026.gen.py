# Genera il report HTML sul mercato energetico UK. Poi Chrome lo stampa in PDF.
import html

INK   = "#0f172a"; MUTED = "#64748b"; LINE = "#e2e8f0"; BG = "#f8fafc"
ELEC  = "#059669"; GAS = "#d97706"; RED = "#dc2626"; NAVY = "#0b2545"; ACC = "#0ea5e9"

# ── Dati (fonti: Ofgem, DESNZ, Commons Library) ───────────────────────────────
CAP = [  # (etichetta, £/anno, nota)
    ("Ott 2021", 1277, ""), ("Apr 2022", 1971, ""), ("Ott 2022", 3549, "EPG"),
    ("Gen 2023", 4279, "EPG"), ("Lug 2023", 2074, ""), ("Gen 2024", 1928, ""),
    ("Apr 2025", 1849, ""), ("Gen 2026", 1758, ""), ("Apr 2026", 1477, ""),
    ("Lug 2026", 1663, "TDCV"), ("Ott 2026", 1723, "TDCV"),
]
COMPOS = [("Energia all'ingrosso", 38, ELEC), ("Rete (fili e tubi)", 23, "#0891b2"),
          ("Oneri di politica energetica", 17, "#7c3aed"), ("Costi operativi fornitore", 10, "#f59e0b"),
          ("Morosità e amministrazione", 7, RED), ("Margine e altro", 5, MUTED)]
MS_EL = [("Octopus", 25), ("British Gas", 21), ("E.ON", 16), ("OVO", 12), ("EDF", 10), ("ScottishPower", 8), ("Altri", 8)]
MS_GA = [("British Gas", 27), ("Octopus", 25), ("E.ON", 13), ("OVO", 10), ("EDF", 9), ("ScottishPower", 7), ("Altri", 8)]

def esc(s): return html.escape(str(s))

# ── Grafico 1: storico price cap ──────────────────────────────────────────────
def chart_cap():
    W,H = 700, 300; PAD_L, PAD_B, PAD_T = 46, 44, 16
    mx = 4400; iw = W - PAD_L - 12; n = len(CAP); bw = iw/n*0.62; gap = iw/n
    p = [f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    for gv in (0,1000,2000,3000,4000):
        y = H-PAD_B-(gv/mx)*(H-PAD_B-PAD_T)
        p.append(f'<line x1="{PAD_L}" y1="{y:.1f}" x2="{W-8}" y2="{y:.1f}" stroke="{LINE}" stroke-width="1"/>')
        p.append(f'<text x="{PAD_L-8}" y="{y+3:.1f}" font-size="9" fill="{MUTED}" text-anchor="end">£{gv:,}</text>')
    # banda EPG
    ye = H-PAD_B-(2500/mx)*(H-PAD_B-PAD_T)
    p.append(f'<line x1="{PAD_L}" y1="{ye:.1f}" x2="{W-8}" y2="{ye:.1f}" stroke="{RED}" stroke-width="1.2" stroke-dasharray="4 3"/>')
    p.append(f'<text x="{W-10}" y="{ye-5:.1f}" font-size="8.5" fill="{RED}" text-anchor="end">tetto governativo EPG £2.500</text>')
    for i,(lab,v,note) in enumerate(CAP):
        x = PAD_L + i*gap + (gap-bw)/2
        bh = (v/mx)*(H-PAD_B-PAD_T); y = H-PAD_B-bh
        col = RED if v>2500 else (ELEC if i==len(CAP)-1 else NAVY)
        p.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{col}" rx="2"/>')
        p.append(f'<text x="{x+bw/2:.1f}" y="{y-4:.1f}" font-size="8.5" font-weight="700" fill="{INK}" text-anchor="middle">{v:,}</text>'.replace(",","."))
        p.append(f'<text x="{x+bw/2:.1f}" y="{H-PAD_B+13:.1f}" font-size="8" fill="{MUTED}" text-anchor="middle">{lab.split()[0]}</text>')
        p.append(f'<text x="{x+bw/2:.1f}" y="{H-PAD_B+24:.1f}" font-size="8" fill="{MUTED}" text-anchor="middle">{lab.split()[1]}</text>')
    p.append('</svg>')
    return "".join(p)

# ── Grafico 2: composizione bolletta (barra impilata) ─────────────────────────
def chart_compos():
    W,H = 700, 116; x = 0; bh = 44
    p=[f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    for lab,pct,col in COMPOS:
        w = pct/100*W
        p.append(f'<rect x="{x:.1f}" y="0" width="{w:.1f}" height="{bh}" fill="{col}"/>')
        if pct>=7:
            p.append(f'<text x="{x+w/2:.1f}" y="{bh/2+4:.1f}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">{pct}%</text>')
        x += w
    lx, ly = 0, bh+22
    for i,(lab,pct,col) in enumerate(COMPOS):
        if i==3: lx, ly = 0, ly+22
        p.append(f'<rect x="{lx}" y="{ly-8}" width="9" height="9" fill="{col}" rx="2"/>')
        p.append(f'<text x="{lx+14}" y="{ly}" font-size="9.5" fill="{INK}">{esc(lab)} <tspan fill="{MUTED}">{pct}%</tspan></text>')
        lx += 235
    p.append('</svg>')
    return "".join(p)

# ── Grafico 3: quote di mercato ───────────────────────────────────────────────
def chart_share(data, accent):
    W = 340; rowh = 26; H = len(data)*rowh + 6
    p=[f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    mx = max(v for _,v in data); barx = 116; barw = W-barx-34
    for i,(lab,v) in enumerate(data):
        y = i*rowh+4
        p.append(f'<text x="{barx-8}" y="{y+13}" font-size="9.5" fill="{INK}" text-anchor="end">{esc(lab)}</text>')
        w = v/mx*barw
        col = accent if i==0 else NAVY if lab!="Altri" else MUTED
        p.append(f'<rect x="{barx}" y="{y+3}" width="{w:.1f}" height="14" fill="{col}" rx="2"/>')
        p.append(f'<text x="{barx+w+6:.1f}" y="{y+14}" font-size="9.5" font-weight="700" fill="{INK}">{v}%</text>')
    p.append('</svg>')
    return "".join(p)

# ── Grafico 4: prezzo per fascia di consumo business ──────────────────────────
def chart_biz():
    rows = [("Microimpresa<br/>&lt; 20.000 kWh/anno", 34.31, RED),
            ("Media di tutte<br/>le imprese", 23.61, NAVY),
            ("Famiglia<br/>(price cap)", 26.32, ELEC)]
    W,H = 700, 126; bw = 92; gap = 150; x0 = 60; mx = 38
    p=[f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    base = 82
    for i,(lab,v,col) in enumerate(rows):
        x = x0+i*gap; bh = v/mx*66; y = base-bh
        p.append(f'<rect x="{x}" y="{y:.1f}" width="{bw}" height="{bh:.1f}" fill="{col}" rx="3"/>')
        p.append(f'<text x="{x+bw/2}" y="{y-6:.1f}" font-size="13" font-weight="700" fill="{INK}" text-anchor="middle">{str(v).replace(".",",")}p</text>')
        for j,part in enumerate(lab.split("<br/>")):
            p.append(f'<text x="{x+bw/2}" y="{base+15+j*11}" font-size="8.5" fill="{MUTED}" text-anchor="middle">{part.replace("&lt;","<")}</text>')
    p.append(f'<text x="{x0+3*gap+6}" y="46" font-size="9" fill="{MUTED}">pence per kWh</text>')
    p.append(f'<text x="{x0+3*gap+6}" y="60" font-size="9" fill="{MUTED}">elettricità</text>')
    p.append('</svg>')
    return "".join(p)

CSS = f"""
@page {{ size: A4; margin: 15mm 14mm 16mm 14mm; }}
@page cover {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ font-family: Helvetica, Arial, sans-serif; color:{INK}; font-size:10.2pt; line-height:1.5; margin:0; }}
h1,h2,h3 {{ margin:0; }}
/* Copertina a piena pagina: page:cover azzera i margini di stampa, il flex
   in colonna tiene il piede attaccato al fondo senza posizionamenti assoluti
   che sforerebbero l'area stampabile. */
.cover {{ page:cover; background:{NAVY}; color:#fff; width:210mm; height:297mm;
          padding:44mm 20mm 18mm; page-break-after:always; display:flex; flex-direction:column; }}
.cover .kicker {{ font-size:10pt; letter-spacing:.22em; text-transform:uppercase; color:#7dd3fc; }}
.cover h1 {{ font-size:34pt; line-height:1.1; margin:13mm 0 7mm; font-weight:800; letter-spacing:-.6pt; }}
.cover .sub {{ font-size:12.5pt; color:#cbd5e1; max-width:132mm; line-height:1.55; }}
.cover .accent {{ width:34mm; height:4px; background:{ELEC}; border-radius:2px; margin-top:16mm; }}
.cover .meta {{ margin-top:auto; font-size:8.6pt; color:#8fa3bd; line-height:1.6;
                border-top:1px solid #ffffff22; padding-top:5mm; }}
.cover .stats {{ display:flex; gap:7mm; margin-top:16mm; }}
.cover .stat {{ flex:1; }}
.cover .stat b {{ display:block; font-size:18pt; color:#fff; white-space:nowrap; letter-spacing:-.4pt; }}
.cover .stat span {{ font-size:8.2pt; color:#8fa3bd; line-height:1.4; display:block; margin-top:1.5mm; }}
/* Flusso continuo. Forzare una pagina nuova per sezione lasciava pagine-moncone
   quando una sezione sforava di poche righe; qui le sezioni scorrono e sono le
   regole break-* a impedire che un titolo resti orfano in fondo o che una
   tabella/figura venga spezzata a metà. */
section {{ margin-top:9mm; }}
section:first-of-type {{ margin-top:0; }}
h2, h3, .rule {{ break-after:avoid; page-break-after:avoid; }}
table, .box, .fig, .calc, .kpi, .two {{ break-inside:avoid; page-break-inside:avoid; }}
tr {{ break-inside:avoid; page-break-inside:avoid; }}
p {{ orphans:3; widows:3; }}
h2 {{ font-size:16pt; font-weight:800; letter-spacing:-.3pt; margin:0 0 1mm; }}
h2 .n {{ color:{ACC}; margin-right:3mm; }}
.rule {{ height:3px; background:{ELEC}; width:26mm; margin:2mm 0 5mm; border-radius:2px; }}
h3 {{ font-size:11.5pt; margin:6mm 0 2mm; }}
p {{ margin:0 0 3mm; }}
.lead {{ font-size:11pt; color:#334155; }}
table {{ width:100%; border-collapse:collapse; font-size:9.3pt; margin:3mm 0 4mm; }}
th {{ background:{NAVY}; color:#fff; text-align:left; padding:2.4mm 3mm; font-size:8.6pt;
      text-transform:uppercase; letter-spacing:.06em; }}
td {{ padding:2.2mm 3mm; border-bottom:1px solid {LINE}; vertical-align:top; }}
tr:nth-child(even) td {{ background:{BG}; }}
td.num, th.num {{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }}
.box {{ background:{BG}; border-left:3px solid {ELEC}; padding:4mm 5mm; margin:4mm 0; font-size:9.6pt; }}
.box b {{ color:{NAVY}; }}
.warn {{ background:#fffbeb; border-left-color:{GAS}; }}
.fig {{ margin:4mm 0 2mm; }}
.cap {{ font-size:8.2pt; color:{MUTED}; margin-top:1mm; }}
.two {{ display:flex; gap:8mm; }}
.two > div {{ flex:1; }}
.kpi {{ display:flex; gap:4mm; margin:4mm 0; }}
.kpi div {{ flex:1; border:1px solid {LINE}; border-radius:4px; padding:3.5mm; }}
.kpi b {{ display:block; font-size:17pt; color:{NAVY}; letter-spacing:-.5pt; }}
.kpi span {{ font-size:8.2pt; color:{MUTED}; line-height:1.35; display:block; margin-top:1mm; }}
.calc {{ font-family:"SF Mono",Menlo,monospace; font-size:9pt; background:{NAVY}; color:#e2e8f0;
         padding:4mm 5mm; border-radius:4px; margin:3mm 0; line-height:1.75; }}
.calc .g {{ color:#6ee7b7; }} .calc .a {{ color:#fbbf24; }} .calc .m {{ color:#94a3b8; }}
ul {{ margin:0 0 3mm; padding-left:5mm; }} li {{ margin-bottom:1.6mm; }}
.src {{ font-size:8.3pt; color:{MUTED}; }}
.tag {{ display:inline-block; background:{ELEC}; color:#fff; font-size:7.6pt; padding:.6mm 2mm;
        border-radius:3px; vertical-align:middle; letter-spacing:.04em; }}
.tag.gas {{ background:{GAS}; }} .tag.n {{ background:{MUTED}; }}
"""

def build():
    d = []
    d.append(f"""<div class="cover">
      <div class="kicker">Energy Index · Ricerca di mercato</div>
      <h1>Il mercato dell'energia<br/>nel Regno Unito</h1>
      <div class="sub">Come è fatta una bolletta luce e gas, domestica e business.
      Chi vende energia, quanto pagano davvero i clienti e come si sono mossi
      i prezzi dalla crisi a oggi.</div>
      <div class="accent"></div>
      <div class="stats">
        <div class="stat"><b>£1.723</b><span>price cap annuo<br/>famiglia tipo, ott–dic 2026</span></div>
        <div class="stat"><b>25%</b><span>quota Octopus,<br/>primo fornitore elettrico</span></div>
        <div class="stat"><b>+92%</b><span>elettricità imprese medie<br/>vs mediana UE</span></div>
        <div class="stat"><b>£4,48 mld</b><span>debito energetico<br/>famiglie, Q3 2025</span></div>
      </div>
      <div class="meta">Documento interno · agosto 2026 · Fonti: Ofgem (State of the Market, gennaio 2026;
      price cap ottobre 2026), DESNZ Quarterly Energy Prices, House of Commons Library.
      Tutti i dati sono pubblici e citati puntualmente nel testo.</div>
    </div>""")

    # 1 — struttura
    d.append(f"""<section class="cont">
      <h2><span class="n">01</span>Come è organizzato il mercato</h2><div class="rule"></div>
      <p class="lead">Il sistema britannico è liberalizzato in tutti i suoi anelli, ma con un regolatore
      che interviene direttamente sul prezzo finale alle famiglie. È la differenza più importante
      rispetto all'Italia.</p>

      <h3>I quattro anelli della catena</h3>
      <table>
        <tr><th style="width:32mm">Anello</th><th>Chi c'è</th><th>Come si forma il prezzo</th></tr>
        <tr><td><b>Generazione</b></td><td>Centrali a gas, nucleare, eolico offshore e onshore, solare, interconnessioni con Francia, Belgio, Norvegia e Paesi Bassi</td>
            <td>Mercato all'ingrosso. Il prezzo lo fissa l'impianto marginale, che nel Regno Unito è quasi sempre a <b>gas</b>: è la ragione strutturale per cui l'elettricità britannica costa cara</td></tr>
        <tr><td><b>Rete</b></td><td>NESO (operatore di sistema), National Grid per la trasmissione, 14 operatori regionali di distribuzione</td>
            <td>Tariffe regolate da Ofgem. Variano per regione: la stessa tariffa costa diversamente a Londra e in Scozia</td></tr>
        <tr><td><b>Vendita</b></td><td>Circa 20 fornitori attivi, di cui 6 coprono oltre il 90% del mercato domestico</td>
            <td>Libera, ma per le famiglie il prezzo è limitato dal <b>price cap</b> di Ofgem</td></tr>
        <tr><td><b>Cliente</b></td><td>~28 milioni di famiglie e circa 2 milioni di siti non domestici</td>
            <td>Tariffa variabile standard (protetta dal cap) oppure contratto a prezzo fisso</td></tr>
      </table>

      <div class="box"><b>Il concetto chiave: il price cap non è un tetto alla bolletta.</b>
      Ofgem non limita quanto paghi in totale: limita il <b>prezzo unitario</b> al kWh e la
      <b>quota fissa giornaliera</b>. Se consumi il doppio, paghi il doppio. La cifra di
      «£1.723 all'anno» che i giornali titolano è solo il risultato di quei prezzi applicati
      a un consumo convenzionale — non un importo garantito a nessuno.</div>

      <h3>Chi fa cosa</h3>
      <ul>
        <li><b>Ofgem</b> — il regolatore. Fissa il price cap ogni tre mesi, con annunci a febbraio, maggio, agosto e novembre, e vigila su fornitori e reti.</li>
        <li><b>DESNZ</b> — il ministero per la sicurezza energetica. Pubblica le statistiche ufficiali sui prezzi, incluse quelle del settore non domestico.</li>
        <li><b>NESO</b> — l'operatore del sistema elettrico, indipendente dal 2024. Pubblica dati aperti su domanda, mix di generazione e intensità di carbonio.</li>
        <li><b>Elexon</b> — gestisce il settlement del mercato elettrico e pubblica gratuitamente prezzi di sbilanciamento e dati di generazione mezz'ora per mezz'ora.</li>
      </ul>
    </section>""")

    # 2 — bolletta domestica
    d.append(f"""<section>
      <h2><span class="n">02</span>La bolletta domestica <span class="tag">B2C</span></h2><div class="rule"></div>
      <p class="lead">Una bolletta britannica ha una struttura molto più semplice di quella italiana:
      due voci per ciascuna fornitura, più l'IVA.</p>

      <div class="kpi">
        <div><b>26,32p</b><span>per kWh elettrico<br/>ott–dic 2026, addebito diretto</span></div>
        <div><b>54,83p</b><span>al giorno di quota fissa<br/>elettricità</span></div>
        <div><b>7,97p</b><span>per kWh gas</span></div>
        <div><b>29,68p</b><span>al giorno di quota fissa<br/>gas</span></div>
      </div>

      <h3>Da dove esce il numero che leggi sui giornali</h3>
      <p>Il famoso «£1.723 all'anno» non è una stima né una media di bollette reali: è un conto
      aritmetico che chiunque può rifare. Ofgem applica i prezzi massimi a un consumo convenzionale
      — chiamato TDCV — di 2.500 kWh di elettricità e 9.500 kWh di gas.</p>

      <div class="calc">
        <span class="m">Elettricità</span>  2.500 kWh × 26,32p = <span class="g">£658</span>  +  365 gg × 54,83p = <span class="a">£200</span>  →  <b>£858</b><br/>
        <span class="m">Gas</span>          9.500 kWh × 7,97p  = <span class="g">£757</span>  +  365 gg × 29,68p = <span class="a">£108</span>  →  <b>£865</b><br/>
        <span class="m">─────────────────────────────────────────────────────────────</span><br/>
        <span class="m">Totale annuo famiglia tipo</span>                        <b>£1.723</b>
      </div>

      <div class="box warn"><b>Attenzione a confrontare le serie storiche.</b>
      Da luglio 2026 Ofgem ha <b>abbassato il consumo convenzionale</b>: il gas da 11.500 a 9.500 kWh
      (−17%) e l'elettricità da 2.700 a 2.500 kWh (−7%). Significa che i £1.663 di luglio 2026 e i
      £1.477 di aprile 2026 <b>non sono confrontabili</b>: il secondo numero è calcolato su meno
      consumo. Il rincaro dei prezzi unitari è stato quindi più forte di quanto suggerisca il
      confronto fra le due cifre. È il tipo di dettaglio che quasi nessun sito spiega.</div>

      <h3>Come si compone la spesa</h3>
      <div class="fig">{chart_compos()}
      <div class="cap">Ripartizione indicativa della bolletta dual fuel a tariffa variabile standard, 2026.
      I pesi cambiano ogni trimestre con il prezzo all'ingrosso. Ofgem talvolta riclassifica i costi dei
      Contracts for Difference fra «ingrosso» e «politiche energetiche», quindi la ripartizione fra queste
      due voci varia a seconda della fonte. Fonte: analisi Ofgem su dati price cap.</div></div>

      <p>Meno di quaranta centesimi per sterlina pagano l'energia vera. Il resto sono reti, oneri
      di politica energetica, costi del fornitore e — voce in crescita — il recupero delle bollette
      non pagate da altri clienti.</p>

      <h3>Le modalità di pagamento non costano uguale</h3>
      <p>Il cap è fissato a livelli diversi per addebito diretto, pagamento a ricezione fattura e
      contatore prepagato. Chi paga alla ricezione della fattura paga di più, perché il fornitore
      anticipa il denaro. È una differenza che pesa soprattutto sulle famiglie a basso reddito.</p>

      <h3>Fisso o variabile</h3>
      <p>Circa <b>un terzo</b> dei clienti domestici è su contratto a prezzo fisso, quota raddoppiata
      in un anno. A ottobre 2025 la tariffa fissa più conveniente stava circa <b>£265 sotto</b> il
      price cap: la protezione del cap, cioè, non è affatto il prezzo migliore disponibile — è solo
      il tetto per chi non sceglie.</p>
    </section>""")

    # 3 — storico prezzi
    d.append(f"""<section>
      <h2><span class="n">03</span>Cosa è successo ai prezzi</h2><div class="rule"></div>
      <p class="lead">In cinque anni la bolletta britannica è più che triplicata, poi è tornata
      indietro senza mai riavvicinarsi ai livelli pre-crisi. Oggi vale circa il 35% in più del 2021.</p>

      <div class="fig">{chart_cap()}
      <div class="cap">Price cap Ofgem per famiglia tipo dual fuel con addebito diretto, £/anno.
      In rosso i trimestri in cui il cap superò il tetto governativo temporaneo (Energy Price Guarantee),
      che mantenne le bollette effettive a £2.500. Le due colonne marcate TDCV sono calcolate sul consumo
      convenzionale ridotto introdotto a luglio 2026, quindi non pienamente confrontabili con le precedenti.
      Fonte: Ofgem.</div></div>

      <table>
        <tr><th>Periodo</th><th class="num">£/anno</th><th>Cosa stava succedendo</th></tr>
        <tr><td>Ottobre 2021</td><td class="num">1.277</td><td>Ultimo trimestre di normalità prima della crisi</td></tr>
        <tr><td>Ottobre 2022</td><td class="num">3.549</td><td>Picco della crisi del gas. Il Governo introduce l'EPG e congela le bollette a £2.500</td></tr>
        <tr><td>Gennaio 2023</td><td class="num">4.279</td><td>Massimo storico del cap teorico, mai pagato dalle famiglie grazie all'EPG</td></tr>
        <tr><td>Luglio 2023</td><td class="num">2.074</td><td>Rientro sotto quota £2.500: l'EPG smette di servire</td></tr>
        <tr><td>Aprile 2025</td><td class="num">1.849</td><td>Assestamento su un livello stabilmente superiore al pre-crisi</td></tr>
        <tr><td>Aprile 2026</td><td class="num">1.477</td><td>Minimo del periodo recente, su consumo convenzionale ancora vecchio</td></tr>
        <tr><td><b>Ottobre 2026</b></td><td class="num"><b>1.723</b></td><td>Cap in vigore: +4% per tensioni sulle forniture di gas e petrolio</td></tr>
      </table>

      <div class="box"><b>Perché l'elettricità britannica costa così tanto.</b>
      Nel Regno Unito il prezzo dell'elettricità all'ingrosso è fissato quasi sempre dalle centrali
      a gas, che sono l'impianto marginale. Quando il gas rincara, rincara tutta l'elettricità —
      anche quella prodotta dal vento, che pure copre una quota crescente del fabbisogno. A questo
      si somma un carico di oneri ambientali più alto della media europea. Risultato: le famiglie
      britanniche pagano l'elettricità <b>il 44% in più</b> della mediana dell'Unione Europea
      (quarto posto in Europa), mentre sul <b>gas</b> il Regno Unito è vicino alla mediana,
      sedicesimo. Fonte: DESNZ, prezzi internazionali.</div>
    </section>""")

    # 4 — business
    d.append(f"""<section>
      <h2><span class="n">04</span>La bolletta business <span class="tag gas">B2B</span></h2><div class="rule"></div>
      <p class="lead">Il mercato non domestico funziona con regole completamente diverse. Qui non
      esiste nessun price cap, e le differenze di prezzo fra un'impresa e l'altra sono enormi.</p>

      <h3>Le cinque differenze che contano</h3>
      <table>
        <tr><th style="width:38mm">Aspetto</th><th>Famiglie</th><th>Imprese</th></tr>
        <tr><td><b>Tetto ai prezzi</b></td><td>Price cap Ofgem, aggiornato ogni trimestre</td><td><b>Nessuno.</b> Il prezzo è quello che si negozia</td></tr>
        <tr><td><b>IVA</b></td><td>5%</td><td><b>20%</b>, con aliquota ridotta al 5% solo per consumi molto bassi o uso prevalentemente non commerciale</td></tr>
        <tr><td><b>Climate Change Levy</b></td><td>Non dovuta</td><td><b>0,801p per kWh</b> su elettricità e gas, da aprile 2026. Voce separata in bolletta, e l'IVA si calcola anche su questa</td></tr>
        <tr><td><b>Durata</b></td><td>Si cambia quando si vuole, senza penali sulla tariffa variabile</td><td>Contratti a termine da 1 a 5 anni. Le grandi imprese comprano a lotti progressivi</td></tr>
        <tr><td><b>Intermediari</b></td><td>Comparatori online, commissione trasparente</td><td>Broker e intermediari, con <b>commissione spesso incorporata nel prezzo unitario</b> e non evidenziata</td></tr>
      </table>

      <h3>Quanto pagano davvero le imprese</h3>
      <div class="fig">{chart_biz()}
      <div class="cap">Prezzo medio dell'elettricità, pence per kWh. Dati imprese: DESNZ Quarterly Energy
      Prices, primo trimestre 2026, prezzi pienamente consegnati, IVA esclusa. Il dato famiglie è il
      prezzo unitario del price cap ottobre 2026 e non include la quota fissa giornaliera.</div></div>

      <div class="box warn"><b>Il premio pagato dalle piccole imprese è oggi ai massimi.</b>
      Una microimpresa paga circa <b>34,31p</b> per kWh contro una media di tutte le imprese di
      <b>23,61p</b>: quasi il 45% in più. Una parte si spiega con costi di rete e misura che pesano
      di più sui siti piccoli, ma la parte maggiore è contrattuale: chi ha rinegoziato ha catturato
      il calo dei prezzi all'ingrosso del 2024-2026, chi è rimasto su rinnovi automatici o su tariffe
      «deemed» no. È un divario che nasce dall'inerzia, non dal mercato.</div>

      <h3>Cosa c'è dentro un prezzo business</h3>
      <p>Oltre all'energia, il prezzo unitario incorpora costi di rete, bilanciamento del sistema,
      oneri per rinnovabili e mercato della capacità, la Climate Change Levy e quasi sempre la
      commissione dell'intermediario — che nel Regno Unito viene tipicamente nascosta dentro il
      prezzo al kWh anziché esposta a parte. È proprio su questo che Ofgem sta stringendo.</p>

      <p>Sulla sostenibilità dei costi il quadro 2025 è però meno drammatico del previsto: il
      <b>70%</b> delle imprese sta al passo con le bollette senza difficoltà, il <b>19%</b> con
      qualche affanno occasionale, il <b>6%</b> in costante difficoltà — concentrata su ditte
      individuali e microimprese.</p>
    </section>""")

    # 5 — chi vende
    d.append(f"""<section>
      <h2><span class="n">05</span>Chi vende energia</h2><div class="rule"></div>
      <p class="lead">Il mercato britannico ha attraversato una selezione durissima: dopo il 2021 sono
      fallite decine di società. Oggi sei gruppi coprono oltre il 90% delle famiglie, e per la prima
      volta il primo posto non appartiene a un incumbent storico.</p>

      <div class="two">
        <div><h3>Elettricità</h3>{chart_share(MS_EL, ELEC)}</div>
        <div><h3>Gas</h3>{chart_share(MS_GA, GAS)}</div>
      </div>
      <div class="cap">Quote di mercato domestiche, secondo trimestre 2025. Fonte: Ofgem, indicatori del
      mercato retail. Ad aggiornamento di luglio 2026 Octopus risulta al 25,7% sull'elettricità e al
      25,9% sul gas.</div>

      <h3>Il ribaltone Octopus</h3>
      <p>Octopus Energy è oggi il primo fornitore elettrico del Paese, davanti a British Gas, che
      resta invece primo sul gas. È un caso quasi unico in Europa: un operatore nato nel 2015 che in
      dieci anni ha superato l'incumbent storico, crescendo per acquisizioni — rilevando i clienti di
      diverse società fallite — e per prodotto, essendo il fornitore che ha spinto di più sulle tariffe
      orarie e sull'integrazione con auto elettriche e pompe di calore.</p>

      <h3>Un settore che guadagna poco</h3>
      <p>La vendita al dettaglio non è un business ricco: l'utile aggregato del settore domestico nel
      2025 è stimato in <b>£0,27 miliardi</b>, in netto calo dagli £0,88 miliardi del 2024. Ofgem fissa
      il margine dentro il price cap tramite un'apposita voce, e nel 2025 primavera mite e morosità in
      crescita hanno eroso la redditività. Nello stesso anno un altro operatore, Tomato Energy, è uscito
      dal mercato per problemi finanziari.</p>

      <div class="box"><b>Il problema che sta sotto tutto: il debito.</b>
      Il debito energetico delle famiglie ha toccato <b>£4,48 miliardi</b> nel terzo trimestre 2025,
      dodicesimo trimestre consecutivo di crescita, con <b>3,6 milioni</b> di clienti indebitati. La
      dinamica non è tanto un aumento del numero di persone in difficoltà quanto un aggravamento
      dell'importo medio. Quel debito non svanisce: rientra nella bolletta di tutti attraverso la voce
      «morosità» che vale circa il 7% del totale. Ofgem sta lavorando a uno schema di cancellazione
      mirata del debito accumulato durante la crisi.</div>
    </section>""")

    # 6 — dinamiche + implicazioni
    d.append(f"""<section>
      <h2><span class="n">06</span>Dove sta andando il mercato</h2><div class="rule"></div>
      <p class="lead">Tre trasformazioni in corso rendono il Regno Unito il mercato europeo più
      interessante per chi lavora sui dati energetici.</p>

      <div class="kpi">
        <div><b>70%</b><span>contatori domestici<br/>ormai intelligenti</span></div>
        <div><b>835 mila</b><span>clienti su tariffe orarie<br/>+68% in un anno</span></div>
        <div><b>653 mila</b><span>di questi su tariffe<br/>per auto elettrica, +84%</span></div>
        <div><b>2,8%</b><span>penetrazione tariffe orarie<br/>sul totale mercato</span></div>
      </div>

      <h3>Il contatore intelligente è ormai la norma</h3>
      <p>A settembre 2025 risultavano installati oltre <b>40 milioni</b> di contatori intelligenti nelle
      case britanniche, pari al <b>70%</b> del totale, più 2 milioni nel settore non domestico (64%).
      È la precondizione tecnica di tutto il resto.</p>

      <h3>Le tariffe orarie stanno decollando</h3>
      <p>I clienti su tariffe che cambiano prezzo durante la giornata sono passati da 497 mila a
      <b>835 mila</b> in dodici mesi. La crescita è quasi interamente trainata dalle tariffe pensate
      per chi ricarica l'auto elettrica di notte, salite dell'84%. La penetrazione complessiva resta
      però bassa, sotto il 3%: siamo all'inizio della curva, non alla fine.</p>

      <h3>Il settlement mezz'orario cambia le regole</h3>
      <p>Nel corso del 2026 entra progressivamente in vigore il <b>Market-wide Half-Hourly Settlement</b>:
      i consumi di tutti verranno regolati con granularità di mezz'ora anziché con profili medi. È la
      riforma che rende economicamente possibili le tariffe flessibili su larga scala, e apre lo spazio
      a prodotti che oggi non esistono.</p>

      <div class="box"><b>Cosa significa per un osservatorio prezzi.</b>
      Il Regno Unito ha un ecosistema di dati pubblici gratuiti molto più ricco dell'Italia — Elexon
      pubblica prezzi e generazione mezz'ora per mezz'ora, NESO pubblica domanda e intensità di
      carbonio previste, Octopus espone pubblicamente le proprie tariffe orarie. Attenzione però a un
      vincolo che cambia il progetto: <b>il prezzo day-ahead non è liberamente ripubblicabile</b>,
      perché sta su piattaforme private con licenze commerciali. L'equivalente britannico del PUN,
      inteso come dato aperto da mostrare in home page, semplicemente non esiste: l'ancora del sito
      dovrà essere un'altra — il price cap, i dati di sistema o le tariffe orarie.</div>

      <h3>In sintesi, le sette cose da ricordare</h3>
      <ul>
        <li>Il price cap limita i <b>prezzi unitari</b>, non la bolletta: la cifra annuale sui giornali è una convenzione di calcolo.</li>
        <li>Da luglio 2026 il consumo convenzionale è cambiato, quindi le serie storiche <b>non sono confrontabili</b> senza un aggiustamento.</li>
        <li>Meno del 40% della bolletta è energia; il resto sono reti, oneri, costi di gestione e morosità altrui.</li>
        <li>Le imprese non hanno alcuna protezione di prezzo, pagano IVA al 20% e la Climate Change Levy.</li>
        <li>Una microimpresa paga l'elettricità quasi il 45% più della media delle imprese, soprattutto per inerzia contrattuale.</li>
        <li>Octopus ha scalzato British Gas sull'elettricità; sei gruppi coprono oltre il 90% del mercato.</li>
        <li>L'elettricità britannica costa il 44% più della mediana UE per le famiglie e il 92% più per le imprese medie, perché il prezzo lo fa il gas.</li>
      </ul>

      <p class="src" style="margin-top:6mm">
      <b>Fonti.</b> Ofgem, <i>State of the Market Report</i>, 27 gennaio 2026 · Ofgem, price cap
      1 ottobre – 31 dicembre 2026 e tariffe unitarie associate · Ofgem, indicatori del mercato retail e
      indicatori su debito e morosità · DESNZ, <i>Quarterly Energy Prices</i>, tabelle sul settore non
      domestico, primo trimestre 2026 · DESNZ, prezzi energetici industriali internazionali ·
      HMRC per le aliquote della Climate Change Levy in vigore dal 1° aprile 2026.
      Documento redatto ad agosto 2026: il price cap viene rivisto ogni tre mesi e i dati di mercato
      con cadenza trimestrale.</p>
    </section>""")

    return f"<!doctype html><html lang='it'><head><meta charset='utf-8'><title>Mercato energetico UK</title><style>{CSS}</style></head><body>{''.join(d)}</body></html>"

open("/private/tmp/claude-501/-Users-semronzoni-Desktop-1RangerDea-Claude-EnergyIndex/fa87b8e7-f437-43c9-b37c-6c91605ce8d6/scratchpad/uk_report.html","w",encoding="utf-8").write(build())
print("HTML generato")

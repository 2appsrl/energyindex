# Libreria condivisa per i report Paese: stessa grafica del documento UK.
INK="#0f172a"; MUTED="#64748b"; LINE="#e2e8f0"; BG="#f8fafc"
ELEC="#059669"; GAS="#d97706"; RED="#dc2626"; NAVY="#0b2545"; ACC="#0ea5e9"; VIO="#7c3aed"; CYAN="#0891b2"

CSS = f"""
@page {{ size:A4; margin:15mm 14mm 16mm 14mm; }}
@page cover {{ size:A4; margin:0; }}
* {{ box-sizing:border-box; }}
body {{ font-family:Helvetica,Arial,sans-serif; color:{INK}; font-size:10.2pt; line-height:1.5; margin:0; }}
h1,h2,h3 {{ margin:0; }}
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
section {{ margin-top:9mm; }}
section:first-of-type {{ margin-top:0; }}
h2,h3,.rule {{ break-after:avoid; page-break-after:avoid; }}
table,.box,.fig,.calc,.kpi,.two {{ break-inside:avoid; page-break-inside:avoid; }}
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
td.num,th.num {{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }}
.box {{ background:{BG}; border-left:3px solid {ELEC}; padding:4mm 5mm; margin:4mm 0; font-size:9.6pt; }}
.box b {{ color:{NAVY}; }}
.warn {{ background:#fffbeb; border-left-color:{GAS}; }}
.fig {{ margin:4mm 0 2mm; }}
.cap {{ font-size:8.2pt; color:{MUTED}; margin-top:1mm; }}
.two {{ display:flex; gap:8mm; }} .two>div {{ flex:1; }}
.kpi {{ display:flex; gap:4mm; margin:4mm 0; }}
.kpi div {{ flex:1; border:1px solid {LINE}; border-radius:4px; padding:3.5mm; }}
.kpi b {{ display:block; font-size:16pt; color:{NAVY}; letter-spacing:-.5pt; }}
.kpi span {{ font-size:8.2pt; color:{MUTED}; line-height:1.35; display:block; margin-top:1mm; }}
.calc {{ font-family:"SF Mono",Menlo,monospace; font-size:8.6pt; background:{NAVY}; color:#e2e8f0;
         padding:4mm 5mm; border-radius:4px; margin:3mm 0; line-height:1.75; }}
.calc .g {{ color:#6ee7b7; }} .calc .a {{ color:#fbbf24; }} .calc .m {{ color:#94a3b8; }}
ul {{ margin:0 0 3mm; padding-left:5mm; }} li {{ margin-bottom:1.6mm; }}
.src {{ font-size:8.3pt; color:{MUTED}; }}
.tag {{ display:inline-block; background:{ELEC}; color:#fff; font-size:7.6pt; padding:.6mm 2mm;
        border-radius:3px; vertical-align:middle; letter-spacing:.04em; }}
.tag.gas {{ background:{GAS}; }}
"""

def fmt(v, dec=2):
    s = f"{v:,.{dec}f}".replace(",", "§").replace(".", ",").replace("§", ".")
    return s

def stacked(items):
    """Barra impilata orizzontale: [(etichetta, pct, colore)]"""
    W,H = 700, 116; x = 0; bh = 44
    p=[f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    for lab,pct,col in items:
        w = pct/100*W
        p.append(f'<rect x="{x:.1f}" y="0" width="{w:.1f}" height="{bh}" fill="{col}"/>')
        if pct>=7:
            p.append(f'<text x="{x+w/2:.1f}" y="{bh/2+4:.1f}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">{pct}%</text>')
        x += w
    lx, ly = 0, bh+22
    per = 3 if len(items)<=6 else 3
    for i,(lab,pct,col) in enumerate(items):
        if i and i%per==0: lx, ly = 0, ly+22
        p.append(f'<rect x="{lx}" y="{ly-8}" width="9" height="9" fill="{col}" rx="2"/>')
        p.append(f'<text x="{lx+14}" y="{ly}" font-size="9.5" fill="{INK}">{lab} <tspan fill="{MUTED}">{pct}%</tspan></text>')
        lx += 235
    p.append('</svg>')
    return "".join(p)

def bars_h(data, accent, unit="%", labw=116, dec=0):
    """Barre orizzontali: [(etichetta, valore)]"""
    W = 340; rowh = 26; H = len(data)*rowh + 6
    p=[f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    mx = max(v for _,v in data); barx = labw; barw = W-barx-40
    for i,(lab,v) in enumerate(data):
        y = i*rowh+4
        p.append(f'<text x="{barx-8}" y="{y+13}" font-size="9.5" fill="{INK}" text-anchor="end">{lab}</text>')
        w = v/mx*barw
        col = accent if i==0 else (MUTED if lab.lower().startswith(("altri","other","otros")) else NAVY)
        p.append(f'<rect x="{barx}" y="{y+3}" width="{w:.1f}" height="14" fill="{col}" rx="2"/>')
        p.append(f'<text x="{barx+w+6:.1f}" y="{y+14}" font-size="9.5" font-weight="700" fill="{INK}">{fmt(v,dec)}{unit}</text>')
    p.append('</svg>')
    return "".join(p)

def bars_v(data, unit="", dec=2, note=""):
    """Colonne verticali: [(etichetta multilinea con |, valore, colore)]"""
    W,H = 700, 132; n=len(data); gap = W/(n+0.6); bw = min(96, gap*0.5); x0 = gap*0.35
    mx = max(v for _,v,_ in data)*1.16; base = 84
    p=[f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    for i,(lab,v,col) in enumerate(data):
        x = x0+i*gap; bh = v/mx*66; y = base-bh
        p.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{col}" rx="3"/>')
        p.append(f'<text x="{x+bw/2:.1f}" y="{y-6:.1f}" font-size="12" font-weight="700" fill="{INK}" text-anchor="middle">{fmt(v,dec)}{unit}</text>')
        for j,part in enumerate(lab.split("|")):
            p.append(f'<text x="{x+bw/2:.1f}" y="{base+15+j*11}" font-size="8.5" fill="{MUTED}" text-anchor="middle">{part}</text>')
    if note:
        # In basso a destra: in alto si scontrava con l'etichetta della colonna
        # più alta quando questa cadeva sul bordo destro.
        p.append(f'<text x="{W-4}" y="{H-3}" font-size="9" fill="{MUTED}" text-anchor="end">{note}</text>')
    p.append('</svg>')
    return "".join(p)

def timeline(series, unit="", dec=0, hi=None):
    """Serie storica a colonne: [(etichetta, valore)]"""
    W,H = 700, 250; PAD_L,PAD_B,PAD_T = 52, 40, 18
    mx = max(v for _,v in series)*1.14; iw = W-PAD_L-12; n=len(series)
    bw = iw/n*0.6; gap = iw/n
    p=[f'<svg viewBox="0 0 {W} {H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif">']
    steps = 4;
    for k in range(steps+1):
        gv = mx/steps*k; y = H-PAD_B-(gv/mx)*(H-PAD_B-PAD_T)
        p.append(f'<line x1="{PAD_L}" y1="{y:.1f}" x2="{W-8}" y2="{y:.1f}" stroke="{LINE}" stroke-width="1"/>')
        p.append(f'<text x="{PAD_L-8}" y="{y+3:.1f}" font-size="9" fill="{MUTED}" text-anchor="end">{fmt(gv,dec)}</text>')
    for i,(lab,v) in enumerate(series):
        x = PAD_L+i*gap+(gap-bw)/2; bh=(v/mx)*(H-PAD_B-PAD_T); y=H-PAD_B-bh
        col = ELEC if (hi and lab==hi) else NAVY
        p.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{col}" rx="2"/>')
        p.append(f'<text x="{x+bw/2:.1f}" y="{y-4:.1f}" font-size="8.5" font-weight="700" fill="{INK}" text-anchor="middle">{fmt(v,dec)}</text>')
        for j,part in enumerate(lab.split("|")):
            p.append(f'<text x="{x+bw/2:.1f}" y="{H-PAD_B+13+j*11:.1f}" font-size="8" fill="{MUTED}" text-anchor="middle">{part}</text>')
    p.append(f'<text x="{W-6}" y="{PAD_T-4}" font-size="9" fill="{MUTED}" text-anchor="end">{unit}</text>')
    p.append('</svg>')
    return "".join(p)

def cover(kicker, title, sub, stats, meta):
    st = "".join(f'<div class="stat"><b>{b}</b><span>{s}</span></div>' for b,s in stats)
    return f"""<div class="cover"><div class="kicker">{kicker}</div><h1>{title}</h1>
      <div class="sub">{sub}</div><div class="accent"></div>
      <div class="stats">{st}</div><div class="meta">{meta}</div></div>"""

def page(title, body):
    return (f"<!doctype html><html lang='it'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style></head><body>{body}</body></html>")

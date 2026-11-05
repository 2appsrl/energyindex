# Cron ETL offerte

Il Portale Offerte ARERA non e' raggiungibile dai runner GitHub (datacenter),
quindi i suoi ETL devono girare da un'altra macchina. Questo pacchetto contiene
tre bundle single-file (niente repo, niente `npm install`), un wrapper con log e
due modi di pianificarli.

**Nota:** energiapro.biz gira su Vercel, quindi non offre un server con SSH. Oggi
il job gira sul Mac del titolare (vedi "macOS"); le istruzioni "server" sotto
valgono per qualunque macchina Linux sempre accesa, previa prova che il portale
risponda dal suo IP.

## macOS (launchd)

`daily.sh` parte ogni ora e al login: fa i job una sola volta al giorno dopo le
06:30 e riprova all'ora dopo se falliscono (Mac spento, senza rete). La cartella
va fuori da Desktop/Documents, che macOS vieta ai job in background.

```bash
bash deploy/energiapro-cron/build.sh
D="$HOME/Library/Application Support/EnergyIndexCron"
mkdir -p "$D" && cp -R deploy/energiapro-cron/{dist,run-etl.sh,daily.sh} "$D/"
cp deploy/energiapro-cron/.env.example "$D/.env" && chmod 600 "$D/.env"   # poi compila SUPABASE_* e NODE_BIN
sed "s|__DIR__|$D|g" deploy/energiapro-cron/it.energyindex.etl-daily.plist.example > ~/Library/LaunchAgents/it.energyindex.etl-daily.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/it.energyindex.etl-daily.plist
```

Log in `$D/logs/`. Per fermarlo: `launchctl bootout "gui/$(id -u)/it.energyindex.etl-daily"`.

## Cosa serve sul server

- **Node.js ≥ 20** (`node --version`). Se manca o è vecchio:
  `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`
  poi `nvm install 20`. Con nvm, metti il path completo di node in `.env`
  (`NODE_BIN=/home/UTENTE/.nvm/versions/node/v20.x.x/bin/node`).
- Accesso SSH e `crontab`.
- In uscita: HTTPS verso `ilportaleofferte.it`, `*.supabase.co` e (solo per
  lo scraping brand) i siti dei fornitori.

## Installazione (5 minuti)

**1. Sul Mac — builda i bundle** (dalla root del repo):

```bash
bash deploy/energiapro-cron/build.sh
```

**2. Sul Mac — carica la cartella sul server:**

```bash
rsync -av --exclude logs deploy/energiapro-cron/ UTENTE@SERVER:~/energyindex-cron/
```

**3. Sul server — crea il file credenziali:**

```bash
cd ~/energyindex-cron
cp .env.example .env
nano .env     # incolla la SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API keys)
chmod 600 .env
chmod +x run-etl.sh
```

**4. Sul server — test manuale (deve stampare offerte > 0):**

```bash
./run-etl.sh arera-placet      && tail -n 20 logs/arera-placet.log
./run-etl.sh portale-mlibero   && tail -n 20 logs/portale-mlibero.log
```

**5. Sul server — installa il cron:**

```bash
crontab -e
```

e incolla le righe da `crontab.example` correggendo il path (di default:
PLACET alle 06:30, mercato libero alle 06:40 ora del server). Lo scraping
brand resta sul workflow GitHub, che da lì funziona; la riga è nel file
commentata se vuoi spostare anche quello.

## Verifica che stia girando

- Sul server: `tail logs/portale-mlibero.log` — ogni run chiude con una
  riga JSON tipo `{"dataDate":"…","fetched":3062,"brands":317,…,"errors":0}`.
- Su Supabase (SQL editor):
  `SELECT MAX(last_seen_at) FROM arera_offers;` → deve essere di oggi;
  `SELECT MAX(synced_at) FROM mercato_libero_offers WHERE source='portale_mercato_libero';` → idem.
- Sul sito: /it/pro/simulator → card "Posizionamento competitor" riporta il
  numero di offerte per canale.

## Manutenzione

- **Aggiornamento ETL**: dopo modifiche agli script nel repo, rifai build
  (passo 1) e rsync (passo 2). Nient'altro.
- **Log**: autoruotati sotto i 2MB, in `~/energyindex-cron/logs/`.
- **Allarme silenzioso**: gli script escono con codice 1 se scaricano 0
  righe — se il tuo hosting manda mail sugli errori cron, le riceverai.
  Nota: un giorno festivo senza file sul portale può dare un falso allarme.
- **I workflow GitHub** `etl-arera-daily` e `etl-portale-mlibero-daily`
  continueranno a fallire (403): una volta attivo il cron sul server puoi
  disattivarli da GitHub → Actions → workflow → "…" → Disable, o lasciarli
  come promemoria.

## Sicurezza

La `SUPABASE_SERVICE_ROLE_KEY` bypassa le RLS: deve stare SOLO nel `.env`
sul server con permessi `600`, mai nel repo, mai in chat o email. Se la key
dovesse trapelare, rigenerala subito dal dashboard Supabase.

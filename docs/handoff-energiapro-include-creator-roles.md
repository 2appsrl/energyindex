# Handoff: estensione API `energiapro.biz` per `include_creator_roles`

**Destinatario**: backend team di `energiapro.biz`
**Scope**: estendere `GET /api/v1/offers` per supportare il filtro `include_creator_roles` + esporre `creator_role` nel JSON response.

## Motivazione

EnergyIndex consuma `/api/v1/offers` ogni 6 ore per popolare la Market Map (`energyindex.it/it/mercato-libero/ticker`). Attualmente l'API restituisce solo le offerte create dal superadmin (~45 offerte attive). Il team di Energy Index vuole mostrare anche le offerte create da `admin` e `agency`, distinguendole visivamente come "Non certificate" (offerte create da agenzie partner, **non ancora validate** dal team interno).

## Cambiamento richiesto

### 1. Nuovo query parameter `include_creator_roles`

```
GET /api/v1/offers?include_creator_roles=superadmin,admin,agency
```

- **Tipo**: stringa, comma-separated
- **Valori validi**: `superadmin`, `admin`, `agency` (in qualunque combinazione e ordine)
- **Default** (se omesso): `superadmin` *(preserva il comportamento legacy attuale per backward-compat con eventuali altri consumer)*
- **Comportamento**: applica un `WHERE creator_role IN (...)` alla query principale

### 2. Nuovo campo nel response JSON

Aggiungere `creator_role` a ogni elemento dell'array `offers`:

```json
{
  "meta": { ... },
  "offers": [
    {
      "id": "ep-offer-810001",
      "offer_code": "...",
      "supplier": "...",
      "creator_role": "superadmin",   // ← NUOVO CAMPO
      "...": "..."
    },
    {
      "id": "ep-offer-810042",
      "creator_role": "agency",       // ← NUOVO CAMPO
      "...": "..."
    }
  ]
}
```

- **Tipo**: `enum("superadmin", "admin", "agency")`
- **Sempre presente** in tutte le offerte
- Deriva dal ruolo dell'utente che ha creato l'offerta (probabilmente già una colonna nella tabella offerte o ricavabile via join su `users.role`)

## Esempio di patch (assumendo Node.js + Prisma/TypeORM)

```ts
// routes/offers.ts (o equivalente)
const VALID_ROLES = ["superadmin", "admin", "agency"] as const;
type CreatorRole = typeof VALID_ROLES[number];

router.get("/api/v1/offers", async (req, res) => {
  // Parse include_creator_roles (default: ["superadmin"] per backward-compat)
  const rolesRaw = (req.query.include_creator_roles as string | undefined) ?? "superadmin";
  const requestedRoles = rolesRaw.split(",").map(s => s.trim()).filter(Boolean);
  const validRoles = requestedRoles.filter((r): r is CreatorRole =>
    VALID_ROLES.includes(r as CreatorRole)
  );
  if (validRoles.length === 0) {
    return res.status(400).json({
      error: `include_creator_roles invalido. Valori: ${VALID_ROLES.join(",")}`
    });
  }

  // ... altri filtri esistenti (commodity, price_type, supplier, ecc.) ...

  // Query (Prisma esempio)
  const offers = await prisma.offer.findMany({
    where: {
      // ... altri WHERE clauses esistenti ...
      creator: { role: { in: validRoles } },   // ← NUOVO FILTRO
      // ... validità, attive, ecc.
    },
    include: { creator: true },
    take: limit,
    skip: offset,
  });

  const total = await prisma.offer.count({ where: { ... } });

  // Mappa il response: aggiungi creator_role
  res.json({
    meta: { total, limit, offset, generated_at: new Date().toISOString(), data_freshness_hours: 6 },
    offers: offers.map(o => ({
      id: o.id,
      offer_code: o.code,
      supplier: o.supplierName,
      // ... altri campi esistenti ...
      creator_role: o.creator.role,            // ← NUOVO CAMPO
    })),
  });
});
```

Se non usate Prisma, adatta la query alla vostra ORM (Sequelize, raw SQL, ecc.). La logica è:

```sql
SELECT o.*, u.role AS creator_role
FROM offers o
JOIN users u ON o.created_by_user_id = u.id
WHERE u.role = ANY($1::text[])  -- $1 = array dei ruoli validi richiesti
  AND o.is_active = true
  AND o.valid_from <= CURRENT_DATE
  AND (o.valid_to IS NULL OR o.valid_to >= CURRENT_DATE)
ORDER BY o.created_at DESC
LIMIT $2 OFFSET $3;
```

## Test rapidi

Dopo il deploy, da terminale:

```bash
# Test 1: comportamento legacy (solo superadmin) — deve essere identico a oggi
curl -H "X-API-Key: ..." "https://energiapro.biz/api/v1/offers?limit=5" | jq '.offers[].creator_role'
# Atteso: ["superadmin","superadmin","superadmin","superadmin","superadmin"]

# Test 2: include tutti i ruoli
curl -H "X-API-Key: ..." "https://energiapro.biz/api/v1/offers?include_creator_roles=superadmin,admin,agency&limit=10" \
  | jq '[.offers[].creator_role] | group_by(.) | map({role: .[0], n: length})'
# Atteso: [{"role":"agency","n":4},{"role":"superadmin","n":6}, ...] (qualcosa di simile)

# Test 3: solo agency (verifica che il filtro funzioni)
curl -H "X-API-Key: ..." "https://energiapro.biz/api/v1/offers?include_creator_roles=agency&limit=5" \
  | jq '.offers[].creator_role'
# Atteso: ["agency","agency","agency","agency","agency"]

# Test 4: valore invalido
curl -H "X-API-Key: ..." "https://energiapro.biz/api/v1/offers?include_creator_roles=hacker"
# Atteso: 400 Bad Request
```

## Compatibilità con EnergyIndex

EnergyIndex è già pronto per consumare il nuovo campo:
- `scripts/lib/energiapro-client.ts` espone `EnergiaProOffer.creator_role` (opzionale) e `FetchOffersParams.include_creator_roles`
- `scripts/etl-energiapro-offers.ts` chiama `fetchAllOffers({})` che di default ora invia `include_creator_roles=superadmin,admin,agency` per pull completo
- Backfill DB già fatto: tutte le offerte energiapro esistenti sono marcate come `superadmin` (= "Certificate" nella UI)
- MarketMap UI mostra:
  - Chip filter **Tutte / ✓ Certificate / ⚠ Non certificate**
  - Ring ambra + icona ⚠ sulle tile non-certificate
  - Tooltip hover con badge "Certificate" o "Non certificate"

Una volta deployata la patch a energiapro.biz, alla prossima esecuzione dell'ETL EnergyIndex (cron ogni 6h) le offerte admin/agency entrano automaticamente nel DB con il flag corretto e diventano visibili sulla Market Map.

## Sicurezza / autorizzazione

Domanda di design da chiarire con il team energiapro.biz:

- Le offerte create da `agency` sono **pubbliche** (visibili a chiunque sul portale, senza login) o sono visibili **solo all'agency stessa** dentro il suo dashboard?
- Se sono "private" tra agency e cliente finale, esporle pubblicamente su `energyindex.it/it/mercato-libero/ticker` può violare aspettative di confidenzialità contrattuale. In quel caso valutare:
  - Aggiungere un campo `is_public` sulle offerte (default `true` per superadmin, agency sceglie esplicitamente al momento della creazione)
  - Filtrare lato API: `WHERE u.role IN (...) AND (u.role = 'superadmin' OR o.is_public = true)`
  - Oppure escludere il ruolo `agency` dal default di `include_creator_roles` e includerlo solo per chiamate autenticate da utenti privilegiati

## Stima sforzo

- Sviluppo backend energiapro.biz: **30-60 min** (query param parsing + WHERE filter + response mapping)
- Test manuali con curl: **5 min**
- Deploy: dipende dalla pipeline CI/CD

Una volta in produzione, niente da fare lato EnergyIndex — l'ETL già consuma il nuovo campo al prossimo run.

---

Per qualsiasi domanda contattare il team Energy Index a `pro@energyindex.pro`.

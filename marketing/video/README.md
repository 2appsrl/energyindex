# EIDX marketing videos (Remotion)

Two 60-second promo videos, 1920x1080 @ 30fps:

- **EnergyIndex** — consumer / B2C: PUN, PSV, drivers, chart, "gratis"
- **EidxPro** — B2B: trading vitals, margin simulator, forecast, €499/mese

Isolated Remotion project — its own `node_modules`, doesn't touch the Next.js
app.

## Setup

```bash
cd marketing/video
npm install
```

## Preview

```bash
npm run dev            # opens Remotion Studio; scrub, tweak, re-render live
```

## Music

Drop `music.mp3` into `public/`. See `public/README.md` for guidance and
suggested libraries (Artlist / Musicbed / Epidemic Sound — search
"corporate uplifting" or "Apple keynote"). No file → silent render.

## Render (MP4)

```bash
npm run render:eidx    # -> out/energyindex-60s.mp4
npm run render:pro     # -> out/eidx-pro-60s.mp4
npm run render:all     # both
```

Rendering needs Chrome — Remotion downloads its own bundled Chromium on the
first run.

## Structure

```
src/
├── index.ts               registerRoot
├── Root.tsx               <Composition> definitions
├── theme.ts               dark keynote palette (EIDX green #16a34a)
├── music.ts               music slot + volume
├── EnergyIndex.tsx        consumer 60s composition
├── EidxPro.tsx            pro 60s composition
└── scenes/
    ├── KeynoteTitle.tsx   full-screen hero text
    ├── BigNumber.tsx      count-up number + unit
    ├── CardsGrid.tsx      2/3/4-col stat cards (staggered)
    ├── LineChartScene.tsx SVG line chart (progressive stroke + forecast fan)
    ├── ClaimsList.tsx     bulleted value props with tick marks
    └── CtaEnd.tsx         EI logo mark + product name + URL
```

## Adjusting content

Numbers/copy are hardcoded in `EnergyIndex.tsx` / `EidxPro.tsx`. Swap the
values in the `cards={[...]}` / `points={[...]}` props — everything else
(motion, timing) is scene-level.

If you need real numbers instead of illustrative ones, wire in a build-time
script that fetches from Supabase and writes JSON into `src/data/` — the
scenes accept plain arrays.

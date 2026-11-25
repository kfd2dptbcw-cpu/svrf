# SVRF Surf Log: KDP paperback

A 192-page surf session journal for Amazon KDP, built from code so it can be regenerated or changed.

## Files to upload

| File | What it is | KDP spec |
|---|---|---|
| `print/svrf-surf-log-interior.pdf` | Manuscript (interior) | 6 x 9 in trim **with bleed** → 6.125 x 9.25 in pages, 192 pages, black & white, all fonts embedded |
| `print/svrf-surf-log-cover.pdf` | Full-wrap paperback cover (back + spine + front) | 12.682 x 9.25 in, 0.432 in spine (192 pp x 0.002252 in, white paper), 0.125 in bleed |
| `print/svrf-surf-log-cover.png` | The same cover as a 300 DPI image (3805 x 2775 px) | For records, proofs, ads |
| `print/svrf-surf-log-front.jpg` | Front cover only, 1800 x 2700 px | Listings, social posts, A+ content |

KDP's paperback cover upload takes a **PDF**, so upload `svrf-surf-log-cover.pdf`. The PNG and JPG are for everywhere else.

## KDP setup (Paperback → Content)

- **Ink and paper:** Black & white interior, **white** paper. The spine width depends on this, so cream paper would need a rebuild with 0.0025 in per page.
- **Trim size:** 6 x 9 in
- **Bleed:** **Bleed** (PDF only)
- **Paperback cover finish:** **Matte**. The back cover says "Durable matte cover", so pick matte.
- **Manuscript:** `print/svrf-surf-log-interior.pdf`
- **Cover:** "Upload a cover you already have" → `print/svrf-surf-log-cover.pdf`
- **Barcode:** leave it to KDP. The lower-right of the back cover is kept clear for it.
- **Low-content book:** leave it **unticked**. You then get a free KDP ISBN and Amazon's "Look Inside" preview. The session pages are the main selling point, so buyers should be able to see them.

## Listing copy (Paperback → Details)

**Title:** SVRF Surf Log
**Subtitle:** A Session Journal for Reading the Sea
**Author / contributor:** SVRF
**Publisher / imprint (with the free KDP ISBN):** SVRF. The copyright page reads "Copyright © 2026 SVRF, a trading name of LYCreative Ltd".
**Series:** leave blank. Add "SVRF Surf Log" later if you publish volume 2 or a colour edition.

**Description** (paste into KDP's rich-text box):

> **The forecast said four foot and clean. What did you actually get?**
>
> The SVRF Surf Log is a surf journal built around the gap between the forecast and the session. Write the forecast before you paddle out, log what you actually got, and give the forecast a verdict: *Called it*, *Close* or *Way off*. A season later you'll know your spots, your boards and your forecasts better than any app ever could.
>
> **Inside:**
> - **120 session pages**: forecast vs reality, a tide curve to bracket your time in the water, a swell and wind compass to draw on, water temp and wetsuit, board and fins, crowd, wave count and a 1–5 stoke rating
> - **12 monthly reviews** that turn sessions into lessons, plus a year-at-a-glance tracker
> - **Forecast scorecard**: work out your season hit rate and where the forecast goes wrong
> - **8 spot files** to map each break's recipe: swell window, offshore wind, best tide, hazards and a lineup sketch
> - **6 quiver pages** with dims, volume, fins, ding log and a board-outline sketch, plus a wetsuit log and car-kit checklist
> - **7-page field guide**: swell period, wind, tide and the rule of twelfths, the 1–5 rating scale, wetsuit thickness by water temperature, lineup etiquette, rip currents and UK beach flags
> - **The progression ladder**: 20 skills from first pop-up to first barrel, dated as they click
> - Session index, ten best waves, three surf-trip planners and dot-grid pages
>
> 6 x 9 in, a size that fits the glovebox or board bag. Matte cover. A gift for any surfer, from first lessons to cold-water regulars.

**Keywords** (7 boxes, one phrase each):
1. surf journal log book for surfers
2. surfing gifts for men women
3. surf session tracker notebook
4. surf forecast swell wind tide log
5. surfboard quiver journal
6. cold water surfing UK gift
7. surf trip planner diary

**Categories** (pick up to 3):
- Sports & Outdoors › Water Sports › Surfing
- Self-Help › Journal Writing (or Books › Blank Books / Journals in the UK store)
- Sports & Outdoors › Coaching (or Training)

**Primary marketplace:** Amazon.co.uk. The content uses UK conventions (°C, mph, RNLI flags, 999), with °F shown in the wetsuit table.

## Pricing (Paperback → Rights & pricing)

Print cost at 192 pages, B&W, 6 x 9 is about **$3.30 / £2.80**. Check KDP's live calculator, because rates change.

- Suggested list price: **£10.99 / $12.99 / €12.99**, which gives a royalty of about £3.80 / $4.50 per copy at 60%.
- Most generic surf log books sell for $6.99–$9.99. This book is positioned above them on content, but well below the Stormrider Surf Journal ($19.95).

Before you go live, order a **printed proof** (Paperback → Request printed proofs).

## Market research behind the design

Most surf log books on Amazon are generic, low-content notebooks: one repeated table of date, spot, swell, wind, tide and notes. A few go further, such as the Stormrider Surf Journal (atlas + planner + log), the Earth Afloat *Surf Session Log Book* (log + companion website) and *Wave Log* (long checklist of conditions). The SVRF Surf Log stands apart in four ways:

1. **Forecast vs reality with a verdict on every page**, adding up to a season hit rate. It fits SVRF as a forecast brand, and no other journal we found does it.
2. **Drawing instead of writing**: a compass for swell and wind, a tide curve, and dots to colour in. A session takes about a minute to log in the car park.
3. **Spot files and a quiver**, so the book records how you learned your breaks and boards, not just a diary of sessions.
4. **A real field guide** written for UK cold-water surfers.

## Brand

Colours, type and voice come from the SVRF site: Ink `#0B0D0E`, Chalk `#EFEEE7`, Seafoam `#CFDBDA`, Flag Orange `#FF4E1F` as the only accent; Archivo Black, Inter and JetBrains Mono.

The book uses a **plain "SVRF" wordmark** set in Archivo Black and no logo mark. To use the official logo, add these files and rebuild:

- `brand/logo.png`: transparent PNG for light backgrounds (interior title page)
- `brand/logo-light.png`: transparent PNG for the dark cover

## Rebuild

```bash
pip install reportlab pypdfium2 pypdf
```

```bash
python3 build.py
```

The constants at the top of `build.py` set the number of sessions, spot files and boards. After any change to the page count, rebuild: the spine width and cover size are recalculated, and the result must be uploaded as a new cover.

Fonts in `fonts/` (Archivo Black, Inter, JetBrains Mono) are under the SIL Open Font License. Commercial print use and embedding are allowed.

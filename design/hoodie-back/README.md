# SVRF hoodie back: "The Cold Water Issue"

A surf-magazine back cover collage for the back of the SVRF hoodie, built from photos in the SVRF Shopify Files library.

- **Output:** 3600 × 4800 px PNG (12 × 16 in at 300 dpi), suitable for a standard DTG/screen-print back placement.
- **Slogan:** "THE FORECAST IS ONLY A RUMOUR. — go and look."
- **Palette and type:** the SVRF brand colours (ink `#0B0D0E`, paper `#EFEEE7`, orange `#FF4E1F`, mist `#CFDBDA`) and fonts (Archivo Black, JetBrains Mono), plus Instrument Serif italic for the handwritten-style captions.

## Make the print file

1. Open `index.html` in Chrome or Safari (double-clicking it works).
2. Wait for the status to read "Rendered from Shopify media."
3. Click **Download print PNG**.

The page loads each photo from `cdn.shopify.com` and runs the halftone, duotone and torn-edge treatments in the browser, so the export is always made from the original store images.

## Change the collage

At the top of the `<script>`, `IMAGES` maps each collage slot to a Shopify file URL. To use a different photo in a slot, paste in any URL from Shopify admin → Content → Files. `SLOGAN` and `SLOGAN_TAG` hold the slogan text. The random layout details (tape, torn edges, grain) use a fixed seed, so every export comes out the same.

| Slot | Treatment | Current source |
|---|---|---|
| hero | ink halftone, lead shot | Penhale Sands |
| gulls | orange duotone | gulls |
| beach | high-contrast mono | beach |
| local1 | mist duotone polaroid | uploaded phone photo |
| tee | mono polaroid | Forecast Tee, styled |
| robe | torn colour clipping | Carpark Robe factory sample |
| seal | round sticker | Good Season Tee seal print |

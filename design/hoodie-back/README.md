# SVRF hoodie back

A photo-led print for the back of the SVRF hoodie, built from images in the SVRF Shopify Files library. It's laid out like a photocopied surf zine page:

- **Lead photo:** full bleed, run through a photocopy treatment (crushed blacks, toner noise, scanner dust).
- **Contact strip:** a 35mm strip of three more Shopify shots, marked up in grease pencil (one frame circled, one crossed out).
- **Wordmark:** a misregistered two-colour SVRF, cut off by the bottom edge.
- **Line:** one dry label-maker line, "IT WAS BETTER YESTERDAY." by default.
- **Output:** a 3600 × 4800 px PNG (12 × 16 in at 300 dpi), transparent outside the rough-cut print edge, so the hoodie colour shows around it.

## Make the print file

1. Open `index.html` in Chrome or Safari.
2. Pick the **lead photo**, the **treatment** (photocopy or halftone) and the **line**. The **Hoodie** menu only changes the preview background.
3. Click **Download print PNG**.

## Edit

At the top of the `<script>` block:

- `PHOTOS`: the Shopify files to choose from, each with a focal point for cropping.
- `STRIP`: which photos go in the contact strip.
- `LINES`: the slogan options.

The texture is seeded, so the same choices always export the same file.

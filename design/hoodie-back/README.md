# SVRF hoodie back

A photo-led print for the back of the SVRF hoodie, made from two SVRF photos in `photos/`: `carpark.jpg` and `set-wave.jpg`. There are two layouts. **Carpark** uses the carpark shot as the lead photo, with the set wave in the strip and no big wordmark (the towel and hoodie in the photo carry the brand). **Set wave** uses the wave as the lead photo, with carpark frames in the strip and the big wordmark at the bottom. Previews of both on a navy hoodie are in `mockups/`. It's laid out like a photocopied surf zine page:

- **Lead photo:** full bleed, with a photocopy treatment (crushed blacks, toner noise, scanner dust).
- **Contact strip:** a 35mm strip of three frames cropped from the other photo, marked up in grease pencil (one frame circled, one crossed out).
- **Wordmark (set wave layout only):** a misregistered two-colour SVRF, cut off by the bottom edge.
- **Line:** one dry label-maker line, "IT WAS BETTER YESTERDAY." by default.
- **Output:** a 3600 × 4800 px PNG (12 × 16 in at 300 dpi), transparent outside the rough-cut print edge, so the hoodie colour shows around it.

## Make the print file

1. In this folder, run `python3 -m http.server`, then open http://localhost:8000. Browsers won't export the canvas from a page opened as a file.
2. Pick the **layout** and the **line**. The **Hoodie** menu only changes the preview background.
3. Click **Download print PNG**.

## Edit

At the top of the `<script>` block:

- `PRESETS`: each layout's lead photo, its crop (focal point and zoom), tone settings, contact-strip frames, line position and whether the wordmark shows.
- `LINES`: the slogan options.

The texture is seeded, so the same choices always export the same file.

## Left chest print

`chest.html` draws three 4 in (1200 px at 300 dpi) left chest prints to go with the back prints. Each comes in light ink for navy, black and coffee hoodies, and dark ink for ecru and grey marl. Open it over http like `index.html`, then right-click a print to save it. `mockups/chest-options.png` shows every option on each hoodie colour.

- **keeper:** SVRF circled in orange grease pencil and marked ▸15A, like the picked frame on the back's contact strip.
- **misprint:** a small version of the back's out-of-register SVRF over "COLD WATER DEPT.".
- **tape:** the label-maker strip reading "SVRF / COLD WATER DEPT.".

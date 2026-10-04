import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Archivo Black for Open Graph images. next/og (satori) needs TTF/OTF/WOFF
 * data, so read the self-hosted @fontsource WOFF file. If it can't be found
 * (e.g. a trimmed standalone deployment) the images fall back to the default
 * font rather than failing.
 */
export async function ogFonts() {
  try {
    const data = await readFile(
      path.join(process.cwd(), "node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff"),
    );
    return [{ name: "Archivo Black", data, weight: 400 as const, style: "normal" as const }];
  } catch {
    return [];
  }
}

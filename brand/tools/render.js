const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2];
const rows = fs.readFileSync(path.join(out, '.manifest'), 'utf8').trim().split('\n').map(l => l.split('\t'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [file, w, h, bg] of rows) {
    const W = +w, H = +h, base = file.replace(/\.svg$/, '');
    const svg = fs.readFileSync(file, 'utf8');
    const target = file.includes('icon') ? 4096 : 6000;   // px on the long edge
    const scale = target / Math.max(W, H);
    const html = (b) => `<html><head><style>@page{size:${W}px ${H}px;margin:0}html,body{width:${W}px;height:${H}px;overflow:hidden}</style></head><body style="margin:0;background:${b || 'transparent'}">${svg.replace(/width="[^"]+" height="[^"]+">/, `width="${W}" height="${H}" style="display:block">`)}</body></html>`;
    await p.setViewportSize({ width: W, height: H });
    // Transparent PNG at print resolution
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
    const pg = await ctx.newPage();
    await pg.setContent(html());
    await pg.screenshot({ path: base + '.png', omitBackground: true });
    await ctx.close();
    // Vector PDF sized to the artwork
    await p.setContent(html());
    await p.pdf({ path: base + '.pdf', width: W + 'px', height: H + 'px', preferCSSPageSize: true, printBackground: true, pageRanges: '1' });
  }
  await b.close();
})();

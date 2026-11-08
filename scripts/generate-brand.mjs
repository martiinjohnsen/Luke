import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Shared vector geometry keeps the web logo and app icons identical.
// Sharp is already installed by Next.js; generated assets are committed.
const mark = `
  <defs>
    <linearGradient id="tile-one" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#b39ac2"/><stop offset="1" stop-color="#a98ab9"/></linearGradient>
    <linearGradient id="tile-two" x1="52" y1="0" x2="100" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#d8c4e0"/><stop offset="1" stop-color="#cbb2d5"/></linearGradient>
    <linearGradient id="tile-three" x1="0" y1="52" x2="48" y2="100" gradientUnits="userSpaceOnUse"><stop stop-color="#cdb7d8"/><stop offset="1" stop-color="#bea2cd"/></linearGradient>
    <linearGradient id="closed-door" x1="52" y1="52" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop stop-color="#80558a"/><stop offset="1" stop-color="#704477"/></linearGradient>
  </defs>
  <rect x="0" y="0" width="48" height="48" rx="11" fill="url(#tile-one)"/>
  <rect x="52" y="0" width="48" height="48" rx="11" fill="url(#tile-two)"/>
  <rect x="0" y="52" width="48" height="48" rx="11" fill="url(#tile-three)"/>
  <rect x="52" y="52" width="48" height="48" rx="11" fill="url(#closed-door)"/>
  <text x="76" y="87" text-anchor="middle" fill="#fff0cb" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="32">24</text>`;
const symbol = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><title>Luke · lukket luke 24</title>${mark}\n</svg>\n`;
const lockup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 266 106" fill="none">
  <title>Luke</title>
  <g transform="translate(2 6) scale(.91)">${mark}</g>
  <text x="109" y="78" fill="#4d254f" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="70">luke</text>
  <circle cx="258" cy="72.5" r="5.6" fill="#b580ac"/>
</svg>\n`;
function appIcon(maskable = false) {
  // Ordinary/iOS icons use only 7% padding, with color extending to every edge.
  // The maskable export keeps the mark inside Android's central safe circle.
  const inset = maskable ? 104 : 36;
  const scale = (512 - 2 * inset) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <title>Luke · appikon</title>
  <defs><linearGradient id="app-background" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="#512b55"/><stop offset="1" stop-color="#452149"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#app-background)"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">${mark}</g>
</svg>\n`;
}
await mkdir('public/brand', { recursive: true });
await mkdir('public/icons', { recursive: true });
await writeFile('public/brand/luke-symbol.svg', symbol);
await writeFile('public/brand/luke-app-icon.svg', appIcon());
for (const name of ['luke-lockup.svg', 'luke-lockup-v3.svg']) await writeFile(`public/brand/${name}`, lockup);
const exports = [
  { size: 32, names: ['luke-favicon-v3.png', 'luke-favicon.png'] },
  { size: 180, names: ['luke-apple-touch-v3.png', 'luke-apple-touch.png', 'apple-touch-icon.png'] },
  { size: 192, names: ['luke-192-v3.png', 'luke-192.png', 'icon-192.png'] },
  { size: 512, names: ['luke-512-v3.png', 'luke-512.png', 'icon-512.png'] },
  { size: 512, maskable: true, names: ['luke-maskable-512-v3.png', 'luke-maskable-512.png', 'maskable-512.png'] },
];
for (const item of exports) {
  const png = await sharp(Buffer.from(appIcon(item.maskable)), { density: 288 })
    .resize(item.size, item.size).flatten({ background: "#512b55" }).png().toBuffer();
  for (const name of item.names) await writeFile(`public/icons/${name}`, png);
}
await sharp(Buffer.from(lockup), { density: 288 }).resize(1064, 424).webp({ lossless: true }).toFile('public/brand/luke-logo.webp');
console.log('Generated matching closed-door logos, favicon and app icons.');

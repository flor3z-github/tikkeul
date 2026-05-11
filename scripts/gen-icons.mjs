// Generate placeholder PWA icons (192/512) from an inline SVG.
// Run: pnpm gen:icons
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outDir = resolve(rootDir, "public", "icons");
const appDir = resolve(rootDir, "app");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A84FF"/>
      <stop offset="100%" stop-color="#007AFF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" ry="112" fill="url(#bg)"/>
  <text x="256" y="330" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, system-ui, 'Pretendard Variable', sans-serif"
        font-size="280" font-weight="800" fill="white"
        letter-spacing="-12">티</text>
</svg>`;

async function main() {
  await mkdir(outDir, { recursive: true });
  const sizes = [192, 512];
  for (const size of sizes) {
    const out = resolve(outDir, `icon-${size}.png`);
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`wrote ${out}`);
  }

  // Next.js auto-wires app/icon.png as the favicon and app/apple-icon.png as
  // the iOS Safari "Add to Home Screen" icon. Both are referenced via <link>
  // tags injected automatically, so no explicit metadata.icons block needed.
  const appIcon = resolve(appDir, "icon.png");
  await sharp(Buffer.from(svg))
    .resize(48, 48)
    .png({ compressionLevel: 9 })
    .toFile(appIcon);
  console.log(`wrote ${appIcon}`);

  const appAppleIcon = resolve(appDir, "apple-icon.png");
  await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(appAppleIcon);
  console.log(`wrote ${appAppleIcon}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

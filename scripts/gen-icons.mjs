// Generate placeholder PWA icons (192/512) from an inline SVG.
// Run: pnpm gen:icons
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "icons");

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

  // Also drop an Apple Touch Icon (180) since iOS install behavior expects it.
  const apple = resolve(outDir, "apple-touch-icon.png");
  await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(apple);
  console.log(`wrote ${apple}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

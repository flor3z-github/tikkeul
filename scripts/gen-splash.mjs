// Generate iOS PWA launch (splash) images for every modern iPhone resolution.
// Run: pnpm gen:splash
//
// iOS only paints an apple-touch-startup-image when a <link>'s media query
// matches the device EXACTLY (device-width/height + -webkit-device-pixel-ratio
// + orientation). A device with no matching entry falls back to a blank
// background_color screen — so we emit one PNG per known iPhone portrait size
// and a matching <link> (wired in app/layout.tsx via metadata.appleWebApp.
// startupImage). The DEVICES list below mirrors what we wire there.
//
// Design: the app-icon mark (blue gradient "티" rounded square, identical to
// scripts/gen-icons.mjs) centered on the #f5f5f7 launch background, which is
// the same background_color / light themeColor used by the manifest + viewport.
// Keep this SVG in sync with gen-icons.mjs if the icon mark changes.
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outDir = resolve(rootDir, "public", "splash");

// Launch background = manifest background_color / light themeColor (#f5f5f7).
const BG = { r: 245, g: 245, b: 247, alpha: 1 };

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
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

// Portrait CSS size + devicePixelRatio for current iPhones. Pixel dimensions
// (cssW*dpr × cssH*dpr) name the PNG; cssW/cssH/dpr build the media query.
// Each row covers one or more models that share a resolution.
const DEVICES = [
  { cssW: 375, cssH: 667, dpr: 2 }, // SE 2/3, 8, 7, 6s, 6
  { cssW: 414, cssH: 736, dpr: 3 }, // 8 Plus, 7 Plus, 6s Plus
  { cssW: 375, cssH: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { cssW: 414, cssH: 896, dpr: 2 }, // XR, 11
  { cssW: 414, cssH: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { cssW: 390, cssH: 844, dpr: 3 }, // 12, 12 Pro, 13, 13 Pro, 14
  { cssW: 428, cssH: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { cssW: 393, cssH: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { cssW: 430, cssH: 932, dpr: 3 }, // 14 Pro Max, 15 Plus, 15/16 Pro Max... (15 Plus)
  { cssW: 402, cssH: 874, dpr: 3 }, // 16 Pro
  { cssW: 440, cssH: 956, dpr: 3 }, // 16 Pro Max
];

async function main() {
  await mkdir(outDir, { recursive: true });

  for (const { cssW, cssH, dpr } of DEVICES) {
    const w = cssW * dpr;
    const h = cssH * dpr;
    // Mark ~30% of the shorter edge — roughly app-icon proportions on launch.
    const mark = Math.round(Math.min(w, h) * 0.3);
    const iconBuf = await sharp(Buffer.from(iconSvg))
      .resize(mark, mark)
      .png()
      .toBuffer();

    const out = resolve(outDir, `splash-${w}x${h}.png`);
    await sharp({
      create: { width: w, height: h, channels: 4, background: BG },
    })
      .composite([{ input: iconBuf, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`wrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Regenerates the favicon set from the KM logo artwork.
 *
 * The source is a 1024px square with the wordmark sitting small in the middle,
 * so it is cropped to the mark's own bounds and recomposited at each size with
 * a fixed proportion of padding. Rebuilding from the artwork for every size,
 * rather than scaling one rendered icon down, keeps the small ones legible.
 *
 * Usage: node scripts/build-favicons.mjs [path-to-artwork]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] ?? path.join(here, "km-logo.png");

/** Share of the icon's width the wordmark spans. The rest is padding. */
const MARK_WIDTH_RATIO = 0.76;
/** Corner radius as a share of the icon's width. */
const CORNER_RADIUS_RATIO = 0.2;
const BACKGROUND = { r: 0, g: 0, b: 0, alpha: 1 };

const root = process.cwd();
const appDir = path.join(root, "src", "app");
const publicDir = path.join(root, "public");

/** The artwork's own bounds, so the padding is ours rather than the file's. */
async function findMarkBounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const bounds = await findMarkBounds(source);
const mark = await sharp(source).extract(bounds).png().toBuffer();
const aspect = bounds.height / bounds.width;

/**
 * One square icon: the mark scaled to a fixed width share, centred on black.
 *
 * `rounded` is off for icons the platform masks itself, such as the Apple touch
 * icon, where pre-rounding would show through as corner artefacts.
 */
async function renderIcon(size, { rounded = true } = {}) {
  const markWidth = Math.max(1, Math.round(size * MARK_WIDTH_RATIO));
  const markHeight = Math.max(1, Math.round(markWidth * aspect));
  const scaled = await sharp(mark)
    .resize(markWidth, markHeight, { kernel: sharp.kernel.lanczos3, fit: "fill" })
    .png()
    .toBuffer();
  const square = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([
      {
        input: scaled,
        left: Math.round((size - markWidth) / 2),
        top: Math.round((size - markHeight) / 2),
      },
    ])
    .png()
    .toBuffer();

  if (!rounded) {
    return sharp(square).png({ compressionLevel: 9 }).toBuffer();
  }

  const radius = size * CORNER_RADIUS_RATIO;
  const corners = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>` +
      `</svg>`,
  );
  return sharp(square)
    .composite([{ input: corners, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Minimal PNG-in-ICO container: every browser in use reads this form. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

await mkdir(publicDir, { recursive: true });

const icoSizes = [16, 32, 48];
const icoImages = [];
for (const size of icoSizes) {
  icoImages.push({ size, data: await renderIcon(size) });
}
await writeFile(path.join(appDir, "favicon.ico"), buildIco(icoImages));

const pngTargets = [
  [path.join(appDir, "icon.png"), 32, { rounded: true }],
  // iOS rounds the home-screen icon itself, so this one stays full-bleed.
  [path.join(appDir, "apple-icon.png"), 180, { rounded: false }],
  [path.join(publicDir, "icon-192.png"), 192, { rounded: true }],
  [path.join(publicDir, "icon-512.png"), 512, { rounded: true }],
];
for (const [file, size, options] of pngTargets) {
  await writeFile(file, await renderIcon(size, options));
}

console.log(
  JSON.stringify(
    {
      artwork: source,
      markBounds: bounds,
      markWidthRatio: MARK_WIDTH_RATIO,
      cornerRadiusRatio: CORNER_RADIUS_RATIO,
      wrote: {
        "src/app/favicon.ico": `${icoSizes.join(", ")} (rounded)`,
        ...Object.fromEntries(
          pngTargets.map(([file, size, options]) => [
            path.relative(root, file).replace(/\\/g, "/"),
            `${size}x${size}${options.rounded ? " (rounded)" : " (square, iOS masks it)"}`,
          ]),
        ),
      },
    },
    null,
    2,
  ),
);

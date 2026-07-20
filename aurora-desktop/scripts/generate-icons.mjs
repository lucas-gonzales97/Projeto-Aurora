// Gera os ícones de empacotamento (build/icon.png|.ico|.icns) a partir de
// assets/icon.svg — rodar de novo sempre que o SVG mudar (`npm run icons`).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import png2icons from "png2icons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SVG_PATH = path.join(ROOT, "assets/icon.svg");
const BUILD_DIR = path.join(ROOT, "build");

async function main() {
  mkdirSync(BUILD_DIR, { recursive: true });
  const svg = readFileSync(SVG_PATH);

  const png1024 = await sharp(svg, { density: 384 }).resize(1024, 1024).png().toBuffer();
  writeFileSync(path.join(BUILD_DIR, "icon.png"), png1024);

  const ico = png2icons.createICO(png1024, png2icons.BICUBIC, 0, false, true);
  if (ico) writeFileSync(path.join(BUILD_DIR, "icon.ico"), ico);

  const icns = png2icons.createICNS(png1024, png2icons.BICUBIC, 0);
  if (icns) writeFileSync(path.join(BUILD_DIR, "icon.icns"), icns);

  console.log("Ícones gerados em build/: icon.png, icon.ico, icon.icns");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

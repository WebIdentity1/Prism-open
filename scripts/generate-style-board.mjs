import PDFDocument from "pdfkit";
import fs from "fs";
import https from "https";
import http from "http";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "SUPABASE_URL and SUPABASE_ANON_KEY are required. You can also use VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "Prism-PDF/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  console.log("Fetching styles from database...");
  const { data: styles, error } = await supabase
    .from("style_gallery")
    .select("id, name, category, gender, image_url, is_active")
    .eq("is_active", true)
    .order("category")
    .order("name");

  if (error) {
    console.error("Failed to fetch styles:", error.message);
    process.exit(1);
  }

  console.log(`Found ${styles.length} active styles. Generating PDF...`);

  const doc = new PDFDocument({ size: "LETTER", margin: 40 });
  const outPath = "Prism_Hairstyle_Guide.pdf";
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // ── Title page ──
  doc.moveDown(6);
  doc.fontSize(32).font("Helvetica-Bold").text("Prism", { align: "center" });
  doc.fontSize(22).font("Helvetica").text("Hairstyle Reference Guide", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(12).fillColor("#666").text(`${styles.length} styles  •  ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, { align: "center" });
  doc.fillColor("#000");

  // ── Group by category ──
  const grouped = {};
  for (const s of styles) {
    const cat = s.category || "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  const categories = Object.keys(grouped).sort();
  const COL_COUNT = 3;
  const PAGE_W = 612 - 80; // letter width minus margins
  const GAP = 12;
  const IMG_W = Math.floor((PAGE_W - GAP * (COL_COUNT - 1)) / COL_COUNT);
  const IMG_H = Math.floor(IMG_W * 1.33); // 3:4 aspect
  const CELL_H = IMG_H + 36; // image + label space
  const MARGIN_LEFT = 40;
  const MARGIN_TOP = 40;
  const PAGE_H = 792; // letter height

  let downloaded = 0;
  let failed = 0;

  for (const cat of categories) {
    const catStyles = grouped[cat];

    // Category header page
    doc.addPage();
    doc.fontSize(20).font("Helvetica-Bold").text(cat, MARGIN_LEFT, MARGIN_TOP);
    doc.fontSize(11).font("Helvetica").fillColor("#888")
      .text(`${catStyles.length} style${catStyles.length !== 1 ? "s" : ""}`, MARGIN_LEFT, MARGIN_TOP + 26);
    doc.fillColor("#000");

    let curX = MARGIN_LEFT;
    let curY = MARGIN_TOP + 54;
    let col = 0;

    for (const style of catStyles) {
      // Check if we need a new page
      if (curY + CELL_H > PAGE_H - MARGIN_TOP) {
        doc.addPage();
        curX = MARGIN_LEFT;
        curY = MARGIN_TOP;
        col = 0;
      }

      // Try to fetch and draw image
      let imageDrawn = false;
      if (style.image_url) {
        try {
          const imgBuf = await fetchImage(style.image_url);
          const ext = style.image_url.toLowerCase();
          const imgType = ext.includes(".png") ? "png" : "jpeg";

          doc.save();
          doc.roundedRect(curX, curY, IMG_W, IMG_H, 6).clip();
          doc.image(imgBuf, curX, curY, { width: IMG_W, height: IMG_H, cover: [IMG_W, IMG_H] });
          doc.restore();
          imageDrawn = true;
          downloaded++;
        } catch (e) {
          failed++;
        }
      }

      if (!imageDrawn) {
        // Placeholder rectangle
        doc.save();
        doc.roundedRect(curX, curY, IMG_W, IMG_H, 6).fillAndStroke("#f0f0f0", "#ccc");
        doc.restore();
        doc.fontSize(9).fillColor("#999").text("No image", curX, curY + IMG_H / 2 - 5, { width: IMG_W, align: "center" });
        doc.fillColor("#000");
      }

      // Style name below image
      doc.fontSize(9).font("Helvetica-Bold")
        .text(style.name, curX, curY + IMG_H + 4, { width: IMG_W, align: "center", lineBreak: false, ellipsis: true });

      // Gender badge
      doc.fontSize(7).font("Helvetica").fillColor("#888")
        .text(style.gender || "", curX, curY + IMG_H + 16, { width: IMG_W, align: "center" });
      doc.fillColor("#000");

      // Advance grid position
      col++;
      if (col >= COL_COUNT) {
        col = 0;
        curX = MARGIN_LEFT;
        curY += CELL_H;
      } else {
        curX += IMG_W + GAP;
      }

      // Progress
      const total = downloaded + failed;
      if (total % 10 === 0) {
        process.stdout.write(`\r  Processed ${total}/${styles.length} images...`);
      }
    }
  }

  doc.end();

  await new Promise((resolve) => stream.on("finish", resolve));
  console.log(`\nDone! PDF saved to: ${outPath}`);
  console.log(`  Images downloaded: ${downloaded}, failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

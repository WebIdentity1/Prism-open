import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("open-source style gallery seed", () => {
  test("includes every tracked public hairstyle reference image", () => {
    const rootDir = process.cwd();
    const stylesDir = path.join(rootDir, "public/styles");
    const migrationPath = path.join(
      rootDir,
      "supabase/migrations/20260523000100_seed_open_source_style_gallery.sql",
    );

    const styleImages = fs.readdirSync(stylesDir).filter((file) => file.endsWith(".png")).sort();
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const seededImages = Array.from(migrationSql.matchAll(/'\/styles\/([^']+\.png)'/g))
      .map((match) => match[1])
      .sort();

    expect(styleImages.length).toBe(137);
    expect(seededImages).toEqual(styleImages);
    expect(migrationSql).toContain("compatible_face_shapes");
    expect(migrationSql).toContain("compatible_hair_types");
    expect(migrationSql).toContain("compatible_hair_thicknesses");
  });
});

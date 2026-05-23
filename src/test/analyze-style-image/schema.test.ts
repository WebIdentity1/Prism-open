import { describe, it, expect } from "vitest";
import {
  TRYON_ATTRIBUTES_SCHEMA,
  type TryonAttributes,
} from "../../../supabase/functions/analyze-style-image/lib/schema.ts";

describe("TRYON_ATTRIBUTES_SCHEMA", () => {
  it("is a JSON object schema", () => {
    expect(TRYON_ATTRIBUTES_SCHEMA.type).toBe("OBJECT");
  });

  it("declares all thirteen top-level fields as required", () => {
    const required = TRYON_ATTRIBUTES_SCHEMA.required ?? [];
    const expected = [
      "length",
      "texture",
      "parting",
      "bangs",
      "layering",
      "ends",
      "volume",
      "silhouette",
      "styling",
      "hairline",
      "asymmetry",
      "color",
      "confidence",
    ];
    expect([...required].sort()).toEqual([...expected].sort());
  });

  it("texture enum uses Andre Walker 1A through 4C", () => {
    const textureEnum = (
      TRYON_ATTRIBUTES_SCHEMA.properties?.texture as { enum?: string[] }
    )?.enum;
    expect(textureEnum).toEqual([
      "1A","1B","1C","2A","2B","2C","3A","3B","3C","4A","4B","4C","unknown",
    ]);
  });

  it("parting is a nested object with type + side", () => {
    const parting = TRYON_ATTRIBUTES_SCHEMA.properties?.parting as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(parting.type).toBe("OBJECT");
    expect([...parting.required].sort()).toEqual(["side", "type"]);
  });

  it("bangs is a nested object with style + length", () => {
    const bangs = TRYON_ATTRIBUTES_SCHEMA.properties?.bangs as {
      type: string;
      required: string[];
    };
    expect(bangs.type).toBe("OBJECT");
    expect([...bangs.required].sort()).toEqual(["length", "style"]);
  });

  it("propertyOrdering is set (required for consistent generation)", () => {
    expect(TRYON_ATTRIBUTES_SCHEMA.propertyOrdering).toBeDefined();
    expect(TRYON_ATTRIBUTES_SCHEMA.propertyOrdering?.length).toBe(13);
  });

  it("TryonAttributes type has the expected top-level keys", () => {
    const sample: TryonAttributes = {
      length: "shoulder",
      texture: "2B",
      parting: { type: "side_deep", side: "left" },
      bangs: { style: "curtain", length: "cheek" },
      layering: "long_face_framing",
      ends: "textured",
      volume: "natural",
      silhouette: "rounded",
      styling: "down",
      hairline: "straight",
      asymmetry: "none",
      color: { base: "brown", dimension: "highlights" },
      confidence: { overall: 0.9 },
    };
    expect(sample.texture).toBe("2B");
  });
});

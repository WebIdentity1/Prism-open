import { describe, it, expect } from "vitest";
import {
  buildStylePrompt,
  buildEditPrompt,
  CORE_ANCHORS,
  ANCHOR_BLOCK,
  SYSTEM_INSTRUCTION,
} from "../../../supabase/functions/generate-tryon/lib/prompt.ts";

describe("buildStylePrompt", () => {
  it("includes every validated anchor phrase", () => {
    const prompt = buildStylePrompt({
      styleName: "Beach Waves",
      styleDescription: "Loose tousled waves",
      hasStyleImage: true,
    });
    for (const anchor of CORE_ANCHORS) {
      expect(prompt).toContain(anchor);
    }
  });

  it("does NOT interpolate the style name when a reference image is provided (image is authoritative)", () => {
    const prompt = buildStylePrompt({
      styleName: "Octopus Cut",
      styleDescription: null,
      hasStyleImage: true,
    });
    expect(prompt).not.toContain("Octopus Cut");
    expect(prompt).not.toContain('"');  // no quoted style name in image-mode
  });

  it("DOES interpolate the style name in the text-only fallback (no reference image, name is the only signal)", () => {
    const prompt = buildStylePrompt({
      styleName: "Beach Waves",
      styleDescription: null,
      hasStyleImage: false,
    });
    expect(prompt).toContain("Beach Waves");
  });

  it("does NOT include STYLE DESCRIPTION block in image-mode even when description is provided (image is authoritative)", () => {
    const prompt = buildStylePrompt({
      styleName: "X",
      styleDescription: "Loose tousled waves",
      hasStyleImage: true,
    });
    expect(prompt).not.toMatch(/STYLE DESCRIPTION:/);
    expect(prompt).not.toContain("Loose tousled waves");
  });

  it("DOES include STYLE DESCRIPTION block in text-only fallback when description is provided", () => {
    const prompt = buildStylePrompt({
      styleName: "X",
      styleDescription: "Loose tousled waves",
      hasStyleImage: false,
    });
    expect(prompt).toMatch(/STYLE DESCRIPTION:\s*"Loose tousled waves"/);
  });

  it("omits STYLE DESCRIPTION block in text-only mode when description is null", () => {
    const prompt = buildStylePrompt({
      styleName: "X",
      styleDescription: null,
      hasStyleImage: false,
    });
    expect(prompt).not.toMatch(/STYLE DESCRIPTION:/);
  });

  it("text-only variant (hasStyleImage=false) still contains anchor phrases", () => {
    const prompt = buildStylePrompt({
      styleName: "X",
      styleDescription: null,
      hasStyleImage: false,
    });
    for (const anchor of CORE_ANCHORS) {
      expect(prompt).toContain(anchor);
    }
  });
});

describe("buildEditPrompt", () => {
  it("includes the edit instruction", () => {
    expect(buildEditPrompt("Make it shorter")).toContain("Make it shorter");
  });

  it("locks face/background/clothing", () => {
    const prompt = buildEditPrompt("Add highlights");
    expect(prompt).toMatch(/face/);
    expect(prompt).toMatch(/background/);
    expect(prompt).toMatch(/clothing/);
  });
});

describe("anchor drift", () => {
  it("ANCHOR_BLOCK contains every CORE_ANCHORS phrase — prevents silent drift", () => {
    for (const anchor of CORE_ANCHORS) {
      expect(ANCHOR_BLOCK).toContain(anchor);
    }
  });
});

describe("buildStylePrompt with attributes", () => {
  const sampleAttrs = {
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
  };

  it("is identical to the no-attributes output when attributes is null", () => {
    const withNull = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true, attributes: null,
    });
    const without = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true,
    });
    expect(withNull).toBe(without);
  });

  it("weaves attributes into a prose sentence", () => {
    const p = buildStylePrompt({
      styleName: "Beach Waves",
      styleDescription: null,
      hasStyleImage: true,
      attributes: sampleAttrs,
    });
    expect(p).toMatch(/The reference shows/);
    expect(p).toMatch(/2B texture/);
    expect(p).toMatch(/deep left side part/);
    expect(p).toMatch(/curtain bangs at the cheek/);
  });

  it("adds a Precise specifications: tail", () => {
    const p = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true, attributes: sampleAttrs,
    });
    expect(p).toMatch(/Precise specifications: length: shoulder; texture: 2B/);
  });

  it("still contains every CORE_ANCHORS phrase", () => {
    const p = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true, attributes: sampleAttrs,
    });
    for (const a of CORE_ANCHORS) expect(p).toContain(a);
  });
});

describe("SYSTEM_INSTRUCTION", () => {
  it("is exported as a non-empty string", () => {
    expect(typeof SYSTEM_INSTRUCTION).toBe("string");
    expect(SYSTEM_INSTRUCTION.length).toBeGreaterThan(50);
  });

  it("contains the role anchor", () => {
    expect(SYSTEM_INSTRUCTION).toContain("photorealistic hair-swap editor");
  });

  it("contains the identity-preservation rule", () => {
    expect(SYSTEM_INSTRUCTION).toContain("Never alter the person's identity");
  });

  it("contains the color-preservation rule", () => {
    expect(SYSTEM_INSTRUCTION).toContain("Never copy the color from the reference");
  });

  it("contains the realism anchor", () => {
    expect(SYSTEM_INSTRUCTION).toContain("indistinguishable from an unedited photograph");
  });
});

describe("buildStylePrompt with userAttributes", () => {
  it("is byte-identical when userAttributes is null", () => {
    const withNull = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true, userAttributes: null,
    });
    const without = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true,
    });
    expect(withNull).toBe(without);
  });

  it("renders the v3 HAIR COLOR line when both attrs present", () => {
    const p = buildStylePrompt({
      styleName: "X",
      styleDescription: null,
      hasStyleImage: true,
      userAttributes: { hairType: "coily", hairColor: "black" },
    });
    expect(p).toContain("HAIR COLOR: The person has natural black coily hair.");
    expect(p).toContain("Preserve this exact color and the characteristic appearance of their natural texture");
  });

  it("does NOT contain the v1 HAIR COLOR line when attrs are present", () => {
    const p = buildStylePrompt({
      styleName: "X",
      styleDescription: null,
      hasStyleImage: true,
      userAttributes: { hairType: "coily", hairColor: "black" },
    });
    expect(p).not.toContain("Match to the person's natural hair color visible in their photo");
  });

  it("falls back to v1 line when only hairType is present", () => {
    const partial = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true,
      userAttributes: { hairType: "coily", hairColor: "" },
    });
    const baseline = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true,
    });
    expect(partial).toBe(baseline);
  });

  it("falls back to v1 line when only hairColor is present", () => {
    const partial = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true,
      userAttributes: { hairType: "", hairColor: "black" },
    });
    const baseline = buildStylePrompt({
      styleName: "X", styleDescription: null, hasStyleImage: true,
    });
    expect(partial).toBe(baseline);
  });

  it("renders underscores as spaces in rendered values", () => {
    const p = buildStylePrompt({
      styleName: "X",
      styleDescription: null,
      hasStyleImage: true,
      userAttributes: { hairType: "coily", hairColor: "dark_brown" },
    });
    expect(p).toContain("HAIR COLOR: The person has natural dark brown coily hair.");
  });

  it("every CORE_ANCHORS phrase still appears with userAttributes set", () => {
    const p = buildStylePrompt({
      styleName: "X",
      styleDescription: null,
      hasStyleImage: true,
      userAttributes: { hairType: "wavy", hairColor: "black" },
    });
    for (const a of CORE_ANCHORS) expect(p).toContain(a);
  });
});

import { describe, it, expect } from "vitest";
import { buildAnalyzePrompt } from "../../../supabase/functions/analyze-style-image/lib/analyze-prompt.ts";

describe("buildAnalyzePrompt", () => {
  it("includes the bangs-vs-face-framing decision rule", () => {
    const p = buildAnalyzePrompt("Beach Waves");
    expect(p).toMatch(/face-framing layers/i);
    expect(p).toMatch(/bangs require a deliberate forehead-covering cut/i);
  });

  it("includes a straight-hair few-shot example (1A or 1B)", () => {
    const p = buildAnalyzePrompt("x");
    expect(p).toMatch(/1A|1B/);
  });

  it("includes a curly few-shot example (3A-3C)", () => {
    const p = buildAnalyzePrompt("x");
    expect(p).toMatch(/3A|3B|3C/);
  });

  it("includes a coily few-shot example (4A-4C)", () => {
    const p = buildAnalyzePrompt("x");
    expect(p).toMatch(/4A|4B|4C/);
  });

  it("warns against defaulting to 'wavy' without evidence", () => {
    const p = buildAnalyzePrompt("x");
    expect(p).toMatch(/do not default to "wavy"/i);
  });

  it("instructs occluded fields to use 'unknown' with lower confidence", () => {
    const p = buildAnalyzePrompt("x");
    expect(p).toMatch(/unknown/);
    expect(p).toMatch(/confidence/i);
  });

  it("weaves in the style name for context", () => {
    const p = buildAnalyzePrompt("Textured Crop");
    expect(p).toContain("Textured Crop");
  });
});

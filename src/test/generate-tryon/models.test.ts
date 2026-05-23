import { describe, it, expect } from "vitest";
import {
  resolveModelChain,
  buildGenerationConfig,
  MODEL_NB2,
  MODEL_NB_PRO,
  MODEL_NB_LEGACY,
  type Tier,
} from "../../../supabase/functions/generate-tryon/lib/models.ts";

describe("resolveModelChain", () => {
  it("default tier puts NB2 first", () => {
    const chain = resolveModelChain("default");
    expect(chain[0]).toBe(MODEL_NB2);
  });

  it("default tier keeps NB legacy as last-resort fallback", () => {
    const chain = resolveModelChain("default");
    expect(chain).toContain(MODEL_NB_LEGACY);
    expect(chain.indexOf(MODEL_NB_LEGACY)).toBe(chain.length - 1);
  });

  it("pro tier puts Pro first", () => {
    const chain = resolveModelChain("pro");
    expect(chain[0]).toBe(MODEL_NB_PRO);
  });

  it("pro tier keeps NB2 as fallback below Pro", () => {
    const chain = resolveModelChain("pro");
    expect(chain).toContain(MODEL_NB2);
    expect(chain.indexOf(MODEL_NB2)).toBeGreaterThan(
      chain.indexOf(MODEL_NB_PRO)
    );
  });

  it("undefined tier is treated as default", () => {
    const chain = resolveModelChain(undefined);
    expect(chain[0]).toBe(MODEL_NB2);
  });

  it("unknown string tier is treated as default", () => {
    const chain = resolveModelChain("garbage" as Tier);
    expect(chain[0]).toBe(MODEL_NB2);
  });
});

describe("buildGenerationConfig", () => {
  it("requests 2K output resolution", () => {
    const cfg = buildGenerationConfig();
    expect(cfg.imageConfig?.imageSize).toBe("2K");
  });

  it("keeps TEXT and IMAGE response modalities", () => {
    const cfg = buildGenerationConfig();
    expect(cfg.responseModalities).toEqual(["TEXT", "IMAGE"]);
  });

  it("sets temperature to 0.3 (low temperature for faithful try-on reconstruction)", () => {
    const cfg = buildGenerationConfig();
    expect(cfg.temperature).toBe(0.3);
  });
});

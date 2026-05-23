// Nano Banana 2 — default. 2K native, thinking-mode reasoning, Flash-tier latency.
// Best tradeoff for interactive try-on.
export const MODEL_NB2 = "gemini-3.1-flash-image-preview";

// Nano Banana Pro — slower, sharper strand detail + identity micro-detail.
// Used on-demand for "Enhance" button.
export const MODEL_NB_PRO = "gemini-3-pro-image-preview";

// Original Nano Banana — 1K ceiling. Kept only as availability fallback.
export const MODEL_NB_LEGACY = "gemini-2.5-flash-image";

export type GeminiModelId =
  | typeof MODEL_NB2
  | typeof MODEL_NB_PRO
  | typeof MODEL_NB_LEGACY;

export type Tier = "default" | "pro";

export function resolveModelChain(tier: Tier | undefined): GeminiModelId[] {
  if (tier === "pro") {
    return [MODEL_NB_PRO, MODEL_NB2, MODEL_NB_LEGACY];
  }
  return [MODEL_NB2, MODEL_NB_PRO, MODEL_NB_LEGACY];
}

export interface GenerationConfig {
  responseModalities: ["TEXT", "IMAGE"];
  temperature?: number;
  // Optional so Task 3's smoke test can strip this field if the Gemini REST API rejects imageConfig on any model variant.
  imageConfig?: {
    imageSize: "0.5K" | "1K" | "2K" | "4K";
  };
}

export function buildGenerationConfig(): GenerationConfig {
  return {
    responseModalities: ["TEXT", "IMAGE"],
    temperature: 0.3,
    imageConfig: { imageSize: "2K" },
  };
}

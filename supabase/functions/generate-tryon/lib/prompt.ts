// Community-validated Nano Banana hair-swap anchor phrases.
// Do not paraphrase — these specific strings measurably outperform alternatives.
// CORE_ANCHORS is the canonical test/eval-harness fixture. ANCHOR_BLOCK below is the prose that ships to the model.
// The anchor-drift test enforces that every CORE_ANCHORS phrase appears verbatim in ANCHOR_BLOCK.
export const CORE_ANCHORS = [
  "Match my head shape exactly",
  "natural shadows",
  "Clean edges around ears and neckline",
  "No floating",
] as const;

export interface StylePromptInput {
  styleName: string;
  styleDescription: string | null;
  hasStyleImage: boolean;
  attributes?: StyleAttributesForPrompt | null;
  userAttributes?: { hairType: string; hairColor: string } | null;
}

// Subset of TryonAttributes that actually helps generation. Kept local to this module
// to avoid cross-module type imports across Deno/Node runtime boundaries.
export interface StyleAttributesForPrompt {
  length: string;
  texture: string;
  parting: { type: string; side: string };
  bangs: { style: string; length: string };
  layering: string;
  ends: string;
  volume: string;
  silhouette: string;
  styling: string;
  hairline: string;
  asymmetry: string;
}

function renderAttributesBlock(a: StyleAttributesForPrompt): string {
  const partingPhrase = a.parting.type === "none"
    ? "no visible part"
    : a.parting.type === "center"
    ? "a center part"
    : `a ${a.parting.type.replace("side_", "")} ${a.parting.side} side part`;
  const bangsPhrase = a.bangs.style === "none"
    ? "no bangs"
    : `${a.bangs.style.replace("_", " ")} bangs at the ${a.bangs.length.replace("_", " ")}`;
  const sentence = `The reference shows ${a.length.replace("_", "-")}-length hair with ${a.texture} texture, ${partingPhrase}, ${bangsPhrase}, ${a.layering.replace(/_/g, " ")} layering, ${a.volume.replace("_", " ")} volume, and a ${a.silhouette.replace("_", "-")} silhouette worn ${a.styling.replace("_", " ")}.`;
  const specs = [
    `length: ${a.length}`,
    `texture: ${a.texture}`,
    `parting: ${a.parting.type}${a.parting.side !== "na" ? ` (${a.parting.side})` : ""}`,
    `bangs: ${a.bangs.style}${a.bangs.length !== "na" ? ` to ${a.bangs.length}` : ""}`,
    `layering: ${a.layering}`,
    `ends: ${a.ends}`,
    `volume: ${a.volume}`,
    `silhouette: ${a.silhouette}`,
    `styling: ${a.styling}`,
    `hairline: ${a.hairline}`,
    `asymmetry: ${a.asymmetry}`,
  ].join("; ");
  return `${sentence}\n\nPrecise specifications: ${specs}.`;
}

function renderHairColorLine(userAttrs: { hairType: string; hairColor: string } | null | undefined): string {
  if (!userAttrs || !userAttrs.hairType || !userAttrs.hairColor) {
    return "HAIR COLOR: Match to the person's natural hair color visible in their photo (or very close to it). Do NOT copy the color from the reference.";
  }
  const color = userAttrs.hairColor.replace(/_/g, " ");
  const type = userAttrs.hairType.replace(/_/g, " ");
  return `HAIR COLOR: The person has natural ${color} ${type} hair. Preserve this exact color and the characteristic appearance of their natural texture in the output. Do NOT copy the color from the reference.`;
}

export const ANCHOR_BLOCK = [
  "ADHERENCE ANCHORS (very important):",
  "- Match my head shape exactly.",
  "- Hair should cast natural shadows like it's really there. No floating. No weird edges.",
  "- Clean edges around ears and neckline.",
  "- Face, skin tone, lighting, and background untouched.",
].join("\n");

// System instruction delivered on the separate `systemInstruction` role channel.
// Deliberately redundant with WHAT TO PRESERVE + HAIR COLOR blocks in the user
// prompt — systemInstruction anchors role-level constraints in a channel the
// model weights more strictly. Load-bearing phrases enforced by unit tests.
export const SYSTEM_INSTRUCTION = `You are a professional photorealistic hair-swap editor. Your only job: replace the hair in the user's photo with the hairstyle from the reference image, while preserving every other aspect of the user's photo — their face, skin tone, identity, expression, lighting, background, and natural hair color. Never alter the person's identity. Never copy the color from the reference; preserve the user's natural hair color. Output must be indistinguishable from an unedited photograph.`;

export function buildStylePrompt(input: StylePromptInput): string {
  const { styleName, styleDescription, hasStyleImage } = input;
  const descBlock = styleDescription
    ? `\n\nSTYLE DESCRIPTION: "${styleDescription}" — use this as additional guidance for the hairstyle's defining characteristics.`
    : "";
  const attrBlock = input.attributes ? `\n\n${renderAttributesBlock(input.attributes)}` : "";

  if (hasStyleImage) {
    // Note: styleName + styleDescription are deliberately NOT interpolated when a
    // reference image is provided. The image is authoritative; gallery metadata can
    // conflict (e.g. style named "Octopus Cut" but image actually shows a cut with
    // bangs — model sometimes followed the name's classical form, dropping bangs).
    // attrBlock (v2 reference-attribute injection) is still wired but currently
    // disabled in production via index.ts (always null), so it's a no-op here.
    return `I have two images. The FIRST image is the HAIRSTYLE REFERENCE — it shows the exact hairstyle I want applied. The SECOND image is a PHOTO OF A REAL PERSON — this is the person whose hair must be changed.${attrBlock}

YOUR TASK: Take the SECOND image (the real person) and replace ONLY their hair with the EXACT hairstyle shown in the FIRST image (the reference).

WHAT TO COPY FROM THE REFERENCE — be precise about ALL of these:
- The exact CUT and SHAPE (silhouette, layering pattern, where hair falls)
- The exact LENGTH (how far it extends from the head, where it reaches relative to ears/neck/shoulders)
- The exact VOLUME and DENSITY (how thick/thin, how close to head vs. lifted)
- The exact TEXTURE and PATTERN (straight, wavy, curly, coiled — match it exactly)
- The exact STYLING (direction of flow, parting, swept-back vs. falling forward, tucked vs. loose)

WHAT TO PRESERVE ON THE PERSON — do NOT change any of these:
- Face, skin tone, eyes, eyebrows, expression — pixel-perfect unchanged
- Ears, neck, shoulders, clothing — exactly as they are
- Background, lighting, camera angle — identical to the original photo
- Facial hair (beard, mustache) if present — keep unchanged

${renderHairColorLine(input.userAttributes)}

BLENDING: The new hairstyle must sit naturally on the person's head — respect their hairline and head shape. The transition from hair to skin should be seamless.

${ANCHOR_BLOCK}

OUTPUT: A photorealistic image that looks like a real photograph. It should be impossible to tell this was AI-generated.`;
  }

  return `Here is a photo of a person. Apply the "${styleName || "selected"}" hairstyle to this person.${descBlock}${attrBlock}

Change ONLY their hair. Keep their face, skin, eyes, expression, background, clothing, and lighting EXACTLY the same. Match hair color to their natural color.

${ANCHOR_BLOCK}

Output must look like a real photograph.`;
}

export function buildEditPrompt(editInstruction: string): string {
  return `Here is a photo of a person. Edit ONLY their hair: "${editInstruction}". Do NOT change the face, background, clothing, skin, expression, or anything else. Return the same photo with only the hair modified.

${ANCHOR_BLOCK}`;
}

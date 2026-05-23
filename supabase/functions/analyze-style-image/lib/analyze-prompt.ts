const FEW_SHOT_BLOCK = `REFERENCE EXAMPLES (for texture calibration — do not describe these, use them as a rubric):
- "Straight 1A/1B example": hair falls completely flat, shows no bend, high shine, individual strands pencil-straight. texture = 1A or 1B.
- "Curly 3B example": clearly defined spiral curls the diameter of a marker pen or smaller, springy, visible curl pattern throughout. texture = 3B.
- "Coily 4B example": tight zigzag or z-pattern, coil diameter smaller than a pencil, may look "fluffy" or "dense" when natural. texture = 4B or 4C.`;

const DECISION_RULES = `DECISION RULES:
- bangs vs face-framing layers: bangs require a DELIBERATE forehead-covering cut. If hair simply falls forward from a part without an intentional forehead fringe, that is long_face_framing layers — set bangs.style = "none". Bangs require a deliberate forehead-covering cut.
- texture calibration: do not default to "wavy" (2A/2B/2C) unless you see clearly visible S-shaped bends. If the hair appears flat/straight, use 1A-1C. If you see defined spirals, use 3A-3C. If you see tight zigzag coils or Afro-textured silhouette, use 4A-4C.
- length: if the style is pulled up (styling != "down"), length is inferred from visible strand length; set confidence.overall lower (0.4-0.6) to reflect the inference.
- occluded fields: if a feature cannot be determined from the image (e.g. hairline hidden by bangs, layering obscured by dark hair), use "unknown" where that enum value is offered and lower confidence.overall accordingly.
- coily hair is historically UNDER-detected by vision models; if you see ANY zigzag pattern, tight coil, or Afro silhouette, report 4A/4B/4C — do not downgrade to 3C.`;

export function buildAnalyzePrompt(styleName: string): string {
  const safeName = styleName || "unnamed hairstyle";
  return `You are a master hairstylist classifying a reference hairstyle image.

The image shows the hairstyle called "${safeName}". Your job: extract precise visual attributes about the HAIRSTYLE ITSELF — ignore the model/mannequin face, the background, and the photo styling.

${FEW_SHOT_BLOCK}

${DECISION_RULES}

Return a single JSON object conforming to the provided schema. Every required field must be set. Use "unknown" for fields that cannot be determined from the image — do not guess under false confidence.`;
}

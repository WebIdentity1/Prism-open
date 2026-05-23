// Gemini responseSchema uses capitalized type names: "OBJECT", "STRING", "ARRAY", "NUMBER".
// propertyOrdering materially improves consistency across runs.
// See https://ai.google.dev/gemini-api/docs/structured-output

export interface TryonAttributes {
  length:
    | "ear"
    | "chin"
    | "shoulder"
    | "collarbone"
    | "mid_back"
    | "waist"
    | "unknown";
  texture:
    | "1A" | "1B" | "1C"
    | "2A" | "2B" | "2C"
    | "3A" | "3B" | "3C"
    | "4A" | "4B" | "4C"
    | "unknown";
  parting: {
    type: "center" | "side_shallow" | "side_deep" | "zigzag" | "none";
    side: "left" | "right" | "na";
  };
  bangs: {
    style:
      | "none"
      | "blunt"
      | "curtain"
      | "wispy"
      | "side_swept"
      | "baby"
      | "arched";
    length:
      | "na"
      | "above_brow"
      | "brow"
      | "below_brow"
      | "eye"
      | "cheek";
  };
  layering:
    | "blunt_one_length"
    | "long_face_framing"
    | "heavy_internal"
    | "wolf_cut"
    | "undercut"
    | "shag"
    | "disconnected"
    | "unknown";
  ends: "blunt" | "textured" | "feathered" | "wispy" | "razored";
  volume: "flat_crown" | "natural" | "lifted_crown" | "teased";
  silhouette:
    | "fitted"
    | "rounded"
    | "a_line"
    | "pyramid"
    | "mushroom"
    | "triangular";
  styling:
    | "down"
    | "half_up"
    | "updo"
    | "braid"
    | "ponytail"
    | "pulled_back"
    | "space_buns";
  hairline:
    | "straight"
    | "widows_peak"
    | "receding"
    | "cowlick"
    | "unknown";
  asymmetry: "none" | "slight" | "strong";
  color: {
    base:
      | "black"
      | "dark_brown"
      | "brown"
      | "light_brown"
      | "red"
      | "auburn"
      | "blonde"
      | "platinum"
      | "gray"
      | "fantasy";
    dimension:
      | "none"
      | "highlights"
      | "balayage"
      | "ombre"
      | "money_piece";
  };
  confidence: {
    overall: number;
  };
}

export const TRYON_ATTRIBUTES_SCHEMA = {
  type: "OBJECT",
  propertyOrdering: [
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
  ],
  properties: {
    length: {
      type: "STRING",
      enum: ["ear", "chin", "shoulder", "collarbone", "mid_back", "waist", "unknown"],
    },
    texture: {
      type: "STRING",
      enum: ["1A","1B","1C","2A","2B","2C","3A","3B","3C","4A","4B","4C","unknown"],
    },
    parting: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING", enum: ["center","side_shallow","side_deep","zigzag","none"] },
        side: { type: "STRING", enum: ["left","right","na"] },
      },
      required: ["type", "side"],
    },
    bangs: {
      type: "OBJECT",
      properties: {
        style: { type: "STRING", enum: ["none","blunt","curtain","wispy","side_swept","baby","arched"] },
        length: { type: "STRING", enum: ["na","above_brow","brow","below_brow","eye","cheek"] },
      },
      required: ["style", "length"],
    },
    layering: {
      type: "STRING",
      enum: ["blunt_one_length","long_face_framing","heavy_internal","wolf_cut","undercut","shag","disconnected","unknown"],
    },
    ends: {
      type: "STRING",
      enum: ["blunt","textured","feathered","wispy","razored"],
    },
    volume: {
      type: "STRING",
      enum: ["flat_crown","natural","lifted_crown","teased"],
    },
    silhouette: {
      type: "STRING",
      enum: ["fitted","rounded","a_line","pyramid","mushroom","triangular"],
    },
    styling: {
      type: "STRING",
      enum: ["down","half_up","updo","braid","ponytail","pulled_back","space_buns"],
    },
    hairline: {
      type: "STRING",
      enum: ["straight","widows_peak","receding","cowlick","unknown"],
    },
    asymmetry: {
      type: "STRING",
      enum: ["none","slight","strong"],
    },
    color: {
      type: "OBJECT",
      properties: {
        base: { type: "STRING", enum: ["black","dark_brown","brown","light_brown","red","auburn","blonde","platinum","gray","fantasy"] },
        dimension: { type: "STRING", enum: ["none","highlights","balayage","ombre","money_piece"] },
      },
      required: ["base", "dimension"],
    },
    confidence: {
      type: "OBJECT",
      properties: {
        overall: { type: "NUMBER" },
      },
      required: ["overall"],
    },
  },
  required: [
    "length","texture","parting","bangs","layering","ends","volume",
    "silhouette","styling","hairline","asymmetry","color","confidence",
  ],
} as const;

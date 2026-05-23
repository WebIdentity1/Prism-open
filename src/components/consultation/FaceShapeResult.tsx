import { motion } from "framer-motion";
import { Sparkles, Info, Scissors } from "lucide-react";

interface FaceShapeResultProps {
  faceShape: string;
  confidence: number;
  currentHairLength: string;
  hairType?: string;
  hairThickness?: string;
  analysis: string;
  recommendations: string[];
}

const shapeDescriptions: Record<string, string> = {
  oval: "Balanced proportions with a slightly narrower forehead and jaw",
  round: "Equal width and length with soft, curved features",
  square: "Strong jawline with forehead and jaw similar in width",
  heart: "Wider forehead tapering to a narrower chin",
  oblong: "Longer than wide with relatively even proportions",
  diamond: "Narrow forehead and jawline with wider cheekbones",
  triangle: "Wider jaw tapering to a narrower forehead",
  inverted_triangle: "Wider forehead tapering to a narrow jaw",
};

const shapeEmojis: Record<string, string> = {
  oval: "🥚",
  round: "🔵",
  square: "🟦",
  heart: "💚",
  oblong: "📏",
  diamond: "💎",
  triangle: "🔺",
  inverted_triangle: "🔻",
};

const FaceShapeResult = ({ faceShape, confidence, currentHairLength, hairType, hairThickness, analysis, recommendations }: FaceShapeResultProps) => {
  const displayShape = faceShape.replace(/_/g, " ");
  const displayLength = currentHairLength.charAt(0).toUpperCase() + currentHairLength.slice(1);
  const confidencePercent = Math.round(confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Main result card */}
      <div className="glass-elevated rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">{shapeEmojis[faceShape] || "✨"}</div>
        <div className="ai-badge inline-flex items-center gap-1.5 mb-3">
          <span className="ai-pulse" />
          <span className="text-xs font-medium capitalize">{displayShape} Face Shape</span>
        </div>
        <h3 className="text-2xl capitalize font-light">
          {displayShape} Face Shape
        </h3>
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-prism"
              initial={{ width: 0 }}
              animate={{ width: `${confidencePercent}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{confidencePercent}% confidence</span>
        </div>
      </div>

      {/* Hair length */}
      <div className="glass-subtle rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Scissors className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium mb-1">Current Hair Length</p>
            <p className="text-sm text-muted-foreground">
              Your hair is currently <span className="font-medium text-foreground">{displayLength}</span>. We'll only show you styles achievable with your current length.
            </p>
          </div>
        </div>
      </div>

      {/* Hair type */}
      {hairType && (
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium mb-1">Hair Type</p>
              <p className="text-sm text-muted-foreground">
                Your hair type is <span className="font-medium text-foreground capitalize">{hairType}</span>
                {hairThickness && (
                  <> with <span className="font-medium text-foreground">{hairThickness}</span> thickness</>
                )}
                . We'll only show styles that work with your hair texture.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis */}
      <div className="glass-subtle rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium mb-1">Analysis</p>
            <p className="text-sm text-muted-foreground">{analysis}</p>
            <p className="text-xs text-muted-foreground/70 mt-2 italic">
              {shapeDescriptions[faceShape]}
            </p>
          </div>
        </div>
      </div>

      {/* Recommended categories */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Recommended Style Categories</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recommendations.map((rec) => (
            <span
              key={rec}
              className="badge-glass px-3 py-1.5 rounded-full text-xs font-medium capitalize"
            >
              {rec}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default FaceShapeResult;

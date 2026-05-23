import { useState, useRef, useCallback } from "react";
import { Camera, Upload, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoCaptureProps {
  onPhotoCapture: (file: File) => void;
  capturedPhoto: string | null;
  onRetake: () => void;
}

const PhotoCapture = ({ onPhotoCapture, capturedPhoto, onRetake }: PhotoCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch {
      fileInputRef.current?.click();
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setIsCameraActive(false);
  }, [stream]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        onPhotoCapture(file);
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  }, [onPhotoCapture, stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPhotoCapture(file);
  };

  if (capturedPhoto) {
    return (
      <div className="relative">
        <div className="aspect-[3/4] max-w-sm mx-auto glass-elevated rounded-3xl overflow-hidden border-2 border-primary/20 shadow-lg shadow-primary/10">
          <img src={capturedPhoto} alt="Captured selfie" className="w-full h-full object-cover" />
        </div>
        <div className="flex justify-center mt-4 gap-3">
          <Button variant="outline" onClick={onRetake} className="rounded-full">
            <RotateCcw className="h-4 w-4 mr-2" /> Retake
          </Button>
          <Button variant="default" disabled className="bg-gradient-prism text-white rounded-full">
            <Check className="h-4 w-4 mr-2" /> Photo Ready
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/4] max-w-sm mx-auto glass-elevated rounded-3xl overflow-hidden border-2 border-dashed border-primary/20 bg-muted/30">
        {/* Video element always mounted so ref is available */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn("w-full h-full object-cover", !isCameraActive && "hidden")}
        />
        {!isCameraActive && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center absolute inset-0">
            <div className="w-16 h-16 rounded-full bg-gradient-prism flex items-center justify-center">
              <Camera className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">Take or upload a selfie</p>
              <p className="text-xs text-muted-foreground mt-1">
                Face the camera directly with good lighting
              </p>
            </div>
          </div>
        )}

        {/* Face framing guide overlay */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none">
            <svg viewBox="0 0 300 400" className="w-full h-full">
              {/* Dimmed overlay */}
              <defs>
                <mask id="faceMask">
                  <rect width="300" height="400" fill="white" />
                  <ellipse cx="150" cy="170" rx="95" ry="125" fill="black" />
                </mask>
              </defs>
              <rect width="300" height="400" fill="rgba(0,0,0,0.4)" mask="url(#faceMask)" />
              {/* Face guide outline */}
              <ellipse cx="150" cy="170" rx="95" ry="125" fill="none" stroke="hsl(174, 62%, 38%)" strokeWidth="2" strokeDasharray="8 4" opacity="0.8" />
              {/* Guide text */}
              <text x="150" y="340" textAnchor="middle" fill="white" fontSize="14" fontFamily="sans-serif">
                Align your face within the guide
              </text>
            </svg>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex justify-center gap-3">
        {isCameraActive ? (
          <>
            <Button variant="outline" onClick={stopCamera} className="rounded-full">Cancel</Button>
            <Button onClick={takePhoto} className="bg-gradient-prism text-white rounded-full">
              <Camera className="h-4 w-4 mr-2" /> Capture
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={startCamera} className="rounded-full">
              <Camera className="h-4 w-4 mr-2" /> Use Camera
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} className="bg-gradient-prism text-white rounded-full">
              <Upload className="h-4 w-4 mr-2" /> Upload Photo
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
};

export default PhotoCapture;

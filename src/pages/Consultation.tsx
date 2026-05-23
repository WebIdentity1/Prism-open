import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Scissors, ArrowLeft, ArrowRight, Loader2, Send, Sparkles, CalendarPlus } from "lucide-react";
import PhotoCapture from "@/components/consultation/PhotoCapture";
import FaceShapeResult from "@/components/consultation/FaceShapeResult";
import StyleGallery from "@/components/consultation/StyleGallery";
import TryOnReview from "@/components/consultation/TryOnReview";
import type { User } from "@supabase/supabase-js";

type Step = "photo" | "analysis" | "gallery" | "generate" | "review";
type Gender = "male" | "female" | null;

interface FaceAnalysis {
  face_shape: string;
  confidence: number;
  current_hair_length: string;
  hair_type: string;
  hair_thickness: string;
  natural_hair_color: string;
  analysis: string;
  recommendations: string[];
}

interface StyleItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string;
  gender: string | null;
  compatible_face_shapes: string[];
  compatible_hair_types: string[];
  compatible_hair_thicknesses: string[];
  hair_length: string | null;
  tags: string[] | null;
}

interface TryOnResult {
  styleId: string;
  styleName: string;
  styleImageUrl: string;
  tryOnUrl: string | null;
  generating: boolean;
  error: string | null;
}

const MAX_SELECTIONS = 5;

const Consultation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const salonParam = searchParams.get("salon") || searchParams.get("salon_id");
  const appointmentIdParam = searchParams.get("appointment_id");
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<Step>("photo");
  const [selectedGender, setSelectedGender] = useState<Gender>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis | null>(null);
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(new Set());
  const [tryOnResults, setTryOnResults] = useState<TryOnResult[]>([]);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [favoriteStyleId, setFavoriteStyleId] = useState<string | null>(null);
  const [clientNotes, setClientNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [consultationId, setConsultationId] = useState<string | null>(null);

  const redirectToLogin = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) redirectToLogin();
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) redirectToLogin();
    });
    return () => subscription.unsubscribe();
  }, [redirectToLogin]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  useEffect(() => {
    const fetchStyles = async () => {
      setStylesLoading(true);
      let query = supabase
        .from("style_gallery")
        .select("*")
        .eq("is_active", true);
      if (selectedGender) {
        query = query.or(`gender.eq.${selectedGender},gender.eq.unisex`);
      }
      const { data, error } = await query;
      if (error) toast.error("Failed to load styles");
      else setStyles((data as StyleItem[]) || []);
      setStylesLoading(false);
    };
    fetchStyles();
  }, [selectedGender]);

  const handlePhotoCapture = useCallback((file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, []);

  const handleRetake = useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelfieUrl(null);
    setFaceAnalysis(null);
    setSelectedStyleIds(new Set());
    setTryOnResults([]);
    setEditingStyleId(null);
    setFavoriteStyleId(null);
    setClientNotes("");
    setConsultationId(null);
    setStep("photo");
  }, []);

  const analyzePhoto = async () => {
    if (!photoFile || !user) return;
    setAnalyzing(true);
    try {
      const filePath = `${user.id}/${Date.now()}-selfie.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("consultation-photos")
        .upload(filePath, photoFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("consultation-photos")
        .getPublicUrl(filePath);
      const uploadedUrl = urlData.publicUrl;
      setSelfieUrl(uploadedUrl);

      const consultationInsert: any = { client_id: user.id, selfie_url: uploadedUrl, status: "draft" };
      if (salonParam) consultationInsert.salon_id = salonParam;

      const { data: consultation, error: consultError } = await supabase
        .from("consultations")
        .insert(consultationInsert)
        .select()
        .single();
      if (consultError) throw consultError;
      setConsultationId(consultation.id);

      const response = await supabase.functions.invoke("detect-face-shape", {
        body: { imageUrl: uploadedUrl },
      });
      if (response.error) throw response.error;

      const result = response.data as FaceAnalysis;
      setFaceAnalysis(result);

      await supabase
        .from("consultations")
        .update({
          face_shape: result.face_shape as any,
          face_shape_confidence: result.confidence,
          face_analysis_notes: result.analysis,
          detected_hair_type: result.hair_type || null,
          detected_hair_thickness: result.hair_thickness || null,
          detected_natural_hair_color: result.natural_hair_color || null,
        })
        .eq("id", consultation.id);

      setStep("analysis");
      toast.success("Face shape analysis complete!");
    } catch (e: any) {
      toast.error(e.message || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSelectStyle = (styleId: string) => {
    setSelectedStyleIds((prev) => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else if (next.size < MAX_SELECTIONS) {
        next.add(styleId);
      }
      return next;
    });
  };

  // Convert a (possibly relative) image URL to a base64 data URL so the edge function can use it
  const toDataUrl = async (url: string): Promise<string> => {
    if (url.startsWith("data:")) return url;
    if (url.startsWith("http")) return url;
    // Relative path — fetch from this origin and convert to base64
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };

  // Generate all try-ons for selected styles
  const generateAllTryOns = async () => {
    if (!selfieUrl || selectedStyleIds.size === 0) return;

    const selectedStyles = styles.filter(s => selectedStyleIds.has(s.id));

    // Initialize results
    const initialResults: TryOnResult[] = selectedStyles.map(s => ({
      styleId: s.id,
      styleName: s.name,
      styleImageUrl: s.image_url,
      tryOnUrl: null,
      generating: true,
      error: null,
    }));
    setTryOnResults(initialResults);
    setStep("generate");

    // Send the storage URL directly — the edge function fetches the image.
    // Sending base64 data URLs can exceed the edge function request body limit.
    const preConvertedSelfie: string = selfieUrl;

    // Helper: invoke generate-tryon with auto-retry (handles transient 429s / edge function errors)
    // Does NOT retry when the edge function hit its worker resource limit (HTTP 546) — that's
    // deterministic (NB2 tail latency exceeded Supabase's ~150s wall-time) so retrying would
    // just burn another ~150s and produce the same failure. User can retry manually via the
    // Regenerate button. Same bailout if a single attempt took >90s (almost always a 546).
    const invokeWithRetry = async (body: any, maxAttempts = 2): Promise<{ imageUrl?: string; error?: string }> => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const t0 = Date.now();
        try {
          const response = await supabase.functions.invoke("generate-tryon", { body });
          if (response.error) {
            // Supabase SDK wraps non-2xx as generic "Edge Function returned a non-2xx status code"
            // Try to extract the actual error from the response data
            const msg = response.data?.error || response.error.message || "Generation failed";
            const msgLower = msg.toLowerCase();
            const elapsed = Date.now() - t0;
            const isWorkerLimit = msgLower.includes("worker_resource_limit") || msgLower.includes("compute resources") || elapsed > 90000;
            if (attempt < maxAttempts - 1 && !msg.includes("credits") && !isWorkerLimit) {
              // Retry after a delay (skip retry for credit exhaustion + worker timeouts)
              await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
              continue;
            }
            return { error: isWorkerLimit ? "Generation timed out. Please try again." : msg };
          }
          return { imageUrl: response.data.imageUrl };
        } catch (e: any) {
          const elapsed = Date.now() - t0;
          if (attempt < maxAttempts - 1 && elapsed < 90000) {
            await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
            continue;
          }
          return { error: elapsed > 90000 ? "Generation timed out. Please try again." : (e.message || "Failed") };
        }
      }
      return { error: "Generation failed after retries" };
    };

    // Fire all generations concurrently — each result streams into state independently
    await Promise.allSettled(
      selectedStyles.map(async (style) => {
        const result = await invokeWithRetry({
          selfieUrl: preConvertedSelfie,
          styleImageUrl: await toDataUrl(style.image_url),
          styleName: style.name,
          styleDescription: style.description || undefined,
          tier: "default",
          styleId: style.id,
          consultationId,
        });

        if (result.imageUrl) {
          setTryOnResults(prev => prev.map(r =>
            r.styleId === style.id ? { ...r, generating: false, tryOnUrl: result.imageUrl! } : r
          ));
        } else {
          setTryOnResults(prev => prev.map(r =>
            r.styleId === style.id ? { ...r, generating: false, error: result.error || "Generation failed" } : r
          ));
        }
      })
    );

    setStep("review");
  };

  // Retry a single failed try-on
  const handleRetryTryOn = async (styleId: string) => {
    const style = styles.find(s => s.id === styleId);
    if (!style || !selfieUrl) return;

    setTryOnResults(prev => prev.map(r =>
      r.styleId === styleId ? { ...r, generating: true, error: null } : r
    ));

    try {
      const response = await supabase.functions.invoke("generate-tryon", {
        body: { selfieUrl, styleImageUrl: await toDataUrl(style.image_url), styleName: style.name, styleDescription: style.description || undefined, tier: "default", styleId: style.id, consultationId },
      });

      if (response.error) {
        const msg = response.data?.error || response.error.message || "Generation failed";
        setTryOnResults(prev => prev.map(r =>
          r.styleId === styleId ? { ...r, generating: false, error: msg } : r
        ));
      } else {
        setTryOnResults(prev => prev.map(r =>
          r.styleId === styleId ? { ...r, generating: false, tryOnUrl: response.data.imageUrl } : r
        ));
      }
    } catch (e: any) {
      setTryOnResults(prev => prev.map(r =>
        r.styleId === styleId ? { ...r, generating: false, error: e.message || "Failed" } : r
      ));
    }
  };

  // Re-invoke generate-tryon with tier: "pro" to enhance an existing result
  const handleEnhanceWithPro = async (styleId: string) => {
    const result = tryOnResults.find(r => r.styleId === styleId);
    const style = styles.find(s => s.id === styleId);
    if (!result || !style || !selfieUrl) return;

    setTryOnResults(prev => prev.map(r =>
      r.styleId === styleId ? { ...r, generating: true, error: null } : r
    ));

    try {
      const response = await supabase.functions.invoke("generate-tryon", {
        body: {
          selfieUrl,
          styleImageUrl: await toDataUrl(style.image_url),
          styleName: style.name,
          styleDescription: style.description || undefined,
          tier: "pro",
          styleId: style.id,
          consultationId,
        },
      });

      if (response.error) {
        const msg = response.data?.error || response.error.message || "Pro enhance failed";
        setTryOnResults(prev => prev.map(r =>
          r.styleId === styleId ? { ...r, generating: false, error: msg } : r
        ));
        return;
      }

      const imageUrl = (response.data as { imageUrl?: string })?.imageUrl;
      if (!imageUrl) {
        setTryOnResults(prev => prev.map(r =>
          r.styleId === styleId ? { ...r, generating: false, error: "No imageUrl in response" } : r
        ));
        return;
      }

      setTryOnResults(prev => prev.map(r =>
        r.styleId === styleId ? { ...r, tryOnUrl: imageUrl, generating: false, error: null } : r
      ));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Pro enhance failed";
      setTryOnResults(prev => prev.map(r =>
        r.styleId === styleId ? { ...r, generating: false, error: message } : r
      ));
    }
  };

  // Handle edit request for a specific try-on
  const handleRequestEdit = async (styleId: string, instruction: string) => {
    const result = tryOnResults.find(r => r.styleId === styleId);
    if (!result?.tryOnUrl) return;

    setEditingStyleId(styleId);
    setTryOnResults(prev => prev.map(r =>
      r.styleId === styleId ? { ...r, generating: true, error: null } : r
    ));

    try {
      const response = await supabase.functions.invoke("generate-tryon", {
        body: { selfieUrl: result.tryOnUrl, editInstruction: instruction },
      });

      if (response.error) {
        setTryOnResults(prev => prev.map(r =>
          r.styleId === styleId ? { ...r, generating: false, error: response.error.message } : r
        ));
      } else {
        setTryOnResults(prev => prev.map(r =>
          r.styleId === styleId ? { ...r, generating: false, tryOnUrl: response.data.imageUrl } : r
        ));
      }
    } catch (e: any) {
      setTryOnResults(prev => prev.map(r =>
        r.styleId === styleId ? { ...r, generating: false, error: e.message } : r
      ));
    } finally {
      setEditingStyleId(null);
    }
  };

  const handleSubmit = async () => {
    if (!consultationId || !user) return;
    const completedResults = tryOnResults.filter(r => r.tryOnUrl);
    if (completedResults.length === 0) {
      toast.error("No try-on results to submit.");
      return;
    }
    setSubmitting(true);
    try {
      const items = completedResults.map((r) => ({
        consultation_id: consultationId,
        user_id: user.id,
        style_id: r.styleId,
        try_on_result_url: r.tryOnUrl,
        is_selected: r.styleId === favoriteStyleId,
      }));
      const { error: itemsError } = await supabase.from("style_board_items").insert(items);
      if (itemsError) throw itemsError;

      const { error: updateError } = await supabase
        .from("consultations")
        .update({ client_notes: clientNotes, status: "submitted" })
        .eq("id", consultationId);
      if (updateError) throw updateError;

      if (appointmentIdParam) {
        const { error: appointmentError } = await supabase
          .from("appointments")
          .update({ consultation_id: consultationId })
          .eq("id", appointmentIdParam)
          .eq("client_id", user.id);
        if (appointmentError) throw appointmentError;

        toast.success("Consultation submitted! Your stylist will review it soon.");
        navigate("/dashboard/appointments");
      } else if (salonParam) {
        toast.success("Consultation submitted! Your stylist will review it soon.");
        navigate(`/dashboard/book?salon=${salonParam}&consultation=${consultationId}`);
      } else {
        toast.success("Consultation submitted! Your stylist will review it soon.");
        navigate("/dashboard");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  const steps: { key: Step; label: string }[] = [
    { key: "photo", label: "Photo" },
    { key: "analysis", label: "Analysis" },
    { key: "gallery", label: "Pick Styles" },
    { key: "generate", label: "Try On" },
    { key: "review", label: "Review" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-background glow-prism">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Virtual Consultation</span>
          </div>
          <div className="w-16" />
        </div>
      </nav>

      {/* Step indicator */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-1 max-w-xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <button
                  onClick={() => { if (i <= currentStepIndex) setStep(s.key); }}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    i <= currentStepIndex ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                    i < currentStepIndex ? "bg-glass-teal text-white"
                      : i === currentStepIndex ? "bg-primary/10 text-primary border border-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>{i + 1}</div>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${i < currentStepIndex ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* STEP 1: Photo */}
        {step === "photo" && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl tracking-tight mb-2">
                Let's find your perfect style
              </h1>
              <p className="text-sm text-muted-foreground">Select your preference, then take or upload a clear selfie.</p>
            </div>

            {/* Gender selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Show me styles for</label>
              <div className="grid grid-cols-2 gap-3">
                {([["male", "Men's Styles"], ["female", "Women's Styles"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSelectedGender(selectedGender === value ? null : value)}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      selectedGender === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <PhotoCapture onPhotoCapture={handlePhotoCapture} capturedPhoto={photoPreview} onRetake={handleRetake} />
            {photoPreview && (
              <Button className="w-full bg-gradient-prism text-white rounded-full" onClick={analyzePhoto} disabled={analyzing || !selectedGender}>
                {analyzing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing your face shape...</>
                ) : !selectedGender ? (
                  <>Please select a style preference above</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Analyze My Face Shape</>
                )}
              </Button>
            )}

            {/* Skip consultation option */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">or</span></div>
            </div>
            <button
              onClick={() => navigate(`/dashboard/book${salonParam ? `?salon=${salonParam}` : ""}`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              <CalendarPlus className="h-4 w-4" />
              Skip consultation & book an appointment directly
            </button>
          </div>
        )}

        {/* STEP 2: Analysis Results */}
        {step === "analysis" && faceAnalysis && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl tracking-tight mb-2">
                Your Face Shape Results
              </h1>
              <p className="text-sm text-muted-foreground">Based on your photo, here's what we found.</p>
            </div>
            {photoPreview && (
              <div className="aspect-[3/4] max-w-[200px] mx-auto rounded-xl overflow-hidden border border-border">
                <img src={photoPreview} alt="Your selfie" className="w-full h-full object-cover" />
              </div>
            )}
            <FaceShapeResult
              faceShape={faceAnalysis.face_shape}
              confidence={faceAnalysis.confidence}
              currentHairLength={faceAnalysis.current_hair_length || "medium"}
              hairType={faceAnalysis.hair_type}
              hairThickness={faceAnalysis.hair_thickness}
              analysis={faceAnalysis.analysis}
              recommendations={faceAnalysis.recommendations}
            />
            <Button className="w-full bg-gradient-prism text-white rounded-full" onClick={() => setStep("gallery")}>
              Pick Your Favorite Styles <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* STEP 3: Gallery - Pick up to 5 */}
        {step === "gallery" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl tracking-tight mb-1">
                  Pick Up to {MAX_SELECTIONS} Styles
                </h1>
                <p className="text-sm text-muted-foreground">
                  {faceAnalysis
                    ? `Styles tagged "For You" complement your ${faceAnalysis.face_shape.replace(/_/g, " ")} face shape. Select your favorites and we'll show you what they look like on you.`
                    : "Select your favorites and we'll generate try-ons on your photo."}
                </p>
              </div>
              {selectedStyleIds.size > 0 && (
                <Button onClick={generateAllTryOns}>
                  Generate Try-Ons ({selectedStyleIds.size}) <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>
            <StyleGallery
              styles={styles}
              faceShape={faceAnalysis?.face_shape || null}
              userHairLength={faceAnalysis?.current_hair_length || null}
              userHairType={faceAnalysis?.hair_type || null}
              userHairThickness={faceAnalysis?.hair_thickness || null}
              selectedStyleIds={selectedStyleIds}
              onToggleSelect={toggleSelectStyle}
              maxSelections={MAX_SELECTIONS}
              loading={stylesLoading}
            />
            {selectedStyleIds.size > 0 && (
              <div className="sticky bottom-4 flex justify-center">
                <Button size="lg" className="shadow-lg bg-gradient-prism text-white rounded-full" onClick={generateAllTryOns}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {selectedStyleIds.size} Try-On{selectedStyleIds.size > 1 ? "s" : ""} on Your Photo
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4 & 5: Generate & Review (same view, step advances when done) */}
        {(step === "generate" || step === "review") && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl tracking-tight mb-2">
                {step === "generate" ? "Generating Your Try-Ons..." : "Your Try-On Results"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {step === "generate"
                  ? "Sit tight — we're applying each style to your photo."
                  : "Compare your looks, request edits, and submit your favorites."}
              </p>
            </div>

            <TryOnReview
              results={tryOnResults}
              selfieUrl={selfieUrl || ""}
              onRequestEdit={handleRequestEdit}
              onRetry={handleRetryTryOn}
              onEnhance={handleEnhanceWithPro}
              editingStyleId={editingStyleId}
              favoriteStyleId={favoriteStyleId}
              onToggleFavorite={(styleId) => setFavoriteStyleId(prev => prev === styleId ? null : styleId)}
            />

            {step === "review" && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes for your stylist</label>
                  <Textarea
                    placeholder="Describe what you're looking for... e.g., 'I love option 2 but want it slightly shorter. Open to color suggestions too.'"
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep("gallery")}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Gallery
                  </Button>
                  <Button className="flex-1 bg-gradient-prism text-white rounded-full" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Submit Consultation</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Consultation;

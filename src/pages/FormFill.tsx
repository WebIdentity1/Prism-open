import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Scissors, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "number" | "date" | "email" | "phone";
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

const FormFill = () => {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointment_id");
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!formId) return;
    supabase.from("forms").select("*").eq("id", formId).eq("is_active", true).maybeSingle()
      .then(({ data, error }) => {
        if (data) setForm(data);
        setLoading(false);
      });
  }, [formId]);

  const fields: FormField[] = form?.fields || [];

  const updateResponse = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    const current = (responses[fieldId] as string[]) || [];
    updateResponse(fieldId, checked ? [...current, option] : current.filter(v => v !== option));
  };

  const handleSubmit = async () => {
    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = responses[field.id];
        if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === "string" && !val.trim())) {
          toast.error(`"${field.label}" is required`);
          return;
        }
      }
    }

    setSubmitting(true);
    const { error } = await supabase.from("form_submissions").insert({
      form_id: formId,
      salon_id: form.salon_id,
      client_id: user?.id || null,
      appointment_id: appointmentId || null,
      responses,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Failed to submit form. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-medium">Form not found</p>
          <p className="text-sm text-muted-foreground mt-1">This form may be inactive or doesn't exist.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-elevated rounded-xl max-w-md w-full mx-4 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-glass-teal mx-auto mb-4" />
          <h2 className="text-xl font-medium mb-2">Thank You!</h2>
          <p className="text-muted-foreground">Your response has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="text-sm font-light">Prism</span>
        </div>

        <div className="glass-elevated rounded-xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-medium">{form.title}</h2>
            {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
          </div>
          <div className="space-y-5">
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {field.type === "text" && (
                  <Input
                    value={responses[field.id] || ""}
                    onChange={(e) => updateResponse(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="rounded-lg"
                  />
                )}

                {field.type === "email" && (
                  <Input
                    type="email"
                    value={responses[field.id] || ""}
                    onChange={(e) => updateResponse(field.id, e.target.value)}
                    placeholder={field.placeholder || "email@example.com"}
                    className="rounded-lg"
                  />
                )}

                {field.type === "phone" && (
                  <Input
                    type="tel"
                    value={responses[field.id] || ""}
                    onChange={(e) => updateResponse(field.id, e.target.value)}
                    placeholder={field.placeholder || "(555) 123-4567"}
                    className="rounded-lg"
                  />
                )}

                {field.type === "number" && (
                  <Input
                    type="number"
                    value={responses[field.id] || ""}
                    onChange={(e) => updateResponse(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="rounded-lg"
                  />
                )}

                {field.type === "date" && (
                  <Input
                    type="date"
                    value={responses[field.id] || ""}
                    onChange={(e) => updateResponse(field.id, e.target.value)}
                    className="rounded-lg"
                  />
                )}

                {field.type === "textarea" && (
                  <Textarea
                    value={responses[field.id] || ""}
                    onChange={(e) => updateResponse(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                  />
                )}

                {field.type === "select" && (
                  <Select value={responses[field.id] || ""} onValueChange={(v) => updateResponse(field.id, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || []).map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.type === "radio" && (
                  <RadioGroup value={responses[field.id] || ""} onValueChange={(v) => updateResponse(field.id, v)}>
                    {(field.options || []).map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                        <Label htmlFor={`${field.id}-${opt}`} className="font-normal">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {field.type === "checkbox" && (
                  <div className="space-y-2">
                    {(field.options || []).map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox
                          checked={(responses[field.id] || []).includes(opt)}
                          onCheckedChange={(checked) => handleCheckboxChange(field.id, opt, !!checked)}
                          id={`${field.id}-${opt}`}
                        />
                        <Label htmlFor={`${field.id}-${opt}`} className="font-normal">{opt}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-gradient-prism text-white rounded-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormFill;

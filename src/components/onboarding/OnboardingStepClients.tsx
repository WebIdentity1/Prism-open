import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import CsvImporter from "./CsvImporter";

interface Props {
  salonId: string;
  onNext: () => void;
  onBack: () => void;
}

const OnboardingStepClients = ({ salonId, onNext, onBack }: Props) => {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);

  const handleCsvImport = async (rows: Record<string, string>[]) => {
    const valid = rows.filter((r) => (r.email || r.Email));
    if (valid.length === 0) { toast.error("No valid rows found — each row needs an email"); return; }

    setImporting(true);
    const { data, error } = await supabase.functions.invoke("import-csv", {
      body: { salon_id: salonId, type: "clients", rows: valid },
    });
    setImporting(false);

    if (error) { toast.error("Import failed"); return; }
    setImported(data?.processed || valid.length);
    toast.success(`${data?.processed || valid.length} client(s) imported`);
  };

  return (
    <div className="glass-elevated rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-xl font-medium">Import Clients</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV of your existing clients so they're ready to book. Each client will receive an email invitation to set up their account.
        </p>
      </div>
      <div className="space-y-6">
        <CsvImporter
          label="Import Clients from CSV"
          description="CSV should have columns: name, email, phone (optional)"
          onImport={handleCsvImport}
          templateCols={["name", "email", "phone"]}
          templateName="clients-template.csv"
          loading={importing}
        />

        {imported > 0 && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium text-primary">✓ {imported} client(s) imported successfully</p>
          </div>
        )}

        <div className="p-4 glass-subtle rounded-xl">
          <p className="text-sm font-medium mb-1">Coming Soon: Direct Imports</p>
          <p className="text-xs text-muted-foreground">
            We're building integrations with Square, Vagaro, Booksy, and more to make migration even easier.
          </p>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} className="rounded-full">Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onNext} className="rounded-full">Skip</Button>
            <Button onClick={onNext} className="bg-gradient-prism text-white rounded-full">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStepClients;

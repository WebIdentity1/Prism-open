import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, Loader2 } from "lucide-react";

interface Props {
  label: string;
  description: string;
  onImport: (rows: Record<string, string>[]) => void | Promise<void>;
  templateCols: string[];
  templateName: string;
  loading?: boolean;
}

const CsvImporter = ({ label, description, onImport, templateCols, templateName, loading }: Props) => {
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCsv = (text: string) => {
    const lines = text.trim().split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
    if (lines.length < 2) return { headers: [], rows: [] };
    const h = lines[0];
    const rows = lines.slice(1).map((line) => {
      const obj: Record<string, string> = {};
      h.forEach((col, i) => { obj[col] = line[i] || ""; });
      return obj;
    });
    return { headers: h, rows };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers: h, rows } = parseCsv(ev.target?.result as string);
      setHeaders(h);
      setAllRows(rows);
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    await onImport(allRows);
    setPreview([]);
    setHeaders([]);
    setAllRows([]);
  };

  const downloadTemplate = () => {
    const csv = templateCols.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = templateName;
    a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1" />Template
        </Button>
      </div>

      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

      {preview.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full p-8 glass rounded-xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm">Click to upload CSV file</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            <span>{allRows.length} row(s) found</span>
          </div>
          <div className="overflow-x-auto glass-subtle rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted">
                  {headers.map((h) => <th key={h} className="text-left p-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {headers.map((h) => <td key={h} className="p-2">{row[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allRows.length > 5 && <p className="text-xs text-muted-foreground">Showing first 5 of {allRows.length} rows</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleImport} disabled={loading} className="bg-gradient-prism text-white rounded-full">
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {loading ? "Importing..." : `Import ${allRows.length} rows`}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPreview([]); setAllRows([]); setHeaders([]); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CsvImporter;

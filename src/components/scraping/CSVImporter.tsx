import { useEffect, useMemo, useState } from "react";
import { normalizeSector } from "@/lib/sectorNormalizer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, Check, AlertCircle, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV, autoMap, toNumber, CSV_TARGET_FIELDS, type CSVTargetKey } from "@/lib/csv";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props { onJobCreated: (j: any) => void; defaultSource?: "linkedin" | "instagram" | "tiktok" | "google_maps" | "csv"; }

type Step = "upload" | "mapping" | "validate" | "importing" | "done";

const NONE = "__none__";

export function CSVImporter({ onJobCreated, defaultSource = "csv" }: Props) {
  const [source, setSource] = useState<string>(defaultSource);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<CSVTargetKey, string | null>>({} as any);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setFile(null); setHeaders([]); setRows([]); setMapping({} as any); setStep("upload"); setLoading(false);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    const { headers, rows } = parseCSV(text);
    if (!headers.length) return toast.error("CSV vide ou format non reconnu");
    setHeaders(headers);
    setRows(rows);
    setMapping(autoMap(headers));
    setStep("mapping");
    toast.success(`${rows.length} lignes détectées — vérifie le mapping`);
  };

  const updateMap = (target: CSVTargetKey, header: string | null) => {
    setMapping((prev) => ({ ...prev, [target]: header }));
  };

  // Validation: name est obligatoire, email/phone/website fortement recommandés.
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!mapping.name) errors.push("Le champ « Nom entreprise » est obligatoire.");
    if (!mapping.email && !mapping.phone) warnings.push("Aucun email ni téléphone mappé — tu ne pourras pas contacter ces prospects.");
    // Sample-check des valeurs des 10 premières lignes
    if (mapping.name) {
      const empty = rows.slice(0, 50).filter((r) => !(r[mapping.name!] || "").trim()).length;
      if (empty > 5) warnings.push(`${empty} lignes ont un nom vide dans les 50 premiers prospects.`);
    }
    if (mapping.email) {
      const invalid = rows.slice(0, 50).filter((r) => {
        const v = r[mapping.email!]?.trim();
        return v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      }).length;
      if (invalid > 0) warnings.push(`${invalid} emails semblent invalides (échantillon de 50).`);
    }
    return { errors, warnings, valid: errors.length === 0 };
  }, [mapping, rows]);

  const buildRow = (r: Record<string, string>) => {
    const get = (k: CSVTargetKey) => (mapping[k] ? r[mapping[k]!]?.trim() || null : null);
    return {
      source: source as any,
      name: get("name") ?? "—",
      contact_name: get("contact_name"),
      email: get("email"),
      phone: get("phone"),
      website: get("website"),
      address: get("address"),
      city: get("city"),
      zip: get("zip"),
      country: get("country") ?? "France",
      sector: normalizeSector(get("sector") || get("category")),
      category: get("category"),
      rating: toNumber(get("rating")),
      reviews_count: toNumber(get("reviews_count")),
      employees_count: toNumber(get("employees_count")),
      revenue_estimate: toNumber(get("revenue_estimate")),
      siren: get("siren"),
      dirigeant: get("dirigeant"),
      linkedin_url: get("linkedin_url"),
      instagram_handle: get("instagram_handle"),
      followers: toNumber(get("followers")),
      engagement_rate: toNumber(get("engagement_rate")),
      raw_data: r as any,
    };
  };

  const importNow = async () => {
    if (!file || !validation.valid) return;
    setStep("importing");
    setLoading(true);

    const { data: job, error: jobErr } = await supabase.from("scraping_jobs").insert({
      source: source as any,
      name: `Import CSV — ${file.name}`,
      filters: { mode: "csv_import", filename: file.name, mapping },
      status: "completed",
      mode: "sync",
      progress: 100,
      results_count: rows.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).select().single();

    if (jobErr || !job) { toast.error(jobErr?.message ?? "Erreur lors de la création du job"); setLoading(false); setStep("validate"); return; }

    const built = rows.map((r) => ({ ...buildRow(r), job_id: job.id }));
    const chunkSize = 500;
    for (let i = 0; i < built.length; i += chunkSize) {
      const { error } = await supabase.from("scraping_results").insert(built.slice(i, i + chunkSize));
      if (error) { toast.error(error.message); setLoading(false); setStep("validate"); return; }
    }

    setLoading(false);
    setStep("done");
    toast.success(`${built.length} prospects importés ✨`);
    onJobCreated(job);
  };

  const previewMapped = rows.slice(0, 3).map((r) => buildRow(r));

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Import CSV avec mapping</h3>
          <Badge variant="outline" className="text-[10px]">100% gratuit</Badge>
        </div>
        {step !== "upload" && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="h-4 w-4 mr-1" /> Annuler
          </Button>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {(["upload", "mapping", "validate", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center font-semibold",
              step === s ? "gradient-primary text-primary-foreground shadow-glow" :
              ["upload", "mapping", "validate", "done"].indexOf(step) > i ? "bg-success/20 text-success" : "bg-muted text-muted-foreground",
            )}>{i + 1}</div>
            <span className={cn("capitalize", step === s ? "font-medium" : "text-muted-foreground")}>{s === "validate" ? "Validation" : s === "done" ? "Terminé" : s}</span>
            {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <>
          <p className="text-sm text-muted-foreground">
            Charge un CSV (LinkedIn Sales Nav, Apify, Phantombuster, Excel exporté…).
            L'écran suivant te laissera mapper chaque colonne du fichier vers les champs du CRM.
          </p>
          <div className="grid gap-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV générique</SelectItem>
                <SelectItem value="linkedin">LinkedIn Sales Navigator</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="google_maps">Google Maps</SelectItem>
                <SelectItem value="apify">Apify export</SelectItem>
                <SelectItem value="pages_jaunes">Pages Jaunes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Fichier CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </>
      )}

      {step === "mapping" && (
        <>
          <p className="text-sm text-muted-foreground">
            On a détecté <strong>{headers.length} colonnes</strong> et <strong>{rows.length} lignes</strong>. Vérifie le mapping ci-dessous puis passe à la validation.
          </p>
          <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
            {CSV_TARGET_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <span className={cn("text-muted-foreground", f.required && "text-foreground font-medium")}>{f.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Select
                  value={mapping[f.key as CSVTargetKey] ?? NONE}
                  onValueChange={(v) => updateMap(f.key as CSVTargetKey, v === NONE ? null : v)}
                >
                  <SelectTrigger className="h-8"><SelectValue placeholder="— Non mappé —" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NONE}>— Non mappé —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("upload")}>Retour</Button>
            <Button variant="hero" onClick={() => setStep("validate")}>Valider le mapping <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </>
      )}

      {step === "validate" && (
        <>
          {validation.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm space-y-1">
              <div className="font-semibold text-destructive flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Erreurs bloquantes</div>
              {validation.errors.map((e, i) => <div key={i} className="text-destructive">• {e}</div>)}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm space-y-1">
              <div className="font-semibold text-warning flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Avertissements</div>
              {validation.warnings.map((w, i) => <div key={i} className="text-warning-foreground">• {w}</div>)}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground mb-2">
              <FileText className="h-3 w-3" /> Aperçu après mapping (3 premières lignes)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="p-1 text-left">Nom</th>
                    <th className="p-1 text-left">Email</th>
                    <th className="p-1 text-left">Téléphone</th>
                    <th className="p-1 text-left">Ville</th>
                    <th className="p-1 text-left">Site</th>
                  </tr>
                </thead>
                <tbody>
                  {previewMapped.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-1 font-medium">{r.name}</td>
                      <td className="p-1 truncate max-w-32">{r.email ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="p-1">{r.phone ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="p-1">{r.city ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="p-1 truncate max-w-32">{r.website ?? <span className="text-muted-foreground italic">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("mapping")}>Modifier le mapping</Button>
            <Button variant="hero" disabled={!validation.valid || loading} onClick={importNow}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Importer {rows.length} prospects
            </Button>
          </div>
        </>
      )}

      {step === "importing" && (
        <div className="text-center py-8 space-y-3">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Import en cours…</p>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-8 space-y-3">
          <Check className="h-10 w-10 mx-auto text-success" />
          <p className="font-medium">Import terminé !</p>
          <p className="text-sm text-muted-foreground">{rows.length} prospects ajoutés à la file de validation.</p>
          <Button variant="outline" onClick={reset}>Importer un autre fichier</Button>
        </div>
      )}
    </Card>
  );
}

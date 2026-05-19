import { useState } from "react";
import { normalizeSector, detectCity } from "@/lib/sectorNormalizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet2Icon, Loader2, CheckCircle, AlertCircle, Eye, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SECTORS = [
  "plomberie", "electricite", "batiment", "peinture", "serrurerie",
  "chauffage", "demenagement", "nettoyage", "jardinage", "restaurant",
  "coiffure", "beaute", "fitness", "auto", "photo", "traiteur",
  "auto_ecole", "reparation", "taxi", "immobilier", "autre",
];

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function buildCsvUrl(sheetId: string, url: string, sheetName: string): string {
  if (sheetName) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }
  const gidMatch = url.match(/gid=(\d+)/);
  let csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  if (gidMatch) csvUrl += `&gid=${gidMatch[1]}`;
  return csvUrl;
}

function mapColumns(headers: string[]): Record<string, number> {
  const rules: Record<string, string[]> = {
    name:    ["nom", "name", "entreprise", "societe", "business", "raison"],
    phone:   ["telephone", "phonenumber", "phone", "tel", "mobile", "portable"],
    email:   ["email", "mail", "courriel"],
    website: ["website", "siteweb", "site", "web", "lien"],
    city:    ["ville", "city", "localite", "commune"],
    zip:     ["codepostal", "zip", "cp", "postal"],
    address: ["fulladdress", "adresse", "address", "rue", "street"],
    sector:  ["secteur", "sector", "activite", "categorie", "metier"],
    notes:   ["notes", "commentaires", "remarques"],
    rating:  ["rating", "avis", "etoile"],
  };

  const normalized = headers.map((h) =>
    h.toLowerCase().trim().replace(/[\s_\-]/g, "")
  );

  const mapping: Record<string, number> = {};
  for (const [field, variants] of Object.entries(rules)) {
    for (const [idx, h] of normalized.entries()) {
      if (variants.includes(h) || variants.some((v) => h.includes(v) || v.includes(h))) {
        if (!Object.values(mapping).includes(idx)) {
          mapping[field] = idx;
          break;
        }
      }
    }
  }
  return mapping;
}

interface PreviewData {
  headers: string[];
  sample: string[][];
  totalRows: number;
  mappedCols: string[];
}

export function GoogleSheetsScraper() {
  const [url, setUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [sectorOverride, setSectorOverride] = useState("auto");
  const [sansOnlySite, setSansOnlySite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const fetchPreview = async () => {
    if (!url.trim()) { toast.error("URL manquante"); return; }
    const sheetId = extractSheetId(url);
    if (!sheetId) { toast.error("URL Google Sheets invalide"); return; }
    setPreviewing(true);
    setPreview(null);
    try {
      const csvUrl = buildCsvUrl(sheetId, url, sheetName);
      const resp = await fetch(csvUrl);
      if (!resp.ok) throw new Error(`Code ${resp.status} — vérifiez que le sheet est partagé en lecture publique`);
      const text = await resp.text();
      const rows = text.split("\n").map((r) => r.split(",").map((c) => c.replace(/^"|"$/g, "").trim()));
      if (!rows.length) throw new Error("Sheet vide");
      const headers = rows[0];
      const sample = rows.slice(1, 4);
      const mapping = mapColumns(headers);
      setPreview({ headers, sample, totalRows: rows.length - 1, mappedCols: Object.keys(mapping) });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!url.trim()) { toast.error("URL manquante"); return; }
    const sheetId = extractSheetId(url);
    if (!sheetId) { toast.error("URL invalide"); return; }
    setLoading(true);
    setResult(null);
    try {
      const csvUrl = buildCsvUrl(sheetId, url, sheetName);
      const resp = await fetch(csvUrl);
      if (!resp.ok) throw new Error(`Code ${resp.status}`);
      const text = await resp.text();
      const rows = text.split("\n").map((r) => {
        // handle quoted CSV fields
        const out: string[] = [];
        let cur = "", inQ = false;
        for (const ch of r) {
          if (ch === '"') { inQ = !inQ; }
          else if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        out.push(cur.trim());
        return out;
      });

      if (rows.length < 2) throw new Error("Sheet vide");
      const headers = rows[0];
      const col = mapColumns(headers);
      if (!("name" in col)) throw new Error(`Colonne "Nom" introuvable. Colonnes : ${headers.join(", ")}`);

      let imported = 0, skipped = 0;
      const errors: string[] = [];
      const toInsert: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row.length || row.every((c) => c === "")) continue;
        const get = (f: string) => (col[f] !== undefined && col[f] < row.length ? row[col[f]] : "");
        const name = get("name");
        if (!name) { skipped++; continue; }
        const website = get("website");
        const hasSite = Boolean(
          website &&
          !["", "-", "--", "N/A", "non", "no", "aucun"].includes(website.toLowerCase()) &&
          (website.startsWith("http") || website.startsWith("www."))
        );
        if (sansOnlySite && hasSite) { skipped++; continue; }
        const rawSector = sectorOverride !== "auto" ? sectorOverride : (get("sector") || get("category") || "");
        const sector = normalizeSector(rawSector, name);
        // Ville : depuis la colonne ou détection depuis le nom
        const rawCity = get("city") || get("ville") || get("localisation") || get("location") || "";
        const city = rawCity || detectCity(name) || null;
        toInsert.push({
          name,
          phone: get("phone") || null,
          email: get("email") || null,
          website: website || null,
          city: city,
          sector: sector.toLowerCase(),
          source: "google_sheets",
          status: "a_contacter",
          ai_note: get("notes") || null,
        });
      }

      // Batch insert par chunks de 50 — insert simple sans conflit
      for (let i = 0; i < toInsert.length; i += 50) {
        const chunk = toInsert.slice(i, i + 50);
        const { data, error } = await supabase.from("prospects").insert(chunk).select("id");
        if (error) {
          errors.push(error.message);
        } else {
          imported += data?.length ?? 0;
        }
      }

      skipped += toInsert.length - imported - errors.length;
      setResult({ imported, skipped, errors: errors.slice(0, 5) });
      if (imported > 0) toast.success(`${imported} prospects importés depuis Google Sheets`);
      else toast.error("Aucun prospect inséré — vérifiez les erreurs ci-dessous");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/15">
          <FileSpreadsheet className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <h3 className="font-semibold">Import Google Sheets</h3>
          <p className="text-sm text-muted-foreground">
            Colle l'URL de ton sheet partagé en lecture. La détection des colonnes est automatique.
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="space-y-2">
          <Label>URL du Google Sheet *</Label>
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Le sheet doit être partagé en <strong>lecture publique</strong> (Partager → Tout le monde avec le lien)
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nom de l'onglet (optionnel)</Label>
            <Input
              placeholder="ex: Feuille1, IMPORT FROM WEB..."
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Forcer un secteur</Label>
            <Select value={sectorOverride} onValueChange={setSectorOverride}>
              <SelectTrigger>
                <SelectValue placeholder="Détection auto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Détection automatique</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Switch checked={sansOnlySite} onCheckedChange={setSansOnlySite} />
          <div>
            <p className="text-sm font-medium">Ignorer les prospects avec un site web</p>
            <p className="text-xs text-muted-foreground">N'importe que ceux sans site ou avec un site obsolète</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={fetchPreview} disabled={previewing || loading}>
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Prévisualiser
          </Button>
          <Button onClick={runImport} disabled={loading || previewing}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {loading ? "Import en cours..." : "Importer"}
          </Button>
        </div>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <p className="font-semibold">Aperçu — {preview.totalRows} lignes</p>
              <p className="text-xs text-muted-foreground">
                Colonnes détectées : {preview.mappedCols.map((c) => (
                  <Badge key={c} variant="secondary" className="mr-1 text-[10px]">{c}</Badge>
                ))}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.headers.slice(0, 8).map((h, i) => (
                    <TableHead key={i} className="whitespace-nowrap text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.sample.map((row, i) => (
                  <TableRow key={i}>
                    {row.slice(0, 8).map((cell, j) => (
                      <TableCell key={j} className="max-w-[140px] truncate text-xs">{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className={`flex items-start gap-3 p-4 ${result.errors.length ? "border-destructive/40 bg-destructive/5" : "border-green-500/40 bg-green-500/5"}`}>
          {result.errors.length ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">
              {result.imported} prospects importés · {result.skipped} ignorés
            </p>
            {result.errors.length > 0 && (
              <ul className="space-y-0.5 text-xs text-destructive">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

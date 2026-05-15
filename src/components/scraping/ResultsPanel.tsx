import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, ExternalLink, Star, Phone, Mail, Globe, Trash2 } from "lucide-react";
import { functionErrorMessage } from "@/lib/functionErrors";

export function ResultsPanel({ jobId }: { jobId: string }) {
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("scraping_results")
      .select("*")
      .eq("job_id", jobId)
      .order("ai_score", { ascending: false });
    setResults(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [jobId]);

  useEffect(() => {
    const ch = supabase
      .channel(`results-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scraping_results", filter: `job_id=eq.${jobId}` }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [jobId]);

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === results.filter((r) => r.import_status === "pending").length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.filter((r) => r.import_status === "pending").map((r) => r.id)));
    }
  };

  const importSelected = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("import-scraping-results", {
      body: { result_ids: Array.from(selected) },
    });
    setImporting(false);
    if (error) { toast.error(await functionErrorMessage(error)); return; }
    toast.success(`✓ ${data.imported} importés · ${data.skipped} doublons`);
    setSelected(new Set());
    fetch();
  };

  if (loading) return <Card className="p-8 text-center text-sm text-muted-foreground">Chargement...</Card>;
  if (results.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">En attente des résultats...</Card>;
  }

  const pending = results.filter((r) => r.import_status === "pending");

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={pending.length > 0 && selected.size === pending.length}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm font-medium">{results.length} résultats · {selected.size} sélectionnés</span>
        </div>
        <Button onClick={importSelected} disabled={selected.size === 0 || importing} variant="hero" size="sm">
          <Download className="h-4 w-4" /> Importer ({selected.size})
        </Button>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left">
              <th className="w-10 p-3" />
              <th className="p-3 font-medium">Score</th>
              <th className="p-3 font-medium">Entreprise</th>
              <th className="p-3 font-medium">Localisation</th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Stats</th>
              <th className="p-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const disabled = r.import_status !== "pending";
              return (
                <tr key={r.id} className={`border-t border-border ${disabled ? "opacity-50" : "hover:bg-accent/30"}`}>
                  <td className="p-3">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} disabled={disabled} />
                  </td>
                  <td className="p-3">
                    <ScoreBadge score={r.ai_score ?? 50} />
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{r.name}</p>
                    {r.contact_name && <p className="text-xs text-muted-foreground">{r.contact_name}</p>}
                    {r.website && (
                      <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <Globe className="h-3 w-3" /> Site
                      </a>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {[r.city, r.zip].filter(Boolean).join(" ") || "—"}
                    {r.sector && <p className="mt-0.5">{r.sector}</p>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1 text-xs">
                      {r.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>}
                      {r.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                      {!r.email && !r.phone && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.rating != null && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {r.rating} ({r.reviews_count ?? 0})
                      </span>
                    )}
                    {r.followers != null && <p>{(r.followers / 1000).toFixed(1)}k followers</p>}
                    {r.employees_count != null && <p>{r.employees_count} salariés</p>}
                  </td>
                  <td className="p-3">
                    {r.import_status === "imported" ? (
                      <Badge className="bg-success/15 text-success border-success/30">Importé</Badge>
                    ) : r.duplicate_of || r.import_status === "skipped_duplicate" ? (
                      <Badge variant="outline">Doublon</Badge>
                    ) : (
                      <Badge variant="secondary">À importer</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-success/15 text-success border-success/30" :
    score >= 50 ? "bg-warning/15 text-warning border-warning/30" :
    "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={color}>{score}</Badge>;
}

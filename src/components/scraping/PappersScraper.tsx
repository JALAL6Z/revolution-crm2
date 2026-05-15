import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Search } from "lucide-react";
import { functionErrorMessage } from "@/lib/functionErrors";

export function PappersScraper({ onJobCreated }: { onJobCreated: (job: any) => void }) {
  const [activite, setActivite] = useState("");
  const [departement, setDepartement] = useState("");
  const [ville, setVille] = useState("");
  const [effMin, setEffMin] = useState<number | "">("");
  const [effMax, setEffMax] = useState<number | "">("");
  const [caMin, setCaMin] = useState<number | "">("");
  const [caMax, setCaMax] = useState<number | "">("");
  const [limit, setLimit] = useState([20]);
  const [autoImport, setAutoImport] = useState(true);
  const [loading, setLoading] = useState(false);

  const launch = async () => {
    if (!activite && !departement && !ville) {
      toast.error("Au moins un filtre requis");
      return;
    }
    setLoading(true);
    const filters = {
      activite: activite || undefined,
      departement: departement || undefined,
      ville: ville || undefined,
      effectif_min: effMin === "" ? undefined : Number(effMin),
      effectif_max: effMax === "" ? undefined : Number(effMax),
      ca_min: caMin === "" ? undefined : Number(caMin),
      ca_max: caMax === "" ? undefined : Number(caMax),
      limit: limit[0],
    };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase.from("scraping_jobs").insert({
      source: "pappers", name: [activite, departement, ville].filter(Boolean).join(" · ") || "Pappers",
      filters, auto_import: autoImport, created_by: user?.id,
    }).select().single();
    if (error || !job) { toast.error(error?.message); setLoading(false); return; }
    const { error: fnErr } = await supabase.functions.invoke("scrape-pappers", { body: { job_id: job.id, filters } });
    setLoading(false);
    if (fnErr) { toast.error(await functionErrorMessage(fnErr)); return; }
    onJobCreated(job);
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold">Pappers — Sociétés FR</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Mode gratuit actif : API publique Annuaire Entreprises/data.gouv si aucune clé Pappers n'est configurée.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Activité (NAF / mot-clé)</Label>
          <Input value={activite} onChange={(e) => setActivite(e.target.value)} placeholder="restauration, plomberie, conseil..." />
        </div>
        <div className="space-y-1.5">
          <Label>Département</Label>
          <Input value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="13, 75, 69..." />
        </div>
        <div className="space-y-1.5">
          <Label>Code postal / Ville</Label>
          <Input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="13001" />
        </div>
        <div className="space-y-1.5">
          <Label>Effectif min</Label>
          <Input type="number" min={0} value={effMin} onChange={(e) => setEffMin(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Effectif max</Label>
          <Input type="number" min={0} value={effMax} onChange={(e) => setEffMax(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>CA min (€)</Label>
          <Input type="number" min={0} value={caMin} onChange={(e) => setCaMin(e.target.value === "" ? "" : Number(e.target.value))} placeholder="200000" />
        </div>
        <div className="space-y-1.5">
          <Label>CA max (€)</Label>
          <Input type="number" min={0} value={caMax} onChange={(e) => setCaMax(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label>Limite : {limit[0]}</Label>
          <Slider value={limit} onValueChange={setLimit} min={10} max={100} step={10} />
        </div>
        <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label>Auto-import</Label>
            <p className="text-xs text-muted-foreground">Importer automatiquement les non-doublons</p>
          </div>
          <Switch checked={autoImport} onCheckedChange={setAutoImport} />
        </div>
      </div>
      <Button onClick={launch} disabled={loading} variant="hero" className="mt-4 w-full">
        <Search className="h-4 w-4" /> {loading ? "Lancement..." : "Lancer la recherche"}
      </Button>
    </Card>
  );
}

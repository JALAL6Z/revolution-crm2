import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, MapPin } from "lucide-react";
import { functionErrorMessage } from "@/lib/functionErrors";

export function GoogleMapsScraper({ onJobCreated }: { onJobCreated: (job: any) => void }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minRating, setMinRating] = useState<number | "">("");
  const [minReviews, setMinReviews] = useState<number | "">("");
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [limit, setLimit] = useState([20]);
  const [autoImport, setAutoImport] = useState(true);
  const [loading, setLoading] = useState(false);

  const launch = async () => {
    if (!query || !location) {
      toast.error("Mot-clé et localisation obligatoires");
      return;
    }
    setLoading(true);
    const filters = {
      query, location,
      min_rating: minRating === "" ? undefined : Number(minRating),
      min_reviews: minReviews === "" ? undefined : Number(minReviews),
      no_website_only: noWebsiteOnly,
      limit: limit[0],
    };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase
      .from("scraping_jobs")
      .insert({
        source: "google_maps",
        name: `${query} · ${location}`,
        filters,
        auto_import: autoImport,
        created_by: user?.id,
      })
      .select()
      .single();
    if (error || !job) {
      toast.error(error?.message ?? "Erreur création job");
      setLoading(false);
      return;
    }
    const { error: fnErr } = await supabase.functions.invoke("scrape-google-maps", {
      body: { job_id: job.id, filters },
    });
    setLoading(false);
    if (fnErr) {
      toast.error(`Scraper: ${await functionErrorMessage(fnErr)}`);
      return;
    }
    onJobCreated(job);
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-red-400" />
        <h3 className="font-semibold">Google Maps</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Mode gratuit actif : recherche locale OpenStreetMap si aucune clé SerpAPI n'est configurée.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Mot-clé / activité *</Label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="restaurant, dentiste, garage..." />
        </div>
        <div className="space-y-1.5">
          <Label>Localisation *</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Marseille, France" />
        </div>
        <div className="space-y-1.5">
          <Label>Note minimum</Label>
          <Input type="number" step="0.1" min={1} max={5} value={minRating} onChange={(e) => setMinRating(e.target.value === "" ? "" : Number(e.target.value))} placeholder="ex: 3.5" />
        </div>
        <div className="space-y-1.5">
          <Label>Avis minimum</Label>
          <Input type="number" min={0} value={minReviews} onChange={(e) => setMinReviews(e.target.value === "" ? "" : Number(e.target.value))} placeholder="ex: 20" />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label>Limite résultats : {limit[0]}</Label>
          <Slider value={limit} onValueChange={setLimit} min={10} max={100} step={10} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label>Sans site web uniquement</Label>
            <p className="text-xs text-muted-foreground">Cibler les entreprises sans présence web</p>
          </div>
          <Switch checked={noWebsiteOnly} onCheckedChange={setNoWebsiteOnly} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label>Auto-import dans Prospects</Label>
            <p className="text-xs text-muted-foreground">Importer automatiquement les non-doublons</p>
          </div>
          <Switch checked={autoImport} onCheckedChange={setAutoImport} />
        </div>
      </div>
      <Button onClick={launch} disabled={loading} variant="hero" className="mt-4 w-full">
        <Search className="h-4 w-4" /> {loading ? "Lancement..." : "Lancer le scraping"}
      </Button>
    </Card>
  );
}

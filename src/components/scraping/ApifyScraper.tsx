import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Instagram, Music2, Linkedin } from "lucide-react";
import { functionErrorMessage } from "@/lib/functionErrors";

type Platform = "instagram" | "tiktok" | "linkedin";

const META: Record<Platform, { icon: any; color: string; label: string; helper: string }> = {
  instagram: { icon: Instagram, color: "text-pink-400", label: "Instagram", helper: "Hashtags ou comptes" },
  tiktok: { icon: Music2, color: "text-cyan-400", label: "TikTok", helper: "Hashtags ou recherche" },
  linkedin: { icon: Linkedin, color: "text-blue-500", label: "LinkedIn (Sociétés)", helper: "Mots-clés sociétés" },
};

export function ApifyScraper({ platform, onJobCreated }: { platform: Platform; onJobCreated: (j: any) => void }) {
  const meta = META[platform];
  const Icon = meta.icon;
  const [seeds, setSeeds] = useState("");        // hashtags ou usernames séparés par virgule
  const [resultsLimit, setResultsLimit] = useState([20]);
  const [minFollowers, setMinFollowers] = useState<number | "">("");
  const [autoImport, setAutoImport] = useState(true);
  const [loading, setLoading] = useState(false);

  const launch = async () => {
    if (!seeds.trim()) { toast.error("Précise au moins un hashtag/compte/mot-clé"); return; }
    setLoading(true);
    const list = seeds.split(",").map((s) => s.trim()).filter(Boolean);
    let input: any = {};
    if (platform === "instagram") {
      input = { directUrls: list.map((h) => h.startsWith("http") ? h : `https://www.instagram.com/${h.replace(/^[#@]/, "")}/`), resultsLimit: resultsLimit[0] };
    } else if (platform === "tiktok") {
      input = { hashtags: list.map((h) => h.replace(/^#/, "")), resultsPerPage: resultsLimit[0] };
    } else {
      input = { queries: list, maxItems: resultsLimit[0] };
    }
    const filters = { seeds: list, resultsLimit: resultsLimit[0], minFollowers: minFollowers || undefined };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase.from("scraping_jobs").insert({
      source: platform, name: `${meta.label} · ${list.slice(0, 3).join(", ")}`,
      filters, auto_import: autoImport, created_by: user?.id,
    }).select().single();
    if (error || !job) { toast.error(error?.message); setLoading(false); return; }
    const { error: fnErr } = await supabase.functions.invoke("scrape-apify", { body: { job_id: job.id, platform, input } });
    setLoading(false);
    if (fnErr) { toast.error(await functionErrorMessage(fnErr)); return; }
    onJobCreated(job);
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${meta.color}`} />
        <h3 className="font-semibold">{meta.label}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Mode gratuit actif : recherche publique DuckDuckGo si aucun token Apify n'est configuré.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label>{meta.helper} *</Label>
          <Input value={seeds} onChange={(e) => setSeeds(e.target.value)} placeholder={platform === "linkedin" ? "agence digitale Marseille, SaaS Lyon" : "#restaurantmarseille, @comptecible"} />
          <p className="text-xs text-muted-foreground">Sépare par des virgules</p>
        </div>
        <div className="space-y-1.5">
          <Label>Followers min</Label>
          <Input type="number" min={0} value={minFollowers} onChange={(e) => setMinFollowers(e.target.value === "" ? "" : Number(e.target.value))} placeholder="ex: 1000" />
        </div>
        <div className="space-y-2">
          <Label>Limite : {resultsLimit[0]}</Label>
          <Slider value={resultsLimit} onValueChange={setResultsLimit} min={10} max={100} step={10} />
        </div>
        <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
          <div><Label>Auto-import dans Prospects</Label></div>
          <Switch checked={autoImport} onCheckedChange={setAutoImport} />
        </div>
      </div>
      <Button onClick={launch} disabled={loading} variant="hero" className="mt-4 w-full">
        <Search className="h-4 w-4" /> {loading ? "Scraping (peut prendre 1-2 min)..." : "Lancer le scraping"}
      </Button>
    </Card>
  );
}

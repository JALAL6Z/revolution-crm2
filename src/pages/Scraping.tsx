import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { MapPin, Building2, Mail, Instagram, Music2, Linkedin, Sparkles, History, Upload, FileSpreadsheet } from "lucide-react";
import { GoogleMapsScraper } from "@/components/scraping/GoogleMapsScraper";
import { PappersScraper } from "@/components/scraping/PappersScraper";
import { HunterScraper } from "@/components/scraping/HunterScraper";
import { ApifyScraper } from "@/components/scraping/ApifyScraper";
import { CSVImporter } from "@/components/scraping/CSVImporter";
import { GoogleSheetsScraper } from "@/components/scraping/GoogleSheetsScraper";
import { ResultsPanel } from "@/components/scraping/ResultsPanel";

const SOURCES = [
  { id: "google_maps", label: "Google Maps", icon: MapPin, color: "text-red-400" },
  { id: "gsheets", label: "Google Sheets", icon: FileSpreadsheet, color: "text-green-400" },
  { id: "pappers", label: "Pappers (FR)", icon: Building2, color: "text-blue-400" },
  { id: "hunter", label: "Hunter", icon: Mail, color: "text-orange-400" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-400" },
  { id: "tiktok", label: "TikTok", icon: Music2, color: "text-cyan-400" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-500" },
  { id: "csv", label: "Import CSV", icon: Upload, color: "text-muted-foreground" },
];

export default function Scraping() {
  const [activeJob, setActiveJob] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [tab, setTab] = useState("google_maps");

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("scraping_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentJobs(data ?? []);
  };

  useEffect(() => {
    fetchJobs();
    const channel = supabase
      .channel("scraping-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "scraping_jobs" }, () => fetchJobs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime on the active job for progress
  useEffect(() => {
    if (!activeJob?.id) return;
    const ch = supabase
      .channel(`job-${activeJob.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "scraping_jobs", filter: `id=eq.${activeJob.id}`,
      }, (payload) => setActiveJob(payload.new as any))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeJob?.id]);

  const handleJobCreated = (job: any) => {
    setActiveJob(job);
    toast.success("Scraping lancé 🚀");
  };

  return (
    <div>
      <PageHeader title="Scraping" description="Trouvez des prospects en masse depuis toutes les sources">
        <Badge variant="outline" className="gap-1 text-xs">
          <Sparkles className="h-3 w-3" /> Pipeline auto
        </Badge>
      </PageHeader>

      <div className="space-y-4 p-3 sm:p-6">
        {/* ── Onglets sources ── */}
        <Tabs value={tab} onValueChange={setTab}>
          {/* Scroll horizontal sur mobile */}
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1">
            <TabsList className="flex w-max gap-1 sm:w-full sm:flex-wrap sm:h-auto">
              {SOURCES.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="flex items-center gap-1.5 whitespace-nowrap text-xs px-3 py-2">
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-4">
            <TabsContent value="google_maps"><GoogleMapsScraper onJobCreated={handleJobCreated} /></TabsContent>
            <TabsContent value="gsheets"><GoogleSheetsScraper /></TabsContent>
            <TabsContent value="pappers"><PappersScraper onJobCreated={handleJobCreated} /></TabsContent>
            <TabsContent value="hunter"><HunterScraper onJobCreated={handleJobCreated} /></TabsContent>
            <TabsContent value="instagram"><ApifyScraper platform="instagram" onJobCreated={handleJobCreated} /></TabsContent>
            <TabsContent value="tiktok"><ApifyScraper platform="tiktok" onJobCreated={handleJobCreated} /></TabsContent>
            <TabsContent value="linkedin"><ApifyScraper platform="linkedin" onJobCreated={handleJobCreated} /></TabsContent>
            <TabsContent value="csv"><CSVImporter onJobCreated={handleJobCreated} /></TabsContent>
          </div>
        </Tabs>

        {/* ── Job actif ── */}
        {activeJob && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Scraping en cours · {activeJob.source}</p>
              <Badge variant={activeJob.status === "completed" ? "default" : activeJob.status === "failed" ? "destructive" : "secondary"}>
                {activeJob.status}
              </Badge>
            </div>
            <Progress value={activeJob.progress ?? 0} className="h-1.5" />
            {activeJob.error_message && <p className="mt-2 text-xs text-destructive">{activeJob.error_message}</p>}
            {activeJob.status === "completed" && (
              <p className="mt-2 text-xs text-success">✓ {activeJob.results_count} résultats — {activeJob.duplicates_count} doublons ignorés</p>
            )}
          </Card>
        )}

        {/* ── Résultats ── */}
        {activeJob && <ResultsPanel jobId={activeJob.id} />}

        {/* ── Historique — accordéon, visible seulement si des jobs existent ── */}
        {recentJobs.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-accent/30 transition-colors list-none">
              <History className="h-4 w-4 text-muted-foreground" />
              <span>Historique des scrapes ({recentJobs.length})</span>
              <span className="ml-auto text-muted-foreground text-xs group-open:hidden">Voir ▼</span>
              <span className="ml-auto text-muted-foreground text-xs hidden group-open:inline">Masquer ▲</span>
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentJobs.map((j) => (
                <Card key={j.id} className="cursor-pointer p-3 hover:border-primary/40 transition-all" onClick={() => setActiveJob(j)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{j.name || j.source}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(j.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <Badge variant={j.status === "completed" ? "default" : j.status === "failed" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                      {j.status}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                    <span>{j.results_count} résultats</span>
                    <span>{j.imported_count} importés</span>
                  </div>
                  {j.status === "running" && <Progress value={j.progress} className="mt-2 h-1" />}
                </Card>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

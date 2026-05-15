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
      <PageHeader
        title="Scraping multi-sources"
        description="Trouvez vos prospects en masse depuis Google Maps, Pappers, Hunter, Instagram, TikTok, LinkedIn"
      >
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" /> Pipeline auto activé
        </Badge>
      </PageHeader>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        {/* MAIN */}
        <div className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex h-auto flex-wrap gap-1 sm:grid sm:w-full sm:grid-cols-4 lg:grid-cols-8">
              {SOURCES.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  <span className="hidden sm:inline">{s.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="google_maps" className="mt-4">
              <GoogleMapsScraper onJobCreated={handleJobCreated} />
            </TabsContent>
            <TabsContent value="gsheets" className="mt-4">
              <GoogleSheetsScraper />
            </TabsContent>
            <TabsContent value="pappers" className="mt-4">
              <PappersScraper onJobCreated={handleJobCreated} />
            </TabsContent>
            <TabsContent value="hunter" className="mt-4">
              <HunterScraper onJobCreated={handleJobCreated} />
            </TabsContent>
            <TabsContent value="instagram" className="mt-4">
              <ApifyScraper platform="instagram" onJobCreated={handleJobCreated} />
            </TabsContent>
            <TabsContent value="tiktok" className="mt-4">
              <ApifyScraper platform="tiktok" onJobCreated={handleJobCreated} />
            </TabsContent>
            <TabsContent value="linkedin" className="mt-4">
              <ApifyScraper platform="linkedin" onJobCreated={handleJobCreated} />
            </TabsContent>
            <TabsContent value="csv" className="mt-4">
              <CSVImporter onJobCreated={handleJobCreated} />
            </TabsContent>
          </Tabs>

          {/* Active job */}
          {activeJob && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Job en cours · {activeJob.source}</p>
                  <p className="text-xs text-muted-foreground">{activeJob.status}</p>
                </div>
                <Badge variant={activeJob.status === "completed" ? "default" : activeJob.status === "failed" ? "destructive" : "secondary"}>
                  {activeJob.status}
                </Badge>
              </div>
              <Progress value={activeJob.progress ?? 0} className="h-2" />
              {activeJob.error_message && (
                <p className="mt-2 text-xs text-destructive">{activeJob.error_message}</p>
              )}
              {activeJob.status === "completed" && (
                <p className="mt-2 text-xs text-success">
                  ✓ {activeJob.results_count} résultats — {activeJob.duplicates_count} doublons détectés
                </p>
              )}
            </Card>
          )}

          {/* Results */}
          {activeJob && <ResultsPanel jobId={activeJob.id} />}
        </div>

        {/* SIDEBAR jobs history */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Historique</h3>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun job pour l'instant.</p>
          ) : (
            recentJobs.map((j) => (
              <Card
                key={j.id}
                className="cursor-pointer p-3 transition-all hover:border-primary/40"
                onClick={() => setActiveJob(j)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{j.name || j.source}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(j.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <Badge
                    variant={j.status === "completed" ? "default" : j.status === "failed" ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {j.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{j.results_count} résultats</span>
                  <span>{j.imported_count} importés</span>
                </div>
                {j.status === "running" && <Progress value={j.progress} className="mt-2 h-1" />}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Journal d'activité IA — toutes les actions des scrapers, agents IA, outreach.
// Filtrable par catégorie, statut, recherche. Realtime activé.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, RefreshCw, Search, CheckCircle2, XCircle, Loader2, Clock, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  running: { label: "En cours", cls: "bg-primary/15 text-primary border-primary/30", icon: Loader2 },
  success: { label: "OK", cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
  error: { label: "Erreur", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  cancelled: { label: "Annulé", cls: "bg-muted text-muted-foreground", icon: XCircle },
};

const CATEGORY_LABEL: Record<string, string> = {
  scraper: "Scraper", agent: "Agent IA", outreach: "Outreach", audit: "Audit", enrichment: "Enrichissement", report: "Rapport",
};

export default function ActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("ai_activity_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (category !== ALL) q = q.eq("category", category);
    if (status !== ALL) q = q.eq("status", status as any);
    const { data, error } = await q;
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [category, status]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("ai_activity_logs_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_activity_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter((l) =>
      l.action?.toLowerCase().includes(s) ||
      l.category?.toLowerCase().includes(s) ||
      l.error_message?.toLowerCase().includes(s) ||
      JSON.stringify(l.payload ?? {}).toLowerCase().includes(s),
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const ok = logs.filter((l) => l.status === "success").length;
    const errs = logs.filter((l) => l.status === "error").length;
    const running = logs.filter((l) => l.status === "running").length;
    const avgMs = logs.filter((l) => l.duration_ms).reduce((a, l) => a + (l.duration_ms || 0), 0) /
      Math.max(1, logs.filter((l) => l.duration_ms).length);
    return { total, ok, errs, running, avgMs };
  }, [logs]);

  const handleExport = () => {
    exportToCSV(
      filtered.map((l) => ({
        date: new Date(l.created_at).toISOString(),
        category: l.category, action: l.action,
        status: l.status, duration_ms: l.duration_ms ?? "",
        error: l.error_message ?? "", target: `${l.target_type ?? ""}:${l.target_id ?? ""}`,
      })),
      "journal-ia",
    );
  };

  return (
    <div>
      <PageHeader title="Journal d'activité IA" description="Toutes les exécutions des scrapers et agents IA, en temps réel.">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Rafraîchir</Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Succès</p><p className="text-2xl font-bold text-success">{stats.ok}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Erreurs</p><p className="text-2xl font-bold text-destructive">{stats.errs}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">En cours</p><p className="text-2xl font-bold text-primary">{stats.running}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Durée moy.</p><p className="text-2xl font-bold">{Math.round(stats.avgMs / 1000)}<span className="text-sm text-muted-foreground"> s</span></p></Card>
        </div>

        {/* Filtres */}
        <Card className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher action, erreur…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="md:w-48"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes catégories</SelectItem>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="md:w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous statuts</SelectItem>
              <SelectItem value="running">En cours</SelectItem>
              <SelectItem value="success">Succès</SelectItem>
              <SelectItem value="error">Erreur</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Liste */}
        <Card>
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto opacity-30 mb-3" />
              <p>Aucune activité IA {search || category !== ALL || status !== ALL ? "ne correspond aux filtres" : "pour le moment"}.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((l) => {
                const s = STATUS_BADGE[l.status] ?? STATUS_BADGE.success;
                const Icon = s.icon;
                return (
                  <div key={l.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-3">
                    <div className={cn("h-9 w-9 shrink-0 rounded-lg flex items-center justify-center border", s.cls)}>
                      <Icon className={cn("h-4 w-4", l.status === "running" && "animate-spin")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm font-mono">{l.action}</span>
                        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[l.category] ?? l.category}</Badge>
                        <Badge className={cn("text-[10px]", s.cls)}>{s.label}</Badge>
                        {l.duration_ms != null && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />{l.duration_ms < 1000 ? `${l.duration_ms} ms` : `${(l.duration_ms / 1000).toFixed(1)} s`}
                          </span>
                        )}
                      </div>
                      {l.error_message && <p className="text-xs text-destructive mt-1 break-all">{l.error_message}</p>}
                      {l.target_type && <p className="text-[11px] text-muted-foreground mt-1">Cible : {l.target_type}{l.target_id ? ` · ${l.target_id.slice(0, 8)}…` : ""}</p>}
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0 text-right">
                      {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

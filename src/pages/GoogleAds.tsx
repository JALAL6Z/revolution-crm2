import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Plus, Euro, Target, BarChart3, Users,
  Loader2, Trash2, Sparkles, Play, CheckCircle,
  AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  MessageCircle, Copy, Zap,
} from "lucide-react";

interface AdsClient {
  id: string;
  name: string;             // company_name from clients table OR stored locally
  google_customer_id: string;
  monthly_budget: number;
  target_roas: number;
  active: boolean;
  client_id: string;        // FK → clients table
  // latest stats (from ads_reports)
  last_report?: AdsReport;
}

interface AdsReport {
  id: string;
  period_start: string;
  period_end: string;
  kpis: any;
  ai_summary: string;
  recommendations: any[];
  status: string;
  created_at: string;
}

const emptyForm = { name: "", google_customer_id: "", monthly_budget: 500, target_roas: 2.0 };

function roas_color(roas: number, target: number) {
  if (!roas) return "text-muted-foreground";
  return roas >= target ? "text-green-400" : roas >= target * 0.7 ? "text-yellow-400" : "text-red-400";
}

function ClientCard({ c, onDelete, onRun, running }: {
  c: AdsClient; onDelete: () => void; onRun: () => void; running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const r = c.last_report;
  const kpis = r?.kpis ?? {};
  const roas = parseFloat(kpis.roas_avg ?? "0") || 0;
  const actions: string[] = kpis.media_buyer_backlog ?? [];
  const warnings: string[] = kpis.warnings ?? [];

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", c.active ? "bg-green-400" : "bg-muted")} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{c.google_customer_id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {r ? (
            <Badge variant="outline" className={cn("gap-1 text-xs", roas_color(roas, c.target_roas))}>
              {roas >= c.target_roas ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              ROAS x{roas.toFixed(1)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Pas encore de données</Badge>
          )}
          <Button variant="hero" size="sm" onClick={onRun} disabled={running} className="h-8 gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Analyse..." : "Lancer le run"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {r && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* KPIs strip */}
      {r && (
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            { label: "Budget", value: `${c.monthly_budget}€/mois` },
            { label: "Dépense", value: kpis.spend_total ?? "—" },
            { label: "Clics", value: kpis.clicks_total ?? "—" },
            { label: "Conversions", value: kpis.conversions_total ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-background px-4 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="font-semibold text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {r && expanded && (
        <div className="space-y-4 border-t border-border p-4 sm:p-5">
          {/* Synthèse IA */}
          {r.ai_summary && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />Synthèse IA
              </p>
              <p className="text-sm leading-relaxed">{r.ai_summary}</p>
            </div>
          )}

          {/* Recommandations */}
          {r.recommendations?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recommandations</p>
              {r.recommendations.slice(0, 3).map((rec: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge className={cn("mt-0.5 shrink-0 text-[10px]",
                    rec.priority === "high" ? "bg-red-500/15 text-red-400 border-red-500/20" :
                    rec.priority === "medium" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {rec.priority === "high" ? "Urgent" : rec.priority === "medium" ? "Important" : "Optionnel"}
                  </Badge>
                  <div>
                    <p>{rec.action ?? rec}</p>
                    {rec.expected_impact && <p className="text-xs text-primary mt-0.5">→ {rec.expected_impact}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Alertes */}
          {warnings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />Alertes
              </p>
              {warnings.map((w, i) => <p key={i} className="text-sm text-muted-foreground">⚠ {w}</p>)}
            </div>
          )}

          {/* Actions auto */}
          {actions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions prises</p>
              {actions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />{a}
                </div>
              ))}
            </div>
          )}

          {/* WhatsApp */}
          {kpis.client_whatsapp_summary && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />Message WhatsApp client
                </p>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                  onClick={() => { navigator.clipboard.writeText(kpis.client_whatsapp_summary); toast.success("Copié !"); }}>
                  <Copy className="h-3 w-3" />Copier
                </Button>
              </div>
              <p className="text-sm whitespace-pre-line">{kpis.client_whatsapp_summary}</p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Dernier run : {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}
    </Card>
  );
}

export default function GoogleAds() {
  const [clients, setClients] = useState<AdsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const load = async () => {
    setLoading(true);
    // Load Google Ads campaigns + their latest report
    const { data: cmp } = await supabase
      .from("campaigns")
      .select("*")
      .eq("platform", "google_ads")
      .order("created_at", { ascending: false });

    if (!cmp) { setLoading(false); return; }

    // For each campaign, get latest ads_report
    const withReports = await Promise.all(
      cmp.map(async (c: any) => {
        const { data: reports } = await supabase
          .from("ads_reports")
          .select("*")
          .eq("client_id", c.client_id)
          .eq("platforms", ["google_ads"] as any)
          .order("created_at", { ascending: false })
          .limit(1);
        return {
          id: c.id,
          name: c.name,
          google_customer_id: c.notes ?? "",
          monthly_budget: c.monthly_budget,
          target_roas: c.target_roas,
          active: c.active,
          client_id: c.client_id ?? "",
          last_report: reports?.[0] ?? undefined,
        } as AdsClient;
      })
    );
    setClients(withReports);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addClient = async () => {
    if (!form.name || !form.google_customer_id) { toast.error("Nom et Customer ID requis"); return; }
    setSaving(true);
    // Upsert client in clients table
    const { data: cl } = await supabase
      .from("clients")
      .insert({ company_name: form.name })
      .select("id")
      .single();
    if (!cl) { setSaving(false); toast.error("Erreur création client"); return; }
    // Create campaign record (notes = customer_id)
    await supabase.from("campaigns").insert({
      name: `${form.name} — Google Ads`,
      client_id: cl.id,
      platform: "google_ads",
      monthly_budget: Number(form.monthly_budget),
      target_roas: Number(form.target_roas),
      notes: form.google_customer_id,
      active: true,
    });
    setSaving(false);
    toast.success(`${form.name} ajouté`);
    setForm(emptyForm);
    setOpen(false);
    load();
  };

  const deleteClient = async (c: AdsClient) => {
    if (!confirm(`Supprimer ${c.name} ?`)) return;
    await supabase.from("campaigns").delete().eq("id", c.id);
    toast.success("Client supprimé");
    load();
  };

  const runClient = async (c: AdsClient) => {
    setRunningId(c.id);
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase.functions.invoke("ads-report", {
      body: {
        client_id: c.client_id || null,
        period_start: weekAgo,
        period_end: today,
        platforms: ["google_ads"],
        raw_data: {
          campaign_name: c.name,
          google_customer_id: c.google_customer_id,
          budget_mensuel: c.monthly_budget,
          roas_cible: c.target_roas,
          note: "Données à compléter — connecter l'API Google Ads pour l'automatisation complète",
        },
      },
    });
    setRunningId(null);
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "Erreur agent — configurez une clé IA dans Paramètres");
      return;
    }
    toast.success(`✅ Run terminé pour ${c.name}`);
    load();
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const c of clients.filter((x) => x.active)) {
      await runClient(c);
    }
    setRunningAll(false);
    toast.success("Run terminé pour tous les clients actifs");
  };

  // Global KPIs
  const activeCount = clients.filter((c) => c.active).length;
  const totalBudget = clients.reduce((s, c) => s + (c.monthly_budget || 0), 0);
  const roasValues = clients.filter((c) => c.last_report?.kpis?.roas_avg).map((c) => parseFloat(c.last_report!.kpis.roas_avg));
  const avgRoas = roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : 0;
  const totalActions = clients.reduce((s, c) => s + (c.last_report?.kpis?.media_buyer_backlog?.length ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Google Ads"
        description="Analyse, optimisation et rapports automatiques par client"
      >
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Rafraîchir
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Ajouter un client
        </Button>
        <Button variant="hero" size="sm" onClick={runAll} disabled={runningAll || clients.length === 0}>
          {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Lancer le run
        </Button>
      </PageHeader>

      <div className="space-y-6 p-3 sm:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
          <StatCard title="Clients actifs" value={activeCount} icon={Users} variant="primary" delay={0} />
          <StatCard title="ROAS moyen" value={avgRoas > 0 ? avgRoas : 0} suffix="x" icon={Target} delay={60}
            trend={avgRoas > 0 ? (avgRoas >= 2 ? "Objectif atteint" : "Sous l'objectif") : undefined}
            trendUp={avgRoas >= 2 ? true : avgRoas > 0 ? false : undefined}
          />
          <StatCard title="Budget géré" value={totalBudget} suffix="€" icon={Euro} delay={120} />
          <StatCard title="Actions auto" value={totalActions} icon={Zap} delay={180} />
        </div>

        {/* Client list */}
        {loading ? (
          <Card className="p-10 text-center text-muted-foreground">Chargement...</Card>
        ) : clients.length === 0 ? (
          <Card className="py-20 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-muted-foreground">Aucun client Google Ads</p>
            <p className="text-sm text-muted-foreground mt-1">Ajoute ton premier client pour commencer</p>
            <Button variant="hero" onClick={() => setOpen(true)} className="mt-5">
              <Plus className="h-4 w-4" />Ajouter un client
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => (
              <ClientCard
                key={c.id}
                c={c}
                onDelete={() => deleteClient(c)}
                onRun={() => runClient(c)}
                running={runningId === c.id || runningAll}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog ajouter client */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un client Google Ads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nom du client *</Label>
              <Input value={form.name} onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="ex: Dupont Plomberie" />
            </div>
            <div className="space-y-1.5">
              <Label>Google Ads Customer ID *</Label>
              <Input value={form.google_customer_id} onChange={(e) => setForm((p: any) => ({ ...p, google_customer_id: e.target.value }))} placeholder="ex: 123-456-7890" className="font-mono" />
              <p className="text-xs text-muted-foreground">Visible dans Google Ads en haut à droite de l'interface</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Budget mensuel (€)</Label>
                <Input type="number" value={form.monthly_budget} onChange={(e) => setForm((p: any) => ({ ...p, monthly_budget: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>ROAS cible</Label>
                <Input type="number" step="0.5" value={form.target_roas} onChange={(e) => setForm((p: any) => ({ ...p, target_roas: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={addClient} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

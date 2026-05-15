// Tableau de bord performance des campagnes : ROAS / CPL / CTR / Spend / Conversions.
// Export CSV + gestion des seuils d'alerte par campagne.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, Download, Plus, Trash2, TrendingUp,
} from "lucide-react";
import { exportToCSV } from "@/lib/export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string; name: string; platform: string; client_id: string;
  monthly_budget: number; target_roas: number;
  current_spend: number; current_roas: number; current_conversions: number;
  current_clicks: number; current_impressions: number; current_ctr: number; current_cpl: number;
  active: boolean; last_synced_at: string | null;
}
interface CampaignAlert {
  id: string; campaign_id: string;
  metric: "roas" | "cpl" | "ctr" | "spend" | "conversions";
  operator: "lt" | "gt" | "lte" | "gte" | "eq";
  threshold: number; active: boolean; last_triggered_at: string | null; last_value: number | null;
}

const METRIC_LABEL: Record<CampaignAlert["metric"], string> = {
  roas: "ROAS", cpl: "CPL", ctr: "CTR (%)", spend: "Dépense", conversions: "Conversions",
};
const OP_LABEL: Record<CampaignAlert["operator"], string> = { lt: "<", gt: ">", lte: "≤", gte: "≥", eq: "=" };

function compareOp(value: number, op: CampaignAlert["operator"], threshold: number): boolean {
  switch (op) {
    case "lt": return value < threshold;
    case "gt": return value > threshold;
    case "lte": return value <= threshold;
    case "gte": return value >= threshold;
    case "eq": return value === threshold;
  }
}

function metricValue(c: Campaign, m: CampaignAlert["metric"]): number {
  switch (m) {
    case "roas": return Number(c.current_roas) || 0;
    case "cpl": return Number(c.current_cpl) || 0;
    case "ctr": return Number(c.current_ctr) || 0;
    case "spend": return Number(c.current_spend) || 0;
    case "conversions": return Number(c.current_conversions) || 0;
  }
}

export default function Performance() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [alerts, setAlerts] = useState<CampaignAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertCampaign, setAlertCampaign] = useState<Campaign | null>(null);
  const [newAlert, setNewAlert] = useState<{ metric: CampaignAlert["metric"]; operator: CampaignAlert["operator"]; threshold: string }>({
    metric: "roas", operator: "lt", threshold: "2",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("campaign_alerts").select("*"),
    ]);
    setCampaigns((c ?? []) as any);
    setAlerts((a ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Aggregates
  const totals = useMemo(() => {
    const spend = campaigns.reduce((a, c) => a + Number(c.current_spend || 0), 0);
    const conv = campaigns.reduce((a, c) => a + Number(c.current_conversions || 0), 0);
    const clicks = campaigns.reduce((a, c) => a + Number(c.current_clicks || 0), 0);
    const impressions = campaigns.reduce((a, c) => a + Number(c.current_impressions || 0), 0);
    const roasW = campaigns.reduce((a, c) => a + (Number(c.current_roas || 0) * Number(c.current_spend || 0)), 0);
    const avgRoas = spend > 0 ? roasW / spend : 0;
    const cpl = conv > 0 ? spend / conv : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    return { spend, conv, clicks, impressions, avgRoas, cpl, ctr };
  }, [campaigns]);

  // Alertes déclenchées
  const triggered = useMemo(() => {
    const map = new Map<string, { campaign: Campaign; alerts: { alert: CampaignAlert; value: number }[] }>();
    for (const a of alerts) {
      if (!a.active) continue;
      const c = campaigns.find((x) => x.id === a.campaign_id);
      if (!c) continue;
      const v = metricValue(c, a.metric);
      if (compareOp(v, a.operator, Number(a.threshold))) {
        const cur = map.get(c.id) ?? { campaign: c, alerts: [] };
        cur.alerts.push({ alert: a, value: v });
        map.set(c.id, cur);
      }
    }
    return Array.from(map.values());
  }, [campaigns, alerts]);

  const exportCSV = () => {
    exportToCSV(
      campaigns.map((c) => ({
        nom: c.name, plateforme: c.platform, actif: c.active ? "oui" : "non",
        budget_mensuel: c.monthly_budget, target_roas: c.target_roas,
        depense: c.current_spend, conversions: c.current_conversions,
        roas: c.current_roas, cpl: c.current_cpl, ctr_pct: c.current_ctr,
        clics: c.current_clicks, impressions: c.current_impressions,
        derniere_sync: c.last_synced_at ?? "",
      })),
      "performance-campagnes",
    );
  };

  const addAlert = async () => {
    if (!alertCampaign) return;
    const t = Number(newAlert.threshold);
    if (!Number.isFinite(t)) return toast.error("Seuil invalide");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("campaign_alerts").insert({
      campaign_id: alertCampaign.id,
      metric: newAlert.metric, operator: newAlert.operator, threshold: t,
      active: true, created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Alerte créée");
    setNewAlert({ metric: "roas", operator: "lt", threshold: "2" });
    load();
  };

  const removeAlert = async (id: string) => {
    const { error } = await supabase.from("campaign_alerts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alerte supprimée");
    load();
  };

  const campaignAlerts = alertCampaign ? alerts.filter((a) => a.campaign_id === alertCampaign.id) : [];

  return (
    <div>
      <PageHeader title="Performance campagnes" description="ROAS, CPL, CTR — suivi en temps réel et alertes seuils.">
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!campaigns.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* KPIs globaux */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Dépense totale</p><p className="text-2xl font-bold">{totals.spend.toFixed(0)} €</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Conversions</p><p className="text-2xl font-bold">{totals.conv}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">ROAS moyen</p><p className={cn("text-2xl font-bold", totals.avgRoas >= 2 ? "text-success" : "text-warning")}>{totals.avgRoas.toFixed(2)}x</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">CPL global</p><p className="text-2xl font-bold">{totals.cpl.toFixed(2)} €</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">CTR moyen</p><p className="text-2xl font-bold">{totals.ctr.toFixed(2)}%</p></Card>
        </div>

        {/* Alertes déclenchées */}
        {triggered.length > 0 && (
          <Card className="p-5 border-warning/40 bg-warning/5">
            <div className="flex items-center gap-2 mb-3">
              <BellRing className="h-4 w-4 text-warning" />
              <h3 className="font-semibold">Alertes déclenchées ({triggered.reduce((a, t) => a + t.alerts.length, 0)})</h3>
            </div>
            <div className="space-y-2">
              {triggered.map(({ campaign, alerts }) => (
                <div key={campaign.id} className="rounded-lg border border-warning/30 bg-background p-3">
                  <p className="text-sm font-medium mb-1">{campaign.name} <span className="text-xs text-muted-foreground">· {campaign.platform}</span></p>
                  <ul className="text-xs space-y-1">
                    {alerts.map(({ alert, value }) => (
                      <li key={alert.id} className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-warning" />
                        <span>{METRIC_LABEL[alert.metric]} {OP_LABEL[alert.operator]} {alert.threshold} — actuel : <strong>{value.toFixed(2)}</strong></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tableau performance */}
        <Card>
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Performance par campagne</h3>
          </div>
          {loading ? (
            <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !campaigns.length ? (
            <div className="p-12 text-center text-muted-foreground"><TrendingUp className="h-12 w-12 mx-auto opacity-30 mb-3" /><p>Aucune campagne. Crée-en une depuis l'onglet Campagnes.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Nom</th>
                    <th className="text-left p-3">Plateforme</th>
                    <th className="text-right p-3">Dépense</th>
                    <th className="text-right p-3">ROAS</th>
                    <th className="text-right p-3">CPL</th>
                    <th className="text-right p-3">CTR</th>
                    <th className="text-right p-3">Conv.</th>
                    <th className="text-right p-3">Alertes</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const camAlerts = alerts.filter((a) => a.campaign_id === c.id);
                    const hit = triggered.find((t) => t.campaign.id === c.id);
                    const roasOk = Number(c.current_roas) >= Number(c.target_roas);
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-2">
                            {c.name}
                            {!c.active && <Badge variant="outline" className="text-[10px]">inactif</Badge>}
                            {hit && <Badge className="text-[10px] bg-warning/20 text-warning border-warning/30">⚠ {hit.alerts.length}</Badge>}
                          </div>
                        </td>
                        <td className="p-3"><Badge variant="outline" className="text-[10px] capitalize">{String(c.platform).replace("_", " ")}</Badge></td>
                        <td className="p-3 text-right tabular-nums">{Number(c.current_spend || 0).toFixed(0)} €</td>
                        <td className={cn("p-3 text-right tabular-nums font-semibold flex items-center justify-end gap-1", roasOk ? "text-success" : "text-warning")}>
                          {roasOk ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Number(c.current_roas || 0).toFixed(2)}x
                        </td>
                        <td className="p-3 text-right tabular-nums">{Number(c.current_cpl || 0).toFixed(2)} €</td>
                        <td className="p-3 text-right tabular-nums">{Number(c.current_ctr || 0).toFixed(2)}%</td>
                        <td className="p-3 text-right tabular-nums">{c.current_conversions ?? 0}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setAlertCampaign(c)} className="gap-1">
                            <BellRing className="h-3.5 w-3.5" /> {camAlerts.length}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Dialog gestion alertes */}
      <Dialog open={!!alertCampaign} onOpenChange={(o) => !o && setAlertCampaign(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Alertes — {alertCampaign?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase text-muted-foreground font-semibold">Alertes existantes</p>
              {campaignAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune alerte configurée.</p>
              ) : (
                <div className="space-y-1">
                  {campaignAlerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span>{METRIC_LABEL[a.metric]} {OP_LABEL[a.operator]} {a.threshold}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeAlert(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs uppercase text-muted-foreground font-semibold">Nouvelle alerte</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Métrique</Label>
                  <Select value={newAlert.metric} onValueChange={(v) => setNewAlert({ ...newAlert, metric: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(METRIC_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Opérateur</Label>
                  <Select value={newAlert.operator} onValueChange={(v) => setNewAlert({ ...newAlert, operator: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(OP_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Seuil</Label>
                  <Input type="number" step="0.01" value={newAlert.threshold} onChange={(e) => setNewAlert({ ...newAlert, threshold: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertCampaign(null)}>Fermer</Button>
            <Button variant="hero" onClick={addAlert}><Plus className="h-4 w-4 mr-1" /> Ajouter l'alerte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Plus, Loader2, Trash2, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { functionErrorMessage } from "@/lib/functionErrors";

interface Campaign {
  id: string; name: string; client_id: string; platform: string; monthly_budget: number;
  current_spend: number; current_roas: number; current_conversions: number;
  target_roas: number; active: boolean;
}
interface Client { id: string; company_name: string; }

export default function Campagnes() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefResult, setBriefResult] = useState<any>(null);

  const empty = { name: "", client_id: "", platform: "meta", monthly_budget: 1000, target_roas: 2.5, active: true };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    setLoading(true);
    const [{ data: cmp }, { data: cl }] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
    ]);
    setItems((cmp ?? []) as Campaign[]);
    setClients((cl ?? []) as Client[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.company_name ?? "—";

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Campaign) => { setEditing(c); setForm({ ...c }); setOpen(true); };

  const save = async () => {
    if (!form.name || !form.client_id) { toast.error("Nom et client requis"); return; }
    const payload = { ...form, monthly_budget: Number(form.monthly_budget) || 0, target_roas: Number(form.target_roas) || 0 };
    const { error } = editing
      ? await supabase.from("campaigns").update(payload).eq("id", editing.id)
      : await supabase.from("campaigns").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Campagne enregistrée");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette campagne ?")) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimée"); load();
  };

  const generateBrief = async (clientId: string, platform: string) => {
    setBriefing(clientId); setBriefResult(null);
    const { data, error } = await supabase.functions.invoke("agent-creative-brief", { body: { client_id: clientId, platform, objective: "leads" } });
    setBriefing(null);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    setBriefResult(data?.brief);
    toast.success("Brief créa généré ✨");
  };

  const totalBudget = items.reduce((s, c) => s + Number(c.monthly_budget || 0), 0);
  const avgRoas = items.length ? (items.reduce((s, c) => s + Number(c.current_roas || 0), 0) / items.length) : 0;

  return (
    <div>
      <PageHeader title="Campagnes" description="Pilotage des campagnes Ads par client">
        <Button variant="hero" size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nouvelle campagne</Button>
      </PageHeader>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Budget total /mois" value={Math.round(totalBudget)} suffix=" €" icon={Megaphone} variant="primary" />
          <StatCard title="ROAS moyen" value={Math.round(avgRoas * 100) / 100} suffix="x" icon={TrendingUp} />
          <StatCard title="Campagnes actives" value={items.filter((c) => c.active).length} icon={Megaphone} />
        </div>

        {briefResult && (
          <Card className="border-primary/30 gradient-card p-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-semibold">Brief créatif IA — {briefResult.campaign_name}</h3></div>
              <Button variant="ghost" size="sm" onClick={() => setBriefResult(null)}>Fermer</Button>
            </div>
            <div className="mt-4 grid gap-4 text-sm">
              <div><strong>Audience :</strong> {briefResult.audience?.demographics}</div>
              <div><strong>Pain points :</strong> {(briefResult.audience?.pain_points ?? []).join(", ")}</div>
              <div>
                <strong>Hooks :</strong>
                <ul className="mt-1 list-disc pl-5 space-y-1">{(briefResult.hooks ?? []).map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
              </div>
              <div>
                <strong>Concepts visuels :</strong>
                <ul className="mt-1 list-disc pl-5 space-y-1">{(briefResult.visual_concepts ?? []).map((v: string, i: number) => <li key={i}>{v}</li>)}</ul>
              </div>
              {briefResult.ugc_scripts?.length > 0 && (
                <div>
                  <strong>Scripts UGC :</strong>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    {briefResult.ugc_scripts.map((s: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-background/50 p-3 text-xs">
                        <div className="font-semibold">{s.hook}</div>
                        <p className="mt-1 text-muted-foreground">{s.script}</p>
                        <ul className="mt-2 list-disc pl-4 text-muted-foreground">{(s.shot_list ?? []).map((shot: string, j: number) => <li key={j}>{shot}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {briefResult.storyboard?.length > 0 && <div><strong>Storyboard :</strong><ol className="mt-1 list-decimal pl-5 space-y-1">{briefResult.storyboard.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>}
              {briefResult.designer_brief && <div className="rounded-lg border border-primary/20 bg-primary/5 p-3"><strong>Brief designer :</strong><p className="mt-1 text-muted-foreground">{briefResult.designer_brief}</p></div>}
              <div>
                <strong>Variantes copy :</strong>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {(briefResult.copy_variants ?? []).map((v: any, i: number) => (
                    <div key={i} className="rounded-lg border border-border bg-background/50 p-3 text-xs">
                      <div className="font-semibold">{v.headline}</div>
                      <p className="mt-1 text-muted-foreground">{v.body}</p>
                      <Badge className="mt-2">{v.cta}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Campagne</th>
                  <th className="p-3 text-left">Client</th>
                  <th className="p-3 text-left">Plateforme</th>
                  <th className="p-3 text-right">Budget</th>
                  <th className="p-3 text-right">ROAS</th>
                  <th className="p-3 text-left">État</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucune campagne</td></tr>
                ) : items.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(c)}>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3">{clientName(c.client_id)}</td>
                    <td className="p-3"><Badge variant="outline" className="capitalize">{c.platform}</Badge></td>
                    <td className="p-3 text-right font-mono">{Number(c.monthly_budget).toLocaleString("fr-FR")} €</td>
                    <td className="p-3 text-right">
                      <span className={Number(c.current_roas) >= Number(c.target_roas) ? "text-success font-semibold" : "text-muted-foreground"}>
                        {Number(c.current_roas).toFixed(2)}x / {Number(c.target_roas).toFixed(2)}x
                      </span>
                    </td>
                    <td className="p-3">{c.active ? <Badge className="bg-success/15 text-success border-success/30">Active</Badge> : <Badge variant="secondary">Pause</Badge>}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" onClick={() => generateBrief(c.client_id, c.platform)} disabled={briefing === c.client_id}>
                          {briefing === c.client_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier la campagne" : "Nouvelle campagne"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Nom *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Plateforme</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Budget mensuel (€)</Label><Input type="number" value={form.monthly_budget} onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>ROAS cible</Label><Input type="number" step="0.1" value={form.target_roas} onChange={(e) => setForm({ ...form, target_roas: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

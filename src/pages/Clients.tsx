import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Plus, Search, Sparkles, Loader2, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { functionErrorMessage } from "@/lib/functionErrors";

interface Client {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  services: string[] | null;
  mrr: number | null;
  total_billed: number | null;
  status: string | null;
  start_date: string | null;
  notes: string | null;
  updated_at: string;
}

const SERVICES_OPTIONS = ["SEO", "Google Ads", "Meta Ads", "TikTok Ads", "Social Media", "Création contenu", "Email Marketing", "Site web", "Branding", "Vidéo"];

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [reactivationResults, setReactivationResults] = useState<any[]>([]);

  const empty = { company_name: "", contact_name: "", email: "", phone: "", mrr: 0, status: "active", services: [] as string[], notes: "" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setClients((data ?? []) as Client[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ ...c, services: c.services ?? [], notes: c.notes ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.company_name) { toast.error("Nom de l'entreprise requis"); return; }
    const payload = { ...form, mrr: Number(form.mrr) || 0 };
    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Client mis à jour" : "Client créé");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce client ?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Client supprimé"); load();
  };

  const runReactivation = async () => {
    setReactivating(true); setReactivationResults([]);
    const { data, error } = await supabase.functions.invoke("agent-reactivation", { body: { days: 60 } });
    setReactivating(false);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    setReactivationResults(data?.messages ?? []);
    toast.success(`${data?.messages?.length ?? 0} messages générés`);
  };

  const filtered = clients.filter((c) =>
    !search || c.company_name?.toLowerCase().includes(search.toLowerCase()) || c.contact_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalMRR = clients.reduce((s, c) => s + (Number(c.mrr) || 0), 0);
  const activeCount = clients.filter((c) => c.status === "active").length;

  return (
    <div>
      <PageHeader title="Clients" description="Comptes actifs, MRR et account management">
        <Button variant="outline" size="sm" onClick={runReactivation} disabled={reactivating}>
          {reactivating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Agent Reactivation
        </Button>
        <Button variant="hero" size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau client
        </Button>
      </PageHeader>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Clients actifs" value={activeCount} icon={Briefcase} variant="primary" />
          <StatCard title="MRR total" value={Math.round(totalMRR)} icon={Sparkles} suffix=" €" />
          <StatCard title="Total clients" value={clients.length} icon={Briefcase} />
        </div>

        {reactivationResults.length > 0 && (
          <Card className="border-primary/30 gradient-card p-5 animate-fade-in">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><h3 className="font-semibold">Messages de réactivation générés</h3></div>
            <div className="mt-4 space-y-3 max-h-96 overflow-auto">
              {reactivationResults.map((m, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{m.client_name}</div>
                    {m.segment && <Badge variant="outline">{m.segment}</Badge>}
                    {m.winback_probability != null && <Badge variant="secondary">{m.winback_probability}% retour</Badge>}
                  </div>
                  {m.offer && <div className="mt-2 rounded border border-primary/20 bg-primary/5 p-2 text-xs"><span className="font-semibold text-primary">Offre : </span>{m.offer}</div>}
                  <div className="mt-1 text-xs uppercase text-muted-foreground">Objet : {m.subject}</div>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                  {m.follow_ups?.length > 0 && (
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="font-semibold">Relances</div>
                      {m.follow_ups.map((f: string, j: number) => <p key={j} className="rounded border border-border p-2 text-muted-foreground">{f}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher un client…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Entreprise</th>
                  <th className="p-3 text-left">Contact</th>
                  <th className="p-3 text-left">Services</th>
                  <th className="p-3 text-right">MRR</th>
                  <th className="p-3 text-left">Statut</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun client</td></tr>
                ) : filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(c)}>
                    <td className="p-3 font-medium">{c.company_name}</td>
                    <td className="p-3 text-muted-foreground">{c.contact_name ?? "—"}<br /><span className="text-xs">{c.email}</span></td>
                    <td className="p-3"><div className="flex flex-wrap gap-1">{(c.services ?? []).slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div></td>
                    <td className="p-3 text-right font-mono">{Number(c.mrr || 0).toLocaleString("fr-FR")} €</td>
                    <td className="p-3"><Badge variant={c.status === "active" ? "default" : "secondary"} className={c.status === "active" ? "bg-success/15 text-success border-success/30" : ""}>{c.status}</Badge></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Entreprise *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Contact</Label><Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Téléphone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>MRR (€)</Label><Input type="number" value={form.mrr ?? 0} onChange={(e) => setForm({ ...form, mrr: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Statut</Label>
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="paused">En pause</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Services</Label>
              <div className="flex flex-wrap gap-2">
                {SERVICES_OPTIONS.map((s) => {
                  const sel = (form.services ?? []).includes(s);
                  return (
                    <Badge key={s} variant={sel ? "default" : "outline"} className="cursor-pointer"
                      onClick={() => setForm({ ...form, services: sel ? form.services.filter((x: string) => x !== s) : [...(form.services ?? []), s] })}>
                      {s}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={save}>{editing ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

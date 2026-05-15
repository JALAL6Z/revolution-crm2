import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { isAdminRole } from "@/lib/access";
import {
  Euro, TrendingUp, Clock, CheckCircle, Plus, Loader2,
  Banknote, User, ChevronRight, AlertCircle, Trophy, Trash2,
} from "lucide-react";

interface Commission {
  id: string;
  prospect_id: string | null;
  prospect_name: string;
  user_id: string;
  role: "setter" | "closer";
  deal_amount: number;
  percentage: number;
  commission_amount: number;
  status: "pending" | "requested" | "approved" | "paid";
  requested_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  note: string | null;
  created_at: string;
}

interface Member {
  id: string;
  full_name: string | null;
  email?: string;
  role: string;
}

const STATUS_CONFIG = {
  pending:   { label: "En attente",        color: "bg-muted text-muted-foreground", icon: Clock },
  requested: { label: "Paiement demandé",  color: "bg-warning/15 text-warning border-warning/30", icon: AlertCircle },
  approved:  { label: "Approuvé",          color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CheckCircle },
  paid:      { label: "Payé ✓",            color: "bg-success/15 text-success border-success/30", icon: Banknote },
};

const ROLE_CONFIG = {
  setter: { label: "Setter", color: "bg-primary/15 text-primary", pct: 10 },
  closer: { label: "Closer", color: "bg-purple-500/15 text-purple-400", pct: 10 },
};

export default function Commissions() {
  const { user } = useAuth();
  const { role } = useCurrentRole();
  const admin = isAdminRole(role);

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    prospect_name: "", deal_amount: "", role: "setter",
    user_id: "", percentage: "10", note: "",
  });
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("commissions").select("*").order("created_at", { ascending: false });
    if (!admin) q = q.eq("user_id", user!.id);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    if (admin && filterUser !== "all") q = q.eq("user_id", filterUser);
    const { data } = await q;
    setCommissions((data ?? []) as Commission[]);
    setLoading(false);
  };

  const loadMembers = async () => {
    if (!admin) return;
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("role", ["setter", "closer"]),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setMembers((roles ?? []).map((r) => ({
      id: r.user_id,
      role: r.role,
      full_name: profiles?.find((p) => p.id === r.user_id)?.full_name ?? null,
    })));
  };

  useEffect(() => { load(); }, [filterStatus, filterUser, role]);
  useEffect(() => { loadMembers(); }, [admin]);

  // KPIs
  const myCommissions = admin ? commissions : commissions.filter((c) => c.user_id === user?.id);
  const totalEarned = myCommissions.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount), 0);
  const totalPending = myCommissions.filter((c) => c.status === "pending" || c.status === "requested").reduce((s, c) => s + Number(c.commission_amount), 0);
  const totalApproved = myCommissions.filter((c) => c.status === "approved").reduce((s, c) => s + Number(c.commission_amount), 0);
  const monthCommissions = myCommissions.filter((c) => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, c) => s + Number(c.commission_amount), 0);

  const requestPayment = async (id: string) => {
    setRequesting(id);
    const { error } = await supabase.from("commissions").update({
      status: "requested", requested_at: new Date().toISOString(),
    }).eq("id", id);
    setRequesting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Demande de paiement envoyée à l'admin");
    load();
  };

  const approveCommission = async (id: string, action: "approved" | "paid") => {
    setApproving(id);
    const update: any = { status: action };
    if (action === "approved") update.approved_at = new Date().toISOString();
    if (action === "paid") update.paid_at = new Date().toISOString();
    const { error } = await supabase.from("commissions").update(update).eq("id", id);
    setApproving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(action === "paid" ? "Commission marquée comme payée ✓" : "Commission approuvée");
    load();
  };

  const changeStatus = async (id: string, newStatus: string) => {
    const commission = commissions.find((c) => c.id === id);
    const update: any = { status: newStatus };
    if (newStatus === "approved") update.approved_at = new Date().toISOString();
    if (newStatus === "paid") update.paid_at = new Date().toISOString();
    if (newStatus === "requested") update.requested_at = new Date().toISOString();
    const { error } = await supabase.from("commissions").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Statut mis à jour");
    // Notif push au setter/closer avec nom de l'admin
    if (commission && (newStatus === "approved" || newStatus === "paid")) {
      const { data: senderProfile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      const senderName = senderProfile?.full_name || "Revolution";
      await supabase.functions.invoke("send-push", {
        body: {
          user_ids: [commission.user_id],
          title: newStatus === "paid"
            ? `💰 Payé par ${senderName} !`
            : `✅ Approuvé par ${senderName}`,
          body: newStatus === "paid"
            ? `Ta commission de ${Number(commission.commission_amount).toFixed(2)}€ pour "${commission.prospect_name}" a été payée.`
            : `Ta commission de ${Number(commission.commission_amount).toFixed(2)}€ pour "${commission.prospect_name}" a été approuvée.`,
          url: "/commissions",
          tag: "commission-update",
        },
      });
    }
    load();
  };

  const deleteCommission = async (id: string) => {
    if (!confirm("Supprimer cette commission ?")) return;
    const { error } = await supabase.from("commissions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Commission supprimée");
    load();
  };

  const addCommission = async () => {
    if (!form.prospect_name || !form.deal_amount || !form.user_id) {
      toast.error("Prospect, montant et membre requis"); return;
    }
    setSaving(true);
    const { error } = await supabase.from("commissions").insert({
      prospect_name: form.prospect_name,
      deal_amount: Number(form.deal_amount),
      role: form.role,
      user_id: form.user_id,
      percentage: Number(form.percentage),
      note: form.note || null,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Commission ajoutée");
    setAddOpen(false);
    setForm({ prospect_name: "", deal_amount: "", role: "setter", user_id: "", percentage: "10", note: "" });
    load();
  };

  const memberName = (uid: string) => members.find((m) => m.id === uid)?.full_name ?? "Membre";

  return (
    <div>
      <PageHeader
        title="Commissions"
        description="Suivi des performances et demandes de paiement"
      >
        {admin && (
          <Button variant="hero" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Ajouter commission
          </Button>
        )}
      </PageHeader>

      <div className="space-y-6 p-3 sm:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
          <StatCard title="Total perçu" value={totalEarned} suffix="€" icon={Banknote} variant="primary" delay={0} />
          <StatCard title="En attente" value={totalPending} suffix="€" icon={Clock} delay={60}
            trend={totalPending > 0 ? "À demander ou en cours" : undefined} />
          <StatCard title="Approuvé" value={totalApproved} suffix="€" icon={CheckCircle} delay={120} />
          <StatCard title="Ce mois" value={monthCommissions} suffix="€" icon={TrendingUp} delay={180}
            trend={monthCommissions > 0 ? "Commissions du mois" : undefined} trendUp={monthCommissions > 0 ? true : undefined} />
        </div>

        {/* Explication commission */}
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Setter</p>
                <p className="text-muted-foreground text-xs">10% à la transformation</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground self-center hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center">
                <Euro className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold">Closer</p>
                <p className="text-muted-foreground text-xs">+10% si closing</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground self-center hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-success/15 flex items-center justify-center">
                <Banknote className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-semibold">Total possible</p>
                <p className="text-muted-foreground text-xs">20% si setter + closer</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {admin && (
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Membre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les membres</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name ?? "Membre"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Liste commissions */}
        {loading ? (
          <Card className="p-10 text-center text-muted-foreground">Chargement...</Card>
        ) : commissions.length === 0 ? (
          <Card className="p-14 text-center space-y-3">
            <Euro className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">Aucune commission enregistrée</p>
            {admin && <Button variant="hero" onClick={() => setAddOpen(true)} className="mt-2"><Plus className="h-4 w-4" />Ajouter</Button>}
          </Card>
        ) : (
          <div className="space-y-2">
            {commissions.map((c) => {
              const st = STATUS_CONFIG[c.status];
              const rl = ROLE_CONFIG[c.role];
              const StatusIcon = st.icon;
              return (
                <Card key={c.id} className="p-4 flex flex-wrap items-center gap-3">
                  {/* Infos */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{c.prospect_name}</p>
                      <Badge className={cn("text-[10px]", rl.color)}>{rl.label}</Badge>
                      {admin && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{memberName(c.user_id)}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Prestation : <strong className="text-foreground">{Number(c.deal_amount).toLocaleString()}€</strong></span>
                      <span>Taux : <strong className="text-foreground">{c.percentage}%</strong></span>
                      <span>{new Date(c.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    {c.note && <p className="mt-1 text-xs text-muted-foreground italic">{c.note}</p>}
                  </div>

                  {/* Montant commission */}
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary">{Number(c.commission_amount).toLocaleString()}€</p>
                    <p className="text-[10px] text-muted-foreground">commission</p>
                  </div>

                  {/* Statut — dropdown pour admin, badge pour membre */}
                  {admin ? (
                    <Select value={c.status} onValueChange={(v) => changeStatus(c.id, v)}>
                      <SelectTrigger className={cn("h-8 w-[170px] text-xs font-semibold border rounded-full", st.color)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={cn("gap-1 text-xs", st.color)}>
                      <StatusIcon className="h-3 w-3" />{st.label}
                    </Badge>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 items-center">
                    {/* Setter/Closer : demander paiement */}
                    {!admin && c.status === "pending" && (
                      <Button size="sm" variant="hero" className="h-8 text-xs"
                        disabled={requesting === c.id}
                        onClick={() => requestPayment(c.id)}>
                        {requesting === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Banknote className="h-3 w-3" />}
                        Demander paiement
                      </Button>
                    )}
                    {/* Admin : supprimer */}
                    {admin && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteCommission(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog ajouter commission */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une commission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client / Prospect *</Label>
              <Input value={form.prospect_name} onChange={(e) => setForm(p => ({ ...p, prospect_name: e.target.value }))}
                placeholder="ex: Garage Dupont" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Montant prestation (€) *</Label>
                <Input type="number" value={form.deal_amount} onChange={(e) => setForm(p => ({ ...p, deal_amount: e.target.value }))}
                  placeholder="ex: 599" />
              </div>
              <div className="space-y-1.5">
                <Label>Commission (%)</Label>
                <Select value={form.percentage} onValueChange={(v) => setForm(p => ({ ...p, percentage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10% — Setter</SelectItem>
                    <SelectItem value="20">20% — Setter + Closer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={(v) => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setter">Setter</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Membre *</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm(p => ({ ...p, user_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? "Membre"} · {m.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Aperçu montant */}
            {form.deal_amount && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                <p className="text-2xl font-black text-primary">
                  {(Number(form.deal_amount) * Number(form.percentage) / 100).toFixed(2)}€
                </p>
                <p className="text-xs text-muted-foreground">commission calculée ({form.percentage}% de {form.deal_amount}€)</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Note (optionnel)</Label>
              <Textarea value={form.note} onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="Détails du deal..." rows={2} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={addCommission} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

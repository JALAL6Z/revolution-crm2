import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ExternalLink, Phone, Mail, MapPin, LayoutGrid, List, Sparkles, ArrowRight, Loader2, Zap, Download, Users, CalendarCheck, Briefcase, Activity, Trash2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KanbanBoard, KanbanStatus } from "@/components/prospects/KanbanBoard";
import { exportToCSV } from "@/lib/export";
import { logFunnelEvent } from "@/lib/funnelEvents";
import { functionErrorMessage } from "@/lib/functionErrors";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { canReceiveProspects, isAdminRole, roleLabel } from "@/lib/access";

type Status = "a_contacter" | "contacte" | "rdv_pris" | "rdv_effectue" | "proposition" | "negociation" | "client" | "perdu" | "injoignable";
type Source = "google_maps" | "linkedin" | "instagram" | "tiktok" | "pages_jaunes" | "societe_com" | "manual" | "referral" | "website";

const STATUS: Record<Status, { label: string; color: string }> = {
  a_contacter: { label: "À contacter", color: "bg-muted text-foreground" },
  contacte: { label: "Contacté", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  rdv_pris: { label: "RDV pris", color: "bg-warning/15 text-warning border-warning/30" },
  rdv_effectue: { label: "RDV effectué", color: "bg-warning/15 text-warning border-warning/30" },
  proposition: { label: "Proposition", color: "bg-primary/15 text-primary border-primary/30" },
  negociation: { label: "Négociation", color: "bg-primary/15 text-primary border-primary/30" },
  client: { label: "Client", color: "bg-success/15 text-success border-success/30" },
  perdu: { label: "Perdu", color: "bg-destructive/15 text-destructive border-destructive/30" },
  injoignable: { label: "Injoignable", color: "bg-muted text-muted-foreground" },
};

const SOURCE_LABELS: Record<Source, string> = {
  google_maps: "Google Maps", linkedin: "LinkedIn", instagram: "Instagram", tiktok: "TikTok",
  pages_jaunes: "Pages Jaunes", societe_com: "Societe.com", manual: "Manuel", referral: "Recommandation", website: "Site web",
};

const PAGE_SIZE = 2000;

// ICP — Profils clients idéaux avec mots-clés secteur associés
const ICP_FILTERS = [
  { id: "restaurant",  label: "Restaurant",    emoji: "🍽️", keywords: ["restaurant","brasserie","pizzeria","traiteur","cafe","bar","bistrot"] },
  { id: "plomberie",   label: "Plomberie",     emoji: "🔧", keywords: ["plombier","plomberie","chauffagiste","chauffage","sanitaire"] },
  { id: "electricite", label: "Électricité",   emoji: "⚡", keywords: ["electricien","electricite","electrique","domotique"] },
  { id: "batiment",    label: "Bâtiment",      emoji: "🏗️", keywords: ["maçon","couvreur","carreleur","menuisier","batiment","peintre","renovation","construction"] },
  { id: "coiffure",    label: "Coiffure",      emoji: "✂️", keywords: ["coiffeur","coiffure","salon","barbier"] },
  { id: "beaute",      label: "Beauté",        emoji: "💅", keywords: ["esthetique","beaute","onglerie","spa","institut","massage"] },
  { id: "fitness",     label: "Fitness",       emoji: "💪", keywords: ["sport","fitness","gym","coach","musculation","pilates","yoga"] },
  { id: "auto",        label: "Auto / Garage", emoji: "🚗", keywords: ["garage","auto","mecanique","carrosserie","reparation auto"] },
  { id: "sante",       label: "Santé",         emoji: "🏥", keywords: ["medecin","docteur","dentiste","kine","kinesitherapeute","pharmacie","infirmier","osteopathe","chirurgien","opticien"] },
  { id: "juridique",   label: "Juridique",     emoji: "⚖️", keywords: ["avocat","notaire","huissier","juridique","droit"] },
  { id: "immobilier",  label: "Immobilier",    emoji: "🏠", keywords: ["immobilier","agence","promotion","agent"] },
  { id: "nettoyage",   label: "Nettoyage",     emoji: "🧹", keywords: ["nettoyage","menage","entretien","proprete","desinfection"] },
  { id: "transport",   label: "Transport",     emoji: "🚚", keywords: ["taxi","vtc","demenagement","transport","livraison","chauffeur"] },
  { id: "jardinage",   label: "Jardinage",     emoji: "🌿", keywords: ["jardinier","jardinage","paysagiste","espaces verts"] },
  { id: "photo",       label: "Photo / Vidéo", emoji: "📸", keywords: ["photographe","photo","video","cameraman","studio"] },
  { id: "informatique",label: "Informatique",  emoji: "💻", keywords: ["informatique","it","developpeur","web","reseau","securite","tech"] },
];

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
}

export default function Prospects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, loading: roleLoading } = useCurrentRole();
  const admin = isAdminRole(role);
  const [prospects, setProspects] = useState<any[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [icpFilter, setIcpFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [sectors, setSectors] = useState<string[]>([]);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const toggleSelect = (id: string) => {
    if (!admin) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkAnalyze = async () => {
    if (!admin || selectedIds.size === 0) return;
    setBulkLoading(true);
    const { data, error } = await supabase.functions.invoke("bulk-analyze-prospects", {
      body: { prospect_ids: Array.from(selectedIds) },
    });
    setBulkLoading(false);
    if (error || data?.error) { toast.error(data?.error || await functionErrorMessage(error)); return; }
    toast.success(`Analyse IA : ${data.success}/${data.total} prospects analysés`);
    setSelectedIds(new Set());
    fetch();
  };

  const bulkDelete = async () => {
    if (!admin || selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} prospect${selectedIds.size > 1 ? "s" : ""} ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from("prospects").delete().in("id", Array.from(selectedIds));
    if (error) { toast.error(error.message); return; }
    toast.success(`${selectedIds.size} prospect${selectedIds.size > 1 ? "s" : ""} supprimé${selectedIds.size > 1 ? "s" : ""}`);
    setSelectedIds(new Set());
    fetch();
  };

  const deleteOne = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    const { error } = await supabase.from("prospects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Prospect supprimé");
    fetch();
  };

  const fetchMembers = async () => {
    if (!admin) { setMembers([]); return; }
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "setter", "closer"]),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const list = (roles ?? []).map((item) => ({
      id: item.user_id,
      role: item.role,
      full_name: profiles?.find((profile) => profile.id === item.user_id)?.full_name ?? null,
    }));
    setMembers(list);
  };

  const fetch = async () => {
    if (roleLoading || !user) return;
    setLoading(true);
    let query = supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!admin) query = query.eq("assigned_to", user.id);
    if (statusFilter !== "all") query = query.eq("status", statusFilter as Status);
    if (sourceFilter !== "all") query = query.eq("source", sourceFilter as Source);
    if (sectorFilter !== "all") query = query.eq("sector", sectorFilter);
    if (icpFilter !== "all") {
      const icp = ICP_FILTERS.find(i => i.id === icpFilter);
      if (icp) {
        const orClauses = icp.keywords.map(k => `sector.ilike.%${k}%,name.ilike.%${k}%`).join(",");
        query = query.or(orClauses);
      }
    }
    if (siteFilter === "none") query = query.is("website", null);
    if (siteFilter === "has") query = query.not("website", "is", null);
    if (assignedFilter === "unassigned") query = query.is("assigned_to", null);
    else if (assignedFilter !== "all") query = query.eq("assigned_to", assignedFilter);
    if (search.trim()) {
      const term = search.trim().replace(/[%_]/g, "\\$&");
      const like = `%${term}%`;
      query = query.or(`name.ilike.${like},city.ilike.${like},sector.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) toast.error(error.message);
    setProspects(data ?? []);
    // Extraire les secteurs uniques pour le filtre
    if (data) {
      const s = [...new Set(data.map((p: any) => p.sector).filter(Boolean))].sort();
      setSectors(s as string[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [search, statusFilter, sourceFilter, siteFilter, sectorFilter, icpFilter, assignedFilter, role, roleLoading, user?.id]);
  useEffect(() => { fetchMembers(); }, [admin]);

  const filtered = prospects;

  const updateStatus = async (id: string, newStatus: Status) => {
    // Optimistic update
    const previous = prospects;
    const current = prospects.find((p) => p.id === id);
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
    const { error } = await supabase.from("prospects").update({ status: newStatus }).eq("id", id);
    if (error) {
      setProspects(previous);
      toast.error(error.message);
      return;
    }
    await logFunnelEvent({
      event_type: "status_changed",
      entity_type: "prospect",
      entity_id: id,
      prospect_id: id,
      source: current?.source,
      status_from: current?.status,
      status_to: newStatus,
      metadata: { prospect_name: current?.name },
    });
    toast.success(`Déplacé vers "${STATUS[newStatus].label}"`);
  };

  const assignProspects = async (ids: string[], assignedTo: string | null) => {
    if (!admin || ids.length === 0) return;
    setAssigning(true);
    const { error } = await supabase.from("prospects").update({ assigned_to: assignedTo }).in("id", ids);
    setAssigning(false);
    if (error) { toast.error(error.message); return; }
    toast.success(assignedTo ? "Prospects assignes" : "Assignation retiree");
    if (assignedTo) {
      const { data: senderProfile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      const senderName = senderProfile?.full_name || "Revolution";
      await supabase.functions.invoke("send-push", {
        body: {
          user_ids: [assignedTo],
          title: `🎯 ${ids.length} prospect${ids.length > 1 ? "s" : ""} — de ${senderName}`,
          body: `${senderName} t'a assigné ${ids.length} prospect${ids.length > 1 ? "s" : ""}. Lance-toi !`,
          url: "/prospects",
          tag: "prospects-assigned",
        },
      });
    }
    setSelectedIds(new Set());
    fetch();
  };

  const assignOne = async (id: string, assignedTo: string | null) => {
    if (!admin) return;
    const prospect = prospects.find((p) => p.id === id);
    const { error } = await supabase.from("prospects").update({ assigned_to: assignedTo }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setProspects((prev) => prev.map((p) => p.id === id ? { ...p, assigned_to: assignedTo } : p));
    if (assignedTo && prospect) {
      const { data: senderProfile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      const senderName = senderProfile?.full_name || "Revolution";
      await supabase.functions.invoke("send-push", {
        body: {
          user_ids: [assignedTo],
          title: `🎯 Nouveau prospect — de ${senderName}`,
          body: `"${prospect.name}" vient de t'être assigné par ${senderName}.`,
          url: "/prospects",
          tag: "prospect-assigned",
        },
      });
    }
  };

  const assignableMembers = members.filter((member) => canReceiveProspects(member.role));
  const memberById = new Map(members.map((member) => [member.id, member]));

  // Stats calculées depuis les prospects chargés
  const statsTotal = prospects.length;
  const statsAContacter = prospects.filter(p => p.status === "a_contacter").length;
  const statsRdv = prospects.filter(p => p.status === "rdv_pris" || p.status === "rdv_effectue").length;
  const statsClient = prospects.filter(p => p.status === "client").length;
  const statsScore = prospects.filter(p => p.analysis_score != null).length;

  return (
    <div>
      <PageHeader title="Prospects" description={`${filtered.length} prospect${filtered.length > 1 ? "s" : ""} affiché${filtered.length > 1 ? "s" : ""}`}>
        {admin && <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(filtered, "prospects", [
            { key: "name", label: "Entreprise" },
            { key: "contact_name", label: "Contact" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Téléphone" },
            { key: "city", label: "Ville" },
            { key: "sector", label: "Secteur" },
            { key: "status", label: "Statut" },
            { key: "source", label: "Source" },
            { key: "website", label: "Site" },
            { key: "analysis_score", label: "Score IA" },
            { key: "created_at", label: "Créé le" },
          ])}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>}
        <div className="flex items-center gap-2 rounded-lg border border-border p-1">
          <Button variant={view === "table" ? "soft" : "ghost"} size="sm" onClick={() => setView("table")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant={view === "kanban" ? "soft" : "ghost"} size="sm" onClick={() => setView("kanban")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        {admin && <NewProspectDialog open={open} onOpenChange={setOpen} onCreated={fetch} members={assignableMembers} />}
      </PageHeader>

      {/* ── Blocs stats ── */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5 sm:gap-4 sm:p-6 sm:pb-2">
        <StatCard title="Total" value={statsTotal} icon={Users} delay={0} />
        <StatCard title="À contacter" value={statsAContacter} icon={Activity} delay={60} />
        <StatCard title="RDV pris" value={statsRdv} icon={CalendarCheck} delay={120} trend={statsRdv > 0 ? `${statsRdv} en attente` : undefined} />
        <StatCard title="Clients" value={statsClient} icon={Briefcase} variant="primary" delay={180} />
        <StatCard title="Analysés IA" value={statsScore} icon={Sparkles} delay={240} trend={statsTotal > 0 ? `${Math.round(statsScore/statsTotal*100)}% analysés` : undefined} />
      </div>

      <div className="space-y-4 p-3 sm:p-6">
        {/* ── Barre de recherche ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, ville, secteur, email, téléphone..." className="pl-9" />
        </div>

        {/* ── Chips statut rapide ── */}
        <div className="flex flex-wrap gap-2">
          {[{ k: "all", label: `Tous (${prospects.length})` }, ...Object.entries(STATUS).map(([k, v]) => ({ k, label: v.label }))].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setStatusFilter(k)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold border transition-all",
                statusFilter === k
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Filtres avancés ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ICP / Activité */}
          <Select value={icpFilter} onValueChange={setIcpFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Activité (ICP)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes activités</SelectItem>
              {ICP_FILTERS.map((icp) => (
                <SelectItem key={icp.id} value={icp.id}>{icp.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Site web */}
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Site web" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous sites</SelectItem>
              <SelectItem value="none">Sans site</SelectItem>
              <SelectItem value="has">Avec site</SelectItem>
            </SelectContent>
          </Select>

          {/* Secteur */}
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Secteur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous secteurs</SelectItem>
              {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Source */}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sources</SelectItem>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Assigné (admin) */}
          {admin && (
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Assigné à" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="unassigned">Non assigné</SelectItem>
                {assignableMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name ?? "Membre"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Reset filtres */}
          {(siteFilter !== "all" || sectorFilter !== "all" || sourceFilter !== "all" || assignedFilter !== "all" || icpFilter !== "all") && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1"
              onClick={() => { setSiteFilter("all"); setSectorFilter("all"); setSourceFilter("all"); setAssignedFilter("all"); setIcpFilter("all"); }}>
              ✕ Réinitialiser
            </Button>
          )}

          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
        </div>

        {selectedIds.size > 0 && (
          <Card className="flex items-center justify-between gap-3 border-primary/40 bg-primary/5 p-3">
            <p className="text-sm">
              <span className="font-semibold">{selectedIds.size}</span> prospect{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Annuler</Button>
              <Select
                onValueChange={(value) => assignProspects(Array.from(selectedIds), value === "none" ? null : value)}
                disabled={assigning}
              >
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder={assigning ? "Assignation..." : "Assigner à"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {assignableMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name ?? "Membre"} · {roleLabel(member.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="hero" size="sm" onClick={bulkAnalyze} disabled={bulkLoading}>
                {bulkLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyse IA...</> : <><Zap className="h-4 w-4" /> Analyser avec l'IA</>}
              </Button>
              <Button variant="destructive" size="sm" onClick={bulkDelete} className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Supprimer ({selectedIds.size})
              </Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Chargement...</div>
        ) : filtered.length === 0 ? (
          <Card className="py-20 text-center">
            <p className="text-muted-foreground">
              {admin ? "Aucun prospect - ajoutez-en un manuellement ou importez votre base." : "Aucun prospect ne vous est assigne pour le moment."}
            </p>
            {admin && (
              <Button variant="hero" className="mt-4" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Ajouter un prospect
              </Button>
            )}
          </Card>
        ) : view === "table" ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="w-10 px-4 py-3">
                      {admin && <Checkbox
                        checked={filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))}
                        onCheckedChange={(c) => {
                          if (c) setSelectedIds(new Set(filtered.map((p) => p.id)));
                          else setSelectedIds(new Set());
                        }}
                      />}
                    </th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entreprise</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Localisation</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Site web</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Secteur</th>
                    {admin && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assigné</th>}
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Statut</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-border/50 transition-colors hover:bg-accent/20 cursor-pointer group"
                      onClick={() => navigate(`/prospects/${p.id}`)}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {admin && <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />}
                      </td>
                      {/* Entreprise */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{p.name}</p>
                          {p.analysis_score != null && (
                            <Badge variant="outline" className="text-[10px] gap-0.5 shrink-0">
                              <Sparkles className="h-2.5 w-2.5 text-primary" />{p.analysis_score}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{SOURCE_LABELS[p.source as Source] ?? p.source}</p>
                      </td>
                      {/* Localisation */}
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {p.city ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.city}</span> : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      {/* Site web */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {p.website ? (
                          <a href={p.website} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/20 px-2.5 py-0.5 text-[11px] font-semibold text-success hover:bg-success/25 transition-colors">
                            <ExternalLink className="h-2.5 w-2.5" />Oui
                          </a>
                        ) : (
                          <Badge variant="destructive" className="rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-destructive/15 text-destructive border border-destructive/20">
                            Aucun
                          </Badge>
                        )}
                      </td>
                      {/* Contact */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("flex items-center justify-center h-7 w-7 rounded-full border transition-colors",
                            p.phone ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/20 text-muted-foreground/30"
                          )}>
                            <Phone className="h-3 w-3" />
                          </span>
                          <span className={cn("flex items-center justify-center h-7 w-7 rounded-full border transition-colors",
                            p.email ? "border-border bg-accent text-accent-foreground" : "border-border bg-muted/20 text-muted-foreground/30"
                          )}>
                            <Mail className="h-3 w-3" />
                          </span>
                        </div>
                      </td>
                      {/* Secteur */}
                      <td className="px-3 py-3">
                        {p.sector ? (
                          <Badge variant="secondary" className="rounded-full text-[11px] font-medium gap-1">
                            <MapPin className="h-2.5 w-2.5" />{p.sector}
                          </Badge>
                        ) : <span className="text-muted-foreground/40 text-sm">—</span>}
                      </td>
                      {/* Assigné (admin only) */}
                      {admin && (
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Select value={p.assigned_to ?? "none"} onValueChange={(value) => assignOne(p.id, value === "none" ? null : value)}>
                            <SelectTrigger className="h-7 w-[140px] text-xs border-dashed">
                              <SelectValue placeholder="Non assigné" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Non assigné</SelectItem>
                              {assignableMembers.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.full_name ?? "Membre"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {/* Statut */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v as Status)}>
                          <SelectTrigger className={cn("h-7 w-[140px] border rounded-full text-xs font-semibold", STATUS[p.status as Status]?.color)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                          {admin && (
                            <button
                              onClick={() => deleteOne(p.id, p.name)}
                              className="ml-1 h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards — version complète ── */}
            <div className="sm:hidden divide-y divide-border">
              {filtered.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  {/* Ligne 1 : nom + flèche */}
                  <div className="flex items-start justify-between gap-2"
                    onClick={() => navigate(`/prospects/${p.id}`)}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          {p.city && <><MapPin className="h-3 w-3" />{p.city}</>}
                          {p.city && p.sector && <span>·</span>}
                          {p.sector && <span>{p.sector}</span>}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                  </div>

                  {/* Ligne 2 : badges site web + contact */}
                  <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Site web */}
                    {p.website ? (
                      <a href={p.website} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/20 px-2.5 py-1 text-[11px] font-semibold text-success">
                        <ExternalLink className="h-2.5 w-2.5" />Site web
                      </a>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-destructive/15 border border-destructive/20 px-2.5 py-1 text-[11px] font-semibold text-destructive">
                        Sans site
                      </span>
                    )}
                    {/* Téléphone cliquable */}
                    {p.phone && (
                      <a href={`tel:${p.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        <Phone className="h-3 w-3" />{p.phone}
                      </a>
                    )}
                    {/* Email */}
                    {p.email && (
                      <a href={`mailto:${p.email}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                        <Mail className="h-3 w-3" />{p.email}
                      </a>
                    )}
                  </div>

                  {/* Ligne 3 : statut (dropdown) + supprimer */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v as Status)}>
                      <SelectTrigger className={cn("h-8 flex-1 text-xs font-semibold rounded-full border", STATUS[p.status as Status]?.color)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {admin && (
                      <button onClick={() => deleteOne(p.id, p.name)}
                        className="h-8 w-8 flex shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </Card>
        ) : (
          <KanbanBoard
            prospects={filtered}
            sourceLabels={SOURCE_LABELS}
            onCardClick={(id) => navigate(`/prospects/${id}`)}
            onStatusChange={(id, s) => updateStatus(id, s as Status)}
          />
        )}
      </div>
    </div>
  );
}

function NewProspectDialog({ open, onOpenChange, onCreated, members }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; members: TeamMember[] }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", website: "", city: "", sector: "", source: "manual" as Source, notes: "", assigned_to: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("prospects").insert({ ...form, assigned_to: form.assigned_to || null, created_by: user?.id }).select("id, source").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (data) {
      await logFunnelEvent({
        event_type: "prospect_created",
        entity_type: "prospect",
        entity_id: data.id,
        prospect_id: data.id,
        source: data.source,
        metadata: { name: form.name, sector: form.sector, city: form.city },
      });
    }
    toast.success("Prospect ajouté");
    setForm({ name: "", email: "", phone: "", website: "", city: "", sector: "", source: "manual", notes: "", assigned_to: "" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="hero"><Plus className="h-4 w-4" /> Nouveau prospect</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouveau prospect</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nom de l'entreprise *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Site web</Label>
              <Input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ville</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Secteur</Label>
              <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="Restauration, BTP..." />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assigner à</Label>
              <Select value={form.assigned_to || "none"} onValueChange={(value) => setForm({ ...form, assigned_to: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name ?? "Membre"} · {roleLabel(member.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as Source })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <Button type="submit" variant="hero" disabled={saving} className="w-full">
            {saving ? "Création..." : "Ajouter le prospect"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

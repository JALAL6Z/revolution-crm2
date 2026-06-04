import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Sparkles, ExternalLink, Phone, Mail, MapPin, Globe, Building2,
  Star, Users, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Copy,
  Send, MessageCircle, Linkedin, Instagram, PhoneCall, Swords, X, Euro,
  Repeat2, CalendarClock, Receipt, Monitor, SearchCode, ChevronDown, ChevronUp, CheckCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logFunnelEvent } from "@/lib/funnelEvents";
import { functionErrorMessage } from "@/lib/functionErrors";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { canReceiveProspects, isAdminRole, roleLabel } from "@/lib/access";
import { generateSiteHtml } from "@/lib/siteGenerator";

const STATUS_LABELS: Record<string, string> = {
  a_contacter: "À contacter", contacte: "Contacté", rdv_pris: "RDV pris",
  rdv_effectue: "RDV effectué", proposition: "Proposition", negociation: "Négociation",
  client: "Client", perdu: "Perdu", injoignable: "Injoignable",
};
const STATUS_COLORS: Record<string, string> = {
  a_contacter: "bg-muted text-muted-foreground",
  contacte: "bg-blue-500/15 text-blue-400",
  rdv_pris: "bg-warning/15 text-warning",
  rdv_effectue: "bg-warning/15 text-warning",
  proposition: "bg-primary/15 text-primary",
  negociation: "bg-primary/15 text-primary",
  client: "bg-success/15 text-success",
  perdu: "bg-destructive/15 text-destructive",
  injoignable: "bg-muted text-muted-foreground",
};

const CHANNELS = [
  { id: "email", label: "Email", icon: Mail, color: "text-blue-400" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-400" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-sky-400" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-400" },
  { id: "tiktok", label: "TikTok", icon: Send, color: "text-fuchsia-400" },
];

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground",
};

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
}

export default function ProspectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useCurrentRole();
  const admin = isAdminRole(role);
  const [prospect, setProspect] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [seoAudit, setSeoAudit] = useState<any>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState([{ description: "", qty: 1, price: 0 }]);
  const [invoiceComment, setInvoiceComment] = useState("");
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceNumState] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rnd = Math.floor(Math.random() * 900) + 100;
    return `RE-${d.getFullYear()}-${mm}${dd}-${rnd}`;
  });
  const [siteGenerating, setSiteGenerating] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [activeChannel, setActiveChannel] = useState("email");
  const [draftContent, setDraftContent] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [outreachExtras, setOutreachExtras] = useState<any>(null);
  const [callScript, setCallScript] = useState<any>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [competitors, setCompetitors] = useState<any>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [offer, setOffer] = useState<any>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [sequenceLoading, setSequenceLoading] = useState<string | null>(null);
  const [rdvOpen, setRdvOpen] = useState(false);
  const [rdvLoading, setRdvLoading] = useState(false);
  const [rdvForm, setRdvForm] = useState({ title: "", scheduled_at: "", duration_minutes: 30, type: "discovery", notes: "" });
  const [availabilitySlots, setAvailabilitySlots] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    const [{ data: p, error: pErr }, { data: m }, { data: seqs }] = await Promise.all([
      supabase.from("prospects").select("*").eq("id", id).maybeSingle(),
      supabase.from("outreach_messages").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
      supabase.from("outreach_sequences").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
    ]);
    // Ne jamais écraser le prospect avec null — on garde l'état précédent si la requête échoue
    if (p) {
      setProspect(p);
      setNotesValue(p.ai_note ?? "");
    } else if (!pErr) {
      // Résultat vide sans erreur (prospect introuvable pour de vrai)
      setProspect(null);
    }
    // Si pErr → on garde le prospect existant en mémoire, pas de disparition
    setMessages(m ?? []);
    setSequences(seqs ?? []);
    setLoading(false);
  };

  const loadMembers = async () => {
    if (!admin) { setMembers([]); return; }
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("role", ["setter", "closer"]),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const list = (roles ?? [])
      .filter((item) => canReceiveProspects(item.role))
      .map((item) => ({
        id: item.user_id,
        role: item.role,
        full_name: profiles?.find((profile) => profile.id === item.user_id)?.full_name ?? null,
      }));
    setMembers(list);
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { loadMembers(); }, [admin]);

  // Charge le dernier brouillon du canal actif dans l'éditeur
  useEffect(() => {
    const last = messages.find((m) => m.channel === activeChannel && m.status === "draft");
    if (last) {
      setDraftContent(last.content);
      setDraftSubject(last.subject ?? "");
    } else {
      setDraftContent("");
      setDraftSubject("");
    }
  }, [activeChannel, messages]);

  const analyze = async () => {
    setAnalyzing(true);
    const { data, error } = await supabase.functions.invoke("analyze-prospect", { body: { prospect_id: id } });
    setAnalyzing(false);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    await logFunnelEvent({
      event_type: "lead_analyzed",
      entity_type: "prospect",
      entity_id: id,
      prospect_id: id,
      source: prospect?.source,
      metadata: { score: data?.analysis?.score, primary_service_to_sell: data?.analysis?.primary_service_to_sell },
    });
    toast.success("Analyse IA terminée 🚀");
    load();
  };

  const generate = async (channel: string) => {
    setGenerating(channel);
    const { data, error } = await supabase.functions.invoke("generate-outreach", {
      body: { prospect_id: id, channel },
    });
    setGenerating(null);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    await logFunnelEvent({
      event_type: "message_generated",
      entity_type: "outreach_message",
      entity_id: data?.message?.id,
      prospect_id: id,
      source: prospect?.source,
      channel,
      metadata: { variants_count: data?.variants?.length ?? 0 },
    });
    toast.success(`Message ${channel} généré`);
    setOutreachExtras({ channel, variants: data?.variants ?? [], follow_ups: data?.follow_ups ?? [], personalization_notes: data?.personalization_notes ?? [] });
    setActiveChannel(channel);
    load();
  };

  const startSequence = async (channel: string) => {
    setSequenceLoading(channel);
    const { data, error } = await supabase.functions.invoke("sequence-create", {
      body: {
        prospect_id: id,
        channel,
        max_steps: 3,
        run_first_now: true,
      },
    });
    setSequenceLoading(null);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }

    await logFunnelEvent({
      event_type: "sequence_created",
      entity_type: "outreach_sequence",
      entity_id: data?.sequence?.id,
      prospect_id: id,
      source: prospect?.source,
      channel,
      metadata: { existing: Boolean(data?.existing), first_message_id: data?.first_message?.id },
    });

    if (data?.first_message) {
      setActiveChannel(channel);
      setDraftSubject(data.first_message.subject ?? "");
      setDraftContent(data.first_message.content ?? "");
      toast.success("Séquence démarrée, premier message généré");
    } else if (data?.existing) {
      toast.info("Une séquence active existe déjà pour ce canal");
    } else {
      toast.success("Séquence programmée");
    }
    load();
  };

  const runCloser = async () => {
    setCallLoading(true);
    const { data, error } = await supabase.functions.invoke("agent-closer", { body: { prospect_id: id } });
    setCallLoading(false);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    setCallScript(data?.script);
    await logFunnelEvent({
      event_type: "call_script_generated",
      entity_type: "call_script",
      entity_id: data?.script_id,
      prospect_id: id,
      source: prospect?.source,
    });
    toast.success("Script d'appel prêt 📞");
  };

  const runCompetitors = async () => {
    setCompLoading(true);
    const { data, error } = await supabase.functions.invoke("agent-competitors", { body: { prospect_id: id } });
    setCompLoading(false);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    setCompetitors(data?.analysis);
    await logFunnelEvent({
      event_type: "competitors_analyzed",
      entity_type: "prospect",
      entity_id: id,
      prospect_id: id,
      source: prospect?.source,
      metadata: { opportunity_score: data?.analysis?.opportunity_score },
    });
    toast.success("Analyse concurrence prête ⚔️");
  };

  const runOfferBuilder = async () => {
    setOfferLoading(true);
    const { data, error } = await supabase.functions.invoke("agent-offer-builder", { body: { prospect_id: id } });
    setOfferLoading(false);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    setOffer(data?.offer);
    await logFunnelEvent({
      event_type: "offer_generated",
      entity_type: "prospect",
      entity_id: id,
      prospect_id: id,
      source: prospect?.source,
      metadata: { offer_name: data?.offer?.offer_name, recommended_package: data?.offer?.recommended_package },
    });
    toast.success("Proposition commerciale prête");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier");
  };

  const openExternal = (channel: string) => {
    if (!prospect) return;
    const text = encodeURIComponent(draftContent);
    let url = "";
    switch (channel) {
      case "email":
        if (!prospect.email) return toast.error("Pas d'email pour ce prospect");
        url = `mailto:${prospect.email}?subject=${encodeURIComponent(draftSubject)}&body=${text}`;
        break;
      case "whatsapp":
        if (!prospect.phone) return toast.error("Pas de téléphone");
        url = `https://wa.me/${prospect.phone.replace(/[^\d]/g, "")}?text=${text}`;
        break;
      case "linkedin":
        url = prospect.linkedin_url || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(prospect.contact_name ?? prospect.name)}`;
        copyToClipboard(draftContent);
        break;
      case "instagram":
        url = prospect.instagram_handle ? `https://instagram.com/${prospect.instagram_handle.replace("@", "")}` : "https://instagram.com";
        copyToClipboard(draftContent);
        break;
      case "tiktok":
        url = "https://tiktok.com";
        copyToClipboard(draftContent);
        break;
    }
    window.open(url, "_blank");
  };

  const assignProspect = async (assignedTo: string | null) => {
    if (!admin || !id) return;
    const { error } = await supabase.from("prospects").update({ assigned_to: assignedTo }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setProspect((prev: any) => prev ? { ...prev, assigned_to: assignedTo } : prev);
    toast.success(assignedTo ? "Prospect assigne" : "Assignation retiree");
  };

  const invoiceNum = invoiceNumState;
  const invoiceTotal = invoiceLines.reduce((s, l) => s + (l.qty * l.price), 0);

  const openInvoice = () => {
    const offerLines = offer?.invoice_services ?? [];
    if (offerLines.length > 0) {
      setInvoiceLines(offerLines.map((l: any) => ({ description: `${l.name} — ${l.detail}`, qty: 1, price: Number(l.amount || 0) })));
    } else {
      setInvoiceLines([{ description: prospect.sector ? `Services digitaux — ${prospect.sector}` : "", qty: 1, price: 0 }]);
    }
    setInvoiceComment("Paiement sous 30 jours. TVA non applicable — art. 293 B du CGI.");
    setInvoiceOpen(true);
  };

  const saveInvoice = async () => {
    setInvoiceSaving(true);
    try {
      // Cherche ou crée le client sans upsert (évite les conflits)
      let clientId: string | null = null;
      const { data: existing } = await supabase.from("clients")
        .select("id").eq("company_name", prospect.name).maybeSingle();
      if (existing?.id) {
        clientId = existing.id;
      } else {
        const { data: created } = await supabase.from("clients")
          .insert({ company_name: prospect.name, contact_name: prospect.contact_name ?? null, email: prospect.email ?? null, phone: prospect.phone ?? null })
          .select("id").maybeSingle();
        clientId = created?.id ?? null;
      }
      const desc = invoiceLines.map(l => `${l.description} (x${l.qty}) — ${l.price}€`).join("\n") + (invoiceComment ? `\n\n${invoiceComment}` : "");
      const { error } = await supabase.from("invoices").insert({
        invoice_number: invoiceNum,
        client_id: clientId,
        amount: invoiceTotal,
        description: desc,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        status: "draft",
      });
      if (error) { toast.error(error.message); return; }
      toast.success(`Facture ${invoiceNum} sauvegardée`);
      setInvoiceOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur sauvegarde facture");
    } finally {
      setInvoiceSaving(false);
    }
  };

  const printInvoice = () => {
    const html = buildInvoiceHtml(prospect.name, invoiceNum, invoiceLines, invoiceTotal, invoiceComment);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => { iframe.contentWindow?.print(); };
  };

  const enrichEmail = async () => {
    setEnrichLoading(true);
    const { data, error } = await supabase.functions.invoke("enrich-prospect", { body: { prospect_id: id } });
    setEnrichLoading(false);
    if (error || data?.error) { toast.error(data?.error ?? "Erreur enrichissement — configurez Hunter ou Dropcontact dans Paramètres"); return; }
    if (data.already_had_email) { toast.info("Ce prospect a déjà un email"); return; }
    if (data.email_found) {
      toast.success(`✉️ Email trouvé : ${data.email_found} (confiance ${data.confidence}%)`);
      load();
    } else {
      toast.error("Aucun email trouvé — essayez d'ajouter le site web du prospect");
    }
  };

  const runSeoAudit = async () => {
    if (!prospect.website) { toast.error("Ce prospect n'a pas de site web à auditer"); return; }
    setSeoLoading(true);
    setSeoOpen(true);
    setSeoAudit(null);
    const { data, error } = await supabase.functions.invoke("audit-site", {
      body: { prospect_id: id, url: prospect.website },
    });
    setSeoLoading(false);
    if (error || data?.error) { toast.error(data?.error ?? error?.message ?? "Erreur audit SEO"); return; }
    setSeoAudit(data.audit);
    toast.success("Audit SEO terminé");
  };

  const saveNotes = async () => {
    if (!id) return;
    setNotesSaving(true);
    const { error } = await supabase.from("prospects").update({ ai_note: notesValue }).eq("id", id);
    setNotesSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Notes sauvegardées");
  };

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    const prev = prospect?.status;
    setProspect((p: any) => p ? { ...p, status: newStatus } : p);
    const { error } = await supabase.from("prospects").update({ status: newStatus }).eq("id", id);
    if (error) {
      setProspect((p: any) => p ? { ...p, status: prev } : p);
      toast.error(error.message);
      return;
    }
    await logFunnelEvent({
      event_type: "status_changed", entity_type: "prospect", entity_id: id, prospect_id: id,
      source: prospect?.source, status_from: prev, status_to: newStatus,
      metadata: { prospect_name: prospect?.name },
    });
    toast.success(`Statut : ${STATUS_LABELS[newStatus] ?? newStatus}`);
  };

  const loadAvailability = async (dateStr: string) => {
    if (!dateStr) { setAvailabilitySlots([]); return; }
    const d = new Date(dateStr);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    const { data } = await supabase.from("appointments")
      .select("title, scheduled_at, duration_minutes")
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at");
    setAvailabilitySlots(data ?? []);
  };

  const openRdv = () => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 1);
    dt.setHours(10, 0, 0, 0);
    const iso = dt.toISOString().slice(0, 16);
    setRdvForm({ title: `RDV — ${prospect.name}`, scheduled_at: iso, duration_minutes: 30, type: "discovery", notes: "" });
    loadAvailability(iso);
    setRdvOpen(true);
  };

  const bookRdv = async () => {
    if (!rdvForm.title || !rdvForm.scheduled_at) { toast.error("Titre et date requis"); return; }
    setRdvLoading(true);

    const { error: apptErr } = await supabase.from("appointments").insert({
      title: rdvForm.title,
      scheduled_at: new Date(rdvForm.scheduled_at).toISOString(),
      duration_minutes: Number(rdvForm.duration_minutes) || 30,
      type: rdvForm.type,
      notes: rdvForm.notes || null,
      prospect_id: id,
    });
    if (apptErr) { toast.error(apptErr.message); setRdvLoading(false); return; }

    const { error: statusErr } = await supabase.from("prospects").update({ status: "rdv_pris" }).eq("id", id!);
    if (statusErr) { toast.error(statusErr.message); setRdvLoading(false); return; }

    await logFunnelEvent({
      event_type: "status_changed", entity_type: "prospect", entity_id: id, prospect_id: id,
      source: prospect?.source, status_from: prospect?.status, status_to: "rdv_pris",
      metadata: { prospect_name: prospect?.name, rdv_at: rdvForm.scheduled_at },
    });

    // Récupère le nom du setteur + les IDs admins en parallèle
    const [{ data: { user } }, { data: adminRoles }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const adminIds = (adminRoles ?? []).map((r: any) => r.user_id);

    let setterName = "Un setteur";
    if (user?.id) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setterName = profile?.full_name || setterName;
    }

    const rdvDate = new Date(rdvForm.scheduled_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
    const typeLabels: Record<string, string> = { discovery: "Découverte", demo: "Démo", closing: "Closing", followup: "Suivi" };

    // Push notification → tous les admins
    if (adminIds.length > 0) {
      supabase.functions.invoke("send-push", {
        body: {
          user_ids: adminIds,
          title: `📅 RDV pris — ${prospect.name}`,
          body: `${setterName} · ${rdvDate} (${rdvForm.duration_minutes} min)`,
          url: `/prospects/${id}`,
          tag: "rdv-booked",
        },
      });
    }

    // Telegram → toi + Sofiane (via Edge Function, token côté serveur)
    const telegramText = [
      `📅 *Nouveau RDV pris*`,
      ``,
      `👤 *Prospect :* ${prospect.name}${prospect.sector ? ` — ${prospect.sector}` : ""}`,
      `🙋 *Setteur :* ${setterName}`,
      `🗓 *Date :* ${rdvDate}`,
      `⏱ *Durée :* ${rdvForm.duration_minutes} min`,
      `📌 *Type :* ${typeLabels[rdvForm.type] ?? rdvForm.type}`,
      rdvForm.notes ? `📝 ${rdvForm.notes}` : null,
    ].filter(Boolean).join("\n");

    supabase.functions.invoke("send-telegram", { body: { text: telegramText } });

    setRdvLoading(false);
    toast.success("RDV planifié — statut mis à jour : RDV pris");
    setRdvOpen(false);
    load();
  };

  const handleGenerateSite = () => {
    setSiteGenerating(true);
    try {
      const html = generateSiteHtml({
        name: prospect.name,
        category: prospect.sector || "",
        city: prospect.city || "",
        phone: prospect.phone || "",
        email: prospect.email || "",
        website: prospect.website || "",
      });
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success("Site généré — ouvert dans un nouvel onglet");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSiteGenerating(false);
    }
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!prospect) {
    return <div className="p-6 text-center text-muted-foreground">Prospect introuvable</div>;
  }

  const analysis = prospect.digital_analysis;

  return (
    <div>
      {/* ── Header prospect redesigné ── */}
      <div className="border-b border-border/60">
        {/* Ligne 1 : retour + nom + statut */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/prospects")} className="mt-0.5 shrink-0 -ml-1">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Retour</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{prospect.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {prospect.sector && <Badge variant="secondary" className="text-xs">{prospect.sector}</Badge>}
              {prospect.city && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{prospect.city}</span>}
              <Select value={prospect.status} onValueChange={updateStatus}>
                <SelectTrigger className={cn("h-6 px-2 text-[10px] font-semibold rounded-full border w-auto gap-1", STATUS_COLORS[prospect.status as string] ?? "bg-muted text-muted-foreground")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {prospect.analysis_score != null && (
                <span className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />Score {prospect.analysis_score}/100
                </span>
              )}
            </div>
          </div>
          {/* Assignation — masquée sur mobile, visible sm+ */}
          {admin && (
            <div className="hidden sm:block shrink-0">
              <Select value={prospect.assigned_to ?? "none"} onValueChange={(value) => assignProspect(value === "none" ? null : value)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Assigner" />
                </SelectTrigger>
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
          )}
        </div>

        {/* Ligne 2 : actions — scroll horizontal sur mobile, flex-wrap sur desktop */}
        <div className="overflow-x-auto scrollbar-none border-t border-border/40 sm:border-0">
          <div className="flex items-center gap-1.5 px-4 py-2 sm:pb-3 sm:px-6 sm:flex-wrap min-w-max sm:min-w-0">
            <Button size="sm" variant="outline" onClick={openRdv} className="h-9 sm:h-8 text-xs gap-1.5 border-warning/40 text-warning hover:bg-warning/10 shrink-0">
              <CalendarClock className="h-3.5 w-3.5" />
              RDV
            </Button>
            <Button size="sm" variant="hero" onClick={analyze} disabled={analyzing} className="h-9 sm:h-8 text-xs gap-1.5 shrink-0">
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {analysis ? "Re-analyser" : "Analyser IA"}
            </Button>
            <div className="w-px h-5 bg-border/60 mx-0.5 shrink-0" />
            <Button size="sm" variant="outline" onClick={runCloser} disabled={callLoading} className="h-8 text-xs gap-1.5 shrink-0">
              {callLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
              Script
            </Button>
            <Button size="sm" variant="outline" onClick={runCompetitors} disabled={compLoading} className="h-8 text-xs gap-1.5 shrink-0">
              {compLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Swords className="h-3.5 w-3.5" />}
              Concurrents
            </Button>
            <Button size="sm" variant="outline" onClick={runOfferBuilder} disabled={offerLoading} className="h-8 text-xs gap-1.5 shrink-0">
              {offerLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Euro className="h-3.5 w-3.5" />}
              Offre
            </Button>
            {admin && !prospect?.email && (
              <Button size="sm" variant="outline" onClick={enrichEmail} disabled={enrichLoading} className="h-8 text-xs gap-1.5 shrink-0">
                {enrichLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Email
              </Button>
            )}
            {admin && prospect?.website && (
              <Button size="sm" variant="outline" onClick={runSeoAudit} disabled={seoLoading} className="h-8 text-xs gap-1.5 shrink-0">
                {seoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchCode className="h-3.5 w-3.5" />}
                SEO
              </Button>
            )}
            {admin && (
              <Button size="sm" variant="outline" onClick={handleGenerateSite} disabled={siteGenerating} className="h-8 text-xs gap-1.5 shrink-0">
                {siteGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Monitor className="h-3.5 w-3.5" />}
                Site
              </Button>
            )}
            {admin && (
              <Button size="sm" variant="outline" onClick={openInvoice} className="h-8 text-xs gap-1.5 shrink-0">
                <Receipt className="h-3.5 w-3.5" />Facture
              </Button>
            )}
            {/* Assignation mobile — visible uniquement sur mobile */}
            {admin && (
              <div className="sm:hidden shrink-0">
                <Select value={prospect.assigned_to ?? "none"} onValueChange={(value) => assignProspect(value === "none" ? null : value)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs border-dashed">
                    <SelectValue placeholder="Assigner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non assigné</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name ?? "Membre"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modales agents */}
      {callScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setCallScript(null)}>
          <Card className="max-w-2xl w-full max-h-[85vh] overflow-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><PhoneCall className="h-4 w-4 text-primary" /> Script d'appel — {prospect.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setCallScript(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3 text-sm">
              <div><div className="text-xs uppercase font-semibold text-primary">Ouverture</div><p className="mt-1">{callScript.opening}</p></div>
              <div><div className="text-xs uppercase font-semibold text-primary">Questions de découverte</div><ul className="mt-1 list-disc pl-5 space-y-1">{(callScript.discovery_questions ?? []).map((q: string, i: number) => <li key={i}>{q}</li>)}</ul></div>
              <div><div className="text-xs uppercase font-semibold text-primary">Propositions de valeur</div><ul className="mt-1 list-disc pl-5 space-y-1">{(callScript.value_props ?? []).map((v: string, i: number) => <li key={i}>{v}</li>)}</ul></div>
              {callScript.call_plan?.length > 0 && <div><div className="text-xs uppercase font-semibold text-primary">Plan d'appel</div><ol className="mt-1 list-decimal pl-5 space-y-1">{callScript.call_plan.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>}
              {callScript.discovery_diagnosis && <div className="rounded-lg border border-border p-3"><div className="text-xs uppercase font-semibold text-primary">Diagnostic à creuser</div><p className="mt-1 text-muted-foreground">{callScript.discovery_diagnosis}</p></div>}
              <div><div className="text-xs uppercase font-semibold text-primary">Objections & réponses</div>
                <div className="mt-2 space-y-2">{(callScript.objections ?? []).map((o: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border p-3"><div className="font-medium">❓ {o.objection}</div><p className="mt-1 text-muted-foreground">→ {o.response}</p></div>
                ))}</div>
              </div>
              <div><div className="text-xs uppercase font-semibold text-primary">Closing</div><p className="mt-1">{callScript.closing}</p></div>
              {callScript.simulation?.length > 0 && <div><div className="text-xs uppercase font-semibold text-primary">Simulation</div><div className="mt-2 space-y-2">{callScript.simulation.map((s: any, i: number) => <div key={i} className="rounded-lg border border-border p-3"><p><span className="font-medium">Prospect :</span> {s.prospect_says}</p><p className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Closer :</span> {s.closer_replies}</p></div>)}</div></div>}
              {callScript.proposal_angle && <div className="rounded-lg bg-success/10 border border-success/20 p-3"><div className="text-xs uppercase font-semibold text-success">Angle proposition</div><p className="mt-1">{callScript.proposal_angle}</p></div>}
              {callScript.post_call_summary_template && <div><div className="text-xs uppercase font-semibold text-primary">Résumé après appel</div><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{callScript.post_call_summary_template}</p></div>}
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3"><div className="text-xs uppercase font-semibold text-primary">Tonalité</div><p className="mt-1">{callScript.tone_advice}</p></div>
            </div>
          </Card>
        </div>
      )}

      {competitors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setCompetitors(null)}>
          <Card className="max-w-2xl w-full max-h-[85vh] overflow-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Swords className="h-4 w-4 text-primary" /> Analyse concurrence — {prospect.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setCompetitors(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3"><div className="text-xs uppercase font-semibold text-primary">Marché local</div><p className="mt-1">{competitors.market_summary}</p></div>
              {competitors.recommended_positioning && <div className="rounded-lg bg-success/10 border border-success/20 p-3"><div className="text-xs uppercase font-semibold text-success">Positionnement recommandé</div><p className="mt-1">{competitors.recommended_positioning}</p></div>}
              <div><div className="text-xs uppercase font-semibold text-primary mb-2">Concurrents identifiés</div>
                <div className="space-y-2">{(competitors.competitors ?? []).map((c: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{c.name}</div>
                    {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{c.url}</a>}
                    {c.likely_offer && <p className="mt-1 text-xs text-muted-foreground">Offre probable : {c.likely_offer}</p>}
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                      <div><div className="font-semibold text-success">Forces</div><ul className="list-disc pl-4 mt-1">{(c.strengths ?? []).map((s: string, j: number) => <li key={j}>{s}</li>)}</ul></div>
                      <div><div className="font-semibold text-warning">Faiblesses</div><ul className="list-disc pl-4 mt-1">{(c.weaknesses ?? []).map((s: string, j: number) => <li key={j}>{s}</li>)}</ul></div>
                    </div>
                    {c.content_gaps?.length > 0 && <div className="mt-2 text-xs"><div className="font-semibold text-primary">Gaps contenu</div><ul className="list-disc pl-4 mt-1">{c.content_gaps.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul></div>}
                  </div>
                ))}</div>
              </div>
              <div><div className="text-xs uppercase font-semibold text-primary mb-2">Angles de différenciation</div>
                <ul className="list-disc pl-5 space-y-1">{(competitors.differentiation_angles ?? []).map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
              {competitors.outbound_angles?.length > 0 && <div><div className="text-xs uppercase font-semibold text-primary mb-2">Angles outbound</div><ul className="list-disc pl-5 space-y-1">{competitors.outbound_angles.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></div>}
              {competitors.quick_wins?.length > 0 && <div><div className="text-xs uppercase font-semibold text-primary mb-2">Quick wins</div><ul className="list-disc pl-5 space-y-1">{competitors.quick_wins.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></div>}
            </div>
          </Card>
        </div>
      )}

      {offer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setOffer(null)}>
          <Card className="max-w-3xl w-full max-h-[85vh] overflow-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Euro className="h-4 w-4 text-primary" /> Offre — {offer.offer_name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setOffer(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="text-xs uppercase font-semibold text-primary">Positionnement</div>
                <p className="mt-1">{offer.positioning}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border p-3"><div className="text-xs uppercase font-semibold text-muted-foreground">Douleur</div><p className="mt-1">{offer.pain_summary}</p></div>
                <div className="rounded-lg border border-border p-3"><div className="text-xs uppercase font-semibold text-muted-foreground">Promesse</div><p className="mt-1">{offer.promise}</p></div>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase font-semibold text-primary">Packs</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(offer.packages ?? []).map((pack: any, i: number) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{pack.name}</p>
                        {pack.name === offer.recommended_package && <Badge>Recommandé</Badge>}
                      </div>
                      <p className="mt-1 text-primary font-medium">{pack.price}</p>
                      <p className="text-xs text-muted-foreground">Setup : {pack.setup_fee} · {pack.timeline}</p>
                      <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">{(pack.deliverables ?? []).map((d: string, j: number) => <li key={j}>{d}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </div>
              {offer.implementation_plan_30_days?.length > 0 && <div><div className="text-xs uppercase font-semibold text-primary">Plan 30 jours</div><ol className="mt-1 list-decimal pl-5 space-y-1">{offer.implementation_plan_30_days.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>}
              {offer.invoice_services?.length > 0 && <div><div className="text-xs uppercase font-semibold text-primary">Lignes facturables</div><div className="mt-2 space-y-2">{offer.invoice_services.map((s: any, i: number) => <div key={i} className="rounded border border-border p-2"><p className="font-medium">{s.name} · {Number(s.amount).toLocaleString("fr-FR")} €</p><p className="text-xs text-muted-foreground">{s.detail}</p></div>)}</div></div>}
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase font-semibold text-primary">Message d'envoi</div>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{offer.proposal_message}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-6 p-3 sm:p-6 lg:grid-cols-3">
        {/* Infos contact */}
        <Card className="p-4 sm:p-5 space-y-3 lg:col-span-1">
          <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Coordonnées</h3>
          <div className="space-y-2 text-sm">
            {prospect.contact_name && <p><span className="text-muted-foreground">Contact : </span>{prospect.contact_name}</p>}
            {prospect.dirigeant && <p><span className="text-muted-foreground">Dirigeant : </span>{prospect.dirigeant}</p>}
            {prospect.email && (
              <a href={`mailto:${prospect.email}`} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-primary hover:bg-accent transition-colors">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{prospect.email}</span>
              </a>
            )}
            {prospect.phone && (
              <a href={`tel:${prospect.phone}`} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2.5 text-primary hover:bg-accent transition-colors font-medium">
                <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{prospect.phone}
              </a>
            )}
            {prospect.website && <p className="flex items-center gap-2 text-xs"><Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><a href={prospect.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{prospect.website}</a></p>}
            {(prospect.address || prospect.city) && <p className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{[prospect.address, prospect.zip, prospect.city].filter(Boolean).join(", ")}</p>}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {prospect.rating != null && prospect.rating > 0 && (
              <Badge variant="outline" className="gap-1"><Star className="h-3 w-3 text-warning" />{prospect.rating} ({prospect.reviews_count})</Badge>
            )}
            {prospect.employees_count && <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{prospect.employees_count}</Badge>}
            {prospect.revenue_estimate && <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" />{(prospect.revenue_estimate / 1000).toFixed(0)}k€</Badge>}
            {prospect.siren && <Badge variant="outline">SIREN {prospect.siren}</Badge>}
          </div>
        </Card>

        {/* Analyse IA */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Analyse digitale IA</h3>
            {analysis && (
              <Badge variant="outline" className="text-base px-3 py-1">
                Score : <span className={cn("ml-1 font-bold", analysis.score >= 70 ? "text-success" : analysis.score >= 40 ? "text-warning" : "text-muted-foreground")}>{analysis.score}/100</span>
              </Badge>
            )}
          </div>

          {!analysis ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="mb-4">Aucune analyse pour ce prospect.</p>
              <Button variant="hero" onClick={analyze} disabled={analyzing}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Lancer l'analyse IA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Note synthèse</p>
                <p className="text-sm">{analysis.ai_note}</p>
              </div>

              {analysis.angle && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs uppercase font-semibold text-primary mb-1">Angle commercial</p>
                  <p className="text-sm">{analysis.angle}</p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                {analysis.primary_service_to_sell && <div className="rounded-lg border border-border p-3"><p className="text-xs uppercase font-semibold text-muted-foreground">Service à vendre</p><p className="mt-1 text-sm font-medium">{analysis.primary_service_to_sell}</p></div>}
                {analysis.estimated_budget && <div className="rounded-lg border border-border p-3"><p className="text-xs uppercase font-semibold text-muted-foreground">Budget estimé</p><p className="mt-1 text-sm font-medium text-primary">{analysis.estimated_budget}</p></div>}
                {analysis.closing_probability != null && <div className="rounded-lg border border-border p-3"><p className="text-xs uppercase font-semibold text-muted-foreground">Probabilité closing</p><p className="mt-1 text-sm font-medium">{analysis.closing_probability}% · {analysis.urgency ?? "—"}</p></div>}
              </div>

              {analysis.next_best_action && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs uppercase font-semibold text-success mb-1">Prochaine action</p>
                  <p className="text-sm">{analysis.next_best_action}</p>
                </div>
              )}

              {analysis.score_reason && <p className="text-xs text-muted-foreground">{analysis.score_reason}</p>}

              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-warning" /> Pain points détectés</p>
                <div className="flex flex-wrap gap-1.5">
                  {(analysis.pain_points ?? []).map((p: string, i: number) => (
                    <Badge key={i} variant="outline" className="bg-warning/5 text-warning-foreground border-warning/30">{p}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Services recommandés</p>
                <div className="space-y-2">
                  {(analysis.recommended_services ?? []).map((s: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <Badge className={cn("shrink-0", PRIORITY_COLOR[s.priority])}>{s.priority}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{s.service}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.why}</p>
                        {s.estimated_budget && <p className="text-xs text-primary mt-1">{s.estimated_budget}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {analysis.best_channels?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Canaux à privilégier</p>
                  <div className="flex gap-2">
                    {analysis.best_channels.map((c: string) => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {analysis.buying_triggers?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Signaux d'achat</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.buying_triggers.map((trigger: string, i: number) => <Badge key={i} variant="secondary">{trigger}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Outreach multi-canal */}
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Outreach multi-canal</h3>
              {!analysis && <p className="mt-1 text-xs text-muted-foreground">Lance d'abord l'analyse IA pour des messages mieux ciblés.</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => startSequence(activeChannel)} disabled={sequenceLoading === activeChannel}>
              {sequenceLoading === activeChannel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat2 className="h-3.5 w-3.5" />}
              Séquence auto 3 étapes
            </Button>
          </div>

          {sequences.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              {sequences.slice(0, 5).map((seq) => (
                <div key={seq.id} className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1.5">
                  <Repeat2 className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{seq.channel}</span>
                  <Badge variant={seq.status === "active" ? "secondary" : "outline"}>{seq.status}</Badge>
                  <span className="text-muted-foreground">étape {seq.current_step}/{seq.max_steps}</span>
                  {seq.next_run_at && (
                    <span className="hidden items-center gap-1 text-muted-foreground sm:inline-flex">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(seq.next_run_at).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <Tabs value={activeChannel} onValueChange={setActiveChannel}>
            <TabsList className="grid w-full grid-cols-5">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const hasMsg = messages.some((m) => m.channel === c.id);
                return (
                  <TabsTrigger key={c.id} value={c.id} className="gap-1 px-1 sm:gap-2 sm:px-3">
                    <Icon className={cn("h-4 w-4 shrink-0", c.color)} />
                    <span className="hidden sm:inline">{c.label}</span>
                    {hasMsg && <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {CHANNELS.map((c) => (
              <TabsContent key={c.id} value={c.id} className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Brouillon {c.label}</p>
                  <Button variant="soft" size="sm" onClick={() => generate(c.id)} disabled={generating === c.id}>
                    {generating === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Générer avec l'IA
                  </Button>
                </div>

                {c.id === "email" && (
                  <input
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                    placeholder="Objet de l'email"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                  />
                )}

                <Textarea
                  rows={c.id === "linkedin" || c.id === "tiktok" ? 4 : 8}
                  placeholder={`Le brouillon ${c.label} apparaîtra ici. Clique sur "Générer avec l'IA" pour en créer un.`}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(draftContent)} disabled={!draftContent}>
                    <Copy className="h-3.5 w-3.5" /> Copier
                  </Button>
                  <Button variant="hero" size="sm" onClick={() => openExternal(c.id)} disabled={!draftContent}>
                    <c.icon className="h-3.5 w-3.5" /> Ouvrir dans {c.label}
                  </Button>
                </div>

                {outreachExtras?.channel === c.id && (outreachExtras.variants?.length > 0 || outreachExtras.follow_ups?.length > 0 || outreachExtras.personalization_notes?.length > 0) && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                    {outreachExtras.personalization_notes?.length > 0 && <p className="mb-2 text-muted-foreground">Personnalisation : {outreachExtras.personalization_notes.join(" · ")}</p>}
                    {outreachExtras.variants?.length > 0 && <div className="space-y-2"><p className="font-semibold">Variantes A/B</p>{outreachExtras.variants.map((v: any, i: number) => <div key={i} className="rounded border border-border p-2"><p className="font-medium">{v.angle}</p><p className="mt-1 text-muted-foreground">{v.content}</p></div>)}</div>}
                    {outreachExtras.follow_ups?.length > 0 && <div className="mt-3 space-y-2"><p className="font-semibold">Relances</p>{outreachExtras.follow_ups.map((f: string, i: number) => <p key={i} className="rounded border border-border p-2 text-muted-foreground">{f}</p>)}</div>}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {messages.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm font-medium mb-3">Historique ({messages.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className="text-xs p-2 rounded border border-border flex justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-[10px]">{m.channel}</Badge>
                        <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString("fr-FR")}</span>
                      </div>
                      <p className="truncate text-muted-foreground">{m.subject ? `${m.subject} — ` : ""}{m.content.slice(0, 120)}…</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── Notes ── */}
        <Card className="p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              📝 Notes internes
            </h3>
            <Button size="sm" variant="outline" onClick={saveNotes} disabled={notesSaving} className="h-7 text-xs">
              {notesSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Sauvegarder
            </Button>
          </div>
          <Textarea
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            placeholder="Notes sur le prospect, objections entendues, prochaine action prévue..."
            rows={4}
            className="resize-none text-sm"
          />
        </Card>
      </div>

      {/* ── Dialog Prendre RDV ── */}
      <Dialog open={rdvOpen} onOpenChange={setRdvOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl flex flex-col max-h-[90dvh] p-0 gap-0 overflow-x-hidden">
          {/* Header fixe */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-warning" />
              Planifier un RDV — {prospect.name}
            </DialogTitle>
          </DialogHeader>

          {/* Corps scrollable */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Titre du rendez-vous</Label>
              <Input value={rdvForm.title} onChange={e => setRdvForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={rdvForm.scheduled_at.slice(0, 10)}
                  onChange={e => {
                    const time = rdvForm.scheduled_at.slice(11, 16) || "10:00";
                    const dt = `${e.target.value}T${time}`;
                    setRdvForm(f => ({ ...f, scheduled_at: dt }));
                    loadAvailability(dt);
                  }} />
              </div>
              <div className="space-y-1.5">
                <Label>Heure</Label>
                <Input type="time" value={rdvForm.scheduled_at.slice(11, 16)}
                  onChange={e => {
                    const date = rdvForm.scheduled_at.slice(0, 10);
                    const dt = `${date}T${e.target.value}`;
                    setRdvForm(f => ({ ...f, scheduled_at: dt }));
                  }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Durée</Label>
                <Select value={String(rdvForm.duration_minutes)} onValueChange={v => setRdvForm(f => ({ ...f, duration_minutes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1h</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type de RDV</Label>
                <Select value={rdvForm.type} onValueChange={v => setRdvForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discovery">Découverte</SelectItem>
                    <SelectItem value="demo">Démo</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                    <SelectItem value="followup">Suivi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={rdvForm.notes} onChange={e => setRdvForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Objectif du RDV, points à aborder..." className="resize-none text-sm" />
            </div>

            {availabilitySlots.length > 0 ? (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> RDV déjà planifiés ce jour-là
                </p>
                <div className="space-y-1.5">
                  {availabilitySlots.map((slot, i) => (
                    <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {new Date(slot.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>—</span>
                      <span className="truncate">{slot.title}</span>
                      <span className="shrink-0 text-muted-foreground/60">({slot.duration_minutes ?? 30} min)</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : rdvForm.scheduled_at ? (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-success font-medium flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" /> Créneau libre ce jour-là
              </div>
            ) : null}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary flex items-start gap-2">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Le statut sera automatiquement mis à jour vers <strong className="ml-1">RDV pris</strong>
            </div>
          </div>

          {/* Footer fixe */}
          <div className="px-5 pb-5 pt-3 border-t border-border shrink-0 flex flex-col gap-2">
            <Button variant="hero" onClick={bookRdv} disabled={rdvLoading} className="w-full">
              {rdvLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Confirmer le RDV
            </Button>
            <Button variant="outline" onClick={() => setRdvOpen(false)} className="w-full">
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Audit SEO ── */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SearchCode className="h-5 w-5 text-primary" />
              Audit SEO — {prospect.name}
            </DialogTitle>
          </DialogHeader>

          {seoLoading && (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Analyse du site en cours...<br/>Crawl HTML · PageSpeed · Tracking · SEO on-page</p>
            </div>
          )}

          {seoAudit && !seoLoading && (
            <div className="space-y-5 py-2">
              {/* Scores */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[
                  { label: "Global", val: seoAudit.score_global },
                  { label: "SEO", val: seoAudit.score_seo },
                  { label: "Perf", val: seoAudit.score_perf },
                  { label: "Mobile", val: seoAudit.score_mobile },
                  { label: "UX", val: seoAudit.score_ux },
                  { label: "Recomm.", val: seoAudit.recommendations?.category_scores?.conversion },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center rounded-lg border border-border bg-muted/20 p-2.5">
                    <p className={cn("text-xl font-black",
                      val == null ? "text-muted-foreground" :
                      val >= 80 ? "text-success" : val >= 50 ? "text-warning" : "text-destructive"
                    )}>{val != null ? val : "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {/* Résumé IA */}
              {seoAudit.recommendations?.executive_summary && (
                <Card className="border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />Synthèse IA
                  </p>
                  <p className="text-sm leading-relaxed">{seoAudit.recommendations.executive_summary}</p>
                </Card>
              )}

              {/* Problèmes critiques */}
              {seoAudit.recommendations?.critical_issues?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Problèmes critiques</p>
                  {seoAudit.recommendations.critical_issues.slice(0, 6).map((issue: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <Badge className={cn("mt-0.5 shrink-0 text-[10px]",
                        issue.severity === "high" ? "bg-destructive/15 text-destructive" :
                        issue.severity === "medium" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                      )}>{issue.severity}</Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{issue.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{issue.fix}</p>
                        {issue.estimated_revenue_impact && (
                          <p className="text-xs text-primary mt-1">→ {issue.estimated_revenue_impact}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick wins */}
              {seoAudit.recommendations?.quick_wins?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick wins</p>
                  {seoAudit.recommendations.quick_wins.map((w: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />{w}
                    </div>
                  ))}
                </div>
              )}

              {/* Offre packagée */}
              {seoAudit.recommendations?.recommended_offer && (
                <Card className="border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Offre à pitcher</p>
                  <p className="font-bold">{seoAudit.recommendations.recommended_offer.name} — <span className="text-primary">{seoAudit.recommendations.recommended_offer.price_range}</span></p>
                  <p className="text-sm text-muted-foreground mt-1">{seoAudit.recommendations.recommended_offer.pitch}</p>
                  {seoAudit.recommendations.recommended_offer.deliverables?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {seoAudit.recommendations.recommended_offer.deliverables.map((d: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{d}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {/* Infos techniques */}
              {seoAudit.findings?.website_inspection && (
                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Données techniques brutes</summary>
                  <div className="p-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {[
                      ["Robots.txt", seoAudit.findings.website_inspection.robots?.exists ? "✅" : "❌"],
                      ["Sitemap.xml", seoAudit.findings.website_inspection.sitemap?.exists ? "✅" : "❌"],
                      ["Title", seoAudit.findings.website_inspection.seo_on_page?.title?.slice(0, 30) || "—"],
                      ["Meta desc.", seoAudit.findings.website_inspection.seo_on_page?.meta_description_length ? `${seoAudit.findings.website_inspection.seo_on_page.meta_description_length} car.` : "❌"],
                      ["H1", seoAudit.findings.website_inspection.seo_on_page?.h1_count ?? "—"],
                      ["Mots", seoAudit.findings.website_inspection.seo_on_page?.word_count ?? "—"],
                      ["GA/GTM", seoAudit.findings.website_inspection.tracking?.google_analytics || seoAudit.findings.website_inspection.tracking?.google_tag_manager ? "✅" : "❌"],
                      ["Meta Pixel", seoAudit.findings.website_inspection.tracking?.meta_pixel ? "✅" : "❌"],
                      ["CTA", seoAudit.findings.website_inspection.conversion?.cta_mentions_count ?? 0],
                    ].map(([label, val]) => (
                      <div key={String(label)} className="rounded bg-muted/30 p-2">
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-semibold mt-0.5">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog Facture avec aperçu live ── */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="p-6 border-b border-border">
            <DialogTitle className="text-lg font-bold">Créer une facture</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Micro-entreprise — TVA non applicable</p>
          </div>
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            {/* ── Formulaire gauche ── */}
            <div className="p-6 space-y-4 border-r border-border">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Client</Label>
                <Input value={prospect.name} readOnly className="bg-muted/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">N° Facture</Label>
                  <Input value={invoiceNum} readOnly className="bg-muted/30 font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
                  <Input value={new Date().toLocaleDateString("fr-FR")} readOnly className="bg-muted/30" />
                </div>
              </div>

              {/* Lignes de service */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Lignes de service</Label>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setInvoiceLines(l => [...l, { description: "", qty: 1, price: 0 }])}>
                    + Ajouter
                  </Button>
                </div>
                {invoiceLines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="flex-1 text-sm" placeholder="Description"
                      value={line.description}
                      onChange={e => setInvoiceLines(l => l.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    <Input className="w-14 text-sm text-center" type="number" min={1} value={line.qty}
                      onChange={e => setInvoiceLines(l => l.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                    <Input className="w-20 text-sm text-center" type="number" min={0} step={0.01} value={line.price}
                      onChange={e => setInvoiceLines(l => l.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setInvoiceLines(l => l.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Totaux */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span className="font-medium">{invoiceTotal.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground italic">TVA (art. 293 B CGI)</span>
                  <span className="text-muted-foreground italic">Non applicable</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                  <span>Total TTC</span>
                  <span className="text-primary">{invoiceTotal.toFixed(2)} €</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Commentaire</Label>
                <Textarea value={invoiceComment} onChange={e => setInvoiceComment(e.target.value)}
                  placeholder="Conditions de paiement..." rows={3} className="text-sm resize-none" />
              </div>
            </div>

            {/* ── Aperçu droite ── */}
            <div className="p-6 bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Aperçu</p>
              <div className="bg-white rounded-xl shadow-sm border border-border/40 p-6 text-gray-900 text-sm">
                {/* En-tête */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xl font-black text-primary">Revolution Agency</p>
                    <p className="text-xs text-gray-500 mt-1">Agence SMMA & Stratégie Digitale</p>
                    <p className="text-xs text-gray-500">contact@revolution-ecom.com</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900">FACTURE</p>
                    <p className="text-xs text-gray-500 mt-1">N° {invoiceNum}</p>
                    <p className="text-xs text-gray-500">Date : {new Date().toISOString().slice(0,10)}</p>
                  </div>
                </div>
                {/* Client */}
                <div className="bg-purple-50 rounded-lg p-3 mb-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Facturé à</p>
                  <p className="font-bold text-gray-900">{prospect.name}</p>
                </div>
                {/* Table */}
                <table className="w-full text-xs mb-4">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-400 font-bold uppercase tracking-wider">Description</th>
                      <th className="text-center py-2 text-gray-400 font-bold uppercase tracking-wider w-10">Qté</th>
                      <th className="text-right py-2 text-gray-400 font-bold uppercase tracking-wider w-16">P.U. HT</th>
                      <th className="text-right py-2 text-gray-400 font-bold uppercase tracking-wider w-16">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLines.map((l, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 text-gray-700">{l.description || "—"}</td>
                        <td className="py-2 text-center text-gray-600">{l.qty}</td>
                        <td className="py-2 text-right text-gray-600">{l.price.toFixed(2)} €</td>
                        <td className="py-2 text-right font-medium">{(l.qty * l.price).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Totaux */}
                <div className="text-right space-y-1 text-xs">
                  <div className="flex justify-end gap-8"><span className="text-gray-400">Sous-total HT</span><span className="font-medium">{invoiceTotal.toFixed(2)} €</span></div>
                  <div className="flex justify-end gap-8"><span className="text-gray-400 italic">TVA</span><span className="text-gray-400 italic">Non applicable</span></div>
                  <div className="flex justify-end gap-8 border-t border-primary/30 pt-2 mt-2">
                    <span className="font-bold text-gray-900">Total TTC</span>
                    <span className="font-black text-primary">{invoiceTotal.toFixed(2)} €</span>
                  </div>
                </div>
                {/* Footer */}
                <p className="text-center text-[10px] text-gray-400 mt-6 border-t border-gray-100 pt-4">
                  TVA non applicable - article 293 B du CGI | Revolution Agency
                </p>
              </div>
            </div>
          </div>

          {/* Boutons bas */}
          <div className="flex gap-3 p-4 border-t border-border">
            <Button variant="hero" className="flex-1" onClick={printInvoice}>
              🖨️ Générer PDF (impression)
            </Button>
            <Button variant="outline" onClick={saveInvoice} disabled={invoiceSaving} className="flex-1">
              {invoiceSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sauvegarder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Fonction utilitaire pour l'impression ──────────────────────────────────
function buildInvoiceHtml(
  clientName: string,
  num: string,
  lines: { description: string; qty: number; price: number }[],
  total: number,
  comment: string
): string {
  const today = new Date().toISOString().slice(0, 10);
  const rows = lines.map(l => `
    <tr>
      <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;color:#374151">${l.description || "—"}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:center">${l.qty}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:right">${l.price.toFixed(2)} €</td>
      <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${(l.qty * l.price).toFixed(2)} €</td>
    </tr>`).join("");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet"/>
  <style>body{font-family:'Inter',sans-serif;color:#111;background:#fff;padding:40px;max-width:760px;margin:0 auto}@media print{body{padding:0}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
    <div><p style="font-size:24px;font-weight:900;color:#7C3AED;margin:0">Revolution Agency</p>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Agence SMMA &amp; Stratégie Digitale</p>
      <p style="font-size:12px;color:#6b7280;margin:2px 0 0">contact@revolution-ecom.com</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:28px;font-weight:900;margin:0">FACTURE</p>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0">N° ${num}</p>
      <p style="font-size:12px;color:#6b7280;margin:2px 0 0">Date : ${today}</p>
    </div>
  </div>
  <div style="background:#f5f3ff;border-radius:10px;padding:16px;margin-bottom:24px">
    <p style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin:0 0 4px">Facturé à</p>
    <p style="font-size:16px;font-weight:700;margin:0">${clientName}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <thead>
      <tr style="border-bottom:2px solid #7C3AED">
        <th style="text-align:left;padding:8px 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em">Description</th>
        <th style="text-align:center;padding:8px 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;width:48px">Qté</th>
        <th style="text-align:right;padding:8px 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;width:80px">P.U. HT</th>
        <th style="text-align:right;padding:8px 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;width:80px">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="text-align:right;font-size:13px;margin-bottom:24px">
    <div style="display:flex;justify-content:flex-end;gap:48px;margin-bottom:6px"><span style="color:#6b7280">Sous-total HT</span><span style="font-weight:600">${total.toFixed(2)} €</span></div>
    <div style="display:flex;justify-content:flex-end;gap:48px;margin-bottom:8px"><span style="color:#6b7280;font-style:italic">TVA</span><span style="color:#6b7280;font-style:italic">Non applicable</span></div>
    <div style="display:flex;justify-content:flex-end;gap:48px;border-top:2px solid #7C3AED;padding-top:10px">
      <span style="font-weight:700;font-size:15px">Total TTC</span>
      <span style="font-weight:900;font-size:15px;color:#7C3AED">${total.toFixed(2)} €</span>
    </div>
  </div>
  ${comment ? `<p style="font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px">${comment}</p>` : ""}
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">
    TVA non applicable - article 293 B du CGI | Revolution Agency
  </p>
  </body></html>`;
}

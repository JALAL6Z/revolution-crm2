import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { AlertTriangle, ArrowRight, BarChart3, CalendarClock, Euro, Flame, Loader2, MessageSquare, PhoneCall, PlayCircle, Send, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { functionErrorMessage } from "@/lib/functionErrors";

type Prospect = {
  id: string;
  name: string;
  status: string;
  source: string;
  city: string | null;
  sector: string | null;
  score: number | null;
  analysis_score: number | null;
  next_action_at: string | null;
  last_contact_at: string | null;
  digital_analysis: any;
  created_at: string;
};

type Invoice = { id: string; amount: number; status: string; due_date: string | null };
type Appointment = { id: string; title: string; scheduled_at: string };
type OutreachMessage = { id: string; prospect_id: string; channel: string; status: string; created_at: string; sent_at: string | null };
type Sequence = { id: string; prospect_id: string; channel: string; status: string; next_run_at: string | null };
type FunnelEvent = {
  id: string;
  created_at: string;
  event_type: string;
  entity_type: string;
  prospect_id: string | null;
  client_id: string | null;
  source: string | null;
  status_from: string | null;
  status_to: string | null;
  channel: string | null;
  amount: number | null;
  metadata: any;
};

const statusOrder = ["a_contacter", "contacte", "rdv_pris", "rdv_effectue", "proposition", "negociation", "client"];

function scoreOf(p: Prospect) {
  return Number(p.analysis_score ?? p.score ?? p.digital_analysis?.score ?? 0);
}

function actionFor(p: Prospect) {
  const analysis = p.digital_analysis ?? {};
  if (p.status === "a_contacter" && scoreOf(p) >= 70) return { label: "Appel direct", icon: PhoneCall, tone: "hot" };
  if (p.status === "a_contacter") return { label: "Envoyer message", icon: Send, tone: "normal" };
  if (p.status === "contacte") return { label: "Relancer", icon: MessageSquare, tone: "normal" };
  if (p.status === "rdv_pris") return { label: "Préparer closing", icon: PhoneCall, tone: "hot" };
  if (p.status === "rdv_effectue" || p.status === "proposition") return { label: "Créer offre", icon: Euro, tone: "hot" };
  if (analysis.next_best_action) return { label: analysis.next_best_action, icon: Target, tone: "normal" };
  return { label: "Ouvrir fiche", icon: ArrowRight, tone: "normal" };
}

export default function Funnel() {
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [events, setEvents] = useState<FunnelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [automationRunning, setAutomationRunning] = useState(false);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const now = new Date().toISOString();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [{ data: ps }, { data: inv }, { data: appts }, { data: msgs }, { data: seqs }, { data: evts }] = await Promise.all([
      supabase.from("prospects").select("id,name,status,source,city,sector,score,analysis_score,next_action_at,last_contact_at,digital_analysis,created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("invoices").select("id,amount,status,due_date").neq("status", "paid").limit(100),
      supabase.from("appointments").select("id,title,scheduled_at").gte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(20),
      supabase.from("outreach_messages").select("id,prospect_id,channel,status,created_at,sent_at").gte("created_at", since).limit(500),
      supabase.from("outreach_sequences").select("id,prospect_id,channel,status,next_run_at").limit(200),
      supabase.from("funnel_events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    ]);
    setProspects((ps ?? []) as Prospect[]);
    setInvoices((inv ?? []) as Invoice[]);
    setAppointments((appts ?? []) as Appointment[]);
    setMessages((msgs ?? []) as OutreachMessage[]);
    setSequences((seqs ?? []) as Sequence[]);
    setEvents((evts ?? []) as unknown as FunnelEvent[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runAutomation = async () => {
    setAutomationRunning(true);
    const { data, error } = await supabase.functions.invoke("sequence-runner", { body: {} });
    setAutomationRunning(false);
    if (error || data?.error) { toast.error(data?.error ?? await functionErrorMessage(error)); return; }
    toast.success(`${data?.processed_count ?? 0} séquence${data?.processed_count > 1 ? "s" : ""} traitée${data?.processed_count > 1 ? "s" : ""}`);
    load(false);
  };

  const hotLeads = useMemo(() => prospects.filter((p) => !["client", "perdu"].includes(p.status) && scoreOf(p) >= 70), [prospects]);
  const needsOffer = useMemo(() => prospects.filter((p) => ["rdv_effectue", "proposition", "negociation"].includes(p.status)), [prospects]);
  const staleContacted = useMemo(() => {
    const cutoff = Date.now() - 3 * 86400_000;
    return prospects.filter((p) => p.status === "contacte" && (!p.last_contact_at || new Date(p.last_contact_at).getTime() < cutoff));
  }, [prospects]);
  const overdueAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const draftMessages = useMemo(() => messages.filter((m) => m.status === "draft" && !m.sent_at), [messages]);
  const activeSequences = useMemo(() => sequences.filter((s) => s.status === "active"), [sequences]);
  const proposalFollowups = useMemo(() => {
    const cutoff = Date.now() - 2 * 86400_000;
    return prospects.filter((p) => ["proposition", "negociation"].includes(p.status) && new Date(p.created_at).getTime() < cutoff);
  }, [prospects]);

  const sourceStats = useMemo(() => {
    const grouped = new Map<string, { source: string; total: number; contacted: number; rdv: number; clients: number; hot: number }>();
    for (const p of prospects) {
      const key = p.source || "unknown";
      const row = grouped.get(key) ?? { source: key, total: 0, contacted: 0, rdv: 0, clients: 0, hot: 0 };
      row.total += 1;
      if (!["a_contacter"].includes(p.status)) row.contacted += 1;
      if (["rdv_pris", "rdv_effectue", "proposition", "negociation", "client"].includes(p.status)) row.rdv += 1;
      if (p.status === "client") row.clients += 1;
      if (scoreOf(p) >= 70) row.hot += 1;
      grouped.set(key, row);
    }
    return [...grouped.values()].sort((a, b) => b.clients - a.clients || b.hot - a.hot || b.total - a.total).slice(0, 8);
  }, [prospects]);

  const serviceOpportunities = useMemo(() => {
    const counts = new Map<string, { service: string; count: number; avgScore: number }>();
    for (const p of hotLeads) {
      const services = p.digital_analysis?.recommended_services ?? [];
      for (const svc of services) {
        const name = typeof svc === "string" ? svc : svc.service;
        if (!name) continue;
        const row = counts.get(name) ?? { service: name, count: 0, avgScore: 0 };
        row.avgScore = (row.avgScore * row.count + scoreOf(p)) / (row.count + 1);
        row.count += 1;
        counts.set(name, row);
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || b.avgScore - a.avgScore).slice(0, 6);
  }, [hotLeads]);
  const eventStats = useMemo(() => {
    const count = (type: string) => events.filter((e) => e.event_type === type).length;
    return {
      created: count("prospect_created"),
      analyzed: count("lead_analyzed"),
      messages: count("message_generated"),
      offers: count("offer_generated"),
      invoicesPaid: count("invoice_paid"),
      revenue: events.filter((e) => e.event_type === "invoice_paid").reduce((sum, e) => sum + Number(e.amount || 0), 0),
    };
  }, [events]);

  const priority = useMemo(() => {
    return [...hotLeads, ...needsOffer, ...staleContacted]
      .filter((p, index, arr) => arr.findIndex((x) => x.id === p.id) === index)
      .sort((a, b) => {
        const scoreDiff = scoreOf(b) - scoreOf(a);
        if (scoreDiff) return scoreDiff;
        return statusOrder.indexOf(b.status) - statusOrder.indexOf(a.status);
      })
      .slice(0, 12);
  }, [hotLeads, needsOffer, staleContacted]);

  return (
    <div>
      <PageHeader title="Funnel" description="Actions prioritaires pour transformer les leads en clients">
        <Button variant="outline" onClick={() => load(false)} disabled={loading}>
          Actualiser
        </Button>
        <Button variant="hero" onClick={runAutomation} disabled={automationRunning}>
          {automationRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Lancer automations
        </Button>
      </PageHeader>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Hot leads" value={hotLeads.length} icon={Flame} variant="primary" />
          <StatCard title="Offres à créer" value={needsOffer.length} icon={Euro} />
          <StatCard title="Relances à faire" value={staleContacted.length} icon={MessageSquare} />
          <StatCard title="À encaisser" value={Math.round(overdueAmount)} suffix=" €" icon={TrendingUp} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Messages brouillons</p>
                <p className="mt-1 text-2xl font-bold">{draftMessages.length}</p>
              </div>
              <Send className="h-5 w-5 text-primary" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Séquences actives</p>
                <p className="mt-1 text-2xl font-bold">{activeSequences.length}</p>
              </div>
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Propositions à relancer</p>
                <p className="mt-1 text-2xl font-bold">{proposalFollowups.length}</p>
              </div>
              <Euro className="h-5 w-5 text-primary" />
            </div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-6">
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Nouveaux leads 30j</p><p className="mt-1 text-2xl font-bold">{eventStats.created}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Analyses IA 30j</p><p className="mt-1 text-2xl font-bold">{eventStats.analyzed}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Messages IA 30j</p><p className="mt-1 text-2xl font-bold">{eventStats.messages}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Offres 30j</p><p className="mt-1 text-2xl font-bold">{eventStats.offers}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Factures payées</p><p className="mt-1 text-2xl font-bold">{eventStats.invoicesPaid}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">CA tracké</p><p className="mt-1 text-2xl font-bold">{Math.round(eventStats.revenue)} €</p></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Actions prioritaires</h3>
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chargement...</p>
            ) : priority.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune action urgente.</p>
            ) : (
              <div className="space-y-2">
                {priority.map((p) => {
                  const action = actionFor(p);
                  const Icon = action.icon;
                  return (
                    <button key={p.id} onClick={() => navigate(`/prospects/${p.id}`)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{p.name}</p>
                          <Badge variant="outline">{p.status}</Badge>
                          {scoreOf(p) > 0 && <Badge className={scoreOf(p) >= 70 ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground"}>{scoreOf(p)}/100</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{[p.sector, p.city, p.source].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-sm text-primary">
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Prochains RDV</h3>
              </div>
              <div className="space-y-2">
                {appointments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun RDV planifié.</p> : appointments.slice(0, 5).map((a) => (
                  <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.scheduled_at).toLocaleString("fr-FR")}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <h3 className="font-semibold">Règles d'automatisation</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Score 70+ : appel direct ou message ultra personnalisé.</li>
                <li>RDV effectué : générer Offer Builder sous 24h.</li>
                <li>Proposition sans réponse 48h : relance IA.</li>
                <li>Client actif 60j : chercher upsell.</li>
              </ul>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Performance par source</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2">Source</th><th>Total</th><th>Hot</th><th>RDV</th><th>Clients</th><th>Conv.</th></tr>
                </thead>
                <tbody>
                  {sourceStats.map((s) => (
                    <tr key={s.source} className="border-t border-border">
                      <td className="py-2"><Badge variant="outline">{s.source}</Badge></td>
                      <td>{s.total}</td>
                      <td>{s.hot}</td>
                      <td>{s.rdv}</td>
                      <td>{s.clients}</td>
                      <td>{s.total ? Math.round((s.clients / s.total) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Euro className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Opportunités par service</h3>
            </div>
            <div className="space-y-2">
              {serviceOpportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Analyse plus de prospects pour voir les opportunités.</p>
              ) : serviceOpportunities.map((s) => (
                <div key={s.service} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{s.service}</p>
                    <p className="text-xs text-muted-foreground">{s.count} hot lead{s.count > 1 ? "s" : ""}</p>
                  </div>
                  <Badge variant="secondary">Score moy. {Math.round(s.avgScore)}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Activité funnel récente</h3>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement tracké sur les 30 derniers jours.</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 20).map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{event.event_type.replace(/_/g, " ")}</Badge>
                      {event.source && <Badge variant="secondary">{event.source}</Badge>}
                      {event.channel && <Badge variant="secondary">{event.channel}</Badge>}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {event.status_from && event.status_to ? `${event.status_from} -> ${event.status_to}` : event.metadata?.prospect_name || event.metadata?.offer_name || event.entity_type}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("fr-FR")}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

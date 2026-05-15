import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Briefcase, TrendingUp, Euro, Activity, Target,
  Sparkles, Calendar, ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

interface Stats {
  prospectsTotal: number;
  prospectsAContacter: number;
  rdvPlanifies: number;
  clientsActifs: number;
  mrr: number;
  conversionRate: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  a_contacter: { label: "À contacter", color: "bg-muted text-muted-foreground" },
  contacte: { label: "Contacté", color: "bg-blue-500/15 text-blue-400" },
  rdv_pris: { label: "RDV pris", color: "bg-warning/15 text-warning" },
  rdv_effectue: { label: "RDV effectué", color: "bg-warning/15 text-warning" },
  proposition: { label: "Proposition", color: "bg-primary/15 text-primary" },
  negociation: { label: "Négociation", color: "bg-primary/15 text-primary" },
  client: { label: "Client", color: "bg-success/15 text-success" },
  perdu: { label: "Perdu", color: "bg-destructive/15 text-destructive" },
  injoignable: { label: "Injoignable", color: "bg-muted text-muted-foreground" },
};

const FUNNEL_ORDER = ["a_contacter", "contacte", "rdv_pris", "proposition", "client"];

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary-glow, var(--primary)))",
  "hsl(265 70% 65%)",
  "hsl(220 80% 60%)",
  "hsl(295 70% 60%)",
  "hsl(180 60% 55%)",
];

const chartTooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  fontSize: "0.8rem",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 10px 30px -10px hsl(var(--primary) / 0.3)",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    prospectsTotal: 0, prospectsAContacter: 0, rdvPlanifies: 0,
    clientsActifs: 0, mrr: 0, conversionRate: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [allProspects, setAllProspects] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: prospects },
        { count: rdv },
        { data: clients },
        { data: recentP },
        { data: inv },
      ] = await Promise.all([
        supabase.from("prospects").select("id, status, source, created_at"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("scheduled_at", new Date().toISOString()),
        supabase.from("clients").select("mrr, status").eq("status", "active"),
        supabase.from("prospects").select("id, name, status, city, sector, source, created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("invoices").select("amount, status, paid_at, created_at").order("created_at", { ascending: false }).limit(200),
      ]);

      const ps = prospects ?? [];
      const total = ps.length;
      const aContacter = ps.filter((p: any) => p.status === "a_contacter").length;
      const wins = ps.filter((p: any) => p.status === "client").length;
      const mrr = (clients ?? []).reduce((s, c: any) => s + Number(c.mrr || 0), 0);
      const conversionRate = total > 0 ? Math.round((wins / total) * 100) : 0;

      setStats({
        prospectsTotal: total,
        prospectsAContacter: aContacter,
        rdvPlanifies: rdv ?? 0,
        clientsActifs: clients?.length ?? 0,
        mrr,
        conversionRate,
      });
      setAllProspects(ps);
      setInvoices(inv ?? []);
      setRecent(recentP ?? []);
      setLoading(false);
    })();
  }, []);

  // 30-day prospects timeline
  const timelineData = useMemo(() => {
    const days: { date: string; label: string; prospects: number; clients: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      days.push({
        date: d.toISOString(),
        label: format(d, "dd MMM", { locale: fr }),
        prospects: 0,
        clients: 0,
      });
    }
    allProspects.forEach((p: any) => {
      const created = startOfDay(new Date(p.created_at)).toISOString();
      const day = days.find((x) => x.date === created);
      if (day) {
        day.prospects += 1;
        if (p.status === "client") day.clients += 1;
      }
    });
    return days;
  }, [allProspects]);

  // Revenue last 6 months
  const revenueData = useMemo(() => {
    const months: { label: string; key: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        label: format(d, "MMM", { locale: fr }),
        key: `${d.getFullYear()}-${d.getMonth()}`,
        revenue: 0,
      });
    }
    invoices.forEach((inv: any) => {
      const ref = inv.paid_at || inv.created_at;
      if (!ref) return;
      const d = new Date(ref);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const m = months.find((x) => x.key === k);
      if (m && (inv.status === "paid" || inv.paid_at)) m.revenue += Number(inv.amount || 0);
    });
    return months;
  }, [invoices]);

  // Funnel
  const funnelData = useMemo(() => {
    return FUNNEL_ORDER.map((s) => ({
      stage: STATUS_LABELS[s]?.label ?? s,
      count: allProspects.filter((p: any) => p.status === s).length,
    }));
  }, [allProspects]);

  // Sources
  const sourcesData = useMemo(() => {
    const map = new Map<string, number>();
    allProspects.forEach((p: any) => {
      const k = p.source || "manual";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [allProspects]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Vue d'ensemble en temps réel de votre activité commerciale"
      >
        <Link to="/agents">
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4" /> Lancer un agent IA
          </Button>
        </Link>
        <Link to="/prospects">
          <Button variant="hero" className="gap-2">
            <Target className="h-4 w-4" /> Voir prospects
          </Button>
        </Link>
      </PageHeader>

      <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Prospects" value={stats.prospectsTotal} icon={Users} variant="primary" delay={0} />
          <StatCard title="À contacter" value={stats.prospectsAContacter} icon={Activity} delay={60} />
          <StatCard title="RDV à venir" value={stats.rdvPlanifies} icon={Calendar} delay={120} />
          <StatCard title="Clients actifs" value={stats.clientsActifs} icon={Briefcase} delay={180} />
          <StatCard title="MRR" value={stats.mrr} suffix=" €" icon={Euro} variant="primary" delay={240} />
          <StatCard
            title="Taux conversion"
            value={stats.conversionRate}
            suffix=" %"
            icon={TrendingUp}
            trend={stats.conversionRate > 0 ? "Prospects → Clients" : "Pas encore de données"}
            trendUp={stats.conversionRate > 0 ? true : undefined}
            delay={300}
          />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-6 animate-fade-in">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Prospects ajoutés (30 derniers jours)</h2>
                <p className="text-sm text-muted-foreground">Évolution quotidienne du pipeline</p>
              </div>
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                <ArrowUpRight className="h-3 w-3" /> Live
              </Badge>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradProspects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradClients" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success, 142 70% 45%))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--success, 142 70% 45%))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="prospects" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradProspects)" />
                  <Area type="monotone" dataKey="clients" stroke="hsl(142 70% 45%)" strokeWidth={2} fill="url(#gradClients)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Sources</h2>
              <p className="text-sm text-muted-foreground">D'où viennent vos prospects</p>
            </div>
            {sourcesData.length === 0 ? (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourcesData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {sourcesData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 space-y-1.5">
              {sourcesData.slice(0, 4).map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="capitalize text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-6 animate-fade-in" style={{ animationDelay: "150ms", animationFillMode: "both" }}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Funnel de conversion</h2>
              <p className="text-sm text-muted-foreground">Répartition par étape du pipeline</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--primary) / 0.08)" }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-6 animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Revenus encaissés</h2>
                <p className="text-sm text-muted-foreground">6 derniers mois (factures payées)</p>
              </div>
              <Badge variant="secondary" className="bg-success/10 text-success">
                {revenueData.reduce((s, r) => s + r.revenue, 0).toLocaleString("fr-FR")} €
              </Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(265 70% 55%)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--primary) / 0.08)" }} formatter={(v: any) => [`${Number(v).toLocaleString("fr-FR")} €`, "Revenus"]} />
                  <Bar dataKey="revenue" fill="url(#gradRev)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Recent activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-6 animate-fade-in" style={{ animationDelay: "250ms", animationFillMode: "both" }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Derniers prospects</h2>
                <p className="text-sm text-muted-foreground">Les 8 plus récents ajouts à votre pipeline</p>
              </div>
              <Link to="/prospects" className="text-sm font-medium text-primary hover:underline">
                Tout voir →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">Aucun prospect pour l'instant</p>
                <Link to="/prospects" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                  Importer ou ajouter →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((p, i) => (
                  <Link
                    key={p.id}
                    to={`/prospects`}
                    className="group flex items-center justify-between rounded-lg border border-transparent p-3 transition-all hover:border-primary/30 hover:bg-accent/30 animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary text-xs font-semibold uppercase text-primary-foreground shadow-glow">
                        {p.name?.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[p.sector, p.city].filter(Boolean).join(" • ") || "—"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={STATUS_LABELS[p.status]?.color}>
                      {STATUS_LABELS[p.status]?.label || p.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
            <h2 className="text-lg font-semibold">Démarrer rapidement</h2>
            <p className="text-sm text-muted-foreground">Les actions à forte valeur</p>
            <div className="mt-4 space-y-3">
              <Link to="/prospects" className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-elegant">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary text-primary-foreground shadow-glow transition-transform group-hover:scale-110">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Ajouter un prospect</p>
                  <p className="text-xs text-muted-foreground">Manuel ou import CSV</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </Link>
              <Link to="/agents" className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-elegant">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Lancer un agent IA</p>
                  <p className="text-xs text-muted-foreground">Génère messages perso</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </Link>
              <Link to="/audits" className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-elegant">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Auditer un site</p>
                  <p className="text-xs text-muted-foreground">Lead magnet automatique</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileSearch, Loader2, ExternalLink, Sparkles, AlertTriangle, CheckCircle2, Gauge, TrendingUp, Search, MousePointerClick, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { functionErrorMessage } from "@/lib/functionErrors";

export default function Audits() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [audits, setAudits] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    const { data } = await supabase.from("site_audits").select("*, prospects(name)").order("created_at", { ascending: false }).limit(50);
    setAudits(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const run = async () => {
    if (!url.trim()) { toast.error("URL requise"); return; }
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("audit-site", { body: { url: url.trim() } });
    setRunning(false);
    if (error || data?.error) { toast.error(data?.error || await functionErrorMessage(error)); return; }
    toast.success("Audit terminé !");
    setUrl("");
    setSelected(data.audit);
    load();
  };

  return (
    <div>
      <PageHeader title="Audits Site" description="Audits SEO/Performance/UX automatiques — votre lead magnet" />
      <div className="space-y-6 p-6">
        <Card className="gradient-card relative overflow-hidden p-6">
          <div className="gradient-radial absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary shadow-glow">
                <FileSearch className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Lancer un nouvel audit</h3>
                <p className="text-sm text-muted-foreground">SEO on-page + tracking pixels + conversion + recommandations IA. PageSpeed est utilisé si un quota est disponible.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemple.com" className="flex-1" />
              <Button variant="hero" onClick={run} disabled={running}>
                {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Audit en cours...</> : <><Sparkles className="h-4 w-4" /> Lancer l'audit</>}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Outils gratuits : crawl HTML, robots.txt, sitemap.xml, détection pixels/CTA/formulaires. PageSpeed reste optionnel.</p>
          </div>
        </Card>

        {selected && <AuditDetail audit={selected} onClose={() => setSelected(null)} />}

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h3 className="font-semibold">Historique des audits</h3>
          </div>
          {audits.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Aucun audit pour l'instant.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Prospect</th>
                  <th className="px-4 py-3 font-medium">Score global</th>
                  <th className="px-4 py-3 font-medium">SEO</th>
                  <th className="px-4 py-3 font-medium">Perf</th>
                  <th className="px-4 py-3 font-medium">Mobile</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3"><a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{a.url.replace(/^https?:\/\//, "").slice(0, 40)}<ExternalLink className="h-3 w-3" /></a></td>
                    <td className="px-4 py-3 text-muted-foreground">{a.prospects?.name ?? "—"}</td>
                    <td className="px-4 py-3"><ScoreBadge score={a.score_global} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={a.score_seo} small /></td>
                    <td className="px-4 py-3"><ScoreBadge score={a.score_perf} small /></td>
                    <td className="px-4 py-3"><ScoreBadge score={a.score_mobile} small /></td>
                    <td className="px-4 py-3"><Badge variant="outline">{a.status}</Badge></td>
                    <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => setSelected(a)}>Voir</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

function ScoreBadge({ score, small }: { score: number | null; small?: boolean }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const color = score >= 80 ? "bg-success/15 text-success border-success/30" : score >= 50 ? "bg-warning/15 text-warning border-warning/30" : "bg-destructive/15 text-destructive border-destructive/30";
  return <Badge variant="outline" className={color}>{small ? score : <><Gauge className="h-3 w-3" />{score}/100</>}</Badge>;
}

function AuditDetail({ audit, onClose }: { audit: any; onClose: () => void }) {
  const recos = audit.recommendations ?? {};
  const inspection = audit.findings?.website_inspection ?? {};
  const seo = inspection.seo_on_page ?? {};
  const tracking = inspection.tracking ?? {};
  const conversion = inspection.conversion ?? {};
  const localSeo = inspection.local_seo ?? {};
  const crawl = inspection.crawl ?? {};
  return (
    <Card className="border-primary/30 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Audit détaillé</p>
          <h3 className="mt-1 text-lg font-semibold">{audit.url.replace(/^https?:\/\//, "")}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Fermer</Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <ScoreCard label="Global" score={audit.score_global} />
        <ScoreCard label="SEO" score={audit.score_seo} />
        <ScoreCard label="Performance" score={audit.score_perf} />
        <ScoreCard label="Mobile" score={audit.score_mobile} />
      </div>

      {recos.executive_summary && (
        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Résumé exécutif</p>
          <p className="mt-2 text-sm">{recos.executive_summary}</p>
        </div>
      )}

      {inspection.reachable && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold"><Search className="h-4 w-4 text-primary" /> SEO on-page</h4>
            <div className="space-y-2 text-xs">
              <p><span className="text-muted-foreground">Title :</span> {seo.title || "—"} <Badge variant="outline" className="ml-1 text-[10px]">{seo.title_length ?? 0} car.</Badge></p>
              <p><span className="text-muted-foreground">Meta description :</span> {seo.meta_description || "—"} <Badge variant="outline" className="ml-1 text-[10px]">{seo.meta_description_length ?? 0} car.</Badge></p>
              <p><span className="text-muted-foreground">H1 :</span> {seo.h1_count ?? 0} · <span className="text-muted-foreground">H2 :</span> {seo.h2_count ?? 0}</p>
              <p><span className="text-muted-foreground">Mots :</span> {seo.word_count ?? 0} · <span className="text-muted-foreground">Images sans alt :</span> {seo.images_without_alt_count ?? 0}/{seo.images_count ?? 0}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant={seo.robots_exists ? "secondary" : "outline"}>robots.txt {seo.robots_exists ? "OK" : "absent"}</Badge>
                <Badge variant={seo.sitemap_exists ? "secondary" : "outline"}>sitemap.xml {seo.sitemap_exists ? "OK" : "absent"}</Badge>
                <Badge variant={seo.canonical ? "secondary" : "outline"}>canonical {seo.canonical ? "OK" : "absent"}</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-primary" /> Tracking</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(tracking).map(([key, value]) => (
                <Badge key={key} variant={value ? "secondary" : "outline"} className={value ? "bg-success/15 text-success border-success/30" : ""}>
                  {key.replace(/_/g, " ")} {value ? "OK" : "absent"}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold"><MousePointerClick className="h-4 w-4 text-primary" /> Conversion & local</h4>
            <div className="space-y-2 text-xs">
              <p>Formulaires : {conversion.forms_count ?? 0}</p>
              <p>Téléphone : {conversion.phone_links_count ?? 0} · Email : {conversion.email_links_count ?? 0} · WhatsApp : {conversion.whatsapp_links_count ?? 0}</p>
              <p>Mentions CTA : {conversion.cta_mentions_count ?? 0}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant={localSeo.has_phone ? "secondary" : "outline"}>NAP téléphone {localSeo.has_phone ? "OK" : "faible"}</Badge>
                <Badge variant={localSeo.has_address_signal ? "secondary" : "outline"}>adresse {localSeo.has_address_signal ? "OK" : "faible"}</Badge>
                <Badge variant={localSeo.has_opening_hours_signal ? "secondary" : "outline"}>horaires {localSeo.has_opening_hours_signal ? "OK" : "faible"}</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {crawl.pages_checked > 0 && (
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="font-semibold">Mini-crawl SEO gratuit</h4>
            <Badge variant="secondary">{crawl.pages_checked} page{crawl.pages_checked > 1 ? "s" : ""} analysée{crawl.pages_checked > 1 ? "s" : ""}</Badge>
          </div>
          {crawl.issue_counts && Object.keys(crawl.issue_counts).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {Object.entries(crawl.issue_counts).map(([issue, count]) => (
                <Badge key={issue} variant="outline">{issue.replace(/_/g, " ")} · {String(count)}</Badge>
              ))}
            </div>
          )}
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 text-left backdrop-blur">
                <tr>
                  <th className="p-2 font-medium">Page</th>
                  <th className="p-2 font-medium">H1</th>
                  <th className="p-2 font-medium">Mots</th>
                  <th className="p-2 font-medium">CTA</th>
                  <th className="p-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {(crawl.pages ?? []).map((page: any) => (
                  <tr key={page.url} className="border-t border-border">
                    <td className="max-w-[260px] p-2">
                      <a href={page.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{page.url.replace(/^https?:\/\//, "").slice(0, 55)}</a>
                      <p className="mt-0.5 truncate text-muted-foreground">{page.title || "Sans title"}</p>
                    </td>
                    <td className="p-2">{page.h1_count}</td>
                    <td className="p-2">{page.word_count}</td>
                    <td className="p-2">{page.cta_mentions_count}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {(page.issues ?? []).slice(0, 4).map((issue: string) => <Badge key={issue} variant="outline" className="text-[10px]">{issue.replace(/_/g, " ")}</Badge>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recos.category_scores && (
        <div className="mt-6">
          <h4 className="mb-3 font-semibold">Scores business</h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {Object.entries(recos.category_scores).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border p-3">
                <p className="text-xs capitalize text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-bold">{String(value)}<span className="text-xs text-muted-foreground">/100</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recos.recommended_offer && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Offre recommandée</p>
          <h4 className="mt-1 font-semibold">{recos.recommended_offer.name}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{recos.recommended_offer.pitch}</p>
          <Badge variant="outline" className="mt-2">{recos.recommended_offer.price_range}</Badge>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {(recos.recommended_offer.deliverables ?? []).map((d: string, i: number) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}

      {recos.critical_issues?.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Problèmes critiques</h4>
          <div className="space-y-2">
            {recos.critical_issues.map((i: any, n: number) => (
              <div key={n} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{i.title}</p>
                  <Badge variant="outline" className={i.severity === "high" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-warning/15 text-warning border-warning/30"}>{i.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.fix}</p>
                {i.estimated_revenue_impact && <p className="mt-1 text-xs text-success">→ {i.estimated_revenue_impact}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {recos.quick_wins?.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-success" /> Quick wins</h4>
          <ul className="space-y-1.5">
            {recos.quick_wins.map((q: string, n: number) => (
              <li key={n} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />{q}</li>
            ))}
          </ul>
        </div>
      )}

      {(recos.seven_day_plan?.length > 0 || recos.thirty_day_plan?.length > 0) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {recos.seven_day_plan?.length > 0 && (
            <div>
              <h4 className="mb-3 font-semibold">Plan 7 jours</h4>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">{recos.seven_day_plan.map((q: string, n: number) => <li key={n}>{q}</li>)}</ol>
            </div>
          )}
          {recos.thirty_day_plan?.length > 0 && (
            <div>
              <h4 className="mb-3 font-semibold">Plan 30 jours</h4>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">{recos.thirty_day_plan.map((q: string, n: number) => <li key={n}>{q}</li>)}</ol>
            </div>
          )}
        </div>
      )}

      {recos.services_to_pitch?.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Services à pitcher</h4>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {recos.services_to_pitch.map((s: any, n: number) => (
              <div key={n} className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-semibold">{s.service}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.why}</p>
                {s.estimated_budget && <Badge variant="outline" className="mt-2 text-[10px]">{s.estimated_budget}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  const color = score == null ? "text-muted-foreground" : score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{score ?? "—"}<span className="text-xs text-muted-foreground">/100</span></p>
    </div>
  );
}

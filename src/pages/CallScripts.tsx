// Historique des scripts d'appel générés par l'agent Closer.
// Recherche, export, re-génération rapide.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Download, ExternalLink, FileText, Loader2, PhoneCall, RefreshCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { functionErrorMessage } from "@/lib/functionErrors";

interface Script {
  id: string; prospect_id: string | null; title: string; objective: string | null;
  tone: string | null; script: string; hook: string | null; closing: string | null;
  objections: any[]; variables: any; model_used: string | null;
  created_by: string | null; created_at: string;
}

export default function CallScripts() {
  const [items, setItems] = useState<Script[]>([]);
  const [prospects, setProspects] = useState<Record<string, { name: string; sector: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<Script | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("call_scripts").select("*").order("created_at", { ascending: false }).limit(200);
    const list = (data ?? []) as Script[];
    setItems(list);
    const ids = Array.from(new Set(list.map((s) => s.prospect_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: ps } = await supabase.from("prospects").select("id, name, sector").in("id", ids);
      const map: Record<string, any> = {};
      (ps ?? []).forEach((p) => { map[p.id] = { name: p.name, sector: p.sector }; });
      setProspects(map);
    } else setProspects({});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((it) =>
      it.title.toLowerCase().includes(s) ||
      it.script.toLowerCase().includes(s) ||
      (it.prospect_id && prospects[it.prospect_id]?.name?.toLowerCase().includes(s)),
    );
  }, [items, prospects, search]);

  const copyScript = (s: string) => { navigator.clipboard.writeText(s); toast.success("Script copié"); };

  const downloadScript = (it: Script) => {
    const blob = new Blob([it.script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${it.title.replace(/\s+/g, "-")}-${it.id.slice(0, 6)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const regenerate = async (it: Script) => {
    if (!it.prospect_id) return toast.error("Pas de prospect lié.");
    setRegenerating(it.id);
    const { data, error } = await supabase.functions.invoke("agent-closer", {
      body: { prospect_id: it.prospect_id, tone: it.tone ?? undefined, objective: it.objective ?? undefined },
    });
    setRegenerating(null);
    if (error || data?.error) return toast.error(data?.error ?? await functionErrorMessage(error));
    toast.success("Nouveau script généré");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("call_scripts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Script supprimé");
    if (view?.id === id) setView(null);
    load();
  };

  const exportAll = () => {
    exportToCSV(
      filtered.map((it) => ({
        date: it.created_at,
        prospect: it.prospect_id ? prospects[it.prospect_id]?.name ?? it.prospect_id : "—",
        titre: it.title, objectif: it.objective ?? "",
        ton: it.tone ?? "", modele: it.model_used ?? "",
        accroche: it.hook ?? "", closing: it.closing ?? "",
      })),
      "scripts-appel",
    );
  };

  return (
    <div>
      <PageHeader title="Historique scripts d'appel" description="Tous les scripts générés par l'agent Closer — réutilise, re-génère, exporte.">
        <Button variant="outline" size="sm" onClick={exportAll} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </PageHeader>

      <div className="p-6 space-y-4">
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher (prospect, contenu…)" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Card>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <PhoneCall className="h-12 w-12 mx-auto opacity-30 mb-3" />
            <p>Aucun script {search ? "ne correspond" : "encore généré"}.</p>
            <p className="text-xs mt-2">Génère un script depuis la fiche d'un prospect avec « Script d'appel ».</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((it) => {
              const p = it.prospect_id ? prospects[it.prospect_id] : null;
              return (
                <Card key={it.id} className="p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{it.title}</h3>
                        {p?.sector && <Badge variant="outline" className="text-[10px]">{p.sector}</Badge>}
                        {it.tone && <Badge variant="secondary" className="text-[10px]">Ton: {it.tone}</Badge>}
                        {it.model_used && <Badge variant="outline" className="text-[10px]">{it.model_used}</Badge>}
                      </div>
                      {it.hook && <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 italic">« {it.hook} »</p>}
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(it.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setView(it)}><FileText className="h-3.5 w-3.5 mr-1" /> Voir</Button>
                      <Button variant="ghost" size="sm" onClick={() => regenerate(it)} disabled={regenerating === it.id || !it.prospect_id}>
                        {regenerating === it.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1" />}
                        Re-générer
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{view?.title}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3">
              {view.prospect_id && prospects[view.prospect_id] && (
                <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => navigate(`/prospects/${view.prospect_id}`)}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir le prospect : {prospects[view.prospect_id].name}
                </Button>
              )}
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-4 rounded-lg max-h-[55vh] overflow-auto">{view.script}</pre>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            {view && (
              <>
                <Button variant="ghost" onClick={() => remove(view.id)}><Trash2 className="h-4 w-4 mr-1" /> Supprimer</Button>
                <Button variant="outline" onClick={() => view && downloadScript(view)}><Download className="h-4 w-4 mr-1" /> Télécharger .txt</Button>
                <Button variant="hero" onClick={() => view && copyScript(view.script)}><Copy className="h-4 w-4 mr-1" /> Copier</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

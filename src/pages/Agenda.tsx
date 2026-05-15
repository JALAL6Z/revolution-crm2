import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalIcon, Plus, Loader2, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isToday, isThisWeek, isPast } from "date-fns";
import { fr } from "date-fns/locale";

interface Appointment {
  id: string; title: string; scheduled_at: string; duration_minutes: number | null;
  type: string | null; notes: string | null; outcome: string | null;
  prospect_id: string | null; client_id: string | null;
}

export default function Agenda() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const nowISO = () => new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  const empty = { title: "", scheduled_at: nowISO(), duration_minutes: 30, type: "discovery", notes: "" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("appointments").select("*").order("scheduled_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Appointment[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (a: Appointment) => {
    setEditing(a);
    setForm({ ...a, scheduled_at: a.scheduled_at.slice(0, 16), notes: a.notes ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title || !form.scheduled_at) { toast.error("Titre et date requis"); return; }
    const payload = { ...form, scheduled_at: new Date(form.scheduled_at).toISOString(), duration_minutes: Number(form.duration_minutes) || 30 };
    const { error } = editing
      ? await supabase.from("appointments").update(payload).eq("id", editing.id)
      : await supabase.from("appointments").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Rendez-vous modifié" : "Rendez-vous créé");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé"); load();
  };

  const today = items.filter((a) => isToday(parseISO(a.scheduled_at)));
  const week = items.filter((a) => !isToday(parseISO(a.scheduled_at)) && isThisWeek(parseISO(a.scheduled_at), { locale: fr }));
  const upcoming = items.filter((a) => !isThisWeek(parseISO(a.scheduled_at), { locale: fr }) && !isPast(parseISO(a.scheduled_at)));
  const past = items.filter((a) => isPast(parseISO(a.scheduled_at)) && !isToday(parseISO(a.scheduled_at))).slice(0, 10);

  const Section = ({ title, list }: { title: string; list: Appointment[] }) =>
    list.length === 0 ? null : (
      <div>
        <h3 className="mb-3 text-xs uppercase font-semibold tracking-wider text-muted-foreground">{title}</h3>
        <div className="space-y-2">
          {list.map((a) => (
            <Card key={a.id} className="group flex items-center justify-between gap-3 p-4 transition-all hover:shadow-elegant hover:border-primary/40 cursor-pointer animate-fade-in" onClick={() => openEdit(a)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg gradient-primary text-primary-foreground shadow-glow">
                  <CalIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(a.scheduled_at), "EEE d MMM 'à' HH:mm", { locale: fr })}
                    <span>· {a.duration_minutes}min</span>
                    {a.type && <Badge variant="outline" className="text-[10px]">{a.type}</Badge>}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(a.id); }}>
                <Trash2 className="h-4 w-4 text-destructive opacity-0 group-hover:opacity-100" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    );

  return (
    <div>
      <PageHeader title="Agenda" description="Vos rendez-vous prospects et clients">
        <Button variant="hero" size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nouveau rendez-vous</Button>
      </PageHeader>

      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">Aucun rendez-vous. Cliquez sur "Nouveau rendez-vous" pour commencer.</Card>
        ) : (
          <>
            <Section title="Aujourd'hui" list={today} />
            <Section title="Cette semaine" list={week} />
            <Section title="À venir" list={upcoming} />
            <Section title="Passés (10 derniers)" list={past} />
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Titre *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Date & heure *</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Durée (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Type</Label>
              <Select value={form.type ?? "discovery"} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Découverte</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                  <SelectItem value="follow-up">Suivi</SelectItem>
                  <SelectItem value="kickoff">Kickoff</SelectItem>
                  <SelectItem value="reporting">Reporting client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
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

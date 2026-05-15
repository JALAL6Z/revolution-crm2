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
import { Receipt, Plus, Loader2, Trash2, Download, FileText, Copy } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { exportToCSV } from "@/lib/export";
import { buildFactureCommand, detailFromDescription } from "@/lib/factureRevolution";
import { logFunnelEvent } from "@/lib/funnelEvents";

interface Invoice {
  id: string; invoice_number: string; client_id: string | null; amount: number;
  status: string; description: string | null; due_date: string | null;
  paid_at: string | null; created_at: string;
}
interface Client { id: string; company_name: string; contact_name?: string | null; }

export default function Factures() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [pdfCommand, setPdfCommand] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);

  const empty = { invoice_number: "", client_id: "", amount: 0, status: "draft", description: "", due_date: "" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    setLoading(true);
    const [{ data: inv }, { data: cl }] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name, contact_name").order("company_name"),
    ]);
    setInvoices((inv ?? []) as Invoice[]);
    setClients((cl ?? []) as Client[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "—";

  const openCreate = () => {
    const num = `F-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`;
    setEditing(null);
    setForm({ ...empty, invoice_number: num, due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
    setOpen(true);
  };
  const openEdit = (i: Invoice) => {
    setEditing(i);
    setForm({ ...i, due_date: i.due_date ?? "", description: i.description ?? "", client_id: i.client_id ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.invoice_number || !form.amount) { toast.error("Numéro et montant requis"); return; }
    const payload = { ...form, amount: Number(form.amount), client_id: form.client_id || null, due_date: form.due_date || null };
    const { data, error } = editing
      ? await supabase.from("invoices").update(payload).eq("id", editing.id).select("id, client_id, amount").single()
      : await supabase.from("invoices").insert(payload).select("id, client_id, amount").single();
    if (error) { toast.error(error.message); return; }
    if (!editing && data) {
      await logFunnelEvent({
        event_type: "invoice_created",
        entity_type: "invoice",
        entity_id: data.id,
        client_id: data.client_id,
        amount: Number(data.amount || 0),
      });
    }
    toast.success("Facture enregistrée");
    setOpen(false); load();
  };

  const markPaid = async (i: Invoice) => {
    const { error } = await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", i.id);
    if (error) { toast.error(error.message); return; }
    await logFunnelEvent({
      event_type: "invoice_paid",
      entity_type: "invoice",
      entity_id: i.id,
      client_id: i.client_id,
      amount: Number(i.amount || 0),
    });
    toast.success("Marquée payée"); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette facture ?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimée"); load();
  };

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalDue = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);

  const exportCsv = () => exportToCSV(invoices.map((i) => ({
    numero: i.invoice_number, client: clientName(i.client_id), montant: i.amount, statut: i.status, echeance: i.due_date, paye_le: i.paid_at,
  })), "factures");

  const nextRevolutionInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const nums = invoices
      .map((i) => String(i.invoice_number).match(new RegExp(`${year}-(\\d+)`))?.[1])
      .filter(Boolean)
      .map((n) => Number(n));
    return `${year}-${String((Math.max(0, ...nums) || invoices.length) + 1).padStart(3, "0")}`;
  };

  const openPdfCommand = (invoice: Invoice) => {
    const client = clients.find((c) => c.id === invoice.client_id);
    const command = buildFactureCommand({
      client: client?.company_name ?? clientName(invoice.client_id),
      address: "Adresse client à compléter",
      num: String(invoice.invoice_number || nextRevolutionInvoiceNumber()).replace(/^F-/, ""),
      services: [{
        name: invoice.description?.split("\n")[0] || "Prestation SMMA",
        detail: detailFromDescription(invoice.description),
        amount: Number(invoice.amount || 0),
      }],
    });
    setPdfCommand(command);
    setPdfOpen(true);
  };

  const copyPdfCommand = async () => {
    await navigator.clipboard.writeText(pdfCommand);
    toast.success("Commande copiée");
  };

  return (
    <div>
      <PageHeader title="Factures" description="Suivi facturation et encaissements">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!invoices.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        <Button variant="hero" size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nouvelle facture</Button>
      </PageHeader>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Encaissé" value={Math.round(totalPaid)} suffix=" €" icon={Receipt} variant="primary" />
          <StatCard title="En attente" value={Math.round(totalDue)} suffix=" €" icon={Receipt} />
          <StatCard title="Factures totales" value={invoices.length} icon={Receipt} />
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">N°</th>
                  <th className="p-3 text-left">Client</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3 text-left">Échéance</th>
                  <th className="p-3 text-left">Statut</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune facture</td></tr>
                ) : invoices.map((i) => (
                  <tr key={i.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(i)}>
                    <td className="p-3 font-mono text-xs">{i.invoice_number}</td>
                    <td className="p-3">{clientName(i.client_id)}</td>
                    <td className="p-3 text-right font-mono font-semibold">{Number(i.amount).toLocaleString("fr-FR")} €</td>
                    <td className="p-3 text-muted-foreground">{i.due_date ?? "—"}</td>
                    <td className="p-3">
                      <Badge className={
                        i.status === "paid" ? "bg-success/15 text-success border-success/30" :
                        i.status === "overdue" ? "bg-destructive/15 text-destructive border-destructive/30" :
                        "bg-muted text-muted-foreground"
                      }>{i.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {i.status !== "paid" && <Button variant="outline" size="sm" onClick={() => markPaid(i)}>Payée</Button>}
                        <Button variant="outline" size="sm" onClick={() => openPdfCommand(i)}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Modifier la facture" : "Nouvelle facture"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>N° facture *</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Montant (€) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Client</Label>
              <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Échéance</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="sent">Envoyée</SelectItem>
                    <SelectItem value="paid">Payée</SelectItem>
                    <SelectItem value="overdue">En retard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="hero" onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Générer le PDF avec le skill facture</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Complète l'adresse/SIRET si besoin, puis exécute cette commande dans le terminal. Elle utilise ton générateur local Revolution Ecom.
            </p>
            <Textarea value={pdfCommand} onChange={(e) => setPdfCommand(e.target.value)} rows={8} className="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Fermer</Button>
            <Button variant="hero" onClick={copyPdfCommand}><Copy className="mr-2 h-4 w-4" />Copier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Users, Briefcase, Bot, FileSearch,
  Megaphone, Receipt, Calendar, Settings, Radar, Plus, Building2, FileText,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/prospects", label: "Prospects", icon: Users },
  { to: "/scraping", label: "Scraping", icon: Radar },
  { to: "/clients", label: "Clients", icon: Briefcase },
  { to: "/agents", label: "Agents IA", icon: Bot },
  { to: "/audits", label: "Audits site", icon: FileSearch },
  { to: "/campagnes", label: "Campagnes", icon: Megaphone },
  { to: "/factures", label: "Factures", icon: Receipt },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [prospects, setProspects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Cmd+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const ctl = new AbortController();
    (async () => {
      if (q.length < 1) {
        const [{ data: p }, { data: c }] = await Promise.all([
          supabase.from("prospects").select("id, name, city, sector").order("created_at", { ascending: false }).limit(6),
          supabase.from("clients").select("id, company_name, contact_name").order("created_at", { ascending: false }).limit(6),
        ]);
        setProspects(p ?? []); setClients(c ?? []); setInvoices([]);
        return;
      }
      const like = `%${q}%`;
      const [{ data: p }, { data: c }, { data: i }] = await Promise.all([
        supabase.from("prospects").select("id, name, city, sector").or(`name.ilike.${like},city.ilike.${like},sector.ilike.${like},email.ilike.${like}`).limit(8),
        supabase.from("clients").select("id, company_name, contact_name").or(`company_name.ilike.${like},contact_name.ilike.${like},email.ilike.${like}`).limit(6),
        supabase.from("invoices").select("id, invoice_number, amount").ilike("invoice_number", like).limit(5),
      ]);
      if (ctl.signal.aborted) return;
      setProspects(p ?? []); setClients(c ?? []); setInvoices(i ?? []);
    })();
    return () => ctl.abort();
  }, [query, open]);

  const go = (path: string) => { onOpenChange(false); setQuery(""); navigate(path); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Rechercher prospects, clients, factures..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        <CommandGroup heading="Actions rapides">
          <CommandItem onSelect={() => go("/prospects")}>
            <Plus className="mr-2 h-4 w-4 text-primary" /> Nouveau prospect
          </CommandItem>
          <CommandItem onSelect={() => go("/agents")}>
            <Bot className="mr-2 h-4 w-4 text-primary" /> Lancer un agent IA
          </CommandItem>
          <CommandItem onSelect={() => go("/audits")}>
            <FileSearch className="mr-2 h-4 w-4 text-primary" /> Auditer un site
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {NAV.map((n) => (
            <CommandItem key={n.to} onSelect={() => go(n.to)}>
              <n.icon className="mr-2 h-4 w-4" /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {prospects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Prospects">
              {prospects.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/prospects/${p.id}`)}>
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{[p.sector, p.city].filter(Boolean).join(" • ")}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clients">
              {clients.map((c) => (
                <CommandItem key={c.id} onSelect={() => go(`/clients`)}>
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{c.company_name}</span>
                    {c.contact_name && <span className="truncate text-xs text-muted-foreground">{c.contact_name}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {invoices.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Factures">
              {invoices.map((i) => (
                <CommandItem key={i.id} onSelect={() => go(`/factures`)}>
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{i.invoice_number}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{Number(i.amount).toLocaleString("fr-FR")} €</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

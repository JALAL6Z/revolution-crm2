import { useEffect, useState } from "react";
import { Bell, Users, Receipt, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "prospect" | "invoice" | "appointment";
  title: string;
  description: string;
  created_at: string;
  link: string;
  read: boolean;
}

const ICON: Record<Notification["type"], any> = {
  prospect: Users,
  invoice: Receipt,
  appointment: Calendar,
};

const READ_KEY = "notifications_read_at";

export function NotificationsBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const readAt = () => {
    const v = localStorage.getItem(READ_KEY);
    return v ? new Date(v) : new Date(0);
  };

  const load = async () => {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const [{ data: ps }, { data: invs }, { data: appts }] = await Promise.all([
      supabase.from("prospects").select("id, name, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(10),
      supabase.from("invoices").select("id, invoice_number, amount, created_at, status").gte("created_at", since).order("created_at", { ascending: false }).limit(10),
      supabase.from("appointments").select("id, title, scheduled_at, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(10),
    ]);
    const r = readAt();
    const all: Notification[] = [
      ...(ps ?? []).map((p: any) => ({
        id: `p-${p.id}`, type: "prospect" as const, title: "Nouveau prospect",
        description: p.name, created_at: p.created_at, link: `/prospects/${p.id}`,
        read: new Date(p.created_at) <= r,
      })),
      ...(invs ?? []).map((i: any) => ({
        id: `i-${i.id}`, type: "invoice" as const, title: i.status === "paid" ? "Facture payée" : "Nouvelle facture",
        description: `${i.invoice_number} — ${Number(i.amount).toLocaleString("fr-FR")} €`,
        created_at: i.created_at, link: "/factures",
        read: new Date(i.created_at) <= r,
      })),
      ...(appts ?? []).map((a: any) => ({
        id: `a-${a.id}`, type: "appointment" as const, title: "RDV planifié",
        description: a.title, created_at: a.created_at, link: "/agenda",
        read: new Date(a.created_at) <= r,
      })),
    ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 15);
    setItems(all);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notif-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "prospects" }, (payload: any) => {
        toast.success("Nouveau prospect", { description: payload.new?.name });
        load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "invoices" }, (payload: any) => {
        toast.success("Nouvelle facture", { description: payload.new?.invoice_number });
        load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, (payload: any) => {
        toast.success("Nouveau RDV", { description: payload.new?.title });
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const unread = items.filter((i) => !i.read).length;

  const markAllRead = () => {
    localStorage.setItem(READ_KEY, new Date().toISOString());
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full gradient-primary px-1 text-[10px] font-bold text-primary-foreground shadow-glow animate-pulse-glow">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <span className="text-xs text-muted-foreground">{items.length} récente{items.length > 1 ? "s" : ""}</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Rien de neuf 🌙</div>
          ) : (
            items.map((n) => {
              const Icon = ICON[n.type];
              return (
                <Link
                  key={n.id}
                  to={n.link}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex gap-3 border-b border-border/50 px-4 py-3 transition-colors hover:bg-accent/40",
                    !n.read && "bg-primary/5",
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary text-primary-foreground shadow-glow">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

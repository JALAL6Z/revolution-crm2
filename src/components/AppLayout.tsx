import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Briefcase, Bot, FileSearch,
  Megaphone, Receipt, Calendar, Settings, LogOut, Radar,
  Menu, Search, Activity as ActivityIcon, TrendingUp, PhoneCall, Target,
  MoreHorizontal, BarChart3, Euro, Bell,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationsBell } from "@/components/NotificationsBell";
import { canAccessPath, isAdminRole, roleLabel } from "@/lib/access";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/funnel", label: "Funnel", icon: Target },
  { to: "/prospects", label: "Prospects", icon: Users },
  { to: "/scraping", label: "Scraping", icon: Radar },
  { to: "/clients", label: "Clients", icon: Briefcase },
  { to: "/agents", label: "Agents IA", icon: Bot },
  { to: "/audits", label: "Audits site", icon: FileSearch },
  { to: "/google-ads", label: "Google Ads", icon: BarChart3, adminOnly: true },
  { to: "/commissions", label: "Commissions", icon: Euro },
  { to: "/campagnes", label: "Campagnes", icon: Megaphone },
  { to: "/performance", label: "Performance", icon: TrendingUp },
  { to: "/scripts", label: "Scripts d'appel", icon: PhoneCall },
  { to: "/activite", label: "Journal IA", icon: ActivityIcon },
  { to: "/factures", label: "Factures", icon: Receipt },
  { to: "/agenda", label: "Agenda", icon: Calendar },
];

function NavLinks({ onNavigate, role }: { onNavigate?: () => void; role?: string | null }) {
  const memberAllowed = ["/prospects", "/commissions", "/scripts", "/agenda"];
  const visibleNav = isAdminRole(role) ? nav : nav.filter((item) => memberAllowed.includes(item.to));

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {visibleNav.map((item, i) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all animate-fade-in",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:translate-x-0.5",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-x-1 -translate-y-1/2 rounded-r-full gradient-primary shadow-glow" />
              )}
              <item.icon className={cn("h-4 w-4 transition-transform", isActive && "text-primary")} />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, loading: roleLoading } = useCurrentRole();
  const [profile, setProfile] = useState<{ full_name?: string | null; avatar_url?: string | null } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  useEffect(() => {
    if (roleLoading || !role) return;
    if (!canAccessPath(role, location.pathname)) navigate("/prospects", { replace: true });
  }, [location.pathname, navigate, role, roleLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = (profile?.full_name || user?.email || "?")
    .split(/\s|@/)[0]
    .slice(0, 2)
    .toUpperCase();

  const { supported: pushSupported, subscribed: pushSubscribed, subscribe: subscribePush } = usePushNotifications();

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col">
      {/* Logo — fixe en haut */}
      <div className="crm-sidebar-brand flex shrink-0 items-center justify-center border-b border-sidebar-border px-5">
        <Logo size="h-12" glow />
      </div>

      {/* Nav links — scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <NavLinks onNavigate={onNavigate} role={role} />
      </div>

      {/* Footer — fixe en bas */}
      <div className="shrink-0 border-t border-sidebar-border p-3 bg-sidebar">
        {isAdminRole(role) && (
          <NavLink
            to="/parametres"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )
            }
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </NavLink>
        )}
        {/* Bouton notif push — visible par tous */}
        {pushSupported && !pushSubscribed && (
          <button
            onClick={subscribePush}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all mb-1"
          >
            <Bell className="h-4 w-4 text-primary" />
            <span>Activer les notifications</span>
          </button>
        )}
        {pushSupported && pushSubscribed && (
          <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-success mb-1">
            <Bell className="h-3.5 w-3.5" />
            <span>Notifications activées</span>
          </div>
        )}

        <div className="mt-1 flex items-center gap-3 rounded-lg p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-primary text-sm font-semibold text-primary-foreground shadow-glow">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name || user?.email}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel(role)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Se déconnecter" className="shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 h-full flex flex-col">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="crm-mobile-topbar flex shrink-0 items-end gap-1.5 border-b border-border bg-background">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Ouvrir le menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          </Sheet>

          <div className="md:hidden flex-1 flex justify-center">
            <Logo size="h-9" glow />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              className="hidden gap-2 md:inline-flex"
            >
              <Search className="h-4 w-4" />
              <span className="text-muted-foreground">Rechercher...</span>
              <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPaletteOpen(true)}
              className="md:hidden"
              aria-label="Rechercher"
            >
              <Search className="h-5 w-5" />
            </Button>
            <NotificationsBell />
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-[72px] md:pb-0">
          <Outlet />
        </main>

        {/* ── Bottom navigation (mobile only) ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-border bg-background/95 backdrop-blur-md safe-bottom">
          {bottomNav(role).map((item) => (
            item.isMore ? (
              <button
                key="more"
                onClick={() => setMobileOpen(true)}
                className="flex flex-1 flex-col items-center gap-1 py-2.5 text-muted-foreground transition-colors active:scale-95"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px] font-medium">Plus</span>
              </button>
            ) : (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors active:scale-95",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition-all", isActive && "bg-primary/15")}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          ))}
        </nav>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function bottomNav(role?: string | null) {
  const admin = isAdminRole(role);
  const base = [
    { to: "/prospects", label: "Prospects", icon: Users },
    { to: "/scripts", label: "Scripts", icon: PhoneCall },
    { to: "/agenda", label: "Agenda", icon: Calendar },
  ];
  if (admin) {
    return [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      ...base,
      { isMore: true, label: "Plus", icon: MoreHorizontal },
    ];
  }
  return [
    { to: "/prospects", label: "Prospects", icon: Users, end: true },
    { to: "/scripts", label: "Scripts", icon: PhoneCall },
    { to: "/agenda", label: "Agenda", icon: Calendar },
    { isMore: true, label: "Plus", icon: MoreHorizontal },
  ];
}

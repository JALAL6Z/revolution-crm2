import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Radar, BarChart3, Bot, Zap, Loader2, User, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";

const features = [
  { icon: Radar, label: "Scraping multi-sources", desc: "Google Maps, Sheets, Pappers — en un clic." },
  { icon: Bot, label: "Agents IA dédiés", desc: "Audit de sites, scoring, génération de messages." },
  { icon: BarChart3, label: "Reporting unifié", desc: "Google Ads, Meta, TikTok consolidés." },
  { icon: Zap, label: "Scripts d'appel", desc: "Scripts personnalisés par secteur et prospect." },
];

// Convert username to internal email (never shown to user)
function toInternalEmail(username: string): string {
  const slug = username.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, ".");
  return `${slug}@revolution-agency.com`;
}

export default function Auth() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (authLoading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return toast.error("Identifiant et mot de passe requis");
    setLoading(true);
    const email = toInternalEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Identifiant ou mot de passe incorrect");
      return;
    }
    navigate("/");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -left-40 top-0 h-[40rem] w-[40rem] rounded-full bg-primary/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[40rem] w-[40rem] rounded-full bg-primary-glow/20 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,hsl(var(--primary)/0.15),transparent_60%)]" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-12 px-6 py-10 lg:grid-cols-2 lg:items-center lg:px-12">
        {/* LEFT — Branding */}
        <div className="hidden flex-col justify-between gap-12 animate-fade-in lg:flex">
          <Logo size="h-20" glow />
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              <Sparkles className="h-3 w-3" />
              CRM Revolution Agency
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Pilotez votre agence,{" "}
              <span className="gradient-text">accélérez la croissance.</span>
            </h1>
            <p className="max-w-md text-base text-muted-foreground md:text-lg">
              Prospection automatisée, audits IA et scripts d'appel — tout votre stack
              commercial dans un seul outil signé Revolution.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            {features.map((f, i) => (
              <div
                key={f.label}
                className="group rounded-xl border border-border/50 bg-card/40 p-3 backdrop-blur transition-all hover:border-primary/40 animate-fade-in"
                style={{ animationDelay: `${100 + i * 80}ms`, animationFillMode: "backwards" }}
              >
                <div className="mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-glow">
                  <f.icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Login form */}
        <div className="flex w-full items-center justify-center lg:justify-end">
          <div className="w-full max-w-sm animate-fade-in" style={{ animationDelay: "150ms", animationFillMode: "backwards" }}>
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              <Logo size="h-14" glow />
            </div>
            <Card className="border-border/60 glass p-7 shadow-elegant">
              <div className="mb-7 space-y-1 text-center">
                <h2 className="text-2xl font-bold">Connexion</h2>
                <p className="text-sm text-muted-foreground">Accès réservé à l'équipe Revolution</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Identifiant</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="ton identifiant"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading} variant="hero" size="lg" className="w-full">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion...</> : "Se connecter →"}
                </Button>
              </form>

              <p className="mt-5 text-center text-xs text-muted-foreground">
                Les accès sont créés par l'administrateur.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

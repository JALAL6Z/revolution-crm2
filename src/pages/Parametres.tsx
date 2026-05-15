import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, Save, Users, Key, Loader2, Shield, Check, X, TestTube2, Sparkles, PlugZap, UserPlus, Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AI_PROVIDER_CATALOG, FREE_SMMA_TOOLS, INTEGRATION_CHOICES } from "@/lib/integrations";
import { roleLabel } from "@/lib/access";

interface Member { user_id: string; full_name: string | null; email?: string; role: string; }
interface IntegrationRow {
  provider: string;
  label: string;
  kind: string;
  enabled: boolean;
  base_url: string | null;
  model: string | null;
  notes: string | null;
  priority: number;
  last_test_status: string | null;
  last_test_message: string | null;
  last_test_at: string | null;
}
interface IntegrationDraft {
  provider: string;
  label: string;
  kind: string;
  enabled: boolean;
  api_key: string;
  base_url: string;
  model: string;
  notes: string;
  priority: number;
}
interface IntegrationStatus {
  provider: string;
  label: string;
  ok: boolean;
  configured: boolean;
  enabled: boolean;
  model: string;
  source: "server_secret" | "database" | "missing";
  message: string;
}

const draftFromCatalog = (item: typeof AI_PROVIDER_CATALOG[number]): IntegrationDraft => ({
  provider: item.provider,
  label: item.label,
  kind: item.kind,
  enabled: item.recommended,
  api_key: "",
  base_url: item.baseUrlHint ?? "",
  model: item.defaultModel ?? "",
  notes: item.value,
  priority: item.recommended ? 10 : 50,
});

export default function Parametres() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string; phone: string }>({ full_name: "", phone: "" });
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);
  const [memberDraft, setMemberDraft] = useState({ email: "", password: "", full_name: "", phone: "", role: "setter" });
  const [integrationRows, setIntegrationRows] = useState<IntegrationRow[]>([]);
  const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatus[]>([]);
  const [drafts, setDrafts] = useState<Record<string, IntegrationDraft>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: p }, { data: roles }, { data: profiles }, { data: integrations }, statusResult] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("integration_settings")
        .select("provider,label,kind,enabled,base_url,model,notes,priority,last_test_status,last_test_message,last_test_at")
        .eq("kind", "ai")
        .order("priority", { ascending: true }),
      supabase.functions.invoke("integration-test", { body: { statusOnly: true } }).catch(() => ({ data: null, error: true })),
    ]);

    if (p) setProfile({ full_name: p.full_name ?? "", phone: p.phone ?? "" });
    const myRole = roles?.find((r) => r.user_id === user.id)?.role;
    setIsAdmin(myRole === "admin");
    const merged: Member[] = (roles ?? []).map((r) => ({
      user_id: r.user_id,
      full_name: profiles?.find((p) => p.id === r.user_id)?.full_name ?? null,
      role: r.role,
    }));
    setMembers(merged);

    const rows = (integrations ?? []) as IntegrationRow[];
    setIntegrationRows(rows);
    setIntegrationStatuses((statusResult as { data?: { results?: IntegrationStatus[] } })?.data?.results ?? []);

    const nextDrafts: Record<string, IntegrationDraft> = {};
    for (const item of AI_PROVIDER_CATALOG) {
      const row = rows.find((r) => r.provider === item.provider);
      nextDrafts[item.provider] = row
        ? {
            provider: row.provider,
            label: row.label,
            kind: row.kind,
            enabled: row.enabled,
            api_key: "",
            base_url: row.base_url ?? "",
            model: row.model ?? "",
            notes: row.notes ?? "",
            priority: row.priority ?? 50,
          }
        : draftFromCatalog(item);
    }
    setDrafts(nextDrafts);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(profile).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profil mis a jour");
  };

  const updateRole = async (userId: string, role: string) => {
    if (!isAdmin) { toast.error("Reserve aux admins"); return; }
    const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role mis a jour");
    load();
  };

  const createMember = async () => {
    if (!isAdmin) { toast.error("Reserve aux admins"); return; }
    if (!memberDraft.full_name || !memberDraft.password) {
      toast.error("Nom d'utilisateur et mot de passe requis");
      return;
    }
    // Generate internal email from username — never shown to user
    const username = memberDraft.full_name.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ".");
    const internalEmail = memberDraft.email?.trim() || `${username}@revolution-agency.com`;
    const payload = { ...memberDraft, email: internalEmail };

    setCreatingMember(true);
    const { data, error } = await supabase.functions.invoke("admin-create-member", { body: payload });
    setCreatingMember(false);

    if (error || data?.error) { toast.error(data?.error ?? error?.message ?? "Creation impossible"); return; }
    toast.success(`Compte créé pour ${memberDraft.full_name}`);
    setMemberDraft({ email: "", password: "", full_name: "", phone: "", role: "setter" });
    load();
  };

  const saveIntegration = async (provider: string) => {
    if (!isAdmin) { toast.error("Reserve aux admins"); return; }
    const draft = drafts[provider];
    if (!draft) return;
    setSavingProvider(provider);
    const payload = {
      provider: draft.provider,
      label: draft.label,
      kind: draft.kind,
      enabled: draft.enabled,
      api_key: null,
      base_url: draft.base_url.trim() || null,
      model: draft.model.trim() || null,
      notes: draft.notes.trim() || null,
      priority: draft.priority,
      updated_by: user?.id ?? null,
    };

    const existing = integrationRows.find((row) => row.provider === provider);
    const { error } = existing
      ? await supabase.from("integration_settings").update(payload).eq("provider", provider)
      : await supabase.from("integration_settings").insert(payload);
    setSavingProvider(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${draft.label} enregistre`);
    load();
  };

  const testIntegration = async (provider: string) => {
    if (!isAdmin) { toast.error("Reserve aux admins"); return; }
    setTestingProvider(provider);
    const { data, error } = await supabase.functions.invoke("integration-test", { body: { provider } });
    setTestingProvider(null);
    if (error) { toast.error(error.message); return; }
    if (data?.results) setIntegrationStatuses(data.results);
    const result = data?.results?.[0];
    if (result?.ok) toast.success(`${provider} OK`);
    else toast.error(result?.message ?? "Test echoue");
    load();
  };

  const testAllIntegrations = async () => {
    if (!isAdmin) { toast.error("Reserve aux admins"); return; }
    setTestingProvider("all");
    const { data, error } = await supabase.functions.invoke("integration-test", { body: {} });
    setTestingProvider(null);
    if (error) { toast.error(error.message); return; }
    if (data?.results) setIntegrationStatuses(data.results);
    const passed = (data?.results ?? []).filter((result: IntegrationStatus) => result.ok).length;
    toast.success(`${passed}/${data?.results?.length ?? 0} integrations OK`);
    load();
  };

  const aiRowsByProvider = useMemo(() => Object.fromEntries(integrationRows.map((row) => [row.provider, row])), [integrationRows]);
  const aiStatusByProvider = useMemo(() => Object.fromEntries(integrationStatuses.map((status) => [status.provider, status])), [integrationStatuses]);

  const { supported: pushSupported, subscribed: pushSubscribed, subscribe: subscribePush } = usePushNotifications();

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div>
      <PageHeader title="Parametres" description="Profil, equipe et integrations" />

      <div className="p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile"><SettingsIcon className="mr-2 h-4 w-4" />Profil</TabsTrigger>
            <TabsTrigger value="team"><Users className="mr-2 h-4 w-4" />Equipe</TabsTrigger>
            <TabsTrigger value="integrations"><Key className="mr-2 h-4 w-4" />Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="max-w-xl p-6 space-y-4">
              <div className="grid gap-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
              <div className="grid gap-2"><Label>Nom complet</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Telephone</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
              <Button variant="hero" onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Enregistrer
              </Button>
            </Card>

            {/* Notifications push */}
            {pushSupported && (
              <Card className="max-w-xl mt-4 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${pushSubscribed ? "bg-success/15" : "bg-muted"}`}>
                      {pushSubscribed ? <Bell className="h-5 w-5 text-success" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Notifications push</p>
                      <p className="text-xs text-muted-foreground">
                        {pushSubscribed ? "Activées — vous recevrez les alertes" : "Recevez les alertes prospects et commissions"}
                      </p>
                    </div>
                  </div>
                  {!pushSubscribed && (
                    <Button size="sm" variant="hero" onClick={subscribePush}>
                      <Bell className="h-4 w-4" /> Activer
                    </Button>
                  )}
                  {pushSubscribed && (
                    <span className="text-xs text-success font-semibold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Activées
                    </span>
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="team">
            {isAdmin && (
              <Card className="mb-4 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <div>
                    <h2 className="font-semibold">Creer un espace membre</h2>
                    <p className="text-sm text-muted-foreground">Setter et closer verront uniquement les prospects que vous leur assignez.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Nom / Pseudo *</Label>
                    <Input value={memberDraft.full_name} onChange={(e) => setMemberDraft((p) => ({ ...p, full_name: e.target.value }))} placeholder="ex: Karim, Sophie L..." />
                    <p className="text-xs text-muted-foreground">Utilisé pour se connecter — pas d'email nécessaire</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Mot de passe *</Label>
                    <Input value={memberDraft.password} onChange={(e) => setMemberDraft((p) => ({ ...p, password: e.target.value }))} placeholder="Min. 6 caractères" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Téléphone</Label>
                    <Input value={memberDraft.phone} onChange={(e) => setMemberDraft((p) => ({ ...p, phone: e.target.value }))} placeholder="06..." />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email (optionnel)</Label>
                    <Input type="email" value={memberDraft.email} onChange={(e) => setMemberDraft((p) => ({ ...p, email: e.target.value }))} placeholder="Laisser vide si pas d'email" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Role</Label>
                    <Select value={memberDraft.role} onValueChange={(role) => setMemberDraft((p) => ({ ...p, role }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="setter">Setter</SelectItem>
                        <SelectItem value="closer">Closer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="hero" onClick={createMember} disabled={creatingMember} className="w-full">
                      {creatingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      Creer l'acces
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="border-b border-border bg-muted/40 px-4 py-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{isAdmin ? "Vous etes admin" : "Vue lecture (reserve aux admins pour modifier)"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                    <tr><th className="p-3 text-left">Membre</th><th className="p-3 text-left">Role</th></tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.user_id} className="border-t border-border">
                        <td className="p-3">
                          <div className="font-medium">{m.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{m.user_id.slice(0, 8)}…</div>
                        </td>
                        <td className="p-3">
                          {isAdmin ? (
                            <Select value={m.role} onValueChange={(v) => updateRole(m.user_id, v)}>
                              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="closer">Closer</SelectItem>
                                <SelectItem value="setter">Setter</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge>{roleLabel(m.role)}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {INTEGRATION_CHOICES.map((choice) => (
                <Card key={choice.title} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{choice.title}</p>
                      <h3 className="mt-1 text-base font-semibold">{choice.label}</h3>
                    </div>
                    <Badge variant="outline">{choice.items.length} blocs</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{choice.description}</p>
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {choice.items.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-success" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            <Card className="border-dashed p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Chemin recommande sans frais annexes</p>
              <p className="mt-1">
                Branche d'abord Gemini Free Tier comme cerveau principal, puis Groq Free Plan comme fallback. Les agents, le scraping et les exports restent utilisables depuis la web app mobile, sans CLI locale.
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Providers IA configurables</h2>
                  <p className="text-sm text-muted-foreground">
                    Ajoute tes clefs ici. Le CRM peut ensuite router automatiquement les agents vers Gemini ou Groq sans carte bancaire.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PlugZap className="h-4 w-4 text-primary" />
                  {integrationStatuses.filter((status) => status.configured).length} providers configures
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={testAllIntegrations} disabled={!isAdmin || testingProvider === "all"}>
                  {testingProvider === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
                  Tester toutes les APIs
                </Button>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {AI_PROVIDER_CATALOG.map((item) => {
                  const draft = drafts[item.provider] ?? draftFromCatalog(item);
                  const row = aiRowsByProvider[item.provider];
                  const status = aiStatusByProvider[item.provider] as IntegrationStatus | undefined;
                  const configured = Boolean(status?.configured);
                  const connected = Boolean(draft.enabled && configured);
                  const sourceLabel = status?.source === "server_secret"
                    ? "Secret serveur"
                    : status?.source === "database"
                      ? "Base CRM"
                      : "Cle absente";

                  return (
                    <Card key={item.provider} className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold">{item.label}</h3>
                            {item.recommended && <Badge className="bg-success/15 text-success border-success/30">Recommande</Badge>}
                            <Badge variant="outline">{item.cost}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        {connected ? (
                          <Badge className="bg-success/15 text-success border-success/30 gap-1"><Check className="h-3 w-3" />Connecte</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><X className="h-3 w-3" />Non connecte</Badge>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Activer</Label>
                          <div className="flex h-10 items-center rounded-md border border-border px-3">
                            <Switch
                              checked={draft.enabled}
                              onCheckedChange={(checked) => setDrafts((prev) => ({
                                ...prev,
                                [item.provider]: { ...draft, enabled: checked },
                              }))}
                              disabled={!isAdmin}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Priorite</Label>
                          <Input
                            type="number"
                            value={draft.priority}
                            onChange={(e) => setDrafts((prev) => ({
                              ...prev,
                              [item.provider]: { ...draft, priority: Number(e.target.value) },
                            }))}
                            disabled={!isAdmin}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Statut cle</Label>
                          <Input
                            value={status?.message ?? sourceLabel}
                            disabled
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Model</Label>
                          <Input
                            value={draft.model}
                            onChange={(e) => setDrafts((prev) => ({
                              ...prev,
                              [item.provider]: { ...draft, model: e.target.value },
                            }))}
                            placeholder={item.defaultModel ?? "Model"}
                            disabled={!isAdmin}
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Base URL</Label>
                          <Input
                            value={draft.base_url}
                            onChange={(e) => setDrafts((prev) => ({
                              ...prev,
                              [item.provider]: { ...draft, base_url: e.target.value },
                            }))}
                            placeholder={item.baseUrlHint ?? "URL optionnelle"}
                            disabled={!isAdmin}
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Notes</Label>
                          <Textarea
                            value={draft.notes}
                            onChange={(e) => setDrafts((prev) => ({
                              ...prev,
                              [item.provider]: { ...draft, notes: e.target.value },
                            }))}
                            rows={3}
                            disabled={!isAdmin}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="hero" onClick={() => saveIntegration(item.provider)} disabled={!isAdmin || savingProvider === item.provider}>
                          {savingProvider === item.provider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Sauvegarder
                        </Button>
                        <Button variant="outline" onClick={() => testIntegration(item.provider)} disabled={!isAdmin || testingProvider === item.provider || !configured}>
                          {testingProvider === item.provider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
                          Tester
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          {status?.ok && `Statut serveur: ${status.message}`}
                          {!status?.ok && status?.message}
                          {!status && row?.last_test_status === "success" && `Dernier test: ${row.last_test_message ?? "OK"}`}
                          {!status && row?.last_test_status === "error" && `Dernier test: ${row.last_test_message ?? "Erreur"}`}
                          {!status && !row?.last_test_status && item.value}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">Integrations gratuites deja integrees</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {FREE_SMMA_TOOLS.map((tool) => (
                  <div key={tool.name} className="rounded-lg border border-border bg-background/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{tool.name}</p>
                      <Badge variant="outline">{tool.cliSupport === "yes" ? "CLI possible" : tool.cliSupport === "limited" ? "CLI limite" : "API"}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{tool.use}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

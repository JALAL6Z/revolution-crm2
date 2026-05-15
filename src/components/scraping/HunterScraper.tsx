import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Search } from "lucide-react";
import { functionErrorMessage } from "@/lib/functionErrors";

export function HunterScraper({ onJobCreated }: { onJobCreated: (job: any) => void }) {
  const [domain, setDomain] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [seniority, setSeniority] = useState("");
  const [autoImport, setAutoImport] = useState(true);
  const [loading, setLoading] = useState(false);

  const launch = async () => {
    if (!domain && !company) { toast.error("Domaine ou entreprise requis"); return; }
    setLoading(true);
    const filters = { domain: domain || undefined, company: company || undefined, department: department || undefined, seniority: seniority || undefined, limit: 25 };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase.from("scraping_jobs").insert({
      source: "hunter", name: `Emails · ${domain || company}`,
      filters, auto_import: autoImport, created_by: user?.id,
    }).select().single();
    if (error || !job) { toast.error(error?.message); setLoading(false); return; }
    const { error: fnErr } = await supabase.functions.invoke("scrape-hunter", { body: { job_id: job.id, filters } });
    setLoading(false);
    if (fnErr) { toast.error(await functionErrorMessage(fnErr)); return; }
    onJobCreated(job);
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5 text-orange-400" />
        <h3 className="font-semibold">Hunter — Emails pro</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Mode gratuit actif : crawl du site et extraction d'emails publics si aucune clé Hunter n'est configurée.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Domaine</Label>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="exemple.com" />
        </div>
        <div className="space-y-1.5">
          <Label>OU Entreprise</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom société" />
        </div>
        <div className="space-y-1.5">
          <Label>Département</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="it">IT</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Séniorité</Label>
          <Select value={seniority} onValueChange={setSeniority}>
            <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="junior">Junior</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
          <div><Label>Auto-import</Label></div>
          <Switch checked={autoImport} onCheckedChange={setAutoImport} />
        </div>
      </div>
      <Button onClick={launch} disabled={loading} variant="hero" className="mt-4 w-full">
        <Search className="h-4 w-4" /> {loading ? "Recherche..." : "Trouver les emails"}
      </Button>
    </Card>
  );
}

import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  comingSoon: string;
  bullets: string[];
}

export function ComingSoon({ title, description, icon: Icon, comingSoon, bullets }: Props) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="p-6">
        <Card className="relative overflow-hidden p-10 text-center">
          <div className="gradient-radial absolute inset-0" />
          <div className="relative mx-auto max-w-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
              <Icon className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">{comingSoon}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              La base de données est prête, l'écran sera branché lors de la prochaine itération.
            </p>
            <ul className="mt-6 space-y-2 text-left text-sm text-muted-foreground">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full gradient-primary" />
                  {b}
                </li>
              ))}
            </ul>
            <Button variant="hero" className="mt-6" disabled>Bientôt disponible</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

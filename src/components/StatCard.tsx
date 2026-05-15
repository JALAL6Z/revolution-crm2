import { Card } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  variant?: "default" | "primary";
  prefix?: string;
  suffix?: string;
  delay?: number;
}

export function StatCard({
  title, value, icon: Icon, trend, trendUp, variant = "default",
  prefix = "", suffix = "", delay = 0,
}: StatCardProps) {
  const isNumeric = typeof value === "number";
  const animated = useCountUp(isNumeric ? (value as number) : 0);
  const display = isNumeric ? `${prefix}${animated.toLocaleString("fr-FR")}${suffix}` : value;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden p-5 transition-all duration-300 animate-fade-in",
        "hover:-translate-y-0.5 hover:shadow-elegant hover:border-primary/40",
        variant === "primary" && "border-primary/30 gradient-card",
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="gradient-radial absolute inset-0 opacity-50 transition-opacity duration-500 group-hover:opacity-80" />
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-all duration-500 group-hover:bg-primary/15" />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{display}</p>
          {trend && (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                trendUp === true && "text-success",
                trendUp === false && "text-destructive",
                trendUp === undefined && "text-muted-foreground",
              )}
            >
              {trendUp === true && <TrendingUp className="h-3 w-3" />}
              {trendUp === false && <TrendingDown className="h-3 w-3" />}
              {trend}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
            variant === "primary"
              ? "gradient-primary text-primary-foreground shadow-glow"
              : "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

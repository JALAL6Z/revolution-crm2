import logoMark from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Taille en hauteur (Tailwind class). Défaut h-10 */
  size?: string;
  /** Halo lumineux animé derrière l'icône */
  glow?: boolean;
  className?: string;
}

/**
 * Logo Revolution Agency — wordmark complet (gradient violet/bleu).
 * Ratio paysage ~5.5:1 → on contraint la hauteur, la largeur s'adapte.
 */
export function Logo({ size = "h-10", glow = false, className }: LogoProps) {
  return (
    <div className={cn("relative inline-flex items-center", size, className)}>
      {glow && (
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/40 blur-2xl animate-pulse-glow" />
      )}
      <img
        src={logoMark}
        alt="Revolution Agency"
        className="h-full w-auto object-contain drop-shadow-[0_4px_20px_hsl(var(--primary)/0.45)]"
        draggable={false}
      />
    </div>
  );
}

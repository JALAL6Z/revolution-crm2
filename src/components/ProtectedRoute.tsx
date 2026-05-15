import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
  const demoMode = demoEnabled && typeof window !== "undefined" && localStorage.getItem("demo_mode") === "1";

  if (demoMode) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-pulse-glow rounded-full gradient-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

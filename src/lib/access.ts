export type AppRole = "admin" | "setter" | "closer";

export const MEMBER_ROLES: AppRole[] = ["setter", "closer"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  setter: "Setter",
  closer: "Closer",
};

export function roleLabel(role?: string | null) {
  if (!role) return "Membre";
  return ROLE_LABELS[role as AppRole] ?? role;
}

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

export function isMemberRole(role?: string | null) {
  return role === "setter" || role === "closer";
}

export function canReceiveProspects(role?: string | null) {
  return role === "setter" || role === "closer";
}

export function canAccessPath(role: string | null | undefined, pathname: string) {
  if (!role || role === "admin") return true;
  return pathname === "/prospects"
    || pathname.startsWith("/prospects/")
    || pathname === "/commissions"
    || pathname === "/scripts"
    || pathname === "/agenda";
}

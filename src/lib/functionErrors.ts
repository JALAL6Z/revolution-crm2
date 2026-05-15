export async function functionErrorMessage(error: unknown, fallback = "Erreur") {
  if (!error) return fallback;

  const err = error as { message?: string; context?: Response };
  const response = err.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      // Keep the original Supabase error message below.
    }
  }

  return err.message ?? fallback;
}

// Extracts the real error body from a Supabase functions.invoke FunctionsHttpError.
// Without this, callers only see the generic "Edge Function returned a non-2xx status code".
export async function functionErrorMessage(error: any, fallback = "Something went wrong"): Promise<string> {
  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = await response.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      try {
        const text = await response.clone().text();
        if (text) return text;
      } catch { /* ignore */ }
    }
  }
  const msg = error?.message;
  return msg && !String(msg).includes("non-2xx") ? String(msg) : fallback;
}

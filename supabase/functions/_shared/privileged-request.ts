import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** A valid gateway JWT alone does not authorize privileged work. */
export async function authorizePrivilegedRequest(
  req: Request,
  supabase: SupabaseClient,
  allowAdmin = false,
): Promise<Response | null> {
  if (req.method !== "POST") {
    return Response.json({ error: "POST required" }, { status: 405, headers: { Allow: "POST" } });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const apiKey = req.headers.get("apikey") ?? "";
  const trusted = [Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""];
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    trusted.push(...Object.values(keys).filter((key): key is string => typeof key === "string"));
  } catch {
    // A malformed optional key map cannot authorize a request.
  }
  if (trusted.some((key) => key.length > 0 && (token === key || apiKey === key))) return null;
  // Cron may retain a valid service credential from before a key rotation.
  // Verify its service privileges with Auth; never trust decoded JWT claims.
  const url = Deno.env.get("SUPABASE_URL");
  if (url) {
    for (const candidate of new Set([token, apiKey])) {
      if (candidate.length > 4096 || !(candidate.startsWith("eyJ") || candidate.startsWith("sb_secret_"))) continue;
      try {
        const verifier = createClient(url, candidate, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await verifier.auth.admin.listUsers({ page: 1, perPage: 1 });
        // Auth's admin endpoint accepts service credentials only. User data is
        // discarded here and is never returned, logged, or used by the worker.
        if (!error && Array.isArray(data?.users)) return null;
      } catch {
        // Authentication failures and outages fail closed.
      }
    }
  }
  if (!allowAdmin || !token) return Response.json({ error: "Not authorized" }, { status: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Not authorized" }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("id", data.user.id).single();
  if (profileError || profile?.role !== "admin") {
    return Response.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

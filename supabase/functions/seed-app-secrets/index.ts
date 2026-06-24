import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const rows = [
      { key: "supabase_url", value: SUPABASE_URL },
      { key: "service_role_key", value: SERVICE_ROLE },
    ];
    for (const r of rows) {
      const { error } = await supabase
        .from("app_secrets")
        .upsert({ key: r.key, value: r.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    }
    return new Response(JSON.stringify({ ok: true, seeded: rows.map((r) => r.key) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

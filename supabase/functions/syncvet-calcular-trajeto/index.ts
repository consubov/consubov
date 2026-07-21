import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  origem_lat: z.number(),
  origem_lng: z.number(),
  destino_lat: z.number(),
  destino_lng: z.number(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { origem_lat, origem_lng, destino_lat, destino_lng } = parsed.data;

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origem_lat},${origem_lng}&destination=${destino_lat},${destino_lng}&mode=driving&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      return new Response(JSON.stringify({
        error: 'Não foi possível calcular o trajeto',
        google_status: data.status,
        google_message: data.error_message ?? null,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leg = data.routes[0].legs[0];
    const distancia_km = Math.round((leg.distance.value / 1000) * 100) / 100;
    const duracao_min = Math.round(leg.duration.value / 60);

    return new Response(JSON.stringify({
      distancia_km,
      duracao_min,
      origem_endereco: leg.start_address ?? null,
      destino_endereco: leg.end_address ?? null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('syncvet-calcular-trajeto error', err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { getSupabasePublishableKey } from '../_shared/apiKeys.ts';

const BodySchema = z.object({
  origem_lat: z.number().min(-90).max(90),
  origem_lng: z.number().min(-180).max(180),
  destino_lat: z.number().min(-90).max(90),
  destino_lng: z.number().min(-180).max(180),
});

// Haversine — distância em linha reta entre dois pontos (km)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // raio da Terra em km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Função pura de cálculo, sem escrita: somente POST (antes qualquer
  // método com corpo caía no fluxo; GET sem body estourava 500 com detalhe).
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      getSupabasePublishableKey((name) => Deno.env.get(name)),
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

    // Estimativa provisória via Haversine (linha reta).
    // Quando GOOGLE_MAPS_API_KEY estiver configurada, trocar para Google Directions.
    const distKm = haversineKm(origem_lat, origem_lng, destino_lat, destino_lng);
    const distancia_km = Math.round(distKm * 100) / 100;
    // Duração estimada assumindo velocidade média de 60 km/h (aproximação simples)
    const duracao_min = Math.round((distKm / 60) * 60);

    return new Response(JSON.stringify({
      distancia_km,
      duracao_min,
      origem_endereco: null,
      destino_endereco: null,
      fonte: 'haversine_estimativa',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Nunca devolver detalhe interno (antes: String(err) expunha mensagens
    // de validação/internas ao cliente).
    console.error('syncvet-calcular-trajeto error');
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

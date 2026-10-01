// Gera uma análise resumida do retiro a partir de observações livres do gestor
// usando o Lovable AI Gateway (Responses API, streaming consumido no servidor).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Limite generoso para o contexto serializado (indicadores do período).
// O chamador legítimo (AnaliseIaRetiroCard) envia um JSON pequeno; o teto
// existe para conter abuso de custo/latência da cota compartilhada de IA.
// [PENDENTE] rate-limit por usuário/tenant e política de retenção de dados
// enviados ao gateway externo: sem evidência de regra no repositório.
const MAX_CONTEXTO_CHARS = 8000;

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Sem efeito colateral, mas consome cota compartilhada de IA: somente POST.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  try {
    // Autenticação: exige JWT válido do chamador (defesa em profundidade
    // além do verify_jwt do gateway). Sem isso, qualquer portador de anon
    // key drenaria a cota de IA. Não confere papel/tenant aqui: sem
    // evidência de regra ([PENDENTE] documentado no inventário SEC-04).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      console.error("analisar-retiro: variáveis de ambiente ausentes");
      return json({ error: "Serviço de análise não configurado." }, 500);
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return json({ error: "Não autorizado" }, 401);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return json({ error: "Serviço de análise não configurado." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const observacoes = String(body?.observacoes ?? "").trim();
    const retiroNome = String(body?.retiroNome ?? "Retiro").slice(0, 120);
    const contexto = body?.contexto ?? null;

    if (observacoes.length < 10) {
      return json({ error: "Escreva um pouco mais nas observações." }, 400);
    }

    // Serializa uma vez para aplicar o teto antes de montar o prompt.
    const contextoTexto = contexto ? JSON.stringify(contexto) : "";
    if (contextoTexto.length > MAX_CONTEXTO_CHARS) {
      return json({ error: "Contexto grande demais para análise." }, 400);
    }

    const prompt = [
      `Retiro: ${retiroNome}`,
      contextoTexto ? `Indicadores do período (JSON): ${contextoTexto}` : "",
      "",
      "Observações do gestor:",
      observacoes.slice(0, 8000),
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableApiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low" },
        instructions:
          "Você é um consultor de pecuária de corte brasileiro. Analise as observações de campo de um retiro " +
          "e responda SEMPRE em português do Brasil, em markdown simples e objetivo, com no máximo 250 palavras, " +
          "nas seções: '## Resumo', '## Destaques', '## Possíveis problemas', '## Recomendações'. " +
          "Use listas curtas. Não invente dados que não estejam nas observações ou nos indicadores.",
        input: prompt,
      }),
    });

    if (!res.ok || !res.body) {
      const detalhe = await res.text().catch(() => "");
      // O detalhe do gateway pode ecoar o prompt (dados do retiro); fica
      // só no log do servidor, nunca na resposta ao cliente.
      console.error("AI gateway error", res.status, detalhe.slice(0, 500));
      const mensagem = res.status === 429
        ? "Muitas solicitações no momento. Tente novamente em instantes."
        : res.status === 402
        ? "Créditos de IA insuficientes para gerar a análise."
        : "Não foi possível gerar a análise agora.";
      // Mapeia somente os códigos com semântica conhecida; demais falhas
      // do provedor viram 502 (antes o status do gateway era repassado
      // diretamente ao cliente, expondo fingerprint do provedor).
      const status = res.status === 429 || res.status === 402 ? res.status : 502;
      return json({ error: mensagem }, status);
    }

    // Consome o SSE no servidor e devolve o texto final.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let texto = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const linhas = buffer.split("\n");
      buffer = linhas.pop() ?? "";
      for (const linha of linhas) {
        if (!linha.startsWith("data:")) continue;
        const payload = linha.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evento = JSON.parse(payload);
          if (evento?.type === "response.output_text.delta" && typeof evento.delta === "string") {
            texto += evento.delta;
          } else if (evento?.type === "response.completed" && !texto) {
            texto = evento?.response?.output_text ?? "";
          }
        } catch {
          // ignora fragmentos não-JSON
        }
      }
    }

    if (!texto.trim()) {
      return json({ error: "A análise voltou vazia. Tente reescrever as observações." }, 502);
    }

    return new Response(JSON.stringify({ analise: texto.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    console.error("analisar-retiro falhou");
    return json({ error: "Erro inesperado ao gerar a análise." }, 500);
  }
});

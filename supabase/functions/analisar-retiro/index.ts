// Gera uma análise resumida do retiro a partir de observações livres do gestor
// usando o Lovable AI Gateway (Responses API, streaming consumido no servidor).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "Serviço de análise não configurado." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const observacoes = String(body?.observacoes ?? "").trim();
    const retiroNome = String(body?.retiroNome ?? "Retiro").slice(0, 120);
    const contexto = body?.contexto ?? null;

    if (observacoes.length < 10) {
      return new Response(JSON.stringify({ error: "Escreva um pouco mais nas observações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = [
      `Retiro: ${retiroNome}`,
      contexto ? `Indicadores do período (JSON): ${JSON.stringify(contexto)}` : "",
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
      console.error("AI gateway error", res.status, detalhe);
      const mensagem = res.status === 429
        ? "Muitas solicitações no momento. Tente novamente em instantes."
        : res.status === 402
        ? "Créditos de IA insuficientes para gerar a análise."
        : "Não foi possível gerar a análise agora.";
      return new Response(JSON.stringify({ error: mensagem }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "A análise voltou vazia. Tente reescrever as observações." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ analise: texto.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analisar-retiro falhou:", e);
    return new Response(JSON.stringify({ error: "Erro inesperado ao gerar a análise." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

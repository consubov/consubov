/**
 * Contrato arquitetural abstrato para provedores de Inteligência Artificial (Port & Adapter).
 * Desacopla a aplicação do Lovable AI Gateway ou qualquer provedor proprietário.
 */

export interface AiRetiroRequest {
  retiroNome: string;
  observacoes: string;
  indicadores?: {
    totalAnimais?: number;
    consumoMedioGastoKg?: number;
    pesoMedioKg?: number;
    gmdEstimadoKgDia?: number;
    lotesAtivos?: number;
  };
  tenantId?: string;
}

export interface AiRetiroResponse {
  resumo: string;
  pontosAtencao: string[];
  recomendacoes: string[];
  provider: string;
  timestamp: string;
  isMock: boolean;
  tokensEstimados?: number;
}

export interface AIProviderPort {
  readonly providerName: string;
  analisarRetiro(request: AiRetiroRequest): Promise<AiRetiroResponse>;
}

export const MAX_AI_CONTEXT_CHARS = 8000;

/**
 * Higieniza e limita o contexto antes do envio para qualquer modelo de IA,
 * removendo dados pessoais sensíveis (PII) e contendo estritamente o tamanho.
 */
export function sanitizeAiContext(rawText: string, maxChars = MAX_AI_CONTEXT_CHARS): string {
  if (!rawText) return "";
  
  // Limpeza de caracteres de controle ASCII (exceto tab/LF/CR) sem regex de controle literal
  let sanitized = Array.from(rawText)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return !(code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f));
    })
    .join("")
    .trim();

  // Mascaramento básico de CPF para compliance LGPD
  sanitized = sanitized.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF_REMOVIDO]");

  // Mascaramento de emails
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REMOVIDO]");

  if (sanitized.length > maxChars) {
    sanitized = sanitized.slice(0, maxChars) + "... [CONTEXTO TRUNCADO]";
  }

  return sanitized;
}

/**
 * Adaptador local determinístico (Mock / Offline-First / Dry-Run)
 * Garante que a aplicação funcione em campo 100% offline ou sem chaves de API externas.
 */
export class LocalMockAIProvider implements AIProviderPort {
  readonly providerName = "local-deterministic-mock";

  async analisarRetiro(request: AiRetiroRequest): Promise<AiRetiroResponse> {
    const limpo = sanitizeAiContext(request.observacoes);
    const ind = request.indicadores;

    const resumo = `Análise descritiva local para o ${request.retiroNome}: ` +
      (ind?.totalAnimais != null ? `Manejo atual com ${ind.totalAnimais} cabeças registradas. ` : "") +
      (ind?.consumoMedioGastoKg != null ? `Consumo mineral/suplemento médio de ${ind.consumoMedioGastoKg.toFixed(2)} kg/cab. ` : "") +
      (limpo ? `Observações operacionais: "${limpo.slice(0, 160)}".` : "Sem anotações anômalas.");

    const pontosAtencao: string[] = [];
    if (ind?.consumoMedioGastoKg != null && ind.consumoMedioGastoKg < 0.05) {
      pontosAtencao.push("Alerta de subconsumo de suplemento no cocho.");
    }
    if (ind?.gmdEstimadoKgDia != null && ind.gmdEstimadoKgDia < 0.3) {
      pontosAtencao.push("GMD abaixo da meta zootécnica estabelecida.");
    }

    const recomendacoes: string[] = [
      "Verificar integridade da cerca e disponibilidade de água nos bebedouros.",
      "Conferir leitura de cocho no período matutino para ajuste de batelada.",
    ];

    return {
      resumo,
      pontosAtencao,
      recomendacoes,
      provider: this.providerName,
      timestamp: new Date().toISOString(),
      isMock: true,
      tokensEstimados: Math.ceil((limpo.length + resumo.length) / 4),
    };
  }
}


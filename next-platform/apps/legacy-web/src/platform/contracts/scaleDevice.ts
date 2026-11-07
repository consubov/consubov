/**
 * Contratos arquiteturais para comunicação com balanças bovinas eletrônicas e leitores RFID.
 * Isola o hardware físico por meio de interfaces abstratas com suporte a parsing determinístico.
 */

export type ScaleProtocol = "generic-ascii" | "tru-test" | "coimma" | "beckhauser";

export interface WeightReading {
  weightKg: number;
  isStable: boolean;
  rawString: string;
  timestamp: number;
  unit: "kg" | "lb";
  protocol: ScaleProtocol;
}

export interface ScaleDevicePort {
  readonly protocol: ScaleProtocol;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  onReading(callback: (reading: WeightReading) => void): () => void;
}

export interface RfidReading {
  epcOrId: string;
  timestamp: number;
  rawString: string;
}

export interface RfidReaderPort {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  onTagRead(callback: (reading: RfidReading) => void): () => void;
}

/**
 * Realiza o parsing de dados brutos seriais emitidos por balanças pecuárias.
 * Ignora caracteres de controle, ruídos e identifica se a pesagem atingiu estabilidade.
 */
export function parseScaleRawString(raw: string, protocol: ScaleProtocol = "generic-ascii"): WeightReading | null {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  let weightStr = "";
  let isStable = true;

  if (protocol === "tru-test") {
    // Protocolo Tru-Test típico: 'ST,GS,+00452.5,KG' ou 'US,GS,+00450.0,KG'
    const parts = trimmed.split(",");
    if (parts.length >= 3) {
      isStable = parts[0] === "ST";
      weightStr = parts[2].replace("+", "").trim();
    } else {
      // Fallback regex
      const match = trimmed.match(/([+-]?\d+(?:\.\d+)?)/);
      if (match) weightStr = match[1];
    }
  } else if (protocol === "coimma") {
    // Protocolo Coimma KM3 / KM2: caracteres fixos ex: 'P= 452.5kg' ou 'E 452.5'
    isStable = !trimmed.includes("?");
    const match = trimmed.match(/(\d+(?:[.,]\d+)?)/);
    if (match) weightStr = match[1].replace(",", ".");
  } else {
    // Genérico ASCII: extrai o primeiro número decimal válido (com sinal se houver)
    const match = trimmed.match(/([+-]?\d+(?:[.,]\d+)?)/);
    if (match) {
      weightStr = match[1].replace(",", ".");
    }
    // Indicador comum de instabilidade: caracteres como '~' ou '?'
    if (trimmed.includes("~") || trimmed.includes("?")) {
      isStable = false;
    }
  }

  const weightKg = parseFloat(weightStr);
  if (isNaN(weightKg) || weightKg < 0 || weightKg > 3500) {
    // Descarta leituras negativas ou animais com peso biológico impossível (> 3.500 kg)
    return null;
  }

  return {
    weightKg: Math.round(weightKg * 10) / 10,
    isStable,
    rawString: trimmed,
    timestamp: Date.now(),
    unit: "kg",
    protocol,
  };
}

/**
 * Adaptador simulador para ambientes de teste e validação de fluxo sem balança física conectada.
 */
export class LocalSimulatedScaleDevice implements ScaleDevicePort {
  readonly protocol: ScaleProtocol = "generic-ascii";
  private connected = false;
  private listeners: Array<(reading: WeightReading) => void> = [];

  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.listeners = [];
  }

  isConnected(): boolean {
    return this.connected;
  }

  onReading(callback: (reading: WeightReading) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  emitWeight(weightKg: number, isStable = true): void {
    if (!this.connected) return;
    const reading: WeightReading = {
      weightKg,
      isStable,
      rawString: `SIMULATED:${weightKg}kg`,
      timestamp: Date.now(),
      unit: "kg",
      protocol: this.protocol,
    };
    for (const listener of this.listeners) {
      listener(reading);
    }
  }
}

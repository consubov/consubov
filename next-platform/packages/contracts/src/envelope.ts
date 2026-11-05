export type ProductId = 'consubov' | 'relatto' | 'syncvet' | 'mais_arrobas';
export type UserProfileId = 'gerente' | 'capataz' | 'escritorio' | 'fabrica' | 'administrador';
export type CommandStatus = 'PENDENTE' | 'ENVIANDO' | 'SINCRONIZADO' | 'CONFLITO' | 'ERRO_FATAL';

export interface AttachmentRef {
  attachment_id: string; // UUID v4
  mime_type: string;     // ex: 'image/jpeg'
  size_bytes: number;    // bytes do arquivo
  hash_sha256: string;   // hash de integridade imutável (64 hex chars)
  local_blob_ref: string;// chave de armazenamento local
}

export interface AtomicCommandEnvelope<TPayload = Record<string, unknown>> {
  command_id: string;          // UUID v4 único da mutação
  idempotency_key: string;     // Chave de deduplicação idempotente (mínimo 16 chars)
  command_type: string;        // Nome qualificado (ex: 'capataz.salga.lancar')
  aggregate_type: string;      // Entidade afetada (ex: 'pasto', 'lote', 'cocho')
  aggregate_id: string;        // UUID v4 do agregado
  base_version: number;        // Versão esperada para Concorrência Otimista (>= 0)
  user_id: string;             // UUID do autor do comando
  tenant_id: string;           // UUID do tenant contratante
  product_id: ProductId;       // Produto ativo no ecossistema
  fazenda_id: string;          // UUID da fazenda ativa
  retiro_id: string | null;    // UUID do retiro (se aplicável)
  profile_id: UserProfileId;   // Perfil ativo emissor
  device_id: string;           // UUID do dispositivo local
  schema_version: number;      // Versão do schema do payload (inteiro >= 1)
  payload: TPayload;           // Dados validados da operação
  correlation_id: string;      // Rastreabilidade fim-a-fim (UUID)
  attachment_refs: AttachmentRef[]; // Anexos vinculados
  occurred_at_local: string;   // ISO 8601 da ocorrência no relógio local
  status: CommandStatus;       // Estado do ciclo de vida local
  attempts: number;            // Contador de retentativas (>= 0)
  last_attempt_at: string | null; // ISO 8601 da última tentativa
  error_message: string | null;// Mensagem detalhada se houver falha
}

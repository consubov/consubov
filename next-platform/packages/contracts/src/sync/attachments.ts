import { z } from 'zod';
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const attachmentUploadMetadataSchema = z.object({
  attachment_id: z.string().uuid(), mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES), hash_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  local_blob_ref: z.string().trim().min(1).max(512)
}).strict();
export type AttachmentUploadMetadata = z.infer<typeof attachmentUploadMetadataSchema>;

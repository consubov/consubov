export type ApiConsumer = {
  /**
   * Unique identifier for the API consumer.
   */
  consumerId: string;

  /**
   * Human-readable name for the API consumer.
   */
  name: string;

  /**
   * Tenant identifier. Nullable because global consumers may be allowed only by explicit rule.
   * When null, the consumer is not tied to a specific tenant and must follow global rules.
   */
  tenantId: string | null;

  /**
   * Scopes granted to this consumer. Reuses the existing PermissionScope contract (namespaced resource:action format).
   * Do not create a new catalog of scopes; reuse the same strings used elsewhere in the system.
   * Stored as readonly array to prevent accidental mutation.
   */
  scopes: readonly string[];

  /**
   * Current status of the consumer credentials.
   * 'active' - credentials are valid and can be used.
   * 'revoked' - credentials have been revoked and cannot be used.
   */
  status: 'active' | 'revoked';

  /**
   * Reference to the stored credential (e.g., key ID or hash reference).
   * Never store the actual secret in plain text; this is only a reference to the credential stored securely elsewhere.
   */
  credentialReference: string;

  /**
   * Timestamp when the consumer was created.
   */
  createdAt: Date;

  /**
   * Timestamp when the consumer was revoked (if applicable).
   * Null if the consumer is still active.
   */
  revokedAt: Date | null;

  /**
   * Timestamp when the consumer credentials expire (if applicable).
   * Null if the credentials do not expire or expiration is managed elsewhere.
   */
  expiresAt: Date | null;

  /**
   * Integration identifier indicating the origin or source of this consumer.
   * Used for auditing and tracking which system or integration created/uses this consumer.
   */
  origin: string;
};
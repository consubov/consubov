export interface FeatureFlagContext {
  tenantId?: string;
  userId?: string;
  [key: string]: any;
}

export interface FeatureFlagPort {
  isEnabled(flag: string, context?: FeatureFlagContext): Promise<boolean>;
}

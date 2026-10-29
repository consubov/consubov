export interface ApplicationReleaseCatalog {
  apps: Record<string, string | null>;
  sites: string[];
}
export declare function ensureBuildVersion(source: string, catalog: ApplicationReleaseCatalog, tags?: string[]): string;

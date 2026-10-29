import applicationReleases from "../../../../config/application-releases.json";

// Each application owns its release number. Sites have no SemVer.
export const APP_ID = "consubov-fazendas-app" as const;
export const APP_VERSION = applicationReleases.apps[APP_ID];

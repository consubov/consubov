import { createApiClient } from "./apiClient";
import { DEFAULT_API_TIMEOUT_MS, getApiBaseUrl } from "./apiConfig";

export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  defaultTimeoutMs: DEFAULT_API_TIMEOUT_MS,
});

export { createApiClient } from "./apiClient";
export type { ApiClientConfig, ApiRequestOptions } from "./apiClient";
export { ApiClientError } from "./apiError";
export type { ApiErrorPayload } from "./apiError";
export {
  DEFAULT_API_BASE_URL,
  DEFAULT_API_TIMEOUT_MS,
  getApiBaseUrl,
  normalizeApiBaseUrl,
} from "./apiConfig";

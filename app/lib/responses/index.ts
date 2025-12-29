/**
 * Responses Module
 * Story 25-1: Response Capture Endpoint
 *
 * Provides response storage and retrieval functionality
 * for Claude Code assistant responses.
 */

// Response storage
export {
  type StoreResponseParams,
  type StoreResponseResult,
  storeResponse,
  requestToStoreParams,
  linkResponseToPrompt,
  findResponseByMessageUuid,
} from "./store-response";

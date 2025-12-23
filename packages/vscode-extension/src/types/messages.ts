/**
 * Message types for extension-webview communication
 */

import { AnalyticsData } from "./index";
import { UserProfile } from "../services/auth";

/**
 * Messages sent from the extension to the webview
 */
export type ExtensionToWebviewMessage =
  | { type: "auth"; authenticated: boolean }
  | { type: "analytics"; data: AnalyticsData; user: UserProfile }
  | { type: "error"; message: string }
  | { type: "loading"; isLoading: boolean };

/**
 * Messages sent from the webview to the extension
 */
export type WebviewToExtensionMessage =
  | { type: "refresh" }
  | { type: "error"; error: string }
  | { type: "ready" };

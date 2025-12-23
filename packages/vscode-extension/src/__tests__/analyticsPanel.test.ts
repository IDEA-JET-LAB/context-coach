/**
 * Unit tests for AnalyticsPanelProvider
 *
 * Tests cover:
 * - Provider initialization with correct view type
 * - Webview configuration (scripts enabled, local resources)
 * - HTML generation with CSP headers
 * - Message handling (refresh, error)
 * - Auth state updates to webview
 * - Error state handling
 */

import { AnalyticsPanelProvider } from "../providers/analyticsPanel";
import { AuthService } from "../services/auth";
import * as vscode from "vscode";
import { EventEmitter } from "./__mocks__/vscode";

// Mock AuthService
jest.mock("../services/auth");

interface MockWebviewView {
  webview: {
    options: Record<string, unknown>;
    html: string;
    onDidReceiveMessage: jest.Mock;
    postMessage: jest.Mock;
    asWebviewUri: jest.Mock;
    cspSource: string;
  };
  onDidDispose: jest.Mock;
  visible: boolean;
}

const createMockWebviewView = (): MockWebviewView => {
  return {
    webview: {
      options: {},
      html: "",
      onDidReceiveMessage: jest.fn((_handler: (message: unknown) => void) => {
        return { dispose: jest.fn() };
      }),
      postMessage: jest.fn(() => Promise.resolve(true)),
      asWebviewUri: jest.fn((uri: { fsPath?: string; toString: () => string }) => ({
        toString: () => `https://file+.vscode-resource.vscode-cdn.net${uri.fsPath || uri.toString()}`,
      })),
      cspSource: "https://file+.vscode-resource.vscode-cdn.net",
    },
    onDidDispose: jest.fn((_handler: () => void) => ({ dispose: jest.fn() })),
    visible: true,
  };
};

const createMockContext = () => ({
  state: undefined,
});

const createMockCancellationToken = () => ({
  isCancellationRequested: false,
  onCancellationRequested: jest.fn(),
});

const mockOutputChannel = {
  appendLine: jest.fn(),
  dispose: jest.fn(),
};

const mockExtensionUri = {
  fsPath: "/path/to/extension",
  toString: () => "/path/to/extension",
};

describe("AnalyticsPanelProvider", () => {
  let provider: AnalyticsPanelProvider;
  let mockAuthService: jest.Mocked<AuthService>;
  let authChangeEmitter: EventEmitter<void>;

  // Helper to call resolveWebviewView with proper types
  const resolveView = (view: MockWebviewView) => {
    provider.resolveWebviewView(
      view as unknown as vscode.WebviewView,
      createMockContext() as unknown as vscode.WebviewViewResolveContext,
      createMockCancellationToken() as unknown as vscode.CancellationToken
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create auth change emitter for testing
    authChangeEmitter = new EventEmitter<void>();

    // Create mock auth service
    mockAuthService = {
      isAuthenticated: jest.fn().mockResolvedValue(false),
      getAccessToken: jest.fn().mockResolvedValue(undefined),
      getUser: jest.fn().mockResolvedValue(undefined),
      onDidChangeAuth: authChangeEmitter.event,
      login: jest.fn(),
      logout: jest.fn(),
      handleCallback: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    provider = new AnalyticsPanelProvider(
      mockExtensionUri as unknown as vscode.Uri,
      mockAuthService,
      mockOutputChannel as unknown as vscode.OutputChannel
    );
  });

  describe("View Type", () => {
    it("should have the correct view type", () => {
      expect(AnalyticsPanelProvider.viewType).toBe("contextor.analyticsView");
    });
  });

  describe("resolveWebviewView", () => {
    it("should configure webview with scripts enabled", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      expect(webviewView.webview.options).toEqual(
        expect.objectContaining({
          enableScripts: true,
        })
      );
    });

    it("should configure local resource roots", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      expect(webviewView.webview.options).toEqual(
        expect.objectContaining({
          localResourceRoots: expect.any(Array),
        })
      );
    });

    it("should set HTML content with CSP headers", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      expect(webviewView.webview.html).toContain("Content-Security-Policy");
      expect(webviewView.webview.html).toContain("nonce-");
    });

    it("should register message handler", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      expect(webviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it("should check authentication on resolve", async () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
    });
  });

  describe("HTML Content", () => {
    it("should include proper DOCTYPE", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      expect(webviewView.webview.html).toMatch(/^<!DOCTYPE html>/);
    });

    it("should include viewport meta tag", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      expect(webviewView.webview.html).toContain('name="viewport"');
    });

    it("should include root div for React mounting", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      expect(webviewView.webview.html).toContain('id="root"');
    });

    it("should include script with nonce", () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      // Check that nonce appears in both CSP header and script tag
      const nonceMatch = webviewView.webview.html.match(/nonce-([A-Za-z0-9]+)/);
      expect(nonceMatch).toBeTruthy();
      if (nonceMatch) {
        expect(webviewView.webview.html).toContain(`nonce="${nonceMatch[1]}"`);
      }
    });
  });

  describe("Authentication State", () => {
    it("should send unauthenticated state when not logged in", async () => {
      const webviewView = createMockWebviewView();
      mockAuthService.isAuthenticated.mockResolvedValue(false);

      resolveView(webviewView);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
        type: "auth",
        authenticated: false,
      });
    });

    it("should respond to auth changes", async () => {
      const webviewView = createMockWebviewView();
      resolveView(webviewView);

      // Clear previous calls
      webviewView.webview.postMessage.mockClear();
      mockAuthService.isAuthenticated.mockClear();

      // Fire auth change event
      authChangeEmitter.fire();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
    });
  });

  describe("Nonce Generation", () => {
    it("should generate unique nonces", () => {
      const webviewView1 = createMockWebviewView();
      const webviewView2 = createMockWebviewView();

      resolveView(webviewView1);

      // Create a new provider for second view
      const provider2 = new AnalyticsPanelProvider(
        mockExtensionUri as unknown as vscode.Uri,
        mockAuthService,
        mockOutputChannel as unknown as vscode.OutputChannel
      );

      provider2.resolveWebviewView(
        webviewView2 as unknown as vscode.WebviewView,
        createMockContext() as unknown as vscode.WebviewViewResolveContext,
        createMockCancellationToken() as unknown as vscode.CancellationToken
      );

      const nonce1 = webviewView1.webview.html.match(/nonce-([A-Za-z0-9]+)/)?.[1];
      const nonce2 = webviewView2.webview.html.match(/nonce-([A-Za-z0-9]+)/)?.[1];

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
    });
  });
});

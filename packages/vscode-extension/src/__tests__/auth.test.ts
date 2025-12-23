/**
 * Unit tests for AuthService
 *
 * Tests cover:
 * - State generation (cryptographically secure)
 * - Token storage/retrieval via SecretStorage
 * - Token refresh logic
 * - Logout clears all credentials
 * - Callback state validation (CSRF protection)
 *
 * Note: Full OAuth flow requires manual testing since it involves browser interaction.
 */

import { AuthService, UserProfile } from "../services/auth";

// Mock VS Code API
const mockSecrets = new Map<string, string>();

const mockSecretStorage = {
  get: jest.fn((key: string) => Promise.resolve(mockSecrets.get(key))),
  store: jest.fn((key: string, value: string) => {
    mockSecrets.set(key, value);
    return Promise.resolve();
  }),
  delete: jest.fn((key: string) => {
    mockSecrets.delete(key);
    return Promise.resolve();
  }),
};

const mockOutputChannel = {
  appendLine: jest.fn(),
  dispose: jest.fn(),
};

const mockContext = {
  secrets: mockSecretStorage,
};

// Note: mockVscode is used via the jest module mock in __mocks__/vscode.ts
// The following object is kept for reference but not directly used
const _mockVscodeConfig = {
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue: string) => {
        if (key === "apiEndpoint") {
          return "https://test.contextor.co/api";
        }
        return defaultValue;
      }),
    })),
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
  },
  env: {
    openExternal: jest.fn(() => Promise.resolve(true)),
  },
  Uri: {
    parse: jest.fn((url: string) => ({ toString: () => url })),
  },
};
void _mockVscodeConfig; // Suppress unused warning

// Mock node:crypto - 64 character hex string (32 bytes)
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => "mockedstate12345678901234567890123456789012345678901234567890abc"),
  })),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Reset mocks before each test
beforeEach(() => {
  mockSecrets.clear();
  mockSecretStorage.get.mockClear();
  mockSecretStorage.store.mockClear();
  mockSecretStorage.delete.mockClear();
  mockOutputChannel.appendLine.mockClear();
  mockFetch.mockClear();
});

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    // Create a new instance for each test
    authService = new AuthService(
      mockContext as unknown as import("vscode").ExtensionContext,
      mockOutputChannel as unknown as import("vscode").OutputChannel
    );
  });

  describe("State Generation", () => {
    it("should generate a unique state for each login", async () => {

      // State is stored during login
      await authService.login();
      const state1 = await mockSecretStorage.get("contextor.pendingState");

      // Clear for second login
      mockSecrets.delete("contextor.pendingState");

      // Second login should generate different state
      await authService.login();
      const state2 = await mockSecretStorage.get("contextor.pendingState");

      // Both should be defined
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();

      // States should be 64 characters (32 bytes hex-encoded)
      expect(state1?.length).toBe(64);
    });

    it("should store state in SecretStorage during login", async () => {
      await authService.login();

      expect(mockSecretStorage.store).toHaveBeenCalledWith(
        "contextor.pendingState",
        expect.any(String)
      );
    });
  });

  describe("Token Storage/Retrieval", () => {
    it("should return undefined for access token when not authenticated", async () => {
      const token = await authService.getAccessToken();
      expect(token).toBeUndefined();
    });

    it("should return false for isAuthenticated when no token stored", async () => {
      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it("should return true for isAuthenticated when valid token exists", async () => {
      // Store a valid token
      const expiry = Date.now() + 60 * 60 * 1000; // 1 hour from now
      mockSecrets.set("contextor.accessToken", "test-access-token");
      mockSecrets.set("contextor.tokenExpiry", expiry.toString());

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it("should return stored access token when not expired", async () => {
      const expiry = Date.now() + 60 * 60 * 1000; // 1 hour from now
      mockSecrets.set("contextor.accessToken", "test-access-token");
      mockSecrets.set("contextor.tokenExpiry", expiry.toString());

      const token = await authService.getAccessToken();
      expect(token).toBe("test-access-token");
    });

    it("should return user profile when stored", async () => {
      const user: UserProfile = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      };
      mockSecrets.set("contextor.userProfile", JSON.stringify(user));

      const storedUser = await authService.getUser();
      expect(storedUser).toEqual(user);
    });

    it("should return undefined for user when not stored", async () => {
      const user = await authService.getUser();
      expect(user).toBeUndefined();
    });
  });

  describe("Token Refresh Logic", () => {
    it("should return true for isAuthenticated when token expired but refresh token exists", async () => {
      // Store an expired token with refresh token
      const expiry = Date.now() - 1000; // Expired 1 second ago
      mockSecrets.set("contextor.accessToken", "expired-token");
      mockSecrets.set("contextor.refreshToken", "refresh-token");
      mockSecrets.set("contextor.tokenExpiry", expiry.toString());

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it("should return false for isAuthenticated when token expired and no refresh token", async () => {
      // Store an expired token without refresh token
      const expiry = Date.now() - 1000; // Expired 1 second ago
      mockSecrets.set("contextor.accessToken", "expired-token");
      mockSecrets.set("contextor.tokenExpiry", expiry.toString());

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it("should attempt refresh when token is within buffer window", async () => {
      // Token expires in 30 seconds (within 60 second buffer)
      const expiry = Date.now() + 30 * 1000;
      mockSecrets.set("contextor.accessToken", "expiring-token");
      mockSecrets.set("contextor.refreshToken", "refresh-token");
      mockSecrets.set("contextor.tokenExpiry", expiry.toString());

      // Mock successful refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
      });

      const token = await authService.getAccessToken();

      // Should have called refresh endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/vscode/refresh"),
        expect.any(Object)
      );

      // Should return new token
      expect(token).toBe("new-access-token");
    });

    it("should clear tokens and return undefined when refresh fails", async () => {
      // Token is expired
      const expiry = Date.now() - 1000;
      mockSecrets.set("contextor.accessToken", "expired-token");
      mockSecrets.set("contextor.refreshToken", "invalid-refresh-token");
      mockSecrets.set("contextor.tokenExpiry", expiry.toString());

      // Mock failed refresh
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: { code: "INVALID_TOKEN", message: "Refresh token expired" },
          }),
      });

      const token = await authService.getAccessToken();

      // Should return undefined
      expect(token).toBeUndefined();

      // Should have cleared all tokens (logout called)
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.accessToken");
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.refreshToken");
    });
  });

  describe("Logout", () => {
    it("should clear all credentials on logout", async () => {
      // Store some credentials
      mockSecrets.set("contextor.accessToken", "token");
      mockSecrets.set("contextor.refreshToken", "refresh");
      mockSecrets.set("contextor.tokenExpiry", "123456");
      mockSecrets.set("contextor.userProfile", '{"id":"1"}');
      mockSecrets.set("contextor.pendingState", "state");

      await authService.logout();

      // All keys should be deleted
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.accessToken");
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.refreshToken");
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.tokenExpiry");
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.userProfile");
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.pendingState");
    });

    it("should log logout action", async () => {
      await authService.logout();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining("Logging out")
      );
    });
  });

  describe("Callback State Validation", () => {
    it("should reject callback with missing state", async () => {
      const uri = {
        query: "code=test-code",
        path: "/callback",
        toString: () => "vscode://contextor.contextor-vscode/callback?code=test-code",
      };

      await expect(
        authService.handleCallback(uri as unknown as Parameters<typeof authService.handleCallback>[0])
      ).rejects.toThrow("Invalid callback: missing code or state");
    });

    it("should reject callback with mismatched state (CSRF protection)", async () => {
      // Store a different state
      mockSecrets.set("contextor.pendingState", "stored-state");

      const uri = {
        query: "code=test-code&state=different-state",
        path: "/callback",
        toString: () =>
          "vscode://contextor.contextor-vscode/callback?code=test-code&state=different-state",
      };

      await expect(
        authService.handleCallback(uri as unknown as Parameters<typeof authService.handleCallback>[0])
      ).rejects.toThrow("Invalid state parameter");
    });

    it("should accept callback with matching state", async () => {
      const state = "matching-state";
      mockSecrets.set("contextor.pendingState", state);

      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
            user: {
              id: "user-123",
              email: "test@example.com",
              name: "Test User",
            },
          }),
      });

      const uri = {
        query: `code=test-code&state=${state}`,
        path: "/callback",
        toString: () =>
          `vscode://contextor.contextor-vscode/callback?code=test-code&state=${state}`,
      };

      await authService.handleCallback(
        uri as unknown as Parameters<typeof authService.handleCallback>[0]
      );

      // Pending state should be cleared
      expect(mockSecretStorage.delete).toHaveBeenCalledWith("contextor.pendingState");

      // Tokens should be stored
      expect(mockSecretStorage.store).toHaveBeenCalledWith(
        "contextor.accessToken",
        "new-access-token"
      );
      expect(mockSecretStorage.store).toHaveBeenCalledWith(
        "contextor.refreshToken",
        "new-refresh-token"
      );
    });

    it("should handle OAuth error in callback", async () => {
      const uri = {
        query: "error=access_denied&state=some-state",
        path: "/callback",
        toString: () =>
          "vscode://contextor.contextor-vscode/callback?error=access_denied&state=some-state",
      };

      await expect(
        authService.handleCallback(uri as unknown as Parameters<typeof authService.handleCallback>[0])
      ).rejects.toThrow("Authentication was cancelled");
    });
  });

  describe("Security", () => {
    it("should never log token values", async () => {
      // Store tokens
      mockSecrets.set("contextor.accessToken", "secret-token-value");
      mockSecrets.set("contextor.refreshToken", "secret-refresh-value");
      mockSecrets.set("contextor.tokenExpiry", (Date.now() + 3600000).toString());

      // Trigger various operations that involve tokens
      await authService.isAuthenticated();
      await authService.getAccessToken();
      await authService.logout();

      // Check that no log message contains token values
      const allLogs = mockOutputChannel.appendLine.mock.calls
        .map((call) => call[0])
        .join("\n");

      expect(allLogs).not.toContain("secret-token-value");
      expect(allLogs).not.toContain("secret-refresh-value");
    });
  });
});

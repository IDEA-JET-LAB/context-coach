/**
 * Unit tests for SettingsService
 *
 * Tests cover:
 * - Default values when no settings configured
 * - Minimum refresh interval enforcement (15 seconds)
 * - Maximum refresh interval enforcement (300 seconds)
 * - Settings change event emission
 * - API endpoint URL validation
 * - Notification gating based on settings
 * - Settings validation on startup
 */

import {
  SettingsService,
  DEFAULT_SETTINGS,
  MIN_REFRESH_INTERVAL,
  MAX_REFRESH_INTERVAL,
  showInfo,
  showError,
} from "../services/settings";
import {
  mockConfigValues,
  resetMockConfig,
  simulateConfigChange,
  window as mockWindow,
} from "./__mocks__/vscode";

// Mock fetch for API validation tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("SettingsService", () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    // Reset singleton and mocks before each test
    SettingsService.resetInstance();
    resetMockConfig();
    mockFetch.mockClear();
    (mockWindow.showInformationMessage as jest.Mock).mockClear();
    (mockWindow.showWarningMessage as jest.Mock).mockClear();
    (mockWindow.showErrorMessage as jest.Mock).mockClear();

    settingsService = SettingsService.getInstance();
  });

  afterEach(() => {
    settingsService.dispose();
  });

  describe("Default Values", () => {
    it("should return default API endpoint when not configured", () => {
      mockConfigValues.apiEndpoint = undefined;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.apiEndpoint).toBe(DEFAULT_SETTINGS.apiEndpoint);
    });

    it("should return default refresh interval when not configured", () => {
      mockConfigValues.refreshInterval = undefined;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.refreshInterval).toBe(DEFAULT_SETTINGS.refreshInterval);
    });

    it("should return default notification preference when not configured", () => {
      mockConfigValues.showNotifications = undefined;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.showNotifications).toBe(DEFAULT_SETTINGS.showNotifications);
    });

    it("should return default status bar preference when not configured", () => {
      mockConfigValues.showStatusBarItem = undefined;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.showStatusBarItem).toBe(DEFAULT_SETTINGS.showStatusBarItem);
    });

    it("should return default auto-refresh preference when not configured", () => {
      mockConfigValues.autoRefreshEnabled = undefined;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.autoRefreshEnabled).toBe(DEFAULT_SETTINGS.autoRefreshEnabled);
    });

    it("should return all default values via getAll()", () => {
      mockConfigValues.apiEndpoint = DEFAULT_SETTINGS.apiEndpoint;
      mockConfigValues.refreshInterval = DEFAULT_SETTINGS.refreshInterval;
      mockConfigValues.showNotifications = DEFAULT_SETTINGS.showNotifications;
      mockConfigValues.showStatusBarItem = DEFAULT_SETTINGS.showStatusBarItem;
      mockConfigValues.autoRefreshEnabled = DEFAULT_SETTINGS.autoRefreshEnabled;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      const allSettings = settingsService.getAll();

      expect(allSettings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe("Refresh Interval Enforcement", () => {
    it("should enforce minimum refresh interval of 15 seconds", () => {
      mockConfigValues.refreshInterval = 5;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.refreshInterval).toBe(MIN_REFRESH_INTERVAL);
    });

    it("should enforce maximum refresh interval of 300 seconds", () => {
      mockConfigValues.refreshInterval = 500;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.refreshInterval).toBe(MAX_REFRESH_INTERVAL);
    });

    it("should allow values within valid range", () => {
      mockConfigValues.refreshInterval = 60;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.refreshInterval).toBe(60);
    });

    it("should return exactly the minimum value when set to minimum", () => {
      mockConfigValues.refreshInterval = MIN_REFRESH_INTERVAL;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.refreshInterval).toBe(MIN_REFRESH_INTERVAL);
    });

    it("should return exactly the maximum value when set to maximum", () => {
      mockConfigValues.refreshInterval = MAX_REFRESH_INTERVAL;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.refreshInterval).toBe(MAX_REFRESH_INTERVAL);
    });
  });

  describe("Settings Change Events", () => {
    it("should emit change event when API endpoint changes", () => {
      const changeHandler = jest.fn();
      settingsService.onDidChange(changeHandler);

      mockConfigValues.apiEndpoint = "https://new.endpoint.com/api";
      simulateConfigChange(["contextor.apiEndpoint"]);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          apiEndpoint: "https://new.endpoint.com/api",
        })
      );
    });

    it("should emit change event when refresh interval changes", () => {
      const changeHandler = jest.fn();
      settingsService.onDidChange(changeHandler);

      mockConfigValues.refreshInterval = 45;
      simulateConfigChange(["contextor.refreshInterval"]);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshInterval: 45,
        })
      );
    });

    it("should emit change event when notification preference changes", () => {
      const changeHandler = jest.fn();
      settingsService.onDidChange(changeHandler);

      mockConfigValues.showNotifications = false;
      simulateConfigChange(["contextor.showNotifications"]);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          showNotifications: false,
        })
      );
    });

    it("should emit change event when status bar preference changes", () => {
      const changeHandler = jest.fn();
      settingsService.onDidChange(changeHandler);

      mockConfigValues.showStatusBarItem = false;
      simulateConfigChange(["contextor.showStatusBarItem"]);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          showStatusBarItem: false,
        })
      );
    });

    it("should not emit event for non-contextor configuration changes", () => {
      const changeHandler = jest.fn();
      settingsService.onDidChange(changeHandler);

      simulateConfigChange(["editor.fontSize"]);

      expect(changeHandler).not.toHaveBeenCalled();
    });

    it("should emit enforced minimum value when below minimum is configured", () => {
      const changeHandler = jest.fn();
      settingsService.onDidChange(changeHandler);

      mockConfigValues.refreshInterval = 5;
      simulateConfigChange(["contextor.refreshInterval"]);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshInterval: MIN_REFRESH_INTERVAL,
        })
      );
    });
  });

  describe("API Endpoint Validation", () => {
    it("should validate valid HTTP URL", () => {
      expect(settingsService.isValidUrl("http://localhost:3000/api")).toBe(true);
    });

    it("should validate valid HTTPS URL", () => {
      expect(settingsService.isValidUrl("https://contextor.co/api")).toBe(true);
    });

    it("should reject invalid URL format", () => {
      expect(settingsService.isValidUrl("not-a-url")).toBe(false);
    });

    it("should reject FTP protocol", () => {
      expect(settingsService.isValidUrl("ftp://example.com/api")).toBe(false);
    });

    it("should reject file protocol", () => {
      expect(settingsService.isValidUrl("file:///path/to/file")).toBe(false);
    });

    it("should return default for invalid URL in settings", () => {
      mockConfigValues.apiEndpoint = "invalid-url";
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      expect(settingsService.apiEndpoint).toBe(DEFAULT_SETTINGS.apiEndpoint);
    });

    it("should validate API endpoint reachability with success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const isValid = await settingsService.validateApiEndpoint(
        "https://contextor.co/api"
      );

      expect(isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://contextor.co/api/health",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should return false for unreachable endpoint", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const isValid = await settingsService.validateApiEndpoint(
        "https://unreachable.example.com/api"
      );

      expect(isValid).toBe(false);
    });

    it("should return false for non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const isValid = await settingsService.validateApiEndpoint(
        "https://contextor.co/api"
      );

      expect(isValid).toBe(false);
    });

    it("should return false for invalid URL format", async () => {
      const isValid = await settingsService.validateApiEndpoint("not-a-url");

      expect(isValid).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Settings Validation", () => {
    it("should pass validation with default settings", () => {
      mockConfigValues.apiEndpoint = DEFAULT_SETTINGS.apiEndpoint;
      mockConfigValues.refreshInterval = DEFAULT_SETTINGS.refreshInterval;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      const result = settingsService.validateSettings();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should report error for invalid API endpoint URL", () => {
      mockConfigValues.apiEndpoint = "not-a-valid-url";
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      const result = settingsService.validateSettings();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid API endpoint URL: not-a-valid-url");
    });

    it("should report warning for refresh interval below minimum", () => {
      mockConfigValues.apiEndpoint = DEFAULT_SETTINGS.apiEndpoint;
      mockConfigValues.refreshInterval = 5;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      const result = settingsService.validateSettings();

      expect(result.isValid).toBe(true); // Below minimum is a warning, not an error
      expect(result.warnings).toContainEqual(
        expect.stringContaining("below minimum")
      );
    });

    it("should report warning for refresh interval above maximum", () => {
      mockConfigValues.apiEndpoint = DEFAULT_SETTINGS.apiEndpoint;
      mockConfigValues.refreshInterval = 500;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      const result = settingsService.validateSettings();

      expect(result.isValid).toBe(true); // Above maximum is a warning, not an error
      expect(result.warnings).toContainEqual(
        expect.stringContaining("above maximum")
      );
    });
  });

  describe("Notification Gating", () => {
    it("should show info message when notifications enabled", () => {
      mockConfigValues.showNotifications = true;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      settingsService.showInfo("Test message");

      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith("Test message");
    });

    it("should NOT show info message when notifications disabled", () => {
      mockConfigValues.showNotifications = false;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      settingsService.showInfo("Test message");

      expect(mockWindow.showInformationMessage).not.toHaveBeenCalled();
    });

    it("should show warning message when notifications enabled", () => {
      mockConfigValues.showNotifications = true;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      settingsService.showWarning("Warning message");

      expect(mockWindow.showWarningMessage).toHaveBeenCalledWith("Warning message");
    });

    it("should NOT show warning message when notifications disabled", () => {
      mockConfigValues.showNotifications = false;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      settingsService.showWarning("Warning message");

      expect(mockWindow.showWarningMessage).not.toHaveBeenCalled();
    });

    it("should ALWAYS show error message regardless of setting", () => {
      mockConfigValues.showNotifications = false;
      SettingsService.resetInstance();
      settingsService = SettingsService.getInstance();

      settingsService.showError("Error message");

      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith("Error message");
    });
  });

  describe("Convenience Functions", () => {
    it("showInfo() uses singleton instance", () => {
      mockConfigValues.showNotifications = true;
      SettingsService.resetInstance();
      SettingsService.getInstance(); // Initialize singleton

      showInfo("Convenience test");

      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith("Convenience test");
    });

    it("showError() uses singleton instance", () => {
      mockConfigValues.showNotifications = false;
      SettingsService.resetInstance();
      SettingsService.getInstance(); // Initialize singleton

      showError("Error test");

      expect(mockWindow.showErrorMessage).toHaveBeenCalledWith("Error test");
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance on multiple calls", () => {
      const instance1 = SettingsService.getInstance();
      const instance2 = SettingsService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after resetInstance()", () => {
      const instance1 = SettingsService.getInstance();
      SettingsService.resetInstance();
      const instance2 = SettingsService.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it("should properly dispose on resetInstance()", () => {
      const instance = SettingsService.getInstance();
      const changeHandler = jest.fn();
      instance.onDidChange(changeHandler);

      SettingsService.resetInstance();

      // After reset, changes should not trigger old handlers
      simulateConfigChange(["contextor.refreshInterval"]);
      expect(changeHandler).not.toHaveBeenCalled();
    });
  });

  describe("Caching", () => {
    it("should cache settings after first getAll() call", () => {
      const firstCall = settingsService.getAll();
      const secondCall = settingsService.getAll();

      expect(firstCall).toEqual(secondCall);
    });

    it("should invalidate cache on configuration change", () => {
      // Get initial settings
      const initialSettings = settingsService.getAll();

      // Change configuration
      mockConfigValues.refreshInterval = 60;
      simulateConfigChange(["contextor.refreshInterval"]);

      // Get updated settings
      const updatedSettings = settingsService.getAll();

      expect(updatedSettings.refreshInterval).toBe(60);
      expect(updatedSettings.refreshInterval).not.toBe(initialSettings.refreshInterval);
    });
  });
});

/**
 * Mock implementation of VS Code API for testing
 */

// Configuration change listeners
type ConfigChangeListener = (e: ConfigurationChangeEvent) => void;
const configChangeListeners: ConfigChangeListener[] = [];

export interface ConfigurationChangeEvent {
  affectsConfiguration(section: string): boolean;
}

// Mock configuration values that can be modified in tests
export const mockConfigValues: Record<string, unknown> = {
  apiEndpoint: "https://test.contextor.co/api",
  refreshInterval: 30,
  showNotifications: true,
  showStatusBarItem: true,
  autoRefreshEnabled: true,
};

export const workspace = {
  getConfiguration: jest.fn((_section?: string) => ({
    get: jest.fn((key: string, defaultValue: unknown) => {
      const value = mockConfigValues[key];
      return value !== undefined ? value : defaultValue;
    }),
  })),
  onDidChangeConfiguration: jest.fn((listener: ConfigChangeListener) => {
    configChangeListeners.push(listener);
    return {
      dispose: () => {
        const index = configChangeListeners.indexOf(listener);
        if (index >= 0) {
          configChangeListeners.splice(index, 1);
        }
      },
    };
  }),
};

/**
 * Helper function to simulate a configuration change in tests
 */
export function simulateConfigChange(changedSections: string[]): void {
  const event: ConfigurationChangeEvent = {
    affectsConfiguration: (section: string) =>
      changedSections.some((s) => s === section || s.startsWith(`${section}.`)),
  };
  configChangeListeners.forEach((listener) => listener(event));
}

/**
 * Reset mock configuration to defaults
 */
export function resetMockConfig(): void {
  mockConfigValues.apiEndpoint = "https://test.contextor.co/api";
  mockConfigValues.refreshInterval = 30;
  mockConfigValues.showNotifications = true;
  mockConfigValues.showStatusBarItem = true;
  mockConfigValues.autoRefreshEnabled = true;
}

export const window = {
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    dispose: jest.fn(),
  })),
  registerUriHandler: jest.fn(),
  registerWebviewViewProvider: jest.fn(),
};

export const env = {
  openExternal: jest.fn(() => Promise.resolve(true)),
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export const Uri = {
  parse: jest.fn((url: string) => ({
    toString: () => url,
    path: new URL(url).pathname,
    query: new URL(url).search.slice(1),
  })),
  joinPath: jest.fn((...segments: unknown[]) => ({
    fsPath: segments.join("/"),
    toString: () => segments.join("/"),
  })),
};

export type SecretStorage = {
  get: (key: string) => Promise<string | undefined>;
  store: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

export type ExtensionContext = {
  secrets: SecretStorage;
  subscriptions: { dispose: () => void }[];
  extensionUri: { fsPath: string; toString: () => string };
};

export type OutputChannel = {
  appendLine: (message: string) => void;
  dispose: () => void;
};

export type WebviewView = {
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
};

export type WebviewViewResolveContext = {
  state?: unknown;
};

export type CancellationToken = {
  isCancellationRequested: boolean;
  onCancellationRequested: jest.Mock;
};

export type Disposable = {
  dispose: () => void;
};

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (listener: (e: T) => void): Disposable => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  fire = (data: T): void => {
    this.listeners.forEach((listener) => listener(data));
  };

  dispose = (): void => {
    this.listeners = [];
  };
}

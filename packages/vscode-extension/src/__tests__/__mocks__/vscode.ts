/**
 * Mock implementation of VS Code API for testing
 */

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn((key: string, defaultValue: string) => {
      if (key === "apiEndpoint") {
        return "https://test.contextor.co/api";
      }
      return defaultValue;
    }),
  })),
};

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

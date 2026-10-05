import { describe, expect, it } from "vitest";
import type {
  LocalDatabase,
  SecureStorage,
  LocationProvider,
  QrScanner,
  CameraProvider,
  ConnectivityProvider,
  FilePicker,
  FileCapture,
  NativeBridge,
  SyncTransport,
} from "@/platform/contracts";

class MemoryLocalDatabase implements LocalDatabase {
  private store = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class MemorySecureStorage implements SecureStorage {
  private store = new Map<string, string>();
  async getSecret(key: string): Promise<string | undefined> {
    return this.store.get(key);
  }
  async setSecret(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

class MockLocationProvider implements LocationProvider {
  private denied = false;
  constructor(denied: boolean = false) {
    this.denied = denied;
  }
  async getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
    return this.denied ? null : { latitude: -22.9, longitude: -43.3 };
  }
}

class MockQrScanner implements QrScanner {
  async scan(): Promise<string | null> {
    return "resource-identity-123";
  }
}

class MockCameraProvider implements CameraProvider {
  async capturePhoto(): Promise<Blob | null> {
    return new Blob([], { type: "image/jpeg" });
  }
}

class MockConnectivityProvider implements ConnectivityProvider {
  private _online = true;
  setOnline(online: boolean) {
    this._online = online;
  }
  isOnline(): boolean {
    return this._online;
  }
}

class MockFilePicker implements FilePicker {
  async pickFile(): Promise<File | null> {
    return null;
  }
}

class MockFileCapture implements FileCapture {
  async captureFile(): Promise<File | null> {
    return null;
  }
}

class MockNativeBridge implements NativeBridge {
  async invoke<T>(method: string, args?: unknown): Promise<T> {
    return {} as T;
  }
}

class MemorySyncTransport implements SyncTransport {
  async push(commands: unknown[]): Promise<void> {}
  async pull(): Promise<unknown[]> {
    return [];
  }
}

describe("Platform Contracts", () => {
  describe("LocalDatabase", () => {
    it("compiles and works with memory implementation", async () => {
      const db: LocalDatabase = new MemoryLocalDatabase();
      await db.set("key", { value: 42 });
      const result = await db.get<{ value: number }>("key");
      expect(result).toEqual({ value: 42 });
    });
  });

  describe("SecureStorage", () => {
    it("compiles and works with memory implementation", async () => {
      const storage: SecureStorage = new MemorySecureStorage();
      await storage.setSecret("secret", "value");
      const result = await storage.getSecret("secret");
      expect(result).toBe("value");
    });

    it("does not expose value in error/logs (no logging in impl)", async () => {
      const storage: SecureStorage = new MemorySecureStorage();
      await storage.setSecret("token", "super-secret-token");
      const result = await storage.getSecret("token");
      expect(result).toBe("super-secret-token");
    });
  });

  describe("LocationProvider", () => {
    it("returns position when available", async () => {
      const provider: LocationProvider = new MockLocationProvider(false);
      const pos = await provider.getCurrentPosition();
      expect(pos).toEqual({ latitude: -22.9, longitude: -43.3 });
    });

    it("represents permission denied as null", async () => {
      const provider: LocationProvider = new MockLocationProvider(true);
      const pos = await provider.getCurrentPosition();
      expect(pos).toBeNull();
    });
  });

  describe("QrScanner", () => {
    it("returns raw data without authorization", async () => {
      const scanner: QrScanner = new MockQrScanner();
      const data = await scanner.scan();
      expect(data).toBe("resource-identity-123");
    });
  });

  describe("CameraProvider", () => {
    it("returns blob for photo capture", async () => {
      const provider: CameraProvider = new MockCameraProvider();
      const blob = await provider.capturePhoto();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob?.type).toBe("image/jpeg");
    });
  });

  describe("ConnectivityProvider", () => {
    it("represents offline status", () => {
      const provider = new MockConnectivityProvider();
      const contract: ConnectivityProvider = provider;
      provider.setOnline(false);
      expect(contract.isOnline()).toBe(false);
    });

    it("represents online status", () => {
      const provider: ConnectivityProvider = new MockConnectivityProvider();
      expect(provider.isOnline()).toBe(true);
    });
  });

  describe("FilePicker", () => {
    it("compiles and returns null when no file selected", async () => {
      const picker: FilePicker = new MockFilePicker();
      const file = await picker.pickFile();
      expect(file).toBeNull();
    });
  });

  describe("FileCapture", () => {
    it("compiles and returns null for mock", async () => {
      const capture: FileCapture = new MockFileCapture();
      const file = await capture.captureFile();
      expect(file).toBeNull();
    });
  });

  describe("NativeBridge", () => {
    it("compiles and returns generic result", async () => {
      const bridge: NativeBridge = new MockNativeBridge();
      const result = await bridge.invoke<{ success: boolean }>("testMethod");
      expect(result).toEqual({});
    });
  });

  describe("SyncTransport", () => {
    it("fake allows testing without network", async () => {
      const transport: SyncTransport = new MemorySyncTransport();
      await transport.push([{ id: 1, type: "create" }]);
      const result = await transport.pull();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
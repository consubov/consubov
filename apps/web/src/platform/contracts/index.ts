export interface LocalDatabase {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface SecureStorage {
  getSecret(key: string): Promise<string | undefined>;
  setSecret(key: string, value: string): Promise<void>;
}

export interface LocationProvider {
  getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null>;
}

export interface QrScanner {
  scan(): Promise<string | null>;
}

export interface CameraProvider {
  capturePhoto(): Promise<Blob | null>;
}

export interface ConnectivityProvider {
  isOnline(): boolean;
}

export interface FilePicker {
  pickFile(): Promise<File | null>;
}

export interface FileCapture {
  captureFile(): Promise<File | null>;
}

export interface NativeBridge {
  invoke<T>(method: string, args?: any): Promise<T>;
}

export interface SyncTransport {
  push(commands: unknown[]): Promise<void>;
  pull(): Promise<unknown[]>;
}
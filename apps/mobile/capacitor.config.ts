/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.consubov.app",
  appName: "Consubov",
  webDir: "../web/dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SQLite: {
      databaseVersion: 1,
      driver: "sqlite3",
    },
    BarcodeScanner: {
      cameraPermissionDeniedMessage: "Permissão de câmera necessária para escanear QR codes",
    },
    Camera: {
      // Configurações padrão
    },
    Geolocation: {
      // Configurações padrão
    },
    Preferences: {
      // Configurações padrão
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
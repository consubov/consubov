import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScanLine, X } from "lucide-react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

interface QrScannerProps {
  onScan: (qrUuid: string) => void;
  onManualSelect?: () => void;
  onBack: () => void;
}


// Declare BarcodeDetector for TypeScript
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => {
      detect: (source: HTMLVideoElement | ImageBitmap | HTMLCanvasElement) => Promise<{ rawValue: string }[]>;
    };
  }
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
    },
  },
  {
    audio: false,
    video: {
      facingMode: "environment",
    },
  },
  {
    audio: false,
    video: true,
  },
];

const VIDEO_METADATA_READY = 1;
const VIDEO_CURRENT_DATA_READY = 2;
const VIDEO_READY_TIMEOUT_MS = 2000;
const BARCODE_SCAN_INTERVAL_MS = 180;

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Não foi possível acessar a câmera. Permita o uso da câmera nas configurações do navegador e tente novamente.";
    }

    if (error.name === "NotReadableError" || error.name === "AbortError") {
      return "A câmera está ocupada ou não conseguiu iniciar completamente. Feche outros apps que usem a câmera e tente novamente.";
    }

    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "Não encontramos uma câmera compatível com este dispositivo. Tente novamente ou selecione o pasto manualmente.";
    }
  }

  return "Não foi possível abrir a câmera neste dispositivo. Tente novamente ou selecione o pasto manualmente.";
}

function waitForVideoReadyState(video: HTMLVideoElement, minimumReadyState: number) {
  return new Promise<void>((resolve) => {
    if (video.readyState >= minimumReadyState) {
      resolve();
      return;
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("playing", handleReady);
    };

    const finish = () => {
      cleanup();
      resolve();
    };

    const handleReady = () => {
      if (video.readyState >= minimumReadyState) {
        finish();
      }
    };

    const timeoutId = window.setTimeout(finish, VIDEO_READY_TIMEOUT_MS);

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("playing", handleReady);
  });
}

export default function QrScanner({ onScan, onManualSelect, onBack }: QrScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const detectorTimerRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const clearDetectorTimer = useCallback(() => {
    if (detectorTimerRef.current !== null) {
      window.clearTimeout(detectorTimerRef.current);
      detectorTimerRef.current = null;
    }
  }, []);

  const resetVideoElement = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.srcObject = null;
    video.load();
  }, []);

  const stopScanner = useCallback(() => {
    activeRef.current = false;
    clearDetectorTimer();

    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
      scannerControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    resetVideoElement();
    setScanning(false);
  }, [clearDetectorTimer, resetVideoElement]);

  const waitForVideoElement = useCallback(() => {
    return new Promise<HTMLVideoElement>((resolve, reject) => {
      let attempts = 0;

      const checkVideo = () => {
        if (!activeRef.current) {
          reject(new Error("Scanner interrompido."));
          return;
        }

        if (videoRef.current) {
          resolve(videoRef.current);
          return;
        }

        attempts += 1;
        if (attempts > 120) {
          reject(new Error("Elemento de vídeo indisponível."));
          return;
        }

        window.requestAnimationFrame(checkVideo);
      };

      checkVideo();
    });
  }, []);

  const openCameraStream = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      throw new Error("Camera API indisponível neste navegador.");
    }

    // iOS Safari sometimes requires a tick after a user gesture before
    // getUserMedia resolves cleanly when the page has been idle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    let lastError: unknown = null;

    for (const constraints of CAMERA_CONSTRAINTS) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;

        if (
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "SecurityError")
        ) {
          break;
        }
      }
    }

    throw lastError ?? new Error("Não foi possível abrir a câmera.");
  }, []);

  const attachStreamToVideo = useCallback(async (video: HTMLVideoElement, stream: MediaStream) => {
    video.setAttribute("autoplay", "true");
    video.setAttribute("muted", "true");
    video.setAttribute("playsinline", "true");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await waitForVideoReadyState(video, VIDEO_METADATA_READY);

    try {
      await video.play();
    } catch {
      await waitForVideoReadyState(video, VIDEO_CURRENT_DATA_READY);
      await video.play();
    }

    await waitForVideoReadyState(video, VIDEO_CURRENT_DATA_READY);
  }, []);

  const startNativeDetector = useCallback((video: HTMLVideoElement) => {
    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });

    const scanFrame = async () => {
      if (!activeRef.current) return;

      try {
        const codes = await detector.detect(video);
        const qrValue = codes.find((code) => code.rawValue)?.rawValue;

        if (qrValue) {
          stopScanner();
          onScan(qrValue);
          return;
        }
      } catch {
        // mantém a varredura ativa mesmo se o detector falhar em um frame específico
      }

      if (activeRef.current) {
        detectorTimerRef.current = window.setTimeout(() => {
          void scanFrame();
        }, BARCODE_SCAN_INTERVAL_MS);
      }
    };

    void scanFrame();
  }, [onScan, stopScanner]);

  const startZxingDetector = useCallback(async (video: HTMLVideoElement) => {
    const codeReader = new BrowserQRCodeReader();

    const controls = await codeReader.decodeFromVideoElement(video, (result, _decodeError, activeControls) => {
      scannerControlsRef.current = activeControls;

      if (result?.getText()) {
        activeControls.stop();
        scannerControlsRef.current = null;
        stopScanner();
        onScan(result.getText());
      }
    });

    scannerControlsRef.current = controls;
  }, [onScan, stopScanner]);

  const startScanner = useCallback(async () => {
    if (activeRef.current) return;

    setError(null);
    setScanning(true);
    activeRef.current = true;

    try {
      const video = await waitForVideoElement();
      const stream = await openCameraStream();

      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      await attachStreamToVideo(video, stream);

      // Try native BarcodeDetector first (works offline)
      if (window.BarcodeDetector) {
        startNativeDetector(video);
      } else {
        await startZxingDetector(video);
      }
    } catch (scanError) {
      stopScanner();
      setFailCount((c) => c + 1);
      setError(getCameraErrorMessage(scanError));
    }
  }, [attachStreamToVideo, openCameraStream, startNativeDetector, startZxingDetector, stopScanner, waitForVideoElement]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  const showManualFallback = failCount >= 3;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { stopScanner(); onBack(); }}
          className="text-primary-foreground hover:bg-primary/80"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Escanear QR Code</h1>
      </header>

      {!scanning && !showManualFallback && (
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-48 h-48 rounded-2xl border-4 border-dashed border-primary/30 flex items-center justify-center">
            <ScanLine className="w-20 h-20 text-primary/40" />
          </div>
          <Button onClick={startScanner} className="w-full max-w-xs gap-2" size="lg">
            <ScanLine className="w-5 h-5" />
            ESCANEAR QR CODE
          </Button>
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          {failCount > 0 && failCount < 3 && (
            <p className="text-muted-foreground text-xs">Tentativa {failCount}/3</p>
          )}
          {onManualSelect && (
            <Button variant="link" onClick={onManualSelect} className="text-muted-foreground text-xs">
              Selecionar pasto manualmente
            </Button>
          )}
        </main>
      )}


      {scanning && (
        <main className="flex-1 flex flex-col relative bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {/* Scanning overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/70 rounded-xl shadow-lg" />
          </div>
          <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-auto px-4">
            <Button variant="secondary" onClick={stopScanner} className="w-full max-w-xs gap-2">
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        </main>
      )}

      {showManualFallback && (
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-4 text-center space-y-3">
              <p className="text-destructive font-semibold text-sm">
                🔴 QR Code não lido após {failCount} tentativas
              </p>
              {onManualSelect && (
                <Button onClick={onManualSelect} className="w-full" variant="secondary">
                  Selecionar pasto manualmente
                </Button>
              )}
              <Button
                onClick={() => { setFailCount(0); setError(null); }}
                variant="outline"
                className="w-full"
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </main>
      )}

    </div>
  );
}

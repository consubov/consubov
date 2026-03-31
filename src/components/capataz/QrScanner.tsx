import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScanLine, X } from "lucide-react";

interface QrScannerProps {
  onScan: (qrUuid: string) => void;
  onManualSelect: () => void;
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

export default function QrScanner({ onScan, onManualSelect, onBack }: QrScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);

  const stopScanner = useCallback(() => {
    activeRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setScanning(true);
    activeRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Try native BarcodeDetector first (works offline)
      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => {
          if (!activeRef.current || !videoRef.current?.videoWidth) {
            if (activeRef.current) requestAnimationFrame(scan);
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              stopScanner();
              onScan(codes[0].rawValue);
              return;
            }
          } catch {
            // detection error, retry
          }
          if (activeRef.current) requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);
      } else {
        // Fallback to zxing (requires network for first load)
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const codeReader = new BrowserMultiFormatReader();
          const controls = await codeReader.decodeFromStream(stream, videoRef.current!, (result) => {
            if (result) {
              controls.stop();
              stopScanner();
              onScan(result.getText());
            }
          });
          // Store stop for cleanup
          const origStop = stopScanner;
          streamRef.current = stream;
        } catch {
          stopScanner();
          setFailCount((c) => c + 1);
          setError("Leitor QR indisponível offline neste dispositivo. Selecione o pasto manualmente.");
        }
      }
    } catch {
      setScanning(false);
      activeRef.current = false;
      setFailCount((c) => c + 1);
      setError(
        "Não foi possível acessar a câmera. Acesse pelo Safari e permita o uso da câmera nas configurações do site."
      );
    }
  }, [onScan, stopScanner]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

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
          <Button variant="link" onClick={onManualSelect} className="text-muted-foreground text-xs">
            Selecionar pasto manualmente
          </Button>
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
              <Button onClick={onManualSelect} className="w-full" variant="secondary">
                Selecionar pasto manualmente
              </Button>
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

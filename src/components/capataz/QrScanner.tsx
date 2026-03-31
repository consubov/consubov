import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScanLine, X } from "lucide-react";

interface QrScannerProps {
  onScan: (qrUuid: string) => void;
  onManualSelect: () => void;
  onBack: () => void;
}

export default function QrScanner({ onScan, onManualSelect, onBack }: QrScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const codeReader = new BrowserMultiFormatReader();
      const controls = await codeReader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, err) => {
          if (result) {
            controls.stop();
            controlsRef.current = null;
            setScanning(false);
            onScan(result.getText());
          }
          // ignore decode errors (no QR found in frame)
        }
      );
      controlsRef.current = controls;
    } catch {
      setScanning(false);
      setFailCount((c) => c + 1);
      setError(
        "Não foi possível acessar a câmera. Acesse pelo Safari e permita o uso da câmera nas configurações do site."
      );
    }
  }, [onScan]);

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, []);

  const showManualFallback = failCount >= 5;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
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

      <main className="flex-1 px-4 py-6 flex flex-col items-center gap-4">
        {!scanning && !showManualFallback && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-48 h-48 rounded-2xl border-4 border-dashed border-primary/30 flex items-center justify-center">
              <ScanLine className="w-20 h-20 text-primary/40" />
            </div>
            <Button onClick={startScanner} className="w-full max-w-xs gap-2" size="lg">
              <ScanLine className="w-5 h-5" />
              ESCANEAR QR CODE
            </Button>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {failCount > 0 && failCount < 5 && (
              <p className="text-muted-foreground text-xs">Tentativa {failCount}/5</p>
            )}
          </div>
        )}

        {scanning && (
          <div className="w-full max-w-sm">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-white/60 rounded-xl" />
              </div>
            </div>
            <Button variant="outline" onClick={stopScanner} className="w-full mt-4 gap-2">
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        )}

        {showManualFallback && (
          <Card className="w-full max-w-sm">
            <CardContent className="p-4 text-center space-y-3">
              <p className="text-destructive font-semibold text-sm">
                🔴 QR Code não lido após 5 tentativas
              </p>
              <Button onClick={onManualSelect} className="w-full" variant="secondary">
                Selecionar pasto manualmente
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

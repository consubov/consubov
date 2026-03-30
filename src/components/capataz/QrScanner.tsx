import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
    setError(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          setScanning(false);
          onScan(decodedText);
        },
        () => {
          // ignore scan failures
        }
      );
    } catch (err) {
      setScanning(false);
      setFailCount((c) => c + 1);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleRetry = () => {
    setFailCount((c) => c + 1);
    startScanner();
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const showManualFallback = failCount >= 5;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { stopScanner(); onBack(); }} className="text-primary-foreground hover:bg-primary/80">
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
            <div id="qr-reader" ref={containerRef} className="rounded-xl overflow-hidden" />
            <Button variant="outline" onClick={stopScanner} className="w-full mt-4 gap-2">
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        )}

        {showManualFallback && (
          <Card className="w-full max-w-sm">
            <CardContent className="p-4 text-center space-y-3">
              <p className="text-destructive font-semibold text-sm">🔴 QR Code não lido após 5 tentativas</p>
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

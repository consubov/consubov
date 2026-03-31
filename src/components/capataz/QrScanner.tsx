import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScanLine, X, Camera, Upload } from "lucide-react";

interface QrScannerProps {
  onScan: (qrUuid: string) => void;
  onManualSelect: () => void;
  onBack: () => void;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function QrScanner({ onScan, onManualSelect, onBack }: QrScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useFileInput, setUseFileInput] = useState(false);
  const [processing, setProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stoppedRef = useRef(false);

  const stopCamera = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const scanFrame = useCallback(() => {
    if (stoppedRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code?.data) {
      stopCamera();
      onScan(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    setError(null);
    stoppedRef.current = false;
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        rafRef.current = requestAnimationFrame(scanFrame);
      }
    } catch {
      stopCamera();
      if (isIOS()) {
        setUseFileInput(true);
        setError(null);
      } else {
        setFailCount((c) => c + 1);
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    }
  }, [scanFrame, stopCamera]);

  const startScanner = useCallback(() => {
    if (isIOS()) {
      setUseFileInput(true);
    } else {
      startCamera();
    }
  }, [startCamera]);

  const processImage = useCallback(
    (file: File) => {
      setProcessing(true);
      setError(null);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setProcessing(false);
          setFailCount((c) => c + 1);
          setError("Erro ao processar imagem.");
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        setProcessing(false);
        if (code?.data) {
          onScan(code.data);
        } else {
          setFailCount((c) => c + 1);
          setError("QR Code não encontrado na imagem. Tente novamente.");
        }
      };
      img.onerror = () => {
        setProcessing(false);
        setFailCount((c) => c + 1);
        setError("Erro ao carregar a imagem.");
      };
      img.src = URL.createObjectURL(file);
    },
    [onScan]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
      if (e.target) e.target.value = "";
    },
    [processImage]
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const showManualFallback = failCount >= 5;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { stopCamera(); onBack(); }}
          className="text-primary-foreground hover:bg-primary/80"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Escanear QR Code</h1>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col items-center gap-4">
        {/* Initial state — not scanning, not file input, not manual fallback */}
        {!scanning && !useFileInput && !showManualFallback && (
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

        {/* Live camera mode (Android / desktop) */}
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
            <canvas ref={canvasRef} className="hidden" />
            <Button variant="outline" onClick={stopCamera} className="w-full mt-4 gap-2">
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        )}

        {/* iOS file input mode */}
        {useFileInput && !showManualFallback && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-48 h-48 rounded-2xl border-4 border-dashed border-primary/30 flex items-center justify-center">
              <Camera className="w-20 h-20 text-primary/40" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Tire uma foto do QR Code para leitura automática
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-xs gap-2"
              size="lg"
              disabled={processing}
            >
              {processing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Processando...
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  TIRAR FOTO DO QR CODE
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                  fileInputRef.current.setAttribute("capture", "environment");
                }
              }}
              className="text-muted-foreground gap-1"
            >
              <Upload className="w-4 h-4" />
              Escolher da galeria
            </Button>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {failCount > 0 && failCount < 5 && (
              <p className="text-muted-foreground text-xs">Tentativa {failCount}/5</p>
            )}
          </div>
        )}

        {/* Manual fallback after 5 failures */}
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

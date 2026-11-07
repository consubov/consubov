import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CapatazCameraCaptureProps {
  label: string;
  onPhoto: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

type CameraStatus = "opening" | "ready" | "processing" | "error";

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Acesso à câmera negado. Autorize a câmera nas permissões do aplicativo. [CAM01]";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Nenhuma câmera disponível neste aparelho. [CAM02]";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "A câmera está ocupada. Feche outros aplicativos que estejam usando a câmera e tente novamente. [CAM03]";
  }
  return "Não foi possível iniciar a câmera. Tente novamente. [CAM04]";
}

export default function CapatazCameraCapture({ label, onPhoto, onClose }: CapatazCameraCaptureProps) {
  const [status, setStatus] = useState<CameraStatus>("opening");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const attemptRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    const attempt = ++attemptRef.current;
    stopTracks();
    setStatus("opening");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("MEDIA_UNAVAILABLE");
      }
      // Keep the stream inside the PWA. Opening the Android native file picker
      // can background/unmount the form before it receives the photograph.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      if (attempt !== attemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (document.visibilityState === "hidden") {
        stream.getTracks().forEach((track) => track.stop());
        setStatus("error");
        setError("A câmera foi interrompida. Toque em Tentar novamente. [CAM05]");
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("VIDEO_UNMOUNTED");
      video.srcObject = stream;
      await video.play();
      if (attempt === attemptRef.current && video.videoWidth > 0 && video.videoHeight > 0) {
        setStatus("ready");
      }
    } catch (reason) {
      if (attempt !== attemptRef.current) return;
      stopTracks();
      setStatus("error");
      setError(cameraErrorMessage(reason));
    }
  }, [stopTracks]);

  useEffect(() => {
    const session = attemptRef;
    void startCamera();
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && streamRef.current) {
        ++attemptRef.current;
        stopTracks();
        setStatus("error");
        setError("A câmera foi interrompida. Toque em Tentar novamente. [CAM05]");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      ++session.current;
      document.removeEventListener("visibilitychange", onVisibility);
      stopTracks();
    };
  }, [startCamera, stopTracks]);

  const takePhoto = async () => {
    if (status !== "ready") return;
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      setError("Aguarde a câmera mostrar a imagem antes de fotografar. [CAM06]");
      return;
    }

    setStatus("processing");
    setError(null);
    try {
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("CANVAS_UNAVAILABLE");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("EMPTY_FRAME")), "image/jpeg", 0.82);
      });
      canvas.width = 0;
      canvas.height = 0;
      if (blob.size === 0) throw new Error("EMPTY_PHOTO");
      await onPhoto(blob);
      onClose();
    } catch (reason) {
      setStatus("ready");
      setError(reason instanceof Error && reason.message.startsWith("Não foi possível")
        ? reason.message : "Não foi possível capturar a foto. Tente novamente. [CAM07]");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && status !== "processing") onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !inset-0 !top-0 !left-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !rounded-none !border-0 !bg-black !p-0 !shadow-none !duration-0 !animate-none sm:!rounded-none data-[state=open]:!animate-none data-[state=closed]:!animate-none"
        style={{ inset: 0, width: "100vw", height: "100dvh", maxWidth: "none", transform: "none", borderRadius: 0 }}
        onEscapeKeyDown={(event) => { if (status === "processing") event.preventDefault(); }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Câmera — {label}</DialogTitle>
          <DialogDescription>A foto será usada somente após aparecer na miniatura.</DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-black" data-testid="camera-fullscreen-preview">
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            aria-label="Imagem ao vivo da câmera"
            className="absolute inset-0 h-full w-full bg-black object-contain"
            onLoadedData={() => {
              if (streamRef.current) setStatus((current) => current === "opening" ? "ready" : current);
            }}
          />
          {status === "opening" && (
            <p role="status" className="absolute inset-x-4 top-1/2 text-center text-sm text-white/90">
              Abrindo câmera...
            </p>
          )}
          {status === "processing" && (
            <p role="status" className="absolute inset-x-4 top-1/2 text-center text-sm text-white/90">
              Processando foto, aguarde...
            </p>
          )}
          {(error || status === "error") && (
            <div className="absolute inset-x-5 bottom-5 flex flex-col items-center gap-3">
              {error && (
                <p role="alert" className="max-w-sm rounded-lg bg-black/85 px-4 py-3 text-center text-sm text-white">
                  {error}
                </p>
              )}
              {status === "error" && (
                <Button type="button" variant="outline" onClick={() => { void startCamera(); }}>
                  Tentar novamente
                </Button>
              )}
            </div>
          )}
        </div>

        <div
          className="relative z-10 flex shrink-0 items-center justify-between bg-black pt-5"
          style={{
            paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(2rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(2rem, env(safe-area-inset-right, 0px))",
          }}
        >
          <button
            type="button"
            aria-label="Voltar"
            title="Voltar"
            disabled={status === "processing"}
            onClick={onClose}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-600/90 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Capturar foto"
            title="Capturar foto"
            disabled={status !== "ready"}
            onClick={() => { void takePhoto(); }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-600 shadow-lg transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

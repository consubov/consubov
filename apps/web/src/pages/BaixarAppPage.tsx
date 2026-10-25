import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  Smartphone,
  ShieldCheck,
  WifiOff,
  Share2,
  PlusSquare,
  ArrowLeft,
} from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import relattoLogo from "@/assets/relatto-logo.png.asset.json";
import { APP_VERSION } from "@/lib/appVersion";
import {
  type AppBrandId,
  activateStandaloneSession,
  clearAppInstalledMark,
  detectInstalledAppAsync,
  getInstalledStorageKey,
  getSurfaceMode,
  isConsubovV2DownloadRoute,
  isAppInstalledOnDevice,
  isStandaloneApp,
  markAppInstalled,
} from "@/lib/appSurface";
import { applyPwaProfile } from "@/lib/pwaManifest";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export default function BaixarAppPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isRelatto = searchParams.get("app")?.toLowerCase() === "relatto";
  const brandId: AppBrandId = isRelatto ? "relatto" : "consubov";

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() =>
    isAppInstalledOnDevice(brandId),
  );
  const [showManualHint, setShowManualHint] = useState(false);
  const [showInstalledV2Hint, setShowInstalledV2Hint] = useState(false);
  const [platform] = useState<"ios" | "android" | "desktop">(detectPlatform);
  const surfaceMode = getSurfaceMode();
  const v2DownloadRoute = isConsubovV2DownloadRoute(
    window.location.pathname,
    window.location.search,
    surfaceMode,
  );
  const brandName = isRelatto
    ? "Relatto"
    : v2DownloadRoute
      ? "Consubov 2.0"
      : "Consubov";
  const displayVersion = v2DownloadRoute ? "2.0.0" : APP_VERSION;
  const externalAppOrigin = (
    (import.meta.env.VITE_APP_URL as string | undefined) ?? ""
  )
    .trim()
    .replace(/\/+$/, "");

  useEffect(() => {
    applyPwaProfile(window.location.pathname);
    document.title = isRelatto
      ? "Baixar App Relatto — Aplicativo Oficial"
      : surfaceMode === "app"
        ? "Baixar App Consubov 2.0 — Aplicativo Oficial"
        : "Baixar App Consubov — Aplicativo Oficial";

    // A URL explícita da nova versão sempre mostra primeiro a instalação.
    // As demais rotas e outros apps preservam a navegação normal pelo ícone.
    if (isStandaloneApp() && !v2DownloadRoute) {
      markAppInstalled(brandId);
      navigate("/login", { replace: true });
      return;
    }

    // O marcador da antiga PWA não prova que a CONSUBOV 2.0 foi instalada.
    if (!v2DownloadRoute) {
      setInstalled(isAppInstalledOnDevice(brandId));
      void detectInstalledAppAsync(brandId).then((alreadyInstalled) => {
        if (alreadyInstalled) {
          setInstalled(true);
          setShowManualHint(false);
        }
      });
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (v2DownloadRoute || !isAppInstalledOnDevice(brandId)) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      }
    };

    const onAppInstalled = () => {
      markAppInstalled(brandId);
      setInstalled(true);
      setDeferredPrompt(null);
      setShowManualHint(false);
      if (v2DownloadRoute) {
        // The browser tab is not the installed app: keep the installer visible.
        // Launching the new icon (start_url: "/") will reach login normally.
        setShowInstalledV2Hint(true);
        return;
      }
      activateStandaloneSession();
      navigate("/login", { replace: true });
    };

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === getInstalledStorageKey(brandId)) {
        setInstalled(e.newValue === "1");
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel("consubov:install-state");
        channel.onmessage = (event) => {
          const data = event.data as { type?: string; brand?: AppBrandId } | null;
          if (data?.brand === brandId) {
            if (data.type === "INSTALLED") {
              setInstalled(true);
              setShowManualHint(false);
            } else if (data.type === "CLEARED") {
              setInstalled(false);
            }
          }
        };
      }
    } catch {
      /* ignore */
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("storage", onStorageChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("storage", onStorageChange);
      try {
        channel?.close();
      } catch {
        /* ignore */
      }
    };
  }, [brandId, isRelatto, navigate, surfaceMode, v2DownloadRoute]);

  const handleInstallClick = async () => {
    // Só o fluxo legado bloqueia segunda instalação; 2.0 tem origem própria.
    if (!v2DownloadRoute && (installed || isAppInstalledOnDevice(brandId))) {
      setInstalled(true);
      setShowManualHint(false);
      return;
    }

    if (
      externalAppOrigin &&
      typeof window !== "undefined" &&
      !window.location.origin.startsWith(externalAppOrigin)
    ) {
      const target = isRelatto
        ? `${externalAppOrigin}/baixar?app=relatto`
        : `${externalAppOrigin}/baixar`;
      window.location.assign(target);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        if (v2DownloadRoute) {
          // Não confundir aceitação do prompt com a instalação concluída.
          // O evento appinstalled confirma a instalação e abre o login.
          setDeferredPrompt(null);
          return;
        }
        markAppInstalled(brandId);
        activateStandaloneSession();
        setInstalled(true);
        setShowManualHint(false);
        setDeferredPrompt(null);
        // Inicia direto na tela de Login assim que o usuário aceita instalar o App
        navigate("/login", { replace: true });
        return;
      }
      setDeferredPrompt(null);
      return;
    }

    setShowManualHint(true);
    document
      .getElementById("instrucoes-instalacao")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleConfirmManualInstall = () => {
    if (v2DownloadRoute) {
      // iOS does not provide a reliable appinstalled event; do not fake one or
      // redirect browser users into login without seeing the installed icon.
      setShowManualHint(false);
      setShowInstalledV2Hint(true);
      return;
    }
    markAppInstalled(brandId);
    activateStandaloneSession();
    setInstalled(true);
    setShowManualHint(false);
    navigate("/login", { replace: true });
  };

  const handleResetInstallMark = () => {
    clearAppInstalledMark(brandId);
    setInstalled(false);
    setShowManualHint(false);
  };

  const brandName = isRelatto ? "Relatto" : surfaceMode === "app" ? "Consubov 2.0" : "Consubov";
  const brandSubtitle = isRelatto
    ? "Aplicativo oficial de relatórios técnicos de campo"
    : "Aplicativo oficial de inteligência nutricional e gestão pecuária";

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between"
      style={{
        background: "#05070A",
        color: "#E6F5EC",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <header
        className="w-full border-b"
        style={{
          borderColor: "rgba(34,255,136,0.18)",
          background: "rgba(5,7,10,0.92)",
        }}
      >
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg overflow-hidden shrink-0"
              style={{
                border: "1px solid rgba(34,255,136,0.35)",
                background: isRelatto ? "#FFFFFF" : "#05070A",
              }}
            >
              <img
                src={isRelatto ? relattoLogo.url : logoConsubov}
                alt={brandName}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-extrabold tracking-widest text-sm uppercase">
                {brandName}
              </span>
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold"
                style={{
                  background: "rgba(34,255,136,0.14)",
                  color: "#22FF88",
                  border: "1px solid rgba(34,255,136,0.28)",
                }}
              >
                App v{displayVersion}
              </span>
            </div>
          </div>

          {surfaceMode !== "app" && (
            <Link
              to={isRelatto ? "/relatto" : "/"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-white/5"
              style={{
                border: "1px solid rgba(34,255,136,0.35)",
                color: "#E6F5EC",
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao site
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="max-w-2xl w-full space-y-8">
          <div
            className="rounded-2xl p-6 sm:p-10 space-y-6"
            style={{
              background: "rgba(12,18,16,0.85)",
              border: "1px solid rgba(34,255,136,0.24)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            }}
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
                style={{
                  border: "2px solid #22FF88",
                  boxShadow: "0 0 28px rgba(34,255,136,0.35)",
                  background: isRelatto ? "#FFFFFF" : "#05070A",
                }}
              >
                <img
                  src={isRelatto ? relattoLogo.url : logoConsubov}
                  alt={`Ícone do App ${brandName}`}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(34,255,136,0.12)",
                    color: "#22FF88",
                    border: "1px solid rgba(34,255,136,0.3)",
                  }}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Aplicativo Nativo para o Seu Dispositivo
                </span>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                  Baixar App {brandName}
                </h1>
                <p className="text-sm sm:text-base text-[#C4DDD0] leading-relaxed">
                  {brandSubtitle}. Instale no seu aparelho e acesse diretamente
                  pelo ícone na tela inicial.
                </p>
              </div>
            </div>

            {/* CONSUBOV 2.0 sempre oferece instalação, inclusive com marcador do legado. */}
            {installed && !v2DownloadRoute ? (
              <div
                className="rounded-xl p-6 text-center space-y-3"
                style={{
                  background: "rgba(34,255,136,0.14)",
                  border: "1px solid #22FF88",
                }}
                role="status"
                data-testid="app-already-installed-banner"
              >
                <CheckCircle2
                  className="w-9 h-9 mx-auto"
                  style={{ color: "#22FF88" }}
                />
                <p className="font-extrabold text-base sm:text-lg text-white">
                  App {brandName} já está instalado neste dispositivo
                </p>
                <p className="text-xs sm:text-sm text-[#D8EFE2] leading-relaxed max-w-lg mx-auto">
                  Identificamos que o <strong>App {brandName}</strong> já foi
                  instalado neste aparelho. Para evitar duplicidade, uma nova
                  instalação foi bloqueada. Feche esta aba do navegador e abra o
                  aplicativo diretamente pelo{" "}
                  <strong>ícone {brandName}</strong> na tela inicial do seu
                  dispositivo.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleResetInstallMark}
                    className="text-[11px] underline text-[#9BB8A8] hover:text-white transition cursor-pointer"
                  >
                    Desinstalou o ícone do aparelho e precisa instalar
                    novamente? Liberar instalação
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void handleInstallClick()}
                  className="w-full py-4 px-6 rounded-xl font-extrabold text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2.5 transition transform hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    background: "#22FF88",
                    color: "#03110A",
                    boxShadow: "0 0 28px rgba(34,255,136,0.45)",
                  }}
                >
                  <Download className="w-5 h-5" />
                  Baixar e Instalar App {brandName}
                </button>

                {v2DownloadRoute && (
                  <p className="text-center text-xs sm:text-sm text-[#D8EFE2] leading-relaxed">
                    O CONSUBOV 2.0 é um novo aplicativo. A versão anterior pode permanecer instalada no seu dispositivo.
                  </p>
                )}

                {v2DownloadRoute && showInstalledV2Hint && (
                  <p className="rounded-xl border border-[#22FF88] bg-[#22FF8817] p-4 text-center text-sm text-[#D8EFE2]" role="status">
                    Abra o novo ícone <strong>Consubov 2.0</strong> na tela inicial.
                    A versão antiga pode continuar instalada.
                  </p>
                )}

                {showManualHint && (
                  <div
                    className="rounded-xl p-4 text-xs sm:text-sm space-y-3"
                    style={{
                      background: "rgba(34,255,136,0.14)",
                      border: "1px solid #22FF88",
                      color: "#FFFFFF",
                    }}
                    role="status"
                  >
                    <p className="font-bold text-[#22FF88]">
                      Confirme a instalação no seu navegador:
                    </p>
                    <p className="text-[#E6F5EC] leading-relaxed">
                      {platform === "ios"
                        ? 'No iPhone/iPad, toque no ícone "Compartilhar" na barra do Safari e selecione "Adicionar à Tela de Início".'
                        : platform === "android"
                          ? 'No Android, confirme no aviso "Instalar aplicativo" ou toque nos três pontos (⋮) no topo do navegador e selecione "Instalar aplicativo".'
                          : 'No computador, clique no ícone de instalação (computador com seta para baixo) no canto direito da barra de endereço do navegador ou no menu (⋮) -> "Instalar aplicativo".'}
                    </p>
                    <button
                      type="button"
                      onClick={handleConfirmManualInstall}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                      style={{
                        background: "rgba(34,255,136,0.22)",
                        border: "1px solid #22FF88",
                        color: "#FFFFFF",
                      }}
                    >
                      {v2DownloadRoute ? "Já adicionei à Tela de Início" : "Já concluí a instalação — Ir para Login"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Aviso de segurança e acesso exclusivo pelo ícone */}
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                background: "rgba(34,255,136,0.08)",
                border: "1px solid rgba(34,255,136,0.22)",
              }}
            >
              <ShieldCheck
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: "#22FF88" }}
              />
              <p className="text-xs sm:text-sm text-[#D8EFE2] leading-relaxed">
                <strong>Acesso exclusivo pelo ícone do App:</strong> Para sua
                segurança e funcionamento 100% offline no campo, o sistema não é
                utilizado dentro da aba do navegador. Após instalar, abra sempre
                pelo <strong>ícone do App {brandName}</strong> no seu aparelho.
              </p>
            </div>

            {/* Guia passo a passo por plataforma */}
            <div id="instrucoes-instalacao" className="space-y-4 pt-2">
              <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                {platform === "ios"
                  ? "Como instalar no seu iPhone ou iPad:"
                  : platform === "android"
                    ? "Como instalar no seu celular Android:"
                    : "Como instalar e abrir o App no seu dispositivo:"}
              </h2>

              {platform === "ios" ? (
                <ol className="space-y-3 text-xs sm:text-sm text-[#D8EFE2]">
                  <li
                    className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Share2
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: "#22FF88" }}
                    />
                    <span>
                      <strong>1.</strong> Toque no botão{" "}
                      <strong>Compartilhar</strong> na barra do navegador do seu
                      iPhone.
                    </span>
                  </li>
                  <li
                    className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <PlusSquare
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: "#22FF88" }}
                    />
                    <span>
                      <strong>2.</strong> Role as opções e toque em{" "}
                      <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.
                    </span>
                  </li>
                  <li
                    className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Smartphone
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: "#22FF88" }}
                    />
                    <span>
                      <strong>3.</strong> Confirme em{" "}
                      <strong>Adicionar</strong> e abra o{" "}
                      <strong>App {brandName}</strong> pelo ícone criado na tela
                      inicial do seu aparelho.
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-xs sm:text-sm text-[#D8EFE2]">
                  <li
                    className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Download
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: "#22FF88" }}
                    />
                    <span>
                      <strong>1.</strong> Clique no botão verde{" "}
                      <strong>
                        &ldquo;Baixar e Instalar App {brandName}&rdquo;
                      </strong>{" "}
                      acima (ou no menu do navegador &rarr;{" "}
                      <strong>&ldquo;Instalar aplicativo&rdquo;</strong>).
                    </span>
                  </li>
                  <li
                    className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Smartphone
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: "#22FF88" }}
                    />
                    <span>
                      <strong>2.</strong> O ícone oficial do{" "}
                      <strong>App {brandName}</strong> será adicionado à tela
                      inicial do seu dispositivo.
                    </span>
                  </li>
                  <li
                    className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <CheckCircle2
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: "#22FF88" }}
                    />
                    <span>
                      <strong>3.</strong> Assim que instalado, o{" "}
                      <strong>App {brandName}</strong> inicia direto na tela de{" "}
                      <strong>Login</strong>.
                    </span>
                  </li>
                </ol>
              )}
            </div>

            {/* Benefícios do App instalado */}
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div
                className="p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium text-[#D8EFE2]"
                style={{
                  background: "rgba(5,7,10,0.65)",
                  border: "1px solid rgba(34,255,136,0.16)",
                }}
              >
                <WifiOff
                  className="w-4 h-4 shrink-0"
                  style={{ color: "#22FF88" }}
                />
                <span>100% Offline no campo</span>
              </div>
              <div
                className="p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium text-[#D8EFE2]"
                style={{
                  background: "rgba(5,7,10,0.65)",
                  border: "1px solid rgba(34,255,136,0.16)",
                }}
              >
                <Smartphone
                  className="w-4 h-4 shrink-0"
                  style={{ color: "#22FF88" }}
                />
                <span>Tela cheia nativa</span>
              </div>
              <div
                className="p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium text-[#D8EFE2]"
                style={{
                  background: "rgba(5,7,10,0.65)",
                  border: "1px solid rgba(34,255,136,0.16)",
                }}
              >
                <ShieldCheck
                  className="w-4 h-4 shrink-0"
                  style={{ color: "#22FF88" }}
                />
                <span>Sincronização segura</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="w-full py-6 px-5 text-center text-xs text-[#9BB8A8] border-t"
        style={{ borderColor: "rgba(34,255,136,0.12)" }}
      >
        © 2026 {brandName} • Aplicativo Oficial v{displayVersion}
      </footer>
    </div>
  );
}

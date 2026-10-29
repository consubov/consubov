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
  isAppInstalledOnDevice,
  isStandaloneApp,
  markAppInstalled,
} from "@/lib/appSurface";
import { applyPwaProfile } from "@/lib/pwaManifest";
import {
  requestConsubovCrossOriginInstall,
  type CrossOriginInstallNavigator,
} from "@/lib/crossOriginInstall";
import { useSiteLanguage } from "@/hooks/useSiteLanguage";
import { SiteLanguageSwitch } from "@/components/landing/SiteLanguageSwitch";

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
  const isSiteBuild = import.meta.env.VITE_SURFACE_MODE === "site";
  const siteCrossOriginInstall = isSiteBuild && !isRelatto;

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() =>
    siteCrossOriginInstall ? false : isAppInstalledOnDevice(brandId),
  );
  const [showManualHint, setShowManualHint] = useState(false);
  const [siteInstallUnavailable, setSiteInstallUnavailable] = useState(false);
  const [platform] = useState<"ios" | "android" | "desktop">(detectPlatform);
  const surfaceMode = getSurfaceMode();
  const { language, setLanguage } = useSiteLanguage();
  const isEnglishSite = isSiteBuild && language === "en-US";
  const copy = (pt: string, en: string) => isEnglishSite ? en : pt;
  const externalAppOrigin = (
    (import.meta.env.VITE_APP_URL as string | undefined) ?? ""
  )
    .trim()
    .replace(/\/+$/, "");

  useEffect(() => {
    applyPwaProfile(window.location.pathname);
    document.title = isEnglishSite
      ? `Download ${isRelatto ? "Relatto" : "Consubov"} App — Official App`
      : isRelatto ? "Baixar App Relatto — Aplicativo Oficial" : "Baixar App Consubov — Aplicativo Oficial";

    // Se já estiver rodando dentro do App instalado (standalone), inicia direto na tela de Login
    if (!siteCrossOriginInstall && isStandaloneApp()) {
      markAppInstalled(brandId);
      navigate("/login", { replace: true });
      return;
    }

    if (siteCrossOriginInstall) {
      // A origem do site não pode comprovar instalação do app em outro domínio.
      setInstalled(false);
    } else {
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
      // Nunca instalar o site institucional como se fosse o app de campo.
      if (siteCrossOriginInstall) return;
      if (!isAppInstalledOnDevice(brandId)) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      }
    };

    const onAppInstalled = () => {
      if (siteCrossOriginInstall) return;
      markAppInstalled(brandId);
      activateStandaloneSession();
      setInstalled(true);
      setDeferredPrompt(null);
      setShowManualHint(false);
      // Assim que o App termina de baixar/instalar, inicia imediatamente na tela de Login
      navigate("/login", { replace: true });
    };

    const onStorageChange = (e: StorageEvent) => {
      if (siteCrossOriginInstall) return;
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
  }, [brandId, isRelatto, navigate, isEnglishSite, siteCrossOriginInstall]);

  const handleInstallClick = async () => {
    if (siteCrossOriginInstall) {
      // Este pedido só alcança o popup sem navegar quando o navegador oferece
      // a API de instalação entre origens (ainda experimental).
      const result = await requestConsubovCrossOriginInstall(
        window.navigator as CrossOriginInstallNavigator,
      );
      if (result === "installed") {
        setInstalled(true);
        setSiteInstallUnavailable(false);
        return;
      }
      if (result !== "dismissed") setSiteInstallUnavailable(true);
      return;
    }

    // Bloqueia tentativa de instalar 2 vezes se já estiver instalado neste dispositivo
    if (installed || isAppInstalledOnDevice(brandId)) {
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

  const brandName = isRelatto ? "Relatto" : "Consubov";
  const brandSubtitle = isRelatto
    ? copy("Aplicativo oficial de relatórios técnicos de campo", "Official app for technical field reports")
    : copy("Aplicativo oficial de inteligência nutricional e gestão pecuária", "Official app for cattle nutrition intelligence and livestock management");

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
        <div className="max-w-4xl mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2">
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
              {!isSiteBuild && <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold"
                style={{
                  background: "rgba(34,255,136,0.14)",
                  color: "#22FF88",
                  border: "1px solid rgba(34,255,136,0.28)",
                }}
              >
                App v{APP_VERSION}
              </span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
          {isSiteBuild && <SiteLanguageSwitch language={language} onChange={setLanguage} />}
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
              {copy("Voltar ao site", "Back to website")}
            </Link>
          )}
          </div>
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
                  alt={copy(`Ícone do App ${brandName}`, `${brandName} App icon`)}
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
                  {copy("Aplicativo Nativo para o Seu Dispositivo", "App for Your Device")}
                </span>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                  {copy("Baixar App", "Download App")} {brandName}
                </h1>
                <p className="text-sm sm:text-base text-[#C4DDD0] leading-relaxed">
                  {brandSubtitle}. {copy("Instale no seu aparelho e acesse diretamente pelo ícone na tela inicial.", "Install it on your device and launch it from the home-screen icon.")}
                </p>
              </div>
            </div>

            {/* Estado: App já instalado (bloqueia 2ª instalação) vs Botão para instalar */}
            {installed ? (
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
                  App {brandName} {copy("já está instalado neste dispositivo", "is already installed on this device")}
                </p>
                <p className="text-xs sm:text-sm text-[#D8EFE2] leading-relaxed max-w-lg mx-auto">
                  {isEnglishSite ? (
                    <>The <strong>{brandName} App</strong> is already installed. To avoid duplicates, installation is disabled here. Close this browser tab and launch the app using the <strong>{brandName} icon</strong> on your home screen.</>
                  ) : (
                    <>Identificamos que o <strong>App {brandName}</strong> já foi instalado neste aparelho. Para evitar duplicidade, uma nova instalação foi bloqueada. Feche esta aba do navegador e abra o aplicativo diretamente pelo <strong>ícone {brandName}</strong> na tela inicial do seu dispositivo.</>
                  )}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleResetInstallMark}
                    className="text-[11px] underline text-[#9BB8A8] hover:text-white transition cursor-pointer"
                  >
                    {copy("Desinstalou o ícone do aparelho e precisa instalar novamente? Liberar instalação", "Removed the app icon and need to install again? Enable installation")}
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
                  {copy("Baixar e Instalar App", "Download and Install")} {brandName}
                </button>

                {siteInstallUnavailable && (
                  <div
                    className="rounded-xl p-4 text-xs sm:text-sm space-y-3"
                    style={{
                      background: "rgba(34,255,136,0.1)",
                      border: "1px solid rgba(34,255,136,0.45)",
                      color: "#FFFFFF",
                    }}
                    role="status"
                    data-testid="cross-origin-install-fallback"
                  >
                    <p className="font-bold text-[#22FF88]">
                      {copy(
                        "A instalação direta ainda não está disponível neste navegador.",
                        "Direct installation is not available in this browser yet.",
                      )}
                    </p>
                    <p className="text-[#D8EFE2]">
                      {copy(
                        "Não abrimos outra página automaticamente. O aplicativo fica no domínio oficial app.consubov.com.br. Para instalar neste navegador, use opcionalmente a página de instalação do App.",
                        "We did not open another page automatically. The app is hosted at app.consubov.com.br. If you wish, you can use the official app installation page.",
                      )}
                    </p>
                    <a
                      href="https://app.consubov.com.br/baixar"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block underline text-[#22FF88] font-semibold"
                    >
                      {copy("Abrir instalação oficial (opcional)", "Open official installation (optional)")}
                    </a>
                  </div>
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
                      {copy("Confirme a instalação no seu navegador:", "Confirm the installation in your browser:")}
                    </p>
                    <p className="text-[#E6F5EC] leading-relaxed">
                      {platform === "ios"
                        ? copy('No iPhone/iPad, toque no ícone "Compartilhar" na barra do Safari e selecione "Adicionar à Tela de Início".', 'On iPhone or iPad, tap Share in Safari and choose Add to Home Screen.')
                        : platform === "android"
                          ? copy('No Android, confirme no aviso "Instalar aplicativo" ou toque nos três pontos (⋮) no topo do navegador e selecione "Instalar aplicativo".', 'On Android, confirm the Install app prompt, or open the browser menu (⋮) and choose Install app.')
                          : copy('No computador, clique no ícone de instalação (computador com seta para baixo) no canto direito da barra de endereço do navegador ou no menu (⋮) -> "Instalar aplicativo".', 'On desktop, click the install icon in the address bar, or open the browser menu (⋮) and choose Install app.')}
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
                      {copy("Já concluí a instalação — Ir para Login", "Installation complete — Go to Login")}
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
                {isEnglishSite ? (
                  <><strong>Use the App icon to sign in:</strong> For secure, fully offline field work, use the installed app rather than a browser tab. After installation, always launch it using the <strong>{brandName} App icon</strong>.</>
                ) : (
                  <><strong>Acesso exclusivo pelo ícone do App:</strong> Para sua segurança e funcionamento 100% offline no campo, o sistema não é utilizado dentro da aba do navegador. Após instalar, abra sempre pelo <strong>ícone do App {brandName}</strong> no seu aparelho.</>
                )}
              </p>
            </div>

            {/* Guia passo a passo por plataforma */}
            <div id="instrucoes-instalacao" hidden={siteCrossOriginInstall} className="space-y-4 pt-2">
              <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                {platform === "ios"
                  ? copy("Como instalar no seu iPhone ou iPad:", "How to install on iPhone or iPad:")
                  : platform === "android"
                    ? copy("Como instalar no seu celular Android:", "How to install on Android:")
                    : copy("Como instalar e abrir o App no seu dispositivo:", "How to install and open the App:")}
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
                      <strong>1.</strong>{" "}
                      {copy("Toque no botão Compartilhar na barra do navegador do seu iPhone.", "Tap Share in your iPhone browser toolbar.")}
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
                      <strong>2.</strong>{" "}
                      {copy('Role as opções e toque em "Adicionar à Tela de Início".', 'Scroll through the options and tap "Add to Home Screen".')}
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
                      <strong>3.</strong>{" "}
                      {copy(`Confirme em Adicionar e abra o App ${brandName} pelo ícone criado na tela inicial do seu aparelho.`, `Tap Add, then open ${brandName} from its new home-screen icon.`)}
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
                      <strong>1.</strong>{" "}
                      {copy(`Clique no botão verde Baixar e Instalar App ${brandName} acima, ou use Instalar aplicativo no menu do navegador.`, `Click the green Download and Install ${brandName} button, or choose Install app in the browser menu.`)}
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
                      <strong>2.</strong>{" "}
                      {copy(`O ícone oficial do App ${brandName} será adicionado à tela inicial do seu dispositivo.`, `The official ${brandName} App icon will be added to your home screen.`)}
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
                      <strong>3.</strong>{" "}
                      {copy(`Assim que instalado, o App ${brandName} inicia direto na tela de Login.`, `Once installed, the ${brandName} App opens directly to the login screen.`)}
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
                <span>{copy("100% Offline no campo", "100% Offline in the Field")}</span>
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
                <span>{copy("Tela cheia nativa", "Full-Screen App")}</span>
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
                <span>{copy("Sincronização segura", "Secure Sync")}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="w-full py-6 px-5 text-center text-xs text-[#9BB8A8] border-t"
        style={{ borderColor: "rgba(34,255,136,0.12)" }}
      >
        © 2026 {brandName} • {copy("Aplicativo Oficial", "Official App")}{!isSiteBuild && surfaceMode === "app" ? ` v${APP_VERSION}` : ""}
      </footer>
    </div>
  );
}

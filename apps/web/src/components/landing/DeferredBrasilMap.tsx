import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
const MapView = lazy(() => import("./BrasilMap").catch(() => ({
  default: () => <p role="status"><LocalizedText source={"Mapa indisponível. Recarregue quando tiver conexão."} /></p>,
})));
// The parent reserves the square occupied by the map before its module arrives.
export function DeferredBrasilMap() {
  const uiText = useStaticUiText();
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "400px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={host} className="w-full h-full" role="region" aria-label={uiText("Mapa da rede nacional")}>
      {visible && <Suspense fallback={<span role="status" className="sr-only"><LocalizedText source={"Carregando mapa"} /></span>}><MapView /></Suspense>}
    </div>
  );
}

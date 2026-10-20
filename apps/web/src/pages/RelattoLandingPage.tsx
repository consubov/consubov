import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLandingContent } from "@/hooks/useLandingContent";
import { APP_VERSION } from "@/lib/appVersion";
import RelattoDemoModal from "@/components/landing/RelattoDemoModal";
import relattoLogo from "@/assets/relatto-logo.png.asset.json";
import {
  ClipboardList,
  FileText,
  WifiOff,
  LayoutDashboard,
  CalendarDays,
  Fuel,
  RefreshCw,
  PlayCircle,
} from "lucide-react";

interface Parceiro {
  id: string;
  nome: string | null;
  logo_url: string | null;
}

interface Slide {
  titulo: string;
  subtitulo: string;
  imagem_url?: string;
}

const SLIDES_FALLBACK: Slide[] = [
  {
    titulo: "Relatório técnico profissional, direto do campo",
    subtitulo:
      "O Relatto transforma sua visita técnica em um relatório pronto, com fotos, notas e gráficos.",
  },
  {
    titulo: "Funciona 100% sem internet",
    subtitulo:
      "Registre tudo em campo mesmo sem sinal. Quando reconectar, o app sincroniza sozinho.",
  },
  {
    titulo: "Relatórios profissionais, prontos para o produtor",
    subtitulo: "PDF organizado, com sua marca, fotos numeradas e gráficos de avaliação.",
  },
  {
    titulo: "3 tipos de visita, um só aplicativo",
    subtitulo: "Rotina, Confinamento e Fábrica, cada uma com sua avaliação específica.",
  },
];

const PASSOS_FALLBACK = [
  { titulo: "Cadastre a fazenda", descricao: "Nome, localização, responsável, tudo em segundos" },
  { titulo: "Inicie a visita", descricao: "Mesmo sem sinal, o app funciona 100% offline em campo" },
  { titulo: "Registre pastos, currais ou a fábrica", descricao: "Fotos numeradas, notas de 1 a 5, observações" },
  { titulo: "Gere o PDF", descricao: "Layout profissional, pronto para compartilhar com o produtor" },
];

const RECURSOS_FALLBACK = [
  { titulo: "Visitas Técnicas", descricao: "Rotina, Confinamento e Fábrica, cada uma com sua avaliação específica" },
  { titulo: "Relatórios em PDF", descricao: "Organizados, com gráficos e sua marca" },
  { titulo: "Modo Offline", descricao: "Funciona sem internet, sincroniza quando reconectar" },
  { titulo: "Painel do Consultor", descricao: "Visão geral de fazendas, visitas e indicadores" },
  { titulo: "Agenda", descricao: "Próximas visitas organizadas, com lembrete automático" },
  { titulo: "Despesas de Combustível (opcional)", descricao: "Controle de cupons fiscais por período" },
];

const RECURSO_ICONS = [ClipboardList, FileText, WifiOff, LayoutDashboard, CalendarDays, Fuel];

export default function RelattoLandingPage() {
  const { t, arr } = useLandingContent("relatto");
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    document.title = "Relatto — Relatório técnico profissional, direto do campo";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "O Relatto transforma sua visita técnica em um relatório pronto, com fotos, notas e gráficos, mesmo sem internet.",
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("landing_parceiros")
      .select("id, nome, logo_url")
      .eq("landing_slug", "relatto")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        if (mounted) setParceiros((data as Parceiro[]) || []);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const slides = arr<Slide>("relatto_slides", SLIDES_FALLBACK).slice(0, 4);
  const passos = arr<{ titulo: string; descricao: string }>("relatto_passos", PASSOS_FALLBACK);
  const recursos = arr<{ titulo: string; descricao: string }>("relatto_recursos", RECURSOS_FALLBACK);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const handleRefresh = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("__v", String(Date.now()));
    window.location.replace(url.toString());
  };

  const slide = slides[Math.min(slideIndex, slides.length - 1)] ?? SLIDES_FALLBACK[0];

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <img src={relattoLogo.url} alt="Logo Relatto" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight">Relatto</span>
            <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-neutral-500">
              v{APP_VERSION}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              aria-label="Atualizar página"
              title="Atualizar"
              className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => setDemoOpen(true)}
            >
              <PlayCircle className="w-4 h-4" /> Demo
            </Button>
            <Link to="/baixar?app=relatto">
              <Button size="sm" className="rounded-full font-semibold">
                {t("relatto_cta_entrar", "Baixar App")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Carrossel do hero */}
      <section className="px-4 pt-5">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl min-h-[300px] sm:min-h-[380px] flex items-end">
            {slide.imagem_url ? (
              <img
                src={slide.imagem_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-neutral-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />

            {!slide.imagem_url && (
              <img
                src={relattoLogo.url}
                alt=""
                aria-hidden="true"
                className="absolute right-4 top-4 w-20 h-20 object-contain opacity-25"
              />
            )}

            <div className="relative p-6 sm:p-10 text-white">
              <h1 className="text-2xl sm:text-4xl font-bold leading-tight max-w-2xl">
                {slide.titulo}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-white/85 max-w-xl leading-relaxed">
                {slide.subtitulo}
              </p>
            </div>
          </div>

          {slides.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Ir para o slide ${i + 1}`}
                  onClick={() => setSlideIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === slideIndex ? "w-6 bg-primary" : "w-2 bg-neutral-300"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="py-10 text-center">
            <p className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900">
              Relatto<sup className="text-lg align-super">®</sup>
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
              {t("relatto_tag_marca", "uma marca Consubov")}
            </p>
          </div>
        </div>
      </section>

      {/* O que é */}
      <section className="px-6 py-14 bg-neutral-50 border-y border-neutral-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold">{t("relatto_oque_titulo", "O que é o Relatto")}</h2>
          <p className="mt-4 text-neutral-600 leading-relaxed text-justify">
            {t(
              "relatto_oque_texto",
              "O Relatto é o aplicativo feito para quem vive na estrada: consultores técnicos, zootecnistas, médicos veterinários e agrônomos que avaliam fazendas de gado de corte no dia a dia. Em vez de anotar tudo no papel ou na memória, você registra cada visita, pastos, currais, fábrica de ração, direto no celular, com fotos, notas técnicas e observações. No fim, o Relatto monta um relatório em PDF pronto para enviar ao produtor, com a sua marca e a credibilidade que seu trabalho merece.",
            )}
          </p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold">{t("relatto_como_titulo", "Como funciona")}</h2>
          <ol className="mt-6 space-y-5">
            {passos.map((p, i) => (
              <li key={i} className="flex gap-4">
                <span className="shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{p.titulo}</p>
                  <p className="text-sm text-neutral-600">{p.descricao}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Recursos */}
      <section className="px-6 py-14 bg-neutral-50 border-y border-neutral-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold">{t("relatto_recursos_titulo", "Recursos")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {recursos.map((r, i) => {
              const Icon = RECURSO_ICONS[i % RECURSO_ICONS.length];
              return (
                <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                  <Icon className="w-5 h-5 text-primary" />
                  <p className="mt-3 font-semibold">{r.titulo}</p>
                  <p className="text-sm text-neutral-600 mt-1">{r.descricao}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Parceiros */}
      {parceiros.length > 0 && (
        <section className="px-6 py-14">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold">{t("relatto_parceiros_titulo", "Parceiros")}</h2>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 items-center">
              {parceiros.map((p) => (
                <div key={p.id} className="flex items-center justify-center">
                  {p.logo_url ? (
                    <img
                      src={p.logo_url}
                      alt={p.nome || "Parceiro"}
                      loading="lazy"
                      className="max-h-14 w-auto object-contain"
                    />
                  ) : (
                    <span className="text-sm text-neutral-500">{p.nome}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Rodapé */}
      <footer className="px-6 py-12 border-t border-neutral-100 text-center">
        <div className="flex items-center justify-center gap-3">
          <img src={relattoLogo.url} alt="Relatto" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold tracking-tight">Relatto</span>
        </div>
        <p className="mt-3 text-sm text-neutral-500">
          {t("relatto_footer_texto", "Relatto é uma marca Consubov.")}
        </p>
        <p className="mt-1 text-xs text-neutral-400">v{APP_VERSION}</p>
      </footer>

      <RelattoDemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}

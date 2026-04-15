import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { LogIn, CheckCircle2, QrCode, WifiOff, BarChart3, Brain, Layers, LayoutDashboard, ChevronLeft, ChevronRight } from "lucide-react";

import heroImg1 from "@/assets/landing-hero-1.jpg";
import heroImg2 from "@/assets/landing-hero-2.jpg";
import heroImg3 from "@/assets/landing-hero-3.jpg";
import logoConsubov from "@/assets/logo-consubov.jpeg";

const leadSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(10, "Telefone inválido").max(20),
  whatsapp: z.string().trim().min(10, "WhatsApp inválido").max(20),
  mensagem: z.string().trim().max(1000).optional(),
});

const fallbackHeroes = [heroImg1, heroImg2, heroImg3];

const diferenciais = [
  { icon: CheckCircle2, title: "Controle de salgas", desc: "Registro e monitoramento de salgas por pasto em tempo real." },
  { icon: WifiOff, title: "Funcionamento offline", desc: "Opera sem internet e sincroniza quando conectar." },
  { icon: QrCode, title: "QR Code no campo", desc: "Identifique pastos com QR Code para lançamentos rápidos." },
  { icon: BarChart3, title: "Relatórios automáticos", desc: "Relatórios de consumo, custos e desempenho gerados automaticamente." },
  { icon: Brain, title: "Inteligência nutricional", desc: "Cálculos de consumo esperado vs real por categoria animal." },
  { icon: Layers, title: "Gestão por pasto e lote", desc: "Organize e monitore cada pasto e lote individualmente." },
  { icon: LayoutDashboard, title: "Painel administrativo completo", desc: "Visão centralizada de todas as fazendas, retiros e indicadores." },
];

type LandingContent = Record<string, string>;

function parseImageArray(val: string | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return val.startsWith("http") ? [val] : [];
  }
}

export default function LandingPage() {
  const [content, setContent] = useState<LandingContent>({});
  const [heroIndex, setHeroIndex] = useState(0);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", whatsapp: "", mensagem: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.from("landing_page_content").select("chave, valor").then(({ data, error }) => {
      if (error) console.error("Erro ao carregar conteúdo da landing page:", error);
      if (data) {
        const map: LandingContent = {};
        data.forEach((r) => { if (r.valor) map[r.chave] = r.valor; });
        setContent(map);
      }
      setLoading(false);
    });
  }, []);

  const heroImages = (() => {
    const dynamic = parseImageArray(content.img_carrossel);
    return dynamic.length > 0 ? dynamic : fallbackHeroes;
  })();
  const quemSomosImg = (() => {
    const dynamic = parseImageArray(content.img_quem_somos);
    return dynamic.length > 0 ? dynamic[0] : heroImg2;
  })();
  const diferenciaisImg = (() => {
    const dynamic = parseImageArray(content.img_diferenciais);
    return dynamic.length > 0 ? dynamic[0] : null;
  })();
  const parceirosLogos = parseImageArray(content.img_parceiros);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = setInterval(() => setHeroIndex((i) => (i + 1) % heroImages.length), 5000);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  useEffect(() => { setHeroIndex(0); }, [heroImages.length]);

  const handleSubmit = useCallback(async () => {
    const result = leadSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await supabase.from("leads").insert({
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      whatsapp: form.whatsapp.trim(),
      mensagem: form.mensagem?.trim() || null,
    });
    if (error) {
      toast.error("Erro ao enviar. Tente novamente.");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
    setForm({ nome: "", email: "", telefone: "", whatsapp: "", mensagem: "" });
  }, [form]);

  const quemSomosText = content.quem_somos || "O Consubov é uma plataforma tecnológica desenvolvida para transformar a gestão pecuária. Com foco no controle de sal mineral, inteligência nutricional e operação de campo, oferecemos ferramentas que permitem ao pecuarista tomar decisões baseadas em dados reais, direto do pasto.";
  const diferenciaisText = content.diferenciais || "Tecnologia pensada para o campo. Cada funcionalidade foi criada a partir da realidade do dia a dia da pecuária brasileira.";
  const formTitle = content.form_titulo || "Ficou interessado?";
  const formDesc = content.form_descricao || "Preencha o formulário abaixo e nossa equipe entrará em contato.";
  const formPlaceholder = content.form_placeholder || "Conte um pouco da sua história, nos dizendo como é a sua realidade na fazenda";
  const formMicrofrase = content.form_microfrase || "Cada fazenda é única, e queremos entender a sua.";
  const formMsgConfirmacao = content.form_msg_confirmacao || "Essas informações nos ajudam a entender melhor sua realidade.\nNossa equipe irá analisar com atenção, e entrar em contato com você.\n\nEquipe Consubov";
  const rodapeText = content.rodape || "Consubov — Tecnologia para Pecuária\nTelefone: (63) 99999-0000\nCNPJ: 00.000.000/0001-00\nPalmas - TO, Brasil";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0D1F0F" }}>
        <div className="w-12 h-12 rounded-xl overflow-hidden animate-pulse">
          <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0D1F0F", color: "#F5F0E8" }}>
      {/* Navbar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(13,31,15,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(46,74,48,0.5)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden">
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg tracking-wide" style={{ color: "#F5F0E8" }}>Consubov</span>
          </div>
          <Link to="/login">
            <button
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:brightness-110"
              style={{ background: "#C9A84C", color: "#0D1F0F" }}
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative w-full overflow-hidden" style={{ height: "70vh", minHeight: "400px" }}>
        {heroImages.map((img, i) => (
          <div
            key={`${img}-${i}`}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: heroIndex === i ? 1 : 0 }}
          >
            <img
              src={img}
              alt={`Hero ${i + 1}`}
              className="w-full h-full object-cover"
              width={1920}
              height={1080}
              {...(i === 0 ? {} : { loading: "lazy" as const })}
            />
          </div>
        ))}
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: "rgba(13,31,15,0.55)" }} />
        {/* Gradient bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: "linear-gradient(to top, #0D1F0F, transparent)" }} />

        {/* Hero content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-wider mb-4" style={{ color: "#F5F0E8" }}>
            CONSUBOV
          </h1>
          <p className="text-base md:text-xl max-w-2xl leading-relaxed opacity-90" style={{ color: "#F5F0E8" }}>
            {content.hero_subtitulo || "Gestão pecuária inteligente. Controle, dados e resultados — direto do pasto."}
          </p>
          <Link to="/login">
            <button
              className="mt-8 px-8 py-3 rounded-lg text-base font-bold uppercase tracking-wide transition-all duration-200 hover:brightness-110 hover:scale-105"
              style={{ background: "#C9A84C", color: "#0D1F0F" }}
            >
              {content.cta_texto || "Entrar"}
            </button>
          </Link>
        </div>

        {/* Carousel controls */}
        {heroImages.length > 1 && (
          <>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{
                    background: heroIndex === i ? "#C9A84C" : "rgba(245,240,232,0.4)",
                    transform: heroIndex === i ? "scale(1.3)" : "scale(1)",
                  }}
                />
              ))}
            </div>
            <button onClick={() => setHeroIndex((i) => (i - 1 + heroImages.length) % heroImages.length)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 transition-colors z-10" style={{ background: "rgba(13,31,15,0.5)", color: "#F5F0E8" }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={() => setHeroIndex((i) => (i + 1) % heroImages.length)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 transition-colors z-10" style={{ background: "rgba(13,31,15,0.5)", color: "#F5F0E8" }}>
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </section>

      {/* Quem Somos */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide" style={{ color: "#F5F0E8" }}>
              Quem Somos
            </h2>
            <div className="w-16 h-1 mx-auto mt-3 rounded-full" style={{ background: "#C9A84C" }} />
          </div>
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="w-full md:w-1/2 rounded-xl overflow-hidden" style={{ maxHeight: "60vh" }}>
              <img src={quemSomosImg} alt="Quem somos" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="w-full md:w-1/2">
              <p className="text-base md:text-lg leading-relaxed whitespace-pre-line text-left" style={{ color: "rgba(245,240,232,0.8)" }}>
                {quemSomosText}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="py-16 md:py-24 px-4" style={{ background: "#0A1A0C" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide" style={{ color: "#F5F0E8" }}>
              Nossos Diferenciais
            </h2>
            <div className="w-16 h-1 mx-auto mt-3 rounded-full" style={{ background: "#C9A84C" }} />
            <p className="mt-4 max-w-2xl mx-auto text-left" style={{ color: "rgba(245,240,232,0.65)" }}>{diferenciaisText}</p>
          </div>

          {diferenciaisImg && (
            <div className="mb-12 rounded-xl overflow-hidden max-w-3xl mx-auto" style={{ maxHeight: "60vh" }}>
              <img src={diferenciaisImg} alt="Nossos diferenciais" className="w-full h-auto object-contain" loading="lazy" />
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {diferenciais.map((d) => (
              <div
                key={d.title}
                className="rounded-xl p-4 md:p-6 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.02]"
                style={{ background: "#1A2E1C", border: "1px solid #2E4A30" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(201,168,76,0.15)" }}>
                    <d.icon className="w-4 h-4 md:w-5 md:h-5" style={{ color: "#C9A84C" }} />
                  </div>
                </div>
                <h3 className="font-bold text-sm md:text-base" style={{ color: "#F5F0E8" }}>{d.title}</h3>
                <p className="text-xs md:text-sm text-left leading-relaxed" style={{ color: "rgba(245,240,232,0.65)" }}>{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parceiros */}
      <section className="py-16 md:py-24 px-4 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide mb-3" style={{ color: "#F5F0E8" }}>
            Parceiros que Usam
          </h2>
          <div className="w-16 h-1 mx-auto mb-6 rounded-full" style={{ background: "#C9A84C" }} />
          <p className="mb-10" style={{ color: "rgba(245,240,232,0.65)" }}>Fazendas e grupos que confiam no Consubov para sua gestão pecuária.</p>
          {(() => {
            const logos = parceirosLogos.length > 0 ? parceirosLogos : [null, null, null];
            const items = [...logos, ...logos];
            return (
              <div
                className="group relative w-full"
                style={{ maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)" }}
              >
                <div className="flex items-center gap-10 animate-[marquee_20s_linear_infinite] group-hover:[animation-play-state:paused] w-max">
                  {items.map((logo, i) => (
                    <div
                      key={i}
                      className="w-24 h-24 shrink-0 rounded-xl flex items-center justify-center overflow-hidden"
                      style={{ background: "#FFFFFF", border: "1px solid #E0E0E0", padding: "24px" }}
                    >
                      {logo ? (
                        <img src={logo} alt={`Parceiro ${(i % logos.length) + 1}`} className="w-full h-full object-contain p-2" loading="lazy" />
                      ) : (
                        <span className="text-xs" style={{ color: "rgba(245,240,232,0.35)" }}>Logo {(i % 3) + 1}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Formulário */}
      <section id="formulario" className="py-16 md:py-24 px-4" style={{ background: "#0A1A0C" }}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center uppercase tracking-wide mb-2" style={{ color: "#F5F0E8" }}>
            {formTitle}
          </h2>
          <div className="w-16 h-1 mx-auto mt-2 mb-4 rounded-full" style={{ background: "#C9A84C" }} />
          <p className="text-center mb-8" style={{ color: "rgba(245,240,232,0.65)" }}>{formDesc}</p>

          <Dialog open={submitted} onOpenChange={setSubmitted}>
            <DialogContent className="text-center max-w-md" style={{ background: "#1A2E1C", color: "#F5F0E8", border: "1px solid #2E4A30" }}>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-center gap-2" style={{ color: "#C9A84C" }}>
                  <CheckCircle2 className="w-6 h-6" />
                  Mensagem enviada!
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm whitespace-pre-line leading-relaxed mt-2" style={{ color: "rgba(245,240,232,0.8)" }}>
                {formMsgConfirmacao}
              </p>
            </DialogContent>
          </Dialog>

          <div className="rounded-xl p-6 space-y-4" style={{ background: "#1A2E1C", border: "1px solid #2E4A30" }}>
            {[
              { key: "nome", placeholder: "Nome *", type: "text" },
              { key: "email", placeholder: "E-mail *", type: "email" },
              { key: "telefone", placeholder: "Telefone *", type: "text" },
              { key: "whatsapp", placeholder: "WhatsApp *", type: "text" },
            ].map((field) => (
              <div key={field.key}>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={(form as Record<string, string>)[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  maxLength={field.key === "email" ? 255 : field.key === "nome" ? 100 : 20}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all focus:ring-2"
                  style={{
                    background: "#0D1F0F",
                    border: "1px solid #2E4A30",
                    color: "#F5F0E8",
                  }}
                />
                {errors[field.key] && <p className="text-xs mt-1" style={{ color: "#EF4444" }}>{errors[field.key]}</p>}
              </div>
            ))}
            <div>
              <textarea
                placeholder={formPlaceholder}
                value={form.mensagem}
                onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                maxLength={1000}
                rows={4}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none transition-all focus:ring-2"
                style={{ background: "#0D1F0F", border: "1px solid #2E4A30", color: "#F5F0E8" }}
              />
              <p className="text-xs mt-1 italic" style={{ color: "rgba(245,240,232,0.45)" }}>{formMicrofrase}</p>
            </div>
            <button
              className="w-full py-3 rounded-lg font-semibold text-sm uppercase tracking-wide transition-all duration-200 hover:brightness-110 disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#0D1F0F" }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="py-12 px-4" style={{ background: "#081408", borderTop: "1px solid #2E4A30" }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden">
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold" style={{ color: "#F5F0E8" }}>Consubov</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: "rgba(245,240,232,0.6)" }}>
              {rodapeText}
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 text-center" style={{ borderTop: "1px solid rgba(46,74,48,0.5)" }}>
          <p className="text-xs" style={{ color: "rgba(245,240,232,0.35)" }}>© {new Date().getFullYear()} Consubov. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

  useEffect(() => {
    supabase.from("landing_page_content").select("chave, valor").then(({ data, error }) => {
      if (error) {
        console.error("Erro ao carregar conteúdo da landing page:", error);
      }
      if (data) {
        const map: LandingContent = {};
        data.forEach((r) => { if (r.valor) map[r.chave] = r.valor; });
        console.log("Landing page content loaded:", Object.keys(map));
        setContent(map);
      }
      setLoading(false);
    });
  }, []);

  // Derived dynamic images
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

  // Hero carousel auto-advance
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = setInterval(() => setHeroIndex((i) => (i + 1) % heroImages.length), 5000);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  // Reset index if images change
  useEffect(() => {
    setHeroIndex(0);
  }, [heroImages.length]);

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

    await supabase.from("notificacoes").insert({
      tipo: "lead",
      titulo: `Novo lead: ${form.nome.trim()}`,
      mensagem: form.mensagem?.trim() || "Sem mensagem",
      dados: { nome: form.nome, email: form.email, telefone: form.telefone, whatsapp: form.whatsapp, mensagem: form.mensagem },
    });

    setSubmitted(true);
    setSubmitting(false);
    toast.success("Mensagem enviada com sucesso!");
  }, [form]);

  const quemSomosText = content.quem_somos || "O Consubov é uma plataforma tecnológica desenvolvida para transformar a gestão pecuária. Com foco no controle de sal mineral, inteligência nutricional e operação de campo, oferecemos ferramentas que permitem ao pecuarista tomar decisões baseadas em dados reais, direto do pasto.";
  const diferenciaisText = content.diferenciais || "Tecnologia pensada para o campo. Cada funcionalidade foi criada a partir da realidade do dia a dia da pecuária brasileira.";
  const formTitle = content.form_titulo || "Ficou interessado?";
  const formDesc = content.form_descricao || "Preencha o formulário abaixo e nossa equipe entrará em contato.";
  const rodapeText = content.rodape || "Consubov — Tecnologia para Pecuária\nTelefone: (63) 99999-0000\nCNPJ: 00.000.000/0001-00\nPalmas - TO, Brasil";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
          <span className="text-xl font-extrabold text-secondary">C</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <span className="text-primary-foreground font-bold text-lg">Consubov</span>
          </div>
          <Link to="/login">
            <Button variant="secondary" size="sm" className="gap-2 font-semibold">
              <LogIn className="w-4 h-4" />
              Entrar
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Carousel */}
      <section className="relative w-full h-[70vh] min-h-[400px] mt-14 overflow-hidden">
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
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/30 to-background" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-3xl md:text-5xl font-extrabold text-primary-foreground drop-shadow-lg mb-4">
            Gestão Pecuária Inteligente
          </h1>
          <p className="text-primary-foreground/90 text-lg md:text-xl max-w-2xl drop-shadow">
            Controle de sal mineral, relatórios automáticos e inteligência nutricional — direto do pasto.
          </p>
        </div>
        {heroImages.length > 1 && (
          <>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`w-3 h-3 rounded-full transition-all ${heroIndex === i ? "bg-secondary scale-125" : "bg-primary-foreground/50"}`}
                />
              ))}
            </div>
            <button onClick={() => setHeroIndex((i) => (i - 1 + heroImages.length) % heroImages.length)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-primary/50 hover:bg-primary/70 text-primary-foreground rounded-full p-2 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={() => setHeroIndex((i) => (i + 1) % heroImages.length)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-primary/50 hover:bg-primary/70 text-primary-foreground rounded-full p-2 transition-colors">
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </section>

      {/* Quem Somos */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">Quem somos nós</h2>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-full md:w-1/2 rounded-xl overflow-hidden shadow-lg">
              <img src={quemSomosImg} alt="Quem somos" className="w-full h-64 md:h-80 object-cover" loading="lazy" />
            </div>
            <div className="w-full md:w-1/2">
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed whitespace-pre-line">
                {quemSomosText}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="py-16 md:py-24 px-4 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 text-center">Nossos diferenciais</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">{diferenciaisText}</p>

          {diferenciaisImg && (
            <div className="mb-12 rounded-xl overflow-hidden shadow-lg max-w-3xl mx-auto">
              <img src={diferenciaisImg} alt="Nossos diferenciais" className="w-full h-64 md:h-80 object-cover" loading="lazy" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {diferenciais.map((d) => (
              <Card key={d.title} className="hover:shadow-lg transition-shadow border-border/50">
                <CardContent className="pt-6 flex flex-col items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <d.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{d.title}</h3>
                  <p className="text-sm text-muted-foreground">{d.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Parceiros */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">Parceiros que usam</h2>
          <p className="text-muted-foreground mb-8">Fazendas e grupos que confiam no Consubov para sua gestão pecuária.</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {parceirosLogos.length > 0 ? (
              parceirosLogos.map((logo, i) => (
                <div key={logo} className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border">
                  <img src={logo} alt={`Parceiro ${i + 1}`} className="w-full h-full object-contain p-2" loading="lazy" />
                </div>
              ))
            ) : (
              <>
                <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">Logo 1</div>
                <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">Logo 2</div>
                <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">Logo 3</div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Formulário */}
      <section className="py-16 md:py-24 px-4 bg-primary/5">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 text-center">{formTitle}</h2>
          <p className="text-muted-foreground text-center mb-8">{formDesc}</p>

          {submitted ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
                <h3 className="text-lg font-semibold text-foreground">Mensagem enviada!</h3>
                <p className="text-muted-foreground text-sm">Nossa equipe analisará sua solicitação e entrará em contato em breve.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Input placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={100} />
                  {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
                </div>
                <div>
                  <Input type="email" placeholder="E-mail *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Input placeholder="Telefone *" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} maxLength={20} />
                  {errors.telefone && <p className="text-xs text-destructive mt-1">{errors.telefone}</p>}
                </div>
                <div>
                  <Input placeholder="WhatsApp *" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} maxLength={20} />
                  {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
                </div>
                <div>
                  <Textarea placeholder="Nos conte sua dificuldade" value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} maxLength={1000} rows={4} />
                </div>
                <Button className="w-full font-semibold" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Rodapé */}
      <footer className="bg-primary text-primary-foreground py-12 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden">
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold">Consubov</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-primary-foreground/80 text-sm whitespace-pre-line leading-relaxed">
              {rodapeText}
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-primary-foreground/20 text-center">
          <p className="text-primary-foreground/60 text-xs">© {new Date().getFullYear()} Consubov. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

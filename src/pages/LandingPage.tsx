import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowRight,
  CheckCircle2,
  QrCode,
  WifiOff,
  BarChart3,
  Brain,
  Map as MapIcon,
  FileBarChart,
  AlertTriangle,
  EyeOff,
  Zap,
  Activity,
  Sparkles,
} from "lucide-react";

import heroImg from "@/assets/landing-hero-cinematic.jpg";
import pecuaristaImg from "@/assets/landing-pecuarista.jpg";
import phoneImg from "@/assets/landing-phone.png";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import BrasilMap from "@/components/landing/BrasilMap";

const leadSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(10, "Telefone inválido").max(20),
  whatsapp: z.string().trim().min(10, "WhatsApp inválido").max(20),
  mensagem: z.string().trim().max(1000).optional(),
});

const NEON = "#22FF88";
const NEON_DIM = "rgba(34,255,136,0.55)";
const BG = "#05070A";
const CARD_BG = "rgba(12,18,16,0.65)";
const BORDER = "rgba(34,255,136,0.18)";

/* ---------------- Particle Canvas ---------------- */
function ParticleField({ density = 60, opacity = 0.6 }: { density?: number; opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(density, Math.floor((w * h) / 18000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.6 + 0.4,
        a: Math.random() * 0.6 + 0.2,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // links
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.strokeStyle = `rgba(34,255,136,${(1 - d / 110) * 0.12 * opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = `rgba(34,255,136,${p.a * opacity})`;
        ctx.shadowColor = NEON;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [density, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}

/* ---------------- Animated counter ---------------- */
function Counter({ to, suffix = "", prefix = "", duration = 2000 }: { to: number; suffix?: string; prefix?: string; duration?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setN(Math.floor(to * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} style={{ color: NEON, textShadow: `0 0 24px ${NEON_DIM}` }}>
      {prefix}
      {n.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}

/* ---------------- Reveal on scroll ---------------- */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 900ms cubic-bezier(.2,.7,.2,1) ${delay}ms, transform 900ms cubic-bezier(.2,.7,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function LandingPage() {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", whatsapp: "", mensagem: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSubmit = useCallback(async () => {
    const result = leadSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        errs[e.path[0] as string] = e.message;
      });
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
    setSubmitting(false);
    if (error) {
      console.error("Erro ao enviar lead:", error);
      toast.error("Erro ao enviar. Tente novamente.");
      return;
    }
    setSubmitted(true);
    setForm({ nome: "", email: "", telefone: "", whatsapp: "", mensagem: "" });
    setTimeout(() => setSubmitted(false), 6000);
  }, [form]);

  const scrollToForm = () =>
    document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
  const scrollToSolucao = () =>
    document.getElementById("solucao")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: BG, color: "#E6F5EC", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px ${NEON_DIM}} 50%{box-shadow:0 0 40px ${NEON}} }
        @keyframes floatSlow { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-18px) rotate(2deg)} }
        @keyframes scanLine { 0%{transform:translateY(-100%)} 100%{transform:translateY(2000%)} }
        @keyframes dotPulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.6)} }
        @keyframes gridDrift { 0%{background-position:0 0} 100%{background-position:60px 60px} }
        @keyframes glitch { 0%,100%{transform:translate(0)} 20%{transform:translate(-2px,1px)} 40%{transform:translate(2px,-1px)} 60%{transform:translate(-1px,-2px)} 80%{transform:translate(1px,2px)} }
        @keyframes openLeft { 0%{transform:perspective(1200px) rotateY(0)} 100%{transform:perspective(1200px) rotateY(-75deg)} }
        @keyframes openRight { 0%{transform:perspective(1200px) rotateY(0)} 100%{transform:perspective(1200px) rotateY(75deg)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .neon-text { text-shadow: 0 0 12px ${NEON_DIM}, 0 0 32px rgba(34,255,136,0.25); }
        .grid-bg { background-image: linear-gradient(rgba(34,255,136,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(34,255,136,0.06) 1px,transparent 1px); background-size:60px 60px; animation: gridDrift 25s linear infinite; }
        .gate-left { transform-origin: left center; animation: openLeft 2.5s cubic-bezier(.6,.05,.2,1) 0.6s forwards; }
        .gate-right { transform-origin: right center; animation: openRight 2.5s cubic-bezier(.6,.05,.2,1) 0.6s forwards; }
        .phone-float { animation: floatSlow 6s ease-in-out infinite; }
        .glow-btn { box-shadow: 0 0 24px ${NEON_DIM}, inset 0 0 20px rgba(34,255,136,0.15); transition: all .3s; }
        .glow-btn:hover { box-shadow: 0 0 50px ${NEON}, inset 0 0 30px rgba(34,255,136,0.25); transform: translateY(-2px); }
        .glitch-img { animation: glitch 3s infinite; filter: hue-rotate(80deg) saturate(1.2); }
        .shimmer { background: linear-gradient(90deg, transparent, rgba(34,255,136,0.15), transparent); background-size: 200% 100%; animation: shimmer 3s linear infinite; }
      `}</style>

      {/* NAV */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: scrolled ? "rgba(5,7,10,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(16px) saturate(180%)" : "none",
          borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden ring-1" style={{ boxShadow: `0 0 18px ${NEON_DIM}` }}>
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold tracking-[0.2em] text-sm">CONSUBOV</span>
              <span className="text-[10px] tracking-[0.3em]" style={{ color: NEON }}>INTELIGÊNCIA NUTRICIONAL</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-all hover:bg-white/5"
              style={{ border: `1px solid ${NEON_DIM}`, color: "#E6F5EC" }}
            >
              Entrar
            </Link>
            <button
              onClick={scrollToForm}
              className="glow-btn flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider"
              style={{ background: NEON, color: "#03110A" }}
            >
              Demonstração <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: "100vh" }}>
        {/* Background image with parallax */}
        <div className="absolute inset-0" style={{ transform: `translateY(${scrollY * 0.3}px)` }}>
          <img src={heroImg} alt="Fazenda futurista" className="w-full h-full object-cover" style={{ opacity: 0.55 }} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 0%, ${BG} 75%)` }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${BG} 0%, transparent 30%, transparent 60%, ${BG} 100%)` }} />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 grid-bg opacity-40" />

        {/* Particles */}
        <ParticleField density={80} opacity={0.9} />

        {/* Portal / Gate animation */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative" style={{ width: "min(620px, 90vw)", height: "min(620px, 90vw)" }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(34,255,136,0.18) 0%, transparent 60%)`,
                animation: "pulseGlow 4s ease-in-out infinite",
              }}
            />
            {/* Two "gate" panels opening */}
            <div
              className="gate-left absolute top-1/2 left-1/2 -translate-y-1/2"
              style={{
                width: "50%",
                height: "70%",
                marginLeft: "-50%",
                background: "linear-gradient(90deg, rgba(5,7,10,0.95), rgba(5,7,10,0.4))",
                borderRight: `1px solid ${NEON_DIM}`,
                boxShadow: `inset -20px 0 60px ${NEON_DIM}`,
              }}
            />
            <div
              className="gate-right absolute top-1/2 left-1/2 -translate-y-1/2"
              style={{
                width: "50%",
                height: "70%",
                background: "linear-gradient(-90deg, rgba(5,7,10,0.95), rgba(5,7,10,0.4))",
                borderLeft: `1px solid ${NEON_DIM}`,
                boxShadow: `inset 20px 0 60px ${NEON_DIM}`,
              }}
            />
            {/* Concentric rings */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute rounded-full border"
                style={{
                  inset: `${i * 8}%`,
                  borderColor: NEON_DIM,
                  opacity: 0.3 / i,
                  animation: `pulseGlow ${3 + i}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-5 pt-32 pb-24 min-h-screen flex flex-col items-center justify-center text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(34,255,136,0.08)", border: `1px solid ${BORDER}` }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: NEON }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: NEON }} />
            </span>
            <span className="text-[11px] tracking-[0.3em] font-medium" style={{ color: NEON }}>SISTEMA ATIVO • BR</span>
          </div>

          <h1
            className="font-black tracking-[-0.02em] mb-6 neon-text"
            style={{
              fontSize: "clamp(3rem, 11vw, 8rem)",
              lineHeight: 0.95,
              background: `linear-gradient(180deg, #FFFFFF 0%, ${NEON} 200%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            CONSUBOV
          </h1>

          <p className="text-xl md:text-3xl font-bold tracking-wide mb-4" style={{ color: "#F5F5F5" }}>
            O FUTURO DA PECUÁRIA <span style={{ color: NEON }} className="neon-text">CHEGOU.</span>
          </p>

          <p className="max-w-2xl text-sm md:text-lg opacity-70 leading-relaxed mb-10 px-4">
            Tecnologia, inteligência de dados e gestão remota para fazendas de alta performance.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={scrollToForm}
              className="glow-btn px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ background: NEON, color: "#03110A" }}
            >
              Solicitar Demonstração <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToSolucao}
              className="px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:bg-white/5"
              style={{ border: `1px solid ${NEON_DIM}`, color: "#E6F5EC" }}
            >
              Conheça a Plataforma
            </button>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60">
            <span className="text-[10px] tracking-[0.3em]">SCROLL</span>
            <div className="w-px h-10 bg-gradient-to-b from-transparent via-white to-transparent" />
          </div>
        </div>
      </section>

      {/* ========== NÚMEROS ========== */}
      <section className="relative py-24 px-5 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="max-w-6xl mx-auto relative">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-xs tracking-[0.4em] font-medium" style={{ color: NEON }}>// IMPACTO REAL</span>
              <h2 className="text-3xl md:text-5xl font-black mt-3 tracking-tight">
                Números que <span className="neon-text" style={{ color: NEON }}>movem o setor</span>
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { value: 130000, suffix: "+", label: "Animais monitorados", icon: Activity },
              { value: 12, suffix: " estados", label: "Atendidos no Brasil", icon: MapIcon },
              { value: 99, suffix: "%", label: "Uptime em tempo real", icon: Zap },
              { value: 340, suffix: "%", label: "Crescimento anual", icon: BarChart3 },
            ].map((stat, i) => (
              <Reveal key={i} delay={i * 100}>
                <div
                  className="relative rounded-2xl p-6 md:p-8 h-full overflow-hidden group"
                  style={{ background: CARD_BG, border: `1px solid ${BORDER}`, backdropFilter: "blur(10px)" }}
                >
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30 blur-3xl group-hover:opacity-60 transition-opacity"
                    style={{ background: NEON }}
                  />
                  <stat.icon className="w-6 h-6 mb-4" style={{ color: NEON }} />
                  <div className="text-4xl md:text-5xl font-black tracking-tight">
                    <Counter to={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-xs md:text-sm mt-2 opacity-70 uppercase tracking-wider">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PROBLEMA ========== */}
      <section className="relative py-24 px-5 overflow-hidden" style={{ background: "#02040680" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div>
              <span className="text-xs tracking-[0.4em] font-medium text-red-400">// O PROBLEMA</span>
              <h2 className="text-3xl md:text-5xl font-black mt-3 mb-6 tracking-tight leading-[1.05]">
                A pecuária ainda <br />
                <span className="text-red-400">sofre no escuro.</span>
              </h2>
              <ul className="space-y-4 mt-8">
                {[
                  "Falta de controle operacional",
                  "Informações perdidas no campo",
                  "Gestão distante da realidade",
                  "Decisões tomadas no escuro",
                  "Falhas humanas constantes",
                ].map((p, i) => (
                  <li key={i} className="flex items-start gap-3 text-base md:text-lg opacity-80">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="relative aspect-square rounded-2xl overflow-hidden glitch-img" style={{ border: `1px solid ${BORDER}`, background: CARD_BG }}>
              <div className="absolute inset-0 grid-bg opacity-30" />
              {/* fake "broken dashboard" */}
              <div className="absolute inset-0 p-6 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] tracking-widest text-red-400">SYSTEM ERROR // 0x4F</span>
                  <EyeOff className="w-4 h-4 text-red-400" />
                </div>
                <div className="h-1 bg-red-500/30 rounded">
                  <div className="h-full w-1/3 bg-red-500 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <div className="h-1.5 w-1/2 bg-red-400/40 rounded mb-2" />
                      <div className="h-3 w-3/4 bg-red-400/20 rounded" />
                    </div>
                  ))}
                </div>
                <div className="mt-auto text-center text-red-400 font-mono text-xs opacity-60">
                  ▮▮▮▮▮▮▯▯▯▯ DADOS PERDIDOS
                </div>
              </div>
              {/* scan line */}
              <div className="absolute left-0 right-0 h-1" style={{ background: "rgba(239,68,68,0.4)", animation: "scanLine 4s linear infinite" }} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== SOLUÇÃO ========== */}
      <section id="solucao" className="relative py-24 px-5 overflow-hidden">
        <ParticleField density={40} opacity={0.5} />
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center relative">
          <Reveal>
            <div className="relative flex justify-center">
              <div
                className="absolute inset-0 rounded-full blur-3xl"
                style={{ background: `radial-gradient(circle, ${NEON_DIM}, transparent 70%)`, animation: "pulseGlow 5s ease-in-out infinite" }}
              />
              <div className="phone-float relative w-full max-w-sm">
                <img src={phoneImg} alt="App Consubov" className="w-full" loading="lazy" />
                {/* Substitui o ícone de touro genérico (embutido no PNG) pela logo real */}
                <img
                  src={logoConsubov}
                  alt="Consubov"
                  className="absolute rounded-full object-cover"
                  style={{
                    top: "10.8%",
                    left: "27%",
                    width: "10%",
                    aspectRatio: "1/1",
                    boxShadow: `0 0 10px ${NEON_DIM}`,
                    border: `1px solid ${NEON_DIM}`,
                    background: "#05070A",
                  }}
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div>
              <span className="text-xs tracking-[0.4em] font-medium" style={{ color: NEON }}>// A SOLUÇÃO</span>
              <h2 className="text-3xl md:text-5xl font-black mt-3 mb-6 tracking-tight leading-[1.05]">
                Transformamos rotina de campo em{" "}
                <span className="neon-text" style={{ color: NEON }}>inteligência gerencial.</span>
              </h2>
              <p className="opacity-70 text-base md:text-lg mb-8 leading-relaxed">
                Uma plataforma viva — opera offline, sincroniza tudo, e entrega decisões em tempo real direto do pasto para a sala de gestão.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: QrCode, label: "Leitura por QR Code" },
                  { icon: CheckCircle2, label: "Registro de salgas" },
                  { icon: WifiOff, label: "Funciona offline" },
                  { icon: BarChart3, label: "Dashboards inteligentes" },
                  { icon: MapIcon, label: "Mapas da fazenda" },
                  { icon: FileBarChart, label: "Relatórios automáticos" },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-3 rounded-lg text-xs md:text-sm"
                    style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
                  >
                    <f.icon className="w-4 h-4 shrink-0" style={{ color: NEON }} />
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== INTELIGÊNCIA DE DADOS / MAPA BRASIL ========== */}
      <section className="relative py-24 px-5 overflow-hidden" style={{ background: "#02040680" }}>
        <div className="max-w-6xl mx-auto text-center relative">
          <Reveal>
            <span className="text-xs tracking-[0.4em] font-medium" style={{ color: NEON }}>// REDE NACIONAL</span>
            <h2 className="text-3xl md:text-5xl font-black mt-3 mb-4 tracking-tight">
              Dados reais gerando <span className="neon-text" style={{ color: NEON }}>decisões reais.</span>
            </h2>
            <p className="opacity-70 max-w-2xl mx-auto mb-12">
              Em breve, o maior ecossistema de inteligência nutricional bovina da América Latina.
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div
              className="relative mx-auto rounded-2xl overflow-hidden"
              style={{
                maxWidth: 760,
                aspectRatio: "1/1",
                background: "radial-gradient(ellipse at center, rgba(34,255,136,0.10), transparent 70%)",
                border: `1px solid ${BORDER}`,
              }}
            >
              <div className="absolute inset-0 grid-bg opacity-20" />

              {/* Real vector Brazil map (IBGE-derived GeoJSON) */}
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <BrasilMap />
              </div>

              {/* Live ticker */}
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-center">
                {["TO • online", "GO • online", "MT • online", "MS • online", "PA • online", "BA • online"].map((s, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-1 rounded-full font-mono"
                    style={{ background: "rgba(34,255,136,0.1)", color: NEON, border: `1px solid ${BORDER}` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== IMPACTO EMOCIONAL ========== */}
      <section className="relative overflow-hidden" style={{ minHeight: "80vh" }}>
        <div className="absolute inset-0">
          <img src={pecuaristaImg} alt="Pecuarista visionário" className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${BG} 0%, transparent 30%, transparent 70%, ${BG} 100%)` }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${BG}cc 0%, transparent 50%)` }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-5 py-32 md:py-48 flex items-center min-h-[80vh]">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs tracking-[0.4em] font-medium" style={{ color: NEON }}>// MANIFESTO</span>
              <h2
                className="font-black mt-4 leading-[0.95] tracking-tight neon-text"
                style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)" }}
              >
                Quem lidera o campo,<br />
                <span style={{ color: NEON }}>lidera o futuro.</span>
              </h2>
              <p className="mt-6 text-base md:text-lg opacity-80 max-w-lg leading-relaxed">
                Não vendemos software. Construímos a infraestrutura digital da pecuária brasileira.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== FORMULÁRIO / CTA FINAL ========== */}
      <section id="formulario" className="relative py-24 px-5 overflow-hidden">
        <ParticleField density={50} opacity={0.6} />
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, rgba(34,255,136,0.08) 0%, transparent 60%)` }}
        />

        <div className="max-w-4xl mx-auto relative text-center mb-12">
          <Reveal>
            <div
              className="w-20 h-20 mx-auto rounded-2xl overflow-hidden mb-6"
              style={{ boxShadow: `0 0 60px ${NEON_DIM}`, border: `1px solid ${BORDER}` }}
            >
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs tracking-[0.4em] font-medium" style={{ color: NEON }}>// ESTAMOS CHEGANDO</span>
            <h2 className="text-4xl md:text-6xl font-black mt-4 mb-4 tracking-tight neon-text">
              Quero fazer <span style={{ color: NEON }}>parte.</span>
            </h2>
            <p className="opacity-70 max-w-xl mx-auto">
              Preencha abaixo e nossa equipe entrará em contato. Cada fazenda é única — e queremos entender a sua.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div
            className="max-w-lg mx-auto rounded-2xl p-6 md:p-8 relative"
            style={{ background: CARD_BG, border: `1px solid ${BORDER}`, backdropFilter: "blur(20px)" }}
          >
            <div className="absolute inset-0 rounded-2xl shimmer pointer-events-none opacity-30" />
            {submitted ? (
              <div className="text-center py-12 relative">
                <Sparkles className="w-12 h-12 mx-auto mb-4" style={{ color: NEON }} />
                <h3 className="text-2xl font-bold mb-2" style={{ color: NEON }}>Mensagem enviada!</h3>
                <p className="opacity-70 text-sm leading-relaxed">
                  Nossa equipe irá analisar com atenção e entrar em contato.<br />
                  <span className="font-semibold mt-2 inline-block">Equipe Consubov</span>
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative">
                {[
                  { key: "nome", placeholder: "Nome completo", type: "text" },
                  { key: "email", placeholder: "E-mail", type: "email" },
                  { key: "telefone", placeholder: "Telefone", type: "tel" },
                  { key: "whatsapp", placeholder: "WhatsApp", type: "tel" },
                ].map((field) => (
                  <div key={field.key}>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={(form as Record<string, string>)[field.key]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all focus:border-[#22FF88]"
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: `1px solid ${BORDER}`,
                        color: "#E6F5EC",
                      }}
                    />
                    {errors[field.key] && <p className="text-xs mt-1 text-red-400">{errors[field.key]}</p>}
                  </div>
                ))}
                <textarea
                  placeholder="Conte um pouco da sua realidade no campo..."
                  value={form.mensagem}
                  onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none resize-none transition-all"
                  style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${BORDER}`, color: "#E6F5EC" }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="glow-btn w-full py-4 rounded-xl font-bold text-sm uppercase tracking-[0.2em] disabled:opacity-50 mt-2"
                  style={{ background: NEON, color: "#03110A" }}
                >
                  {submitting ? "Enviando..." : "Quero fazer parte"}
                </button>
              </div>
            )}
          </div>
        </Reveal>
      </section>

      {/* RODAPÉ */}
      <footer className="relative py-12 px-5" style={{ borderTop: `1px solid ${BORDER}`, background: "#02030580" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden">
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-extrabold tracking-[0.2em] text-sm">CONSUBOV</div>
              <div className="text-[10px] tracking-[0.3em] opacity-60">INTELIGÊNCIA NUTRICIONAL</div>
            </div>
          </div>
          <div className="text-center md:text-right text-xs opacity-60 leading-relaxed">
            <p>Araguaína — TO, Brasil • (63) 99113-6071</p>
            <p>© 2026 Consubov. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

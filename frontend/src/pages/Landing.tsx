import { Brain, ArrowRight, FileText, Link2, Image as ImageIcon, Video, Sparkles, Search, Tag, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";


const Landing = () => {
  const navigate = useNavigate();

  return (
  <div className="relative min-h-screen overflow-hidden text-foreground bg-gradient-to-b from-[#0a0f1f] via-[#0a0d17] to-[#05070d]">
      {/* Background FX layers: gradient glow, dotted grid, orbital curves, drifting orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
        {/* Soft radial glow from top-right blending purple → blue (ambient neon through mist) */}
        <div
          className="absolute -top-[22%] -right-[12%] w-[78vw] h-[78vw] blur-3xl opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(167,139,250,0.12) 0%, rgba(96,165,250,0.10) 45%, transparent 70%)",
            filter: "saturate(115%)",
          }}
        />
        {/* Additional diffused blue ambient light */}
        <div
          className="absolute -top-[10%] right-[10%] w-[55vw] h-[55vw] blur-3xl opacity-100"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0.06) 40%, transparent 70%)",
          }}
        />

        {/* Dotted grid pattern with slow drift to evoke structured intelligence */}
        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0",
            animation: "gridShift 80s linear infinite",
          }}
        />

        {/* Orbital curves (subtle strokes) rotating slowly */}
        <svg
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] opacity-[0.04] blur-[0.2px]"
          style={{ animation: "orbitRotate 30s linear infinite" }}
          viewBox="0 0 1200 1200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="orbStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <g stroke="url(#orbStroke)" strokeWidth="0.8">
            <circle cx="600" cy="600" r="420" />
            <ellipse cx="600" cy="600" rx="500" ry="250" />
            <ellipse cx="600" cy="600" rx="300" ry="520" />
            <path d="M100 600 C 300 300, 900 300, 1100 600" />
            <path d="M200 700 C 400 900, 800 300, 1000 500" />
          </g>
        </svg>

        {/* Drifting glow orbs for a living interface feel */}
        {[
          { cls: "top-[18%] right-[18%]", size: 240, hue: "rgba(96,165,250,0.10)", delay: 0, dur: 20 },
          { cls: "bottom-[14%] left-[15%]", size: 220, hue: "rgba(167,139,250,0.10)", delay: 0, dur: 22 },
          { cls: "top-[8%] left-[28%]", size: 180, hue: "rgba(255,255,255,0.10)", delay: 0, dur: 18 },
          { cls: "top-[42%] left-[8%]", size: 200, hue: "rgba(139,92,246,0.10)", delay: 0, dur: 24 },
          { cls: "bottom-[10%] right-[10%]", size: 260, hue: "rgba(96,165,250,0.10)", delay: 0, dur: 19 },
          { cls: "top-[55%] right-[38%]", size: 160, hue: "rgba(167,139,250,0.10)", delay: 0, dur: 17 },
          { cls: "bottom-[28%] left-[40%]", size: 140, hue: "rgba(255,255,255,0.10)", delay: 0, dur: 16 },
        ].map((o, i) => (
          <span
            key={i}
            className={`absolute ${o.cls} rounded-full blur-3xl shadow-[0_0_80px_30px_rgba(0,0,0,0.25)]`}
            style={{
              width: o.size,
              height: o.size,
              background: `radial-gradient(closest-side, ${o.hue}, transparent 70%)`,
              animation: `drift ${o.dur}s ease-in-out ${o.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>
      {/* Header */}
  <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold">MindFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              className="text-sm border-border/50 hover:border-primary/50 px-4 py-2 sm:px-5"
              onClick={() => navigate("/auth/login")}
            >
              Log in
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 pt-28 pb-20 sm:px-6 lg:pt-32">
        {/* Glass panel behind hero for legibility */}
        <div className="absolute inset-x-4 top-24 flex justify-center -z-10 sm:inset-x-6">
          <div className="relative h-[min(420px,70vh)] w-[min(1100px,92vw)] sm:h-[min(440px,70vh)]">
            {/* Distant star-like glow behind the glass */}
            <div
              className="absolute -inset-10 rounded-[36px] blur-3xl opacity-70 animate-starPulse"
              style={{
                backgroundImage:
                  "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent 60%)",
              }}
            />
            {/* Frosted glass surface with faint border */}
            <div className="absolute inset-0 rounded-[28px] bg-white/5 backdrop-blur-2xl border border-white/12 shadow-[0_10px_60px_rgba(2,6,23,0.6)]" />
            {/* Subtle outer ring to enhance layered depth */}
            <div className="absolute inset-0 rounded-[28px] ring-1 ring-white/10" />
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary">Your personal digital brain</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl"
          >
            Collect. Think. Create.
          </motion.h1>

          {/* Content Type Pills */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-3 pb-5"
          >
            {[
              { icon: FileText, label: "Notes" },
              { icon: Link2, label: "Links" },
              { icon: FileText, label: "Articles" },
              { icon: ImageIcon, label: "Images" },
              { icon: Video, label: "Videos" },
            ].map((type, idx) => (
              <motion.div
                key={type.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + idx * 0.05 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <type.icon className="w-4 h-4" />
                <span className="text-sm">{type.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Subheadline */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            MindFlow helps you capture everything, organize it with AI auto-tagging, and surface insights
            instantly with smart search — minimal, fast, and thoughtful.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-12 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
          >
            <Button 
              size="lg"
              className="w-full bg-gradient-primary px-8 text-primary-foreground transition-all hover:opacity-90 hover:shadow-glow sm:w-auto"
              onClick={() => navigate("/auth/signin")}
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full border-border/60 bg-white/5 px-8 transition-all hover:border-primary/50 hover:bg-primary/5 sm:w-auto"
              onClick={() => navigate("/auth/login")}
            >
              Log in
            </Button>
          </motion.div>

        </div>

        {/* Subtle neon accent edge */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[calc(24rem+48px)] w-[min(1000px,88vw)] h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent blur-[1px]" />
      </section>

      {/* Features Section */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold mb-16 text-center"
          >
            What MindFlow Does
          </motion.h2>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                icon: Inbox,
                title: "Capture Anything",
                description: "Save notes, links, articles (PDFs), images, and videos in seconds. MindFlow stays out of the way so ideas keep moving.",
              },
              {
                icon: Tag,
                title: "AI Auto-tagging",
                description: "Intelligent organization that learns from you. Clean structure without the manual sorting.",
              },
              {
                icon: Search,
                title: "Smart Search",
                description: "Ask in natural language to find insights instantly — across everything you've saved.",
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="p-8 rounded-3xl bg-card border border-border hover:border-primary/30 hover:shadow-glow transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What MindFlow Does Section */}
      <section className="bg-card/30 px-4 py-20 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold mb-16 text-center"
          >
            What Makes MindFlow Different
          </motion.h2>
          
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                icon: Brain,
                title: "Intelligent Spaces",
                description: "MindFlow helps you capture your similar interests in one place — thoughts, links, notes, and media — and turns them into organized knowledge.",
                gradient: "from-primary/20 to-primary/5",
                iconBg: "bg-primary/10",
                iconColor: "text-primary"
              },
              {
                icon: Sparkles,
                title: "Effortlessly Smart",
                description: "Your personal digital brain — creates smart AI generated semantic tags and descriptions to structure your media effortlessly.",
                gradient: "from-accent/20 to-accent/5",
                iconBg: "bg-accent/10",
                iconColor: "text-accent"
              },
              {
                icon: Search,
                title: "Instant Rediscovery",
                description: "Save, search, and rediscover your ideas instantly without losing them with just a trace of context and time.",
                gradient: "from-primary/20 to-accent/10",
                iconBg: "bg-gradient-primary",
                iconColor: "text-white"
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ 
                  duration: 0.6, 
                  delay: idx * 0.15,
                  type: "spring",
                  stiffness: 100
                }}
                whileHover={{ 
                  y: -8, 
                  scale: 1.02,
                  transition: { duration: 0.2 } 
                }}
                className={`relative p-8 rounded-3xl bg-gradient-to-br ${feature.gradient} border border-border/50 hover:border-primary/40 transition-all duration-300 overflow-hidden group cursor-pointer`}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-xl" />
                </div>

                <div className="relative z-10">
                  <motion.div 
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                    className={`w-16 h-16 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-6 shadow-lg group-hover:shadow-glow`}
                  >
                    <feature.icon className={`w-8 h-8 ${feature.iconColor}`} />
                  </motion.div>
                  
                  <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Decorative corner element */}
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold">MindFlow</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 · Simplicity meets intelligence</p>
        </div>
      </footer>

      {/* Local styles for animations and background effects */}
      <style>
        {`
        @keyframes drift {
          0% { transform: translate3d(0,0,0) scale(1); filter: brightness(1); }
          50% { transform: translate3d(22px,-30px,0) scale(1.015); filter: brightness(1.06); }
          100% { transform: translate3d(-24px,26px,0) scale(0.985); filter: brightness(0.96); }
        }
        @keyframes orbitRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes gridShift {
          0% { background-position: 0 0; }
          50% { background-position: 60px 30px; }
          100% { background-position: 0 0; }
        }
        @keyframes starPulse {
          0% { opacity: 0.55; transform: scale(0.985); }
          50% { opacity: 0.75; transform: scale(1.02); }
          100% { opacity: 0.55; transform: scale(0.985); }
        }
        `}
      </style>
    </div>
  );
};

export default Landing;

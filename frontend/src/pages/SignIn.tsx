import { Brain, Mail, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle, isAuthenticated, authStorage } from "@/lib/auth";
import { useState } from "react";
import { api } from "@/lib/api";
import { useEffect } from "react";

const SignIn = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleGoogleSignIn = () => {
    // Redirect to backend Google OAuth
    loginWithGoogle();
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword || submitting) return;
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await api.post("/api/v1/auth/register", {
        email,
        password,
        name: name || undefined,
      });
      authStorage.setToken(res.access_token);
      if (res.user) authStorage.setUser(res.user);
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to register:", err);
      const message = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center p-6 text-foreground
                 bg-gradient-to-b from-[#0a0f1f] via-[#0a0d17] to-[#05070d]"
      style={{ fontFamily: 'Inter, "Space Grotesk", Satoshi, ui-sans-serif, system-ui, -apple-system' }}
    >
      {/* Ambient background: soft purple-blue radial edges, subtle grid, drifting orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Main ambient glow (top-right) */}
        <div
          className="absolute -top-[22%] -right-[12%] w-[78vw] h-[78vw] blur-3xl opacity-80"
          style={{
            backgroundImage:
              'radial-gradient(closest-side, rgba(167,139,250,0.12) 0%, rgba(96,165,250,0.10) 45%, transparent 70%)',
            filter: 'saturate(115%)',
          }}
        />
        {/* Secondary diffused blue */}
        <div
          className="absolute -top-[8%] right-[8%] w-[55vw] h-[55vw] blur-3xl opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(closest-side, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0.06) 40%, transparent 70%)',
          }}
        />
        {/* Dotted grid (very subtle) */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0',
            animation: 'gridShift 80s linear infinite',
          }}
        />
        {/* Drifting orbs */}
        {[
          { cls: 'top-[18%] right-[22%]', size: 240, hue: 'rgba(96,165,250,0.08)', delay: 0, dur: 20 },
          { cls: 'bottom-[18%] left-[18%]', size: 220, hue: 'rgba(167,139,250,0.08)', delay: 6, dur: 22 },
          { cls: 'top-[52%] left-[44%]', size: 160, hue: 'rgba(255,255,255,0.05)', delay: 9, dur: 18 },
        ].map((o, i) => (
          <span
            key={i}
            className={`absolute ${o.cls} rounded-full blur-3xl`}
            style={{
              width: o.size,
              height: o.size,
              background: `radial-gradient(closest-side, ${o.hue}, transparent 70%)`,
              animation: `mf-drift ${o.dur}s ease-in-out ${o.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold">MindFlow</span>
          </div>
          <Button 
            variant="outline" 
            className="border-white/20 hover:border-violet-400/50 hover:bg-white/5 transition-all"
            onClick={() => navigate("/")}
          >
            Back
          </Button>
        </div>
      </header>

      {/* Sign In Form */}
      <div className="relative z-10 w-full max-w-md">
        <div className="relative p-12 rounded-[32px] border border-white/12 bg-white/10 backdrop-blur-2xl text-white
                        shadow-[0_10px_60px_rgba(2,6,23,0.6)] overflow-hidden opacity-0 scale-95 animate-[mf-pop_320ms_ease-out_forwards]">
          {/* subtle gradient edges */}
          <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-white/10" />
          <div className="pointer-events-none absolute inset-0 rounded-[32px]"
               style={{ background: 'radial-gradient(60% 60% at 0% 0%, rgba(139,92,246,0.18), transparent 60%), radial-gradient(50% 60% at 100% 100%, rgba(79,70,229,0.18), transparent 60%)' }} />
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary" />
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold text-center mb-2">Create your account</h1>
          <p className="text-center text-muted-foreground mb-8">
            Start capturing everything you care about in one intelligent space.
          </p>

          {/* Google Sign In */}
          <Button
            size="lg"
            className="w-full mb-4 relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white
                       shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                       transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]
                       after:content-[''] after:absolute after:inset-0 after:rounded-[inherit] after:bg-white/20 after:opacity-0
                       active:after:opacity-100 active:after:animate-[mf-ripple_600ms_ease-out]"
            onClick={handleGoogleSignIn}
          >
            <Mail className="mr-2 w-5 h-5" />
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 rounded-md bg-white/5 backdrop-blur text-white/70">or</span>
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <Input
                type="email"
                placeholder="Email address"
                className="pl-12 h-12 rounded-2xl bg-white/5 backdrop-blur border border-white/10 text-white placeholder-white/50 shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Input
              type="text"
              placeholder="Name (optional)"
              className="h-12 rounded-2xl bg-white/5 backdrop-blur border border-white/10 text-white placeholder-white/50 shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="pl-12 pr-12 h-12 rounded-2xl bg-white/5 backdrop-blur border border-white/10 text-white placeholder-white/50 shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80 transition"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                className="pl-12 pr-12 h-12 rounded-2xl bg-white/5 backdrop-blur border border-white/10 text-white placeholder-white/50 shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80 transition"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errorMsg && (
              <p className="text-center text-sm text-red-400" role="alert">
                {errorMsg}
              </p>
            )}

            <Button
              size="lg"
              variant="secondary"
              className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white
                         shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                         transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]
                         after:content-[''] after:absolute after:inset-0 after:rounded-[inherit] after:bg-white/20 after:opacity-0
                         active:after:opacity-100 active:after:animate-[mf-ripple_600ms_ease-out]"
              onClick={handleRegister}
              disabled={!email || !password || !confirmPassword || submitting}
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </Button>
          </div>

          <div className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <button
              className="text-primary hover:underline"
              onClick={() => navigate("/auth/login")}
            >
              Log in
            </button>
          </div>
        </div>
      </div>

      {/* Local styles for subtle motion and ripple */}
      <style>{`
        @keyframes mf-pop { 0% { opacity: 0; transform: scale(.95); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes mf-ripple { from { opacity: .35; transform: scale(.8); } to { opacity: 0; transform: scale(1.35); } }
        @keyframes gridShift { 0% { background-position: 0 0; } 50% { background-position: 60px 30px; } 100% { background-position: 0 0; } }
        @keyframes mf-drift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(16px,-22px,0) scale(1.01); } 100% { transform: translate3d(-18px,18px,0) scale(0.99); } }
      `}</style>
    </div>
  );
};

export default SignIn;

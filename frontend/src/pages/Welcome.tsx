import { useNavigate } from "react-router-dom";
import { APP_NAME, APP_TAGLINE } from "../constants/brand";
import { useProfile } from "../contexts/ProfileContext";

export default function Welcome() {
  const navigate = useNavigate();
  const { completeOnboarding } = useProfile();

  function handleGetStarted() {
    completeOnboarding();
    navigate("/home", { replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Welcome to
          </p>
          <h1 className="mt-3 bg-gradient-to-r from-white via-emerald-100 to-emerald-300 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl md:text-6xl">
            {APP_NAME}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">
            {APP_TAGLINE} and helps you discover music you&apos;ll actually love.
          </p>
          <button
            type="button"
            onClick={handleGetStarted}
            className="mt-10 inline-flex rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-8 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] hover:from-emerald-300 hover:to-emerald-400"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

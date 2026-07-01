import { useEffect, useState } from "react";
import { APP_NAME } from "../constants/brand";
import SenseLogo from "./SenseLogo";

const SPLASH_DURATION_MS = 1200;

export default function SplashScreen() {
  const [phase, setPhase] = useState<"enter" | "exit" | "done">("enter");

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setPhase("exit"), SPLASH_DURATION_MS - 350);
    const doneTimer = window.setTimeout(() => setPhase("done"), SPLASH_DURATION_MS);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "done") {
    return null;
  }

  return (
    <div
      className={[
        "splash-screen fixed inset-0 z-[100] flex flex-col items-center justify-center",
        phase === "exit" ? "splash-screen-exit" : "splash-screen-enter",
      ].join(" ")}
      aria-hidden
    >
      <div className="splash-logo-wrap">
        <SenseLogo className="h-20 w-20 splash-logo" />
      </div>
      <p className="splash-title mt-5 text-2xl font-semibold tracking-[0.35em] text-white">
        {APP_NAME.toUpperCase()}
      </p>
    </div>
  );
}

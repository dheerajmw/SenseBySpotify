import { NavLink, Outlet } from "react-router-dom";
import { DISCOVER_LABEL } from "../constants/brand";
import BrandHeader from "./BrandHeader";
import DemoModeToggle from "./DemoModeToggle";
import GlobalSearch from "./GlobalSearch";
import MusicPlayerBar from "./MusicPlayerBar";
import SessionIntentPrompt from "./SessionIntentPrompt";
import SessionStatusPill from "./SessionStatusPill";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-emerald-500/20 text-emerald-300"
      : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
  ].join(" ");

export default function Layout() {
  return (
    <div className="player-bar-offset min-h-screen">
      <header className="safe-top sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <BrandHeader />
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:gap-3">
              <GlobalSearch />
              <DemoModeToggle />
            </div>
          </div>
          <nav className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 scrollbar-hide sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0">
            <NavLink to="/home" className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/search" className={navLinkClass}>
              Search
            </NavLink>
            <NavLink to="/discovery" className={navLinkClass}>
              {DISCOVER_LABEL}
            </NavLink>
            <NavLink to="/feed" className={navLinkClass}>
              Feed
            </NavLink>
            <NavLink to="/now-playing" className={navLinkClass}>
              Now Playing
            </NavLink>
          </nav>
        </div>
      </header>
      <SessionStatusPill />
      <main className="layout-main-with-pill mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        <Outlet />
      </main>
      <MusicPlayerBar />
      <SessionIntentPrompt />
    </div>
  );
}

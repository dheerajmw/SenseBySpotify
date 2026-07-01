import { NavLink, Outlet } from "react-router-dom";
import { DISCOVER_LABEL } from "../constants/brand";
import BrandHeader from "./BrandHeader";
import DemoModeToggle from "./DemoModeToggle";
import GlobalSearch from "./GlobalSearch";
import MusicPlayerBar from "./MusicPlayerBar";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-emerald-500/20 text-emerald-300"
      : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
  ].join(" ");

export default function Layout() {
  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <BrandHeader />
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <GlobalSearch />
              <DemoModeToggle />
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <MusicPlayerBar />
    </div>
  );
}

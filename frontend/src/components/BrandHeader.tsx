import { Link } from "react-router-dom";
import {
  APP_NAME,
  APP_TAGLINE_DETAIL,
  APP_TAGLINE_LEAD,
} from "../constants/brand";
import SenseLogo from "./SenseLogo";

export default function BrandHeader() {
  return (
    <Link
      to="/home"
      className="group flex min-w-0 items-center gap-3 rounded-xl outline-offset-4 transition hover:opacity-95"
    >
      <div className="relative shrink-0">
        <div className="absolute -inset-1 rounded-full bg-emerald-500/15 opacity-0 blur-md transition group-hover:opacity-100" />
        <SenseLogo className="relative h-9 w-9 transition-transform group-hover:scale-[1.03] sm:h-11 sm:w-11" />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xl font-bold leading-none tracking-tight text-white sm:text-[1.35rem]">
            {APP_NAME}
          </span>
          <span className="text-sm font-medium leading-none text-zinc-500">
            by <span className="font-semibold text-[#1ed760]">Spotify</span>
          </span>
        </div>

        <p className="mt-1.5 hidden max-w-md text-sm leading-snug sm:block">
          <span className="font-medium text-zinc-300">{APP_TAGLINE_LEAD}</span>
          <span className="text-zinc-600"> · </span>
          <span className="text-zinc-500">{APP_TAGLINE_DETAIL}</span>
        </p>
      </div>
    </Link>
  );
}

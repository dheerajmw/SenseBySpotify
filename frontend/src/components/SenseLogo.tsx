import { useId } from "react";

interface SenseLogoProps {
  className?: string;
}

export default function SenseLogo({ className = "h-16 w-16" }: SenseLogoProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="56" y2="56">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        opacity="0.35"
      />
      <circle
        cx="32"
        cy="32"
        r="20"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        opacity="0.55"
      />
      <path
        d="M38 18c-6-2-14 1-14 9 0 6 6 8 12 10 5 2 8 4 8 9 0 7-8 11-16 9-4-1-7-3-9-6"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 28c2-4 6-6 10-6M42 36c-2 4-6 7-10 7"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

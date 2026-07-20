"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DeviceStatus from "./DeviceStatus";

const navItems = [
  {
    href: "/guide",
    label: "TV Guide",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    href: "/recordings",
    label: "Recordings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-bg-secondary border-b border-border flex items-center px-4 h-14 shrink-0">
      <div className="flex items-center gap-2 mr-8">
        <div className="w-8 h-8 rounded-lg bg-accent-cyan flex items-center justify-center" style={{ boxShadow: "0 0 16px rgba(0,212,255,0.4)" }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-bg-primary">
            <path d="M21 6.5a2.5 2.5 0 0 0-2.5-2.5H4A2.5 2.5 0 0 0 1.5 6.5v11A2.5 2.5 0 0 0 4 20h14.5a2.5 2.5 0 0 0 2.5-2.5v-11ZM10 15V9l5 3-5 3Z" />
          </svg>
        </div>
        <span className="font-semibold tracking-tight" style={{ color: "#00d4ff", textShadow: "0 0 10px rgba(0,212,255,0.4)" }}>
          HDHomerun
        </span>
      </div>

      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2 px-4 h-14 text-sm font-medium transition-all border-b-2
                ${
                  active
                    ? "border-b-2"
                    : "text-text-secondary border-transparent hover:text-text-primary hover:border-border-bright"
                }
              `}
              style={
                active
                  ? { color: "#00d4ff", borderBottomColor: "#00d4ff" }
                  : undefined
              }
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto">
        <DeviceStatus />
      </div>
    </nav>
  );
}

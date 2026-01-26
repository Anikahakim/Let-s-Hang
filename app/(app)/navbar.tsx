"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/friends", label: "Friends" },
  { href: "/availability", label: "Availability" },
  { href: "/match", label: "Match" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-4 flex gap-2 items-center shadow-sm">
      {tabs.map((t) => {
        const active = pathname === t.href;

        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              active
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                : "text-gray-700 hover:text-purple-600 hover:bg-purple-50"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
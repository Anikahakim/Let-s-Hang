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
    <nav className="border-b px-6 py-3 flex gap-2 items-center">
      {tabs.map((t) => {
        const active = pathname === t.href;

        return (
          <Link
            key={t.href}
            href={t.href}
            className={[
              "px-3 py-2 rounded-md font-semibold",
              active ? "bg-black text-white" : "text-black hover:bg-gray-100",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
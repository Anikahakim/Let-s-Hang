"use client";

import { useState } from "react";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dark, setDark] = useState(false);

  return (
    <html lang="en">
      <body className={dark ? "bg-black text-white min-h-screen" : "bg-white text-black min-h-screen"}>
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setDark(!dark)}
            className="border px-3 py-1 rounded"
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
        {children}
      </body>
    </html>
  );
}
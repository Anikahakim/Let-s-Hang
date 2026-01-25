"use client";

import { supabase } from "../lib/supabaseClient";

export default function Home() {
  async function testConnection() {
    const { data, error } = await supabase.from("profiles").select("*");
    console.log("DATA:", data);
    console.log("ERROR:", error);
  }

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">Hangout Finder</h1>

      <button
        onClick={testConnection}
        className="mt-6 bg-black text-white px-4 py-2 rounded"
      >
        Test Supabase
      </button>
    </main>
  );
}

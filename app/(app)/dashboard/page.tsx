"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

useEffect(() => {
  async function load() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/login");
      return;
    }

    // 🔍 Check if profile exists
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!prof) {
      router.push("/onboarding");
      return;
    }

    setEmail(data.user.email ?? "");
  }

  load();
}, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Logged in as: {email}</p>

      <button onClick={signOut} className="bg-black text-white px-4 py-2 rounded">
        Sign out
      </button>
    </main>
  );
}

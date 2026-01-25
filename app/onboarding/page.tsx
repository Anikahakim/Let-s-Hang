"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      // If profile already exists, skip onboarding
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (existing) router.push("/dashboard");
    }

    check();
  }, [router]);

  async function saveProfile() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username: cleanUsername,
      full_name: fullName.trim() || null,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="p-10 space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">Create your profile</h1>

      <div>
        <label className="block mb-1">Username (unique)</label>
        <input
          className="border p-2 w-full"
          placeholder="e.g. anika"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div>
        <label className="block mb-1">Full name (optional)</label>
        <input
          className="border p-2 w-full"
          placeholder="e.g. Anika Hakim"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <button
        onClick={saveProfile}
        disabled={loading || username.trim().length < 3}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save"}
      </button>
    </main>
  );
}

"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Account created! Now sign in.");
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Login</h1>

      <input
        className="border p-2 block"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        className="border p-2 block"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div className="space-x-2">
        <button
          onClick={signIn}
          className="bg-black text-white px-4 py-2"
        >
          Sign In
        </button>

        <button
          onClick={signUp}
          className="bg-gray-500 text-white px-4 py-2"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}

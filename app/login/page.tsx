"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

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

  async function resetPassword() {
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Password reset email sent! Check your inbox.");
      setShowResetForm(false);
      setResetEmail("");
    }
  }

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Login</h1>

      {!showResetForm ? (
        <>
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

          <button
            onClick={() => setShowResetForm(true)}
            className="text-blue-600 underline text-sm"
          >
            Forgot password?
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">Enter your email to receive a password reset link</p>
          <input
            className="border p-2 block"
            placeholder="Email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />

          <div className="space-x-2">
            <button
              onClick={resetPassword}
              className="bg-green-600 text-white px-4 py-2"
            >
              Send Reset Link
            </button>

            <button
              onClick={() => {
                setShowResetForm(false);
                setResetEmail("");
              }}
              className="bg-gray-500 text-white px-4 py-2"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}

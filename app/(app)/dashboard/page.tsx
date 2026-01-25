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
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4 sm:p-8 lg:p-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 bg-clip-text text-transparent mb-2">Welcome Back! 🎉</h1>
          <p className="text-gray-600 text-sm sm:text-base">Ready to hang out with friends?</p>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-lg font-bold">👤</div>
            <div>
              <p className="text-gray-600 text-sm">Logged in as</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 break-all">{email}</p>
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/availability")}>
            <div className="text-3xl mb-2">📅</div>
            <h3 className="font-bold text-lg">Set Availability</h3>
            <p className="text-blue-100 text-sm">Tell us when you're free</p>
          </div>
          <div className="bg-gradient-to-br from-pink-400 to-pink-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/friends")}>
            <div className="text-3xl mb-2">👥</div>
            <h3 className="font-bold text-lg">Friends</h3>
            <p className="text-pink-100 text-sm">Manage your connections</p>
          </div>
          <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/match")}>
            <div className="text-3xl mb-2">🏃</div>
            <h3 className="font-bold text-lg">Find Matches</h3>
            <p className="text-green-100 text-sm">See when you can hang</p>
          </div>
          <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/onboarding")}>
            <div className="text-3xl mb-2">⚙️</div>
            <h3 className="font-bold text-lg">Profile</h3>
            <p className="text-purple-100 text-sm">Edit your info</p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button 
          onClick={signOut} 
          className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}

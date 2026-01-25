"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }

    checkUser();
  }, [router]);

  return null; // nothing flashes
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      try {
        const { data } = await supabase.auth.getUser();

        if (data?.user) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    }

    checkUser();
  }, [router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return null;
}
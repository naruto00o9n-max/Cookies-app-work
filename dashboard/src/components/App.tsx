"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import Shell from "@/components/dash/Shell";

function Boot() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950">
      {}
      <img
        src="/cookie-logo.png"
        alt="Cookies Tracker"
        className="h-20 w-20 rounded-full object-cover ring-1 ring-gold/40 shadow-[0_0_60px_-10px_rgba(212,175,55,0.5)]"
        style={{ animation: "dust-float 3s ease-in-out infinite" }}
        onError={(e) =>
          ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")
        }
      />
      <div className="gold-text text-lg font-black">Cookies Tracker</div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-800">
        <div className="gold-bar h-full w-1/2 rounded-full" />
      </div>
    </div>
  );
}

function CookiesApp() {
  const {
    data: me,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    staleTime: 60_000,
  });

  if (isLoading || !me) return <Boot />;

  if (me.authenticated && me.user) {
    return <Shell me={me} />;
  }
  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-950 text-white"
    >
      <img
        src="/cookie-logo.png"
        alt="Cookies"
        className="h-24 w-24 rounded-full"
      />
      <h1 className="text-3xl font-bold">مساحة فريق كوكيز</h1>
      <p>الدخول بحساب الفريق، والبيانات محفوظة في MongoDB.</p>
      {me.config.oauthEnabled ? (
        <a
          href="/api/auth/discord"
          className="rounded-xl bg-yellow-200 px-6 py-3 text-black"
        >
          الدخول بديسكورد
        </a>
      ) : (
        <p>يلزم إكمال إعداد تسجيل الدخول في خدمة الفريق.</p>
      )}
    </main>
  );
}

export default function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <CookiesApp />
    </QueryClientProvider>
  );
}

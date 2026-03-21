import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import Navbar from "@/components/Navbar";
import PersistentChart from "@/components/PersistentChart";
import { AccountProvider } from "@/lib/account-context";
import { PrivacyProvider } from "@/lib/privacy-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ledger Of Alpha — Trade Log & Planner",
  description: "Log trades, plan setups, and track performance with built-in risk tools.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-sidebar="collapsed">
      <body className="dark:bg-slate-950 bg-slate-50 dark:text-white text-slate-900 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AccountProvider>
          <PrivacyProvider>
          <Navbar />
          <Suspense><PersistentChart /></Suspense>
          <main className="sidebar-push px-6 py-6 max-sm:pt-20">
            {children}
          </main>
          </PrivacyProvider>
        </AccountProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

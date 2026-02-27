import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import Navbar from "@/components/Navbar";
import PersistentChart from "@/components/PersistentChart";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ledger Of Alpha — Trade Log & Planner",
  description: "Log trades, plan setups, and track performance with built-in risk tools.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dark:bg-slate-950 bg-slate-50 dark:text-white text-slate-900 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Navbar />
          <PersistentChart />
          <main className="pt-14 max-w-screen-2xl mx-auto px-4 py-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}

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
          <footer className="border-t dark:border-slate-800 border-slate-200 py-4">
            <div className="flex items-center justify-center gap-1 text-xs dark:text-slate-500 text-slate-400">
              <span>Built by</span>
              <span className="dark:text-slate-300 text-slate-600 font-medium">David Amar</span>
              <span>·</span>
              <a
                href="https://github.com/david1x/ledger-of-alpha"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </a>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}

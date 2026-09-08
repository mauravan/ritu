import "./globals.css";
import AuthPanel from "./components/AuthPanel";

export const metadata = {
  title: "RITU — Find your hardware",
  description: "Find hardware via ricardo.ch & tutti.ch",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
        <header className="border-b bg-white dark:bg-zinc-900 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">RITU — Find your hardware</h1>
          <AuthPanel />
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white dark:bg-zinc-900 px-6 py-3 text-center text-sm text-zinc-500">
          Results from ricardo.ch &amp; tutti.ch, not affiliated
        </footer>
      </body>
    </html>
  );
}

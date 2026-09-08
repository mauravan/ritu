"use client";

import { useEffect, useState } from "react";
import type { AuthStatus } from "@/lib/types";

export default function AuthPanel() {
  const [status, setStatus] = useState<AuthStatus>({ ricardo: false, tutti: false });
  const [modal, setModal] = useState<"ricardo" | "tutti" | null>(null);
  const [cookieString, setCookieString] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = (await res.json()) as AuthStatus;
      setStatus(data);
    } catch {}
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleSave = async () => {
    if (!modal) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace: modal, cookieString }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error === "invalid_session" ? "Invalid or expired session — please check cookie" : `Error: ${data.error}`);
      } else {
        setMsg("Connected!");
        setModal(null);
        setCookieString("");
        await fetchStatus();
      }
    } catch (e) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (mp: "ricardo" | "tutti") => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace: mp }),
    });
    await fetchStatus();
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className={status.ricardo ? "text-green-600" : "text-zinc-400"}>ricardo {status.ricardo ? "✓" : "○"}</span>
      <span className={status.tutti ? "text-green-600" : "text-zinc-400"}>tutti {status.tutti ? "✓" : "○"}</span>

      {!status.ricardo && (
        <button onClick={() => setModal("ricardo")} className="rounded-full border px-3 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Connect ricardo
        </button>
      )}
      {status.ricardo && (
        <button onClick={() => void handleLogout("ricardo")} className="rounded-full border px-3 py-1 hover:bg-zinc-50">
          Disconnect ricardo
        </button>
      )}

      {!status.tutti && (
        <button onClick={() => setModal("tutti")} className="rounded-full border px-3 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Connect tutti
        </button>
      )}
      {status.tutti && (
        <button onClick={() => void handleLogout("tutti")} className="rounded-full border px-3 py-1 hover:bg-zinc-50">
          Disconnect tutti
        </button>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 p-6 space-y-4">
            <h3 className="font-semibold">Connect {modal}</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Log in to {modal} in another tab, then copy your cookie string (DevTools → Application → Cookies → copy value) or paste full{" "}
              <code>document.cookie</code> output. RITU never handles your marketplace password — only the session cookie.
            </p>
            <textarea
              value={cookieString}
              onChange={(e) => setCookieString(e.target.value)}
              placeholder="Paste cookie string here"
              rows={3}
              className="w-full rounded border px-3 py-2 text-xs dark:bg-zinc-800 dark:border-zinc-700"
            />
            {msg && <p className="text-xs text-red-600">{msg}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="rounded px-4 py-2 text-xs border">
                Cancel
              </button>
              <button onClick={() => void handleSave()} disabled={loading || !cookieString} className="rounded bg-black text-white px-4 py-2 text-xs disabled:opacity-50 dark:bg-white dark:text-black">
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

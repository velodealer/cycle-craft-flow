import { supabase } from "@/integrations/supabase/client";

let sent = 0;
const seen = new Set<string>();

/** Records an app error for the super admin's error log. Never throws. */
export async function reportError(message: string, detail?: unknown, source = "app") {
  try {
    const msg = String(message || "Unknown error").slice(0, 2000);
    if (seen.has(msg) || sent >= 20) return; // avoid floods from one page
    seen.add(msg);
    sent++;
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    const { data: bid } = await supabase.rpc("current_business_id");
    await supabase.from("system_error_logs" as any).insert({
      user_id: uid,
      business_id: (bid as string) ?? null,
      source,
      message: msg,
      detail: detail ? { text: JSON.stringify(detail).slice(0, 8000) } : null,
      url: window.location.pathname,
    });
  } catch {
    /* reporting must never break the app */
  }
}

export function installErrorReporter() {
  window.addEventListener("error", (e) => reportError(e.message, { stack: e.error?.stack }));
  window.addEventListener("unhandledrejection", (e) => {
    const r: any = e.reason;
    reportError(r?.message ?? String(r), { stack: r?.stack });
  });
}

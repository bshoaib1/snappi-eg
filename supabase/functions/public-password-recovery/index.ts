import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { emailLayout, sendEmail } from "../_shared/email.ts";

const origins = new Set(["https://snappi-eg.com","https://www.snappi-eg.com","http://127.0.0.1:5500","http://localhost:5500","http://localhost:3000"]);
const cors = (request: Request) => ({ "Access-Control-Allow-Origin": origins.has(request.headers.get("origin") || "") ? request.headers.get("origin")! : "https://snappi-eg.com", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", Vary: "Origin" });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const generic = (request: Request) => new Response(JSON.stringify({ success: true, message: "Password recovery instructions were sent if the account exists." }), { headers: cors(request) });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  const origin = request.headers.get("origin");
  if (origin && !origins.has(origin)) return new Response(JSON.stringify({ success: false, message: "Origin not allowed." }), { status: 403, headers: cors(request) });
  try {
    const input = await request.json();
    if (String(input.companyWebsite || "").trim()) return generic(request);
    const email = String(input.email || "").trim().toLowerCase().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic(request);
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const identifier = await digest(`password-recovery:${email}`);
    const rate = await fetch(`${url}/rest/v1/rpc/consume_public_submission_limit`, { method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_bucket: "password_recovery_email", p_identifier_hash: identifier, p_max_requests: 3, p_window_seconds: 3600 }) });
    if (!rate.ok || await rate.json() !== true) return generic(request);
    const admin = createClient(url, service);
    let redirectTo = "https://snappi-eg.com/index.html";
    try {
      const candidate = new URL(String(input.redirectTo || ""));
      if (origins.has(candidate.origin)) redirectTo = candidate.href;
    } catch {}
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    if (error || !data.properties?.action_link) return generic(request);
    await sendEmail({ to: email, subject: "Reset your Snappi password", html: emailLayout({ eyebrow: "Password recovery", heading: "Create a new Snappi password.", intro: "A password reset was requested for your Snappi account. Use the secure link below. If you did not request it, you can ignore this email.", action: { label: "Reset Password", url: data.properties.action_link } }), text: `Reset your Snappi password: ${data.properties.action_link}`, idempotencyKey: `password-recovery-${identifier}-${new Date().toISOString().slice(0,13)}` });
    return generic(request);
  } catch (error) {
    console.error("Password recovery delivery failed", error instanceof Error ? error.message : "unknown");
    return generic(request);
  }
});

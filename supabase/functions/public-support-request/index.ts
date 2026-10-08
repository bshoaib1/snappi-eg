import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { emailLayout, sendEmail } from "../_shared/email.ts";

const allowedOrigins = new Set(["https://snappi-eg.com", "https://www.snappi-eg.com", "http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:8080", "http://127.0.0.1:8081", "http://127.0.0.1:8082", "http://127.0.0.1:3000", "http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://localhost:3000"]);
const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("origin") || "") ? request.headers.get("origin")! : "https://snappi-eg.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin"
});
const json = (request: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const requestIp = (request: Request) => (request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1) || "unknown").trim();
const consumeLimit = async (url: string, serviceKey: string, bucket: string, identifier: string, maxRequests: number, windowSeconds: number) => {
  const response = await fetch(`${url}/rest/v1/rpc/consume_public_submission_limit`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_bucket: bucket, p_identifier_hash: await digest(`${bucket}:${identifier}`), p_max_requests: maxRequests, p_window_seconds: windowSeconds }) });
  if (!response.ok) throw new Error("Submission protection is unavailable.");
  return await response.json() === true;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json(request, 403, { success: false, message: "Origin not allowed." });
  if (request.method !== "POST") return json(request, 405, { success: false, message: "Method not allowed." });
  if (Number(request.headers.get("content-length") || 0) > 20000) return json(request, 413, { success: false, message: "Submission is too large." });
  try {
    const body = await request.json();
    if (clean(body.companyWebsite)) return json(request, 200, { success: true, message: "Your request was received." });
    let requesterName = clean(body.name, 160);
    let requesterEmail = clean(body.email, 254).toLowerCase();
    let requesterPhone = clean(body.phone, 40) || null;
    let requesterId: string | null = null;
    const subject = clean(body.subject, 200);
    const message = clean(body.message, 3000);
    const category = ["brand", "creator", "website", "enhancement", "account_access", "active_campaign", "security"].includes(body.category) ? body.category : "general";
    const priority = category === "security" ? "urgent" : ["website", "account_access", "active_campaign"].includes(category) ? "high" : category === "enhancement" ? "low" : "normal";
    const preferredReply = ["Email", "Phone", "WhatsApp", "Workspace"].includes(body.preferredReply) ? body.preferredReply : "Email";
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json(request, 500, { success: false, message: "Support submission is unavailable." });
    const authorization = request.headers.get("authorization") || "";
    if (authorization.startsWith("Bearer ") && authorization !== `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`) {
      const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", Authorization: authorization } });
      if (userResponse.ok) {
        const user = await userResponse.json();
        const profileResponse = await fetch(`${url}/rest/v1/profiles?select=id,full_name,email,phone&id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
        const profile = profileResponse.ok ? (await profileResponse.json())?.[0] : null;
        if (profile) {
          requesterId = profile.id;
          requesterName = clean(profile.full_name, 160);
          requesterEmail = clean(profile.email, 254).toLowerCase();
          requesterPhone = clean(profile.phone, 40) || null;
        }
      }
    }
    if (!requesterName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail) || !subject || !message || (!requesterId && body.consent !== true)) {
      return json(request, 400, { success: false, message: "Complete the required support fields." });
    }
    const ip = requestIp(request);
    const limits = await Promise.all([
      consumeLimit(url, serviceKey, "support_ip_minute", ip, 4, 60),
      consumeLimit(url, serviceKey, "support_ip_hour", ip, 12, 3600),
      consumeLimit(url, serviceKey, "support_email_hour", requesterEmail, 5, 3600)
    ]);
    if (limits.includes(false)) return json(request, 429, { success: false, message: "Too many support requests. Please wait and try again." });
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
    const ownerResponse = await fetch(`${url}/rest/v1/profiles?select=id&email=eq.basem%40snappi-eg.com&limit=1`, { headers });
    const ownerRows = ownerResponse.ok ? await ownerResponse.json() : [];
    const payload = {
      requester_id: requesterId,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_phone: requesterPhone,
      preferred_reply: preferredReply,
      subject,
      category,
      message,
      priority,
      status: "new",
      assigned_to: ownerRows?.[0]?.id || null,
      source: clean(body.source, 1500) || "Snappi public website"
    };
    const response = await fetch(`${url}/rest/v1/support_requests`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("The support request could not be saved.");
    const saved = (await response.json())?.[0];
    const reference = String(saved?.id || "").slice(0, 8).toUpperCase();
    const notificationResults = await Promise.allSettled([
      sendEmail({
        to: requesterEmail,
        subject: `Snappi support request ${reference || "received"}`,
        html: emailLayout({ eyebrow: "Support request received", heading: "We have your request.", intro: "Snappi Support has received your message and will follow up using your preferred reply method.", rows: [["Reference", reference || "Recorded"], ["Subject", subject], ["Priority", priority], ["Status", "New"]] }),
        text: `Snappi Support received your request. Reference: ${reference || "Recorded"}. Subject: ${subject}. Priority: ${priority}.`,
        idempotencyKey: `support-confirmation-${saved?.id || await digest(`${requesterEmail}:${subject}`)}`
      }),
      sendEmail({
        to: Deno.env.get("SNAPPI_SUPPORT_ALERT_EMAIL") || Deno.env.get("snappi_support_alert_email") || "support@snappi-eg.com",
        subject: `${priority === "urgent" ? "URGENT: " : ""}New Snappi support request — ${subject}`,
        html: emailLayout({ eyebrow: "Administrator alert", heading: "A new support request needs review.", intro: message, rows: [["Reference", reference || "Recorded"], ["Requester", requesterName], ["Email", requesterEmail], ["Category", category], ["Priority", priority]], action: { label: "Open Support Queue", url: "https://www.snappi-eg.com/workspace/#support" } }),
        text: `New support request. Reference: ${reference || "Recorded"}. Requester: ${requesterName} (${requesterEmail}). Category: ${category}. Priority: ${priority}. Message: ${message}`,
        idempotencyKey: `support-admin-${saved?.id || await digest(`${requesterEmail}:${subject}`)}`
      })
    ]);
    notificationResults.forEach((result) => { if (result.status === "rejected") console.error("Support email failed", result.reason instanceof Error ? result.reason.message : "unknown error"); });
    return json(request, 200, { success: true, message: "Your support request was submitted. Snappi team will contact you." });
  } catch (error) {
    return json(request, 400, { success: false, message: error instanceof Error ? error.message : "Submission failed." });
  }
});

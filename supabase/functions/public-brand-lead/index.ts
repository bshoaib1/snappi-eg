import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    if (clean(body.companyWebsite)) return json(request, 200, { success: true, message: "Your enquiry was received." });
    const email = clean(body.workEmail, 254).toLowerCase();
    const contactName = clean(body.contactName, 160);
    const companyName = clean(body.companyName, 200);
    if (!contactName || !companyName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(request, 400, { success: false, message: "Complete the required enquiry fields." });

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const crmUrl = Deno.env.get("snappi_crm_webhook_url");
    const crmSecret = Deno.env.get("snappi_crm_webhook_secret");
    if (!url || !serviceKey || !crmUrl || !crmSecret) return json(request, 500, { success: false, message: "Enquiry service is unavailable." });
    const ip = requestIp(request);
    const limits = await Promise.all([
      consumeLimit(url, serviceKey, "lead_ip_minute", ip, 3, 60),
      consumeLimit(url, serviceKey, "lead_ip_hour", ip, 10, 3600),
      consumeLimit(url, serviceKey, "lead_email_hour", email, 4, 3600)
    ]);
    if (limits.includes(false)) return json(request, 429, { success: false, message: "Too many enquiries. Please wait and try again." });

    const payload = {
      id: clean(body.id, 100), createdAt: clean(body.createdAt, 60), ownerName: "Basem Shoaib", status: "new",
      contactName, workEmail: email, mobile: clean(body.mobile, 40), companyName,
      packageName: clean(body.packageName, 80), campaignObjective: clean(body.campaignObjective, 1500),
      source: clean(body.source, 500), utmSource: clean(body.utmSource, 200), utmMedium: clean(body.utmMedium, 200), utmCampaign: clean(body.utmCampaign, 200),
      webhookSecret: crmSecret
    };
    const crmResponse = await fetch(crmUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), redirect: "follow" });
    if (!crmResponse.ok) throw new Error("The CRM rejected the enquiry.");
    const result = await crmResponse.json().catch(() => null);
    if (!result?.success) throw new Error("The CRM did not confirm the enquiry.");
    return json(request, 200, { success: true, message: "Enquiry submitted. Snappi team will contact you shortly." });
  } catch (error) {
    console.error("Brand lead delivery failed", error instanceof Error ? error.message : "unknown error");
    return json(request, 502, { success: false, message: "We could not confirm your enquiry. Please email sales@snappi-eg.com." });
  }
});

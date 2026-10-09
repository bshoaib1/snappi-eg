import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { emailLayout, sendEmail } from "../_shared/email.ts";

const allowedOrigins = new Set(["https://snappi-eg.com", "https://www.snappi-eg.com", "http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:8080", "http://localhost:8080", "http://localhost:3000"]);
const corsHeaders = (request: Request) => ({ "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("origin") || "") ? request.headers.get("origin")! : "https://snappi-eg.com", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Vary": "Origin" });
const json = (request: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const requestIp = (request: Request) => (request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1) || "unknown").trim();
const consumeLimit = async (url: string, key: string, bucket: string, identifier: string, max: number, seconds: number) => {
  const response = await fetch(`${url}/rest/v1/rpc/consume_public_submission_limit`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_bucket: bucket, p_identifier_hash: await digest(`${bucket}:${identifier}`), p_max_requests: max, p_window_seconds: seconds }) });
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
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json(request, 500, { success: false, message: "Enquiry service is unavailable." });
    const ip = requestIp(request);
    const limits = await Promise.all([consumeLimit(url, key, "lead_ip_minute", ip, 3, 60), consumeLimit(url, key, "lead_ip_hour", ip, 10, 3600), consumeLimit(url, key, "lead_email_hour", email, 4, 3600)]);
    if (limits.includes(false)) return json(request, 429, { success: false, message: "Too many enquiries. Please wait and try again." });

    const id = /^[0-9a-f-]{36}$/i.test(clean(body.id, 40)) ? clean(body.id, 40) : crypto.randomUUID();
    const packageName = clean(body.packageName, 80) || "Not Sure Yet";
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
    const ownerResponse = await fetch(`${url}/rest/v1/profiles?select=id&email=eq.basem%40snappi-eg.com&limit=1`, { headers });
    const ownerRows = ownerResponse.ok ? await ownerResponse.json() : [];
    const dbPayload = { id, contact_name: contactName, work_email: email, phone: clean(body.mobile, 40), company_name: companyName, industry: clean(body.industry, 160) || null, website_url: clean(body.websiteUrl, 500) || null, package_name: packageName, campaign_objective: clean(body.campaignObjective, 1500) || null, status: packageName === "Not Sure Yet" ? "consultation_required" : "package_selected", assigned_to: ownerRows?.[0]?.id || null, source: clean(body.source, 500) || "Snappi website", consent: true };
    const save = await fetch(`${url}/rest/v1/brand_requests?on_conflict=id`, { method: "POST", headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(dbPayload) });
    if (!save.ok) throw new Error(`Brand request could not be saved (${save.status}).`);

    let crmError = "";
    const crmUrl = Deno.env.get("snappi_crm_webhook_url");
    const crmSecret = Deno.env.get("snappi_crm_webhook_secret");
    try {
      if (!crmUrl || !crmSecret) throw new Error("CRM webhook is not configured.");
      const crmPayload = { id, createdAt: clean(body.createdAt, 60) || new Date().toISOString(), ownerName: "Basem Shoaib", status: "new", contactName, workEmail: email, mobile: dbPayload.phone, companyName, industry: dbPayload.industry || "", websiteUrl: dbPayload.website_url || "", packageName, campaignObjective: dbPayload.campaign_objective || "", source: dbPayload.source, utmSource: clean(body.utmSource, 200), utmMedium: clean(body.utmMedium, 200), utmCampaign: clean(body.utmCampaign, 200), webhookSecret: crmSecret };
      const response = await fetch(crmUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(crmPayload), redirect: "follow" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error("CRM did not confirm the enquiry.");
      await fetch(`${url}/rest/v1/brand_requests?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ crm_synced_at: new Date().toISOString(), crm_sync_error: null }) });
    } catch (error) {
      crmError = error instanceof Error ? error.message : "CRM synchronization failed.";
      await fetch(`${url}/rest/v1/brand_requests?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ crm_sync_error: crmError }) });
    }

    let emailError = "";
    try {
      await Promise.all([
        sendEmail({ to: email, replyTo: "sales@snappi-eg.com", subject: "Snappi received your campaign enquiry", html: emailLayout({ eyebrow: "Campaign enquiry", heading: "Your request is with the Snappi team.", intro: "Thank you for considering Snappi. Our team will review your goals and contact you to discuss the right next step.", rows: [["Company", companyName], ["Business category", dbPayload.industry || "Not provided"], ["Package", packageName]] }), text: `Thank you, ${contactName}. We received the campaign enquiry for ${companyName}. Snappi team will contact you shortly.`, idempotencyKey: `brand-confirmation-${id}` }),
        sendEmail({ to: Deno.env.get("SNAPPI_ADMIN_ALERT_EMAIL") || Deno.env.get("snappi_admin_alert_email") || "basem@snappi-eg.com", replyTo: email, subject: `New Snappi campaign enquiry — ${companyName}`, html: emailLayout({ eyebrow: "Administrator alert", heading: "A campaign enquiry is ready for review.", intro: "The request is saved in Brand Requests and has also been sent to the CRM sheet.", rows: [["Contact", contactName], ["Company", companyName], ["Business category", dbPayload.industry || "Not provided"], ["Email", email], ["Phone", dbPayload.phone], ["Package", packageName]] }), text: `New campaign enquiry from ${companyName}. Contact: ${contactName}. Email: ${email}. Package: ${packageName}.`, idempotencyKey: `brand-admin-alert-${id}` })
      ]);
      await fetch(`${url}/rest/v1/brand_requests?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString(), confirmation_email_error: null }) });
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Confirmation email failed.";
      await fetch(`${url}/rest/v1/brand_requests?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ confirmation_email_error: emailError }) });
    }
    return json(request, 200, { success: true, message: "Enquiry submitted. Snappi team will contact you shortly.", crmSynced: !crmError, emailSent: !emailError });
  } catch (error) {
    console.error("Brand lead delivery failed", error instanceof Error ? error.message : "unknown error");
    return json(request, 500, { success: false, message: "We could not save your enquiry. Please email sales@snappi-eg.com." });
  }
});

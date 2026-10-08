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
const list = (value: unknown, maxItems = 8) => Array.isArray(value) ? value.map((item) => clean(item, 300)).filter(Boolean).slice(0, maxItems) : [];
const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const requestIp = (request: Request) => (request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1) || "unknown").trim();
const hasImageSignature = (bytes: Uint8Array, mime: string) => {
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length > 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value);
  return mime === "image/webp" && bytes.length > 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
};
const imageDimensions = (bytes: Uint8Array, mime: string) => {
  if (mime === "image/png" && bytes.length >= 24) return { width: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19], height: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23] };
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  if (mime === "image/webp" && bytes.length >= 30) {
    const kind = new TextDecoder().decode(bytes.slice(12, 16));
    if (kind === "VP8X") return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (kind === "VP8 " && bytes.length >= 30) return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) { const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
  }
  return null;
};
const consumeLimit = async (url: string, serviceKey: string, bucket: string, identifier: string, maxRequests: number, windowSeconds: number) => {
  const response = await fetch(`${url}/rest/v1/rpc/consume_public_submission_limit`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_bucket: bucket, p_identifier_hash: await digest(`${bucket}:${identifier}`), p_max_requests: maxRequests, p_window_seconds: windowSeconds })
  });
  if (!response.ok) throw new Error("Submission protection is unavailable.");
  return await response.json() === true;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json(request, 403, { success: false, message: "Origin not allowed." });
  if (request.method !== "POST") return json(request, 405, { success: false, message: "Method not allowed." });
  if (Number(request.headers.get("content-length") || 0) > 4200000) return json(request, 413, { success: false, message: "Submission is too large." });
  try {
    const body = await request.json();
    if (clean(body.companyWebsite)) return json(request, 200, { success: true });
    const type = clean(body.type, 20);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 40);
    if (!["creator", "brand"].includes(type) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone) return json(request, 400, { success: false, message: "Complete the required contact information." });

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json(request, 500, { success: false, message: "Submission service is unavailable." });
    const ip = requestIp(request);
    const limits = await Promise.all([
      consumeLimit(url, serviceKey, "join_ip_minute", ip, 3, 60),
      consumeLimit(url, serviceKey, "join_ip_hour", ip, 10, 3600),
      consumeLimit(url, serviceKey, "join_email_hour", email, 3, 3600)
    ]);
    if (limits.includes(false)) return json(request, 429, { success: false, message: "Too many submissions. Please wait and try again." });
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" };
    const ownerResponse = await fetch(`${url}/rest/v1/profiles?select=id&email=eq.basem%40snappi-eg.com&limit=1`, { headers });
    const ownerRows = ownerResponse.ok ? await ownerResponse.json() : [];
    const assignedTo = ownerRows?.[0]?.id || null;

    if (type === "creator") {
      const id = crypto.randomUUID();
      const fullName = clean(body.fullName, 160);
      const city = clean(body.city, 120);
      const photo = body.profilePhoto;
      if (!fullName || !city || body.isOver18 !== true || body.consent !== true || !photo?.base64) return json(request, 400, { success: false, message: "Complete the required creator application fields, including a profile photo." });
      const mime = ["image/jpeg","image/png","image/webp"].includes(photo.type) ? photo.type : "";
      const bytes = decodeBase64(clean(photo.base64, 3000000));
      if (!mime || bytes.byteLength > 2097152 || !hasImageSignature(bytes, mime)) return json(request, 400, { success: false, message: "Use a valid JPG, PNG, or WebP profile photo no larger than 2 MB." });
      const dimensions = imageDimensions(bytes, mime);
      if (!dimensions || dimensions.width < 64 || dimensions.height < 64 || dimensions.width > 4096 || dimensions.height > 4096 || dimensions.width * dimensions.height > 12000000) return json(request, 400, { success: false, message: "Use a profile photo between 64 and 4,096 pixels per side." });
      const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const photoPath = `applications/${id}/profile.${extension}`;
      const upload = await fetch(`${url}/storage/v1/object/creator-profile-photos/${photoPath}`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": mime, "x-upsert": "false" }, body: bytes });
      if (!upload.ok) throw new Error("Profile photo could not be uploaded.");
      const payload = { id, full_name: fullName, email, phone, city, profile_photo_path: photoPath, social_url: clean(body.socialUrl, 500) || null, portfolio_urls: list(body.portfolioUrls, 6), categories: list(body.categories, 8), languages: list(body.languages, 6), availability: clean(body.availability, 300) || null, is_over_18: true, consent: true, status: "new", assigned_to: assignedTo, source: clean(body.source, 500) || "Snappi website" };
      const response = await fetch(`${url}/rest/v1/creator_applications`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (!response.ok) {
        await fetch(`${url}/storage/v1/object/creator-profile-photos/${photoPath}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
        throw new Error("Creator application could not be saved.");
      }
      const saved = (await response.json())?.[0];
      await sendEmail({
        to: Deno.env.get("SNAPPI_ADMIN_ALERT_EMAIL") || Deno.env.get("snappi_admin_alert_email") || "basem@snappi-eg.com",
        subject: `New creator application — ${fullName}`,
        html: emailLayout({ eyebrow: "Administrator alert", heading: "A creator application is ready for review.", intro: "A new creator has completed the Snappi application form.", rows: [["Applicant", fullName], ["Email", email], ["Phone", phone], ["City", city], ["Categories", payload.categories.join(", ") || "Not specified"]], action: { label: "Review Creator Applications", url: "https://www.snappi-eg.com/workspace/#creator-applications" } }),
        text: `New creator application from ${fullName}. Email: ${email}. Phone: ${phone}. City: ${city}.`,
        idempotencyKey: `creator-application-${saved?.id || id}`
      }).catch((error) => console.error("Creator administrator alert failed", error instanceof Error ? error.message : "unknown error"));
      return json(request, 200, { success: true, message: "Your creator application was submitted for review." });
    }

    const contactName = clean(body.contactName, 160);
    const companyName = clean(body.companyName, 200);
    const packageName = ["Starter","Growth","Premium","Not Sure Yet"].includes(body.packageName) ? body.packageName : "Not Sure Yet";
    if (!contactName || !companyName || body.consent !== true) return json(request, 400, { success: false, message: "Complete the required brand request fields." });
    const payload = { contact_name: contactName, work_email: email, phone, company_name: companyName, industry: clean(body.industry, 160) || null, website_url: clean(body.websiteUrl, 500) || null, package_name: packageName, campaign_objective: clean(body.campaignObjective, 1500) || null, preferred_launch_date: clean(body.preferredLaunchDate, 20) || null, status: packageName === "Not Sure Yet" ? "consultation_required" : "package_selected", assigned_to: assignedTo, source: clean(body.source, 500) || "Snappi website", consent: true };
    const response = await fetch(`${url}/rest/v1/brand_requests`, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("Brand request could not be saved.");
    const saved = (await response.json())?.[0];
    await sendEmail({
      to: Deno.env.get("SNAPPI_ADMIN_ALERT_EMAIL") || Deno.env.get("snappi_admin_alert_email") || "basem@snappi-eg.com",
      replyTo: "sales@snappi-eg.com",
      subject: `New brand request — ${companyName}`,
      html: emailLayout({ eyebrow: "Administrator alert", heading: "A brand request is ready for review.", intro: "A new brand has requested access to Snappi.", rows: [["Contact", contactName], ["Company", companyName], ["Email", email], ["Phone", phone], ["Package", packageName]], action: { label: "Review Brand Requests", url: "https://www.snappi-eg.com/workspace/#brand-requests" } }),
      text: `New brand request from ${companyName}. Contact: ${contactName}. Email: ${email}. Phone: ${phone}. Package: ${packageName}.`,
      idempotencyKey: `brand-request-${saved?.id || await digest(`${email}:${companyName}`)}`
    }).catch((error) => console.error("Brand administrator alert failed", error instanceof Error ? error.message : "unknown error"));
    return json(request, 200, { success: true, message: packageName === "Not Sure Yet" ? "Your consultation request was submitted. Snappi team will contact you." : "Your brand request and selected package were submitted for review." });
  } catch (error) {
    return json(request, 400, { success: false, message: error instanceof Error ? error.message : "Submission failed." });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { emailLayout, sendEmail } from "../_shared/email.ts";

const allowedOrigins = new Set(["https://snappi-eg.com", "https://www.snappi-eg.com", "http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:8080", "http://127.0.0.1:8081", "http://127.0.0.1:8082", "http://127.0.0.1:3000", "http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://localhost:3000"]);
const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("origin") || "") ? request.headers.get("origin")! : "https://snappi-eg.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin"
});
const clean = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);
const json = (request: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json(request, 403, { success: false, message: "Origin not allowed." });
  if (request.method !== "POST") return json(request, 405, { success: false, message: "Method not allowed." });
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) throw new Error("Authentication is required.");
    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, serviceKey);
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) throw new Error("Your administrator session is invalid.");
    const { data: profile } = await caller.from("profiles").select("role,status").eq("id", user.id).single();
    const { data: mayManageSupport } = await caller.rpc("has_admin_permission", { permission_name: "manage_support" });
    if (profile?.status !== "active" || (profile.role !== "super_admin" && !mayManageSupport)) throw new Error("You do not have permission to manage support requests.");

    const input = await request.json();
    const requestId = clean(input.requestId, 80);
    const priority = clean(input.priority, 20);
    const status = clean(input.status, 30);
    const assignedTo = clean(input.assignedTo, 80) || null;
    const internalNotes = clean(input.internalNotes, 4000) || null;
    if (!requestId || !["low", "normal", "high", "urgent"].includes(priority) || !["new", "open", "waiting_for_user", "waiting_for_snappi", "resolved", "closed"].includes(status)) throw new Error("A valid support request, priority, and status are required.");

    const { data: existing, error: existingError } = await admin.from("support_requests").select("id,requester_email,requester_name,subject,status,priority").eq("id", requestId).single();
    if (existingError || !existing) throw new Error("Support request not found.");
    const { error: updateError } = await admin.from("support_requests").update({ priority, status, assigned_to: assignedTo }).eq("id", requestId);
    if (updateError) throw updateError;
    const { error: notesError } = await admin.from("support_request_admin_notes").upsert({ request_id: requestId, internal_notes: internalNotes, updated_by: user.id, updated_at: new Date().toISOString() });
    if (notesError) throw notesError;

    if (existing.requester_email && (existing.status !== status || existing.priority !== priority)) {
      const statusLabel = status.replaceAll("_", " ");
      await sendEmail({
        to: existing.requester_email,
        subject: `Snappi support update — ${existing.subject}`,
        html: emailLayout({ eyebrow: "Support update", heading: "Your support request was updated.", intro: `Hello ${existing.requester_name || "there"}, the Snappi team updated your request.`, rows: [["Reference", requestId.slice(0, 8).toUpperCase()], ["Subject", existing.subject], ["Status", statusLabel], ["Priority", priority]] }),
        text: `Your Snappi support request ${requestId.slice(0, 8).toUpperCase()} is now ${statusLabel}. Priority: ${priority}.`,
        idempotencyKey: `support-update-${requestId}-${status}-${priority}`
      });
    }
    return json(request, 200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update support request.";
    return json(request, /permission|session|Authentication/i.test(message) ? 403 : 400, { success: false, message });
  }
});

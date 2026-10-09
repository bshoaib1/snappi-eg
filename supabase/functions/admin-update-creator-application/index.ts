import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { emailLayout, sendEmail } from "../_shared/email.ts";

const origins = new Set(["https://snappi-eg.com","https://www.snappi-eg.com","http://127.0.0.1:5500","http://localhost:5500","http://localhost:3000"]);
const cors = (request: Request) => ({ "Access-Control-Allow-Origin": origins.has(request.headers.get("origin") || "") ? request.headers.get("origin")! : "https://snappi-eg.com", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", Vary: "Origin" });
const copy: Record<string, [string,string]> = {
  under_review: ["Your Snappi application is under review", "Our team is reviewing your creator profile. We will contact you when there is an update."],
  shortlisted: ["You have been shortlisted by Snappi", "Your profile has moved to the Snappi shortlist. We will contact you when the next suitable step is ready."],
  interview_requested: ["Snappi would like to speak with you", "Your application has moved forward. The Snappi team will contact you to arrange a short conversation."],
  approved: ["Welcome to the Snappi creator network", "Your creator application has been approved. A separate secure invitation will give you access to your workspace."],
  waitlisted: ["Your Snappi application is on the waitlist", "We are keeping your profile in the network for future opportunities and will contact you when there is a relevant update."],
  rejected: ["An update on your Snappi application", "Thank you for applying. We are unable to move forward with your application at this time, but you may apply again when your profile or portfolio changes."],
  onboarded: ["Your Snappi creator workspace is ready", "Your creator account has been connected. Use your secure invitation to create a password and enter your workspace."]
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Authentication is required.");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, service);
    const { data: { user } } = await caller.auth.getUser();
    const { data: permitted } = await caller.rpc("has_admin_permission", { permission_name: "manage_creators" });
    if (!user || !permitted) throw new Error("Creator management permission is required.");
    const input = await request.json();
    const applicationId = String(input.applicationId || "");
    const status = String(input.status || "");
    if (!applicationId || !copy[status]) throw new Error("Select a valid creator application status.");
    const { data: application, error: readError } = await admin.from("creator_applications").select("id,full_name,email,status").eq("id", applicationId).single();
    if (readError || !application) throw new Error("Creator application was not found.");
    if (application.status === status) return new Response(JSON.stringify({ success: true, emailSent: false, unchanged: true }), { headers: cors(request) });
    const { error: updateError } = await admin.from("creator_applications").update({ status, status_email_error: null }).eq("id", applicationId);
    if (updateError) throw updateError;
    const [subject, intro] = copy[status];
    try {
      await sendEmail({ to: application.email, subject, html: emailLayout({ eyebrow: "Creator application update", heading: subject, intro, rows: [["Applicant", application.full_name], ["Status", status.replaceAll("_", " ")]], action: status === "approved" || status === "onboarded" ? { label: "Visit Snappi", url: "https://snappi-eg.com/" } : undefined }), text: `Hello ${application.full_name},\n\n${intro}\n\nStatus: ${status.replaceAll("_", " ")}\n\nSnappi`, idempotencyKey: `creator-status-${applicationId}-${status}` });
      await admin.from("creator_applications").update({ status_email_sent_at: new Date().toISOString(), status_email_error: null }).eq("id", applicationId);
      return new Response(JSON.stringify({ success: true, emailSent: true }), { headers: cors(request) });
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : "Email delivery failed.";
      await admin.from("creator_applications").update({ status_email_error: message }).eq("id", applicationId);
      return new Response(JSON.stringify({ success: true, emailSent: false, warning: "Status saved, but the creator email could not be delivered." }), { headers: cors(request) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the creator application.";
    return new Response(JSON.stringify({ success: false, message }), { status: /permission|Authentication/i.test(message) ? 403 : 400, headers: cors(request) });
  }
});

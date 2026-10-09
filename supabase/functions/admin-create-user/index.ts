// SNAPPI ADMIN CREATE USER EDGE FUNCTION
// Deploy with JWT verification enabled. Secret credentials remain in Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { emailLayout, sendEmail } from "../_shared/email.ts";

const allowedOrigins = new Set(["https://snappi-eg.com", "https://www.snappi-eg.com", "http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:8080", "http://127.0.0.1:8081", "http://127.0.0.1:8082", "http://127.0.0.1:3000", "http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://localhost:3000"]);
const corsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("origin") || "") ? request.headers.get("origin")! : "https://snappi-eg.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Authentication is required.");

    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(url, serviceRoleKey);
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error("Your administrator session is invalid.");

    const { data: callerProfile, error: profileError } = await callerClient.from("profiles").select("role,status").eq("id", user.id).single();
    const { data: mayManageUsers } = await callerClient.rpc("has_admin_permission", { permission_name: "manage_users" });
    if (profileError || callerProfile?.status !== "active" || (callerProfile.role !== "super_admin" && !mayManageUsers)) throw new Error("You do not have permission to create users.");

    const input = await request.json();
    const email = String(input.email || "").trim().toLowerCase();
    const fullName = String(input.fullName || "").trim();
    const phone = String(input.phone || "").trim();
    const role = String(input.role || "");
    const workspaceRoleId = String(input.workspaceRoleId || "");
    const sourceType = ["creator_application", "brand_request"].includes(input.sourceType) ? String(input.sourceType) : "";
    const sourceId = String(input.sourceId || "");
    const allowedRoles = ["operations_admin", "creator", "brand"];
    if (!email || !fullName || !phone || !allowedRoles.includes(role)) throw new Error("Name, email, phone number, and an allowed role are required.");
    const callerIsSuperAdmin = callerProfile.role === "super_admin";
    if (role === "operations_admin" && !callerIsSuperAdmin) throw new Error("Only the Super Admin can create administrator accounts.");
    if (sourceType === "creator_application") {
      const { data: allowed } = await callerClient.rpc("has_admin_permission", { permission_name: "manage_creators" });
      if (!callerIsSuperAdmin && !allowed) throw new Error("Creator management permission is required.");
    }
    if (sourceType === "brand_request") {
      const { data: allowed } = await callerClient.rpc("has_admin_permission", { permission_name: "manage_brands" });
      if (!callerIsSuperAdmin && !allowed) throw new Error("Brand management permission is required.");
    }
    if (role === "creator" && !sourceType) {
      const { data: allowed } = await callerClient.rpc("has_admin_permission", { permission_name: "manage_creators" });
      if (!callerIsSuperAdmin && !allowed) throw new Error("Creator management permission is required.");
    }
    if (role === "brand" && !sourceType) {
      const { data: allowed } = await callerClient.rpc("has_admin_permission", { permission_name: "manage_brands" });
      if (!callerIsSuperAdmin && !allowed) throw new Error("Brand management permission is required.");
    }
    let accessRole: Record<string, boolean | string> | null = null;
    if (role === "operations_admin") {
      if (!workspaceRoleId) throw new Error("Select an Administration role.");
      const { data, error: roleError } = await adminClient.from("workspace_roles").select("id,manage_users,manage_creators,manage_brands,manage_campaigns,manage_content,manage_support,manage_careers").eq("id", workspaceRoleId).single();
      if (roleError || !data) throw new Error("The selected Administration role was not found.");
      accessRole = data;
    }
    const { data: created, error: createError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: "https://snappi-eg.com/index.html#login",
        data: { full_name: fullName, phone, invited_role: role, must_change_password: true }
      }
    });
    if (createError || !created.user || !created.properties?.action_link) throw createError || new Error("User invitation could not be created.");

    const userId = created.user.id;
    try {
      const { error: updateError } = await adminClient.from("profiles").update({ full_name: fullName, phone, role, status: "active" }).eq("id", userId);
      if (updateError) throw updateError;

      if (role === "operations_admin") {
      if (!accessRole) throw new Error("The selected Administration role was not found.");
      const permissions = {
        user_id: userId,
        workspace_role_id: accessRole.id,
        manage_users: accessRole.manage_users,
        manage_creators: accessRole.manage_creators,
        manage_brands: accessRole.manage_brands,
        manage_campaigns: accessRole.manage_campaigns,
        manage_content: accessRole.manage_content,
        manage_support: accessRole.manage_support,
        manage_careers: accessRole.manage_careers,
      };
      const { error: permissionsError } = await adminClient.from("user_permissions").upsert(permissions);
      if (permissionsError) throw permissionsError;
      }

      if (role === "creator") {
      let creatorProfile = { user_id: userId } as Record<string, unknown>;
      if (sourceType === "creator_application" && sourceId) {
        const { data: application, error: sourceError } = await adminClient.from("creator_applications").select("city,categories,portfolio_urls,availability,internal_notes").eq("id", sourceId).single();
        if (sourceError || !application) throw sourceError || new Error("Creator application was not found.");
        creatorProfile = { ...creatorProfile, application_status: "onboarded", city: application.city, categories: application.categories, portfolio_url: application.portfolio_urls?.[0] || null, availability: application.availability, internal_notes: application.internal_notes };
      }
      const { error: creatorError } = await adminClient.from("creator_profiles").upsert(creatorProfile);
      if (creatorError) throw creatorError;
      if (sourceType === "creator_application" && sourceId) {
        const { error: sourceUpdateError } = await adminClient.from("creator_applications").update({ status: "onboarded", converted_user_id: userId }).eq("id", sourceId);
        if (sourceUpdateError) throw sourceUpdateError;
      }
      }

      if (role === "brand") {
      let brandProfile = { user_id: userId } as Record<string, unknown>;
      if (sourceType === "brand_request" && sourceId) {
        const { data: requestRecord, error: sourceError } = await adminClient.from("brand_requests").select("company_name,industry,website_url,assigned_to,internal_notes").eq("id", sourceId).single();
        if (sourceError || !requestRecord) throw sourceError || new Error("Brand request was not found.");
        brandProfile = { ...brandProfile, company_name: requestRecord.company_name, industry: requestRecord.industry, website_url: requestRecord.website_url, assigned_owner: requestRecord.assigned_to, internal_notes: requestRecord.internal_notes };
      }
      const { error: brandError } = await adminClient.from("brand_profiles").upsert(brandProfile);
      if (brandError) throw brandError;
      if (sourceType === "brand_request" && sourceId) {
        const { error: sourceUpdateError } = await adminClient.from("brand_requests").update({ status: "converted", converted_user_id: userId }).eq("id", sourceId);
        if (sourceUpdateError) throw sourceUpdateError;
      }
      }
    } catch (setupError) {
      await adminClient.auth.admin.deleteUser(userId);
      throw setupError;
    }

    try {
      await sendEmail({
        to: email,
        subject: "Your secure Snappi workspace invitation",
        html: emailLayout({
          eyebrow: "Workspace invitation",
          heading: "Your Snappi access is ready.",
          intro: `Hello ${fullName}. Use this secure invitation to create your private password and enter your ${role === "brand" ? "brand" : role === "creator" ? "creator" : "administrator"} workspace.`,
          rows: [["Account type", role.replaceAll("_", " ")]],
          action: { label: "Accept Secure Invitation", url: created.properties.action_link }
        }),
        text: `Hello ${fullName}. Accept your secure Snappi invitation: ${created.properties.action_link}`,
        idempotencyKey: `workspace-invite-${userId}`
      });
    } catch (emailError) {
      await adminClient.auth.admin.deleteUser(userId);
      throw emailError;
    }

    return new Response(JSON.stringify({ success: true, userId }), { status: 200, headers: { ...corsHeaders(request), "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    const status = /permission|Super Admin|administrator/i.test(message) ? 403 : 400;
    return new Response(JSON.stringify({ success: false, message }), { status, headers: { ...corsHeaders(request), "Content-Type": "application/json" } });
  }
});

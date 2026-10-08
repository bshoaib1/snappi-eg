// SNAPPI ADMIN UPDATE USER EDGE FUNCTION
// Updates Auth and profile data while keeping service credentials off the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";

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
    const { data: callerProfile } = await callerClient.from("profiles").select("role,status").eq("id", user.id).single();
    const { data: mayManageUsers } = await callerClient.rpc("has_admin_permission", { permission_name: "manage_users" });
    if (callerProfile?.status !== "active" || (callerProfile.role !== "super_admin" && !mayManageUsers)) throw new Error("You do not have permission to manage users.");

    const input = await request.json();
    const userId = String(input.userId || "");
    const fullName = String(input.fullName || "").trim();
    const email = String(input.email || "").trim().toLowerCase();
    const phone = String(input.phone || "").trim();
    const role = String(input.role || "");
    const status = String(input.status || "");
    const workspaceRoleId = String(input.workspaceRoleId || "");
    if (!userId || !fullName || !email || !phone) throw new Error("Name, email, and phone number are required.");
    if (!["creator", "brand", "operations_admin"].includes(role)) throw new Error("Select an allowed account type.");
    if (!["invited", "active", "paused", "suspended", "archived"].includes(status)) throw new Error("Select an allowed account status.");

    const { data: targetProfile, error: targetError } = await adminClient.from("profiles").select("role").eq("id", userId).single();
    if (targetError || !targetProfile) throw new Error("User not found.");
    const callerIsSuperAdmin = callerProfile.role === "super_admin";
    if (targetProfile.role === "super_admin") throw new Error("The Super Admin account is protected.");
    if (!callerIsSuperAdmin && (!["creator", "brand"].includes(targetProfile.role) || role !== targetProfile.role)) {
      throw new Error("Only the Super Admin can change administrative access or account roles.");
    }
    if (role === "operations_admin" && !callerIsSuperAdmin) throw new Error("Only the Super Admin can grant administrator access.");

    const { data: authUser, error: authReadError } = await adminClient.auth.admin.getUserById(userId);
    if (authReadError || !authUser.user) throw new Error("The Auth account was not found.");
    const metadata = { ...(authUser.user.user_metadata || {}), full_name: fullName, phone };
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, { email, user_metadata: metadata });
    if (authUpdateError) throw authUpdateError;
    const profileUpdate = targetProfile.role === "super_admin" ? { full_name: fullName, email, phone } : { full_name: fullName, email, phone, role, status };
    const { error: profileError } = await adminClient.from("profiles").update(profileUpdate).eq("id", userId);
    if (profileError) throw profileError;

    if (role === "operations_admin") {
      if (!workspaceRoleId) throw new Error("Select an Administration role.");
      const { data: accessRole, error: roleError } = await adminClient.from("workspace_roles").select("*").eq("id", workspaceRoleId).single();
      if (roleError || !accessRole) throw new Error("The selected Administration role was not found.");
      const { error: permissionError } = await adminClient.from("user_permissions").upsert({
        user_id: userId, workspace_role_id: accessRole.id, manage_users: accessRole.manage_users,
        manage_creators: accessRole.manage_creators, manage_brands: accessRole.manage_brands,
        manage_campaigns: accessRole.manage_campaigns, manage_content: accessRole.manage_content,
        manage_support: accessRole.manage_support,
        manage_careers: accessRole.manage_careers,
      });
      if (permissionError) throw permissionError;
    } else {
      await adminClient.from("user_permissions").delete().eq("user_id", userId);
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders(request), "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user.";
    const status = /permission|protected|Super Admin|administrator/i.test(message) ? 403 : 400;
    return new Response(JSON.stringify({ success: false, message }), { status, headers: { ...corsHeaders(request), "Content-Type": "application/json" } });
  }
});

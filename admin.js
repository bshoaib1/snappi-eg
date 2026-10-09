/* SNAPPI ADMIN WORKSPACE
   Authentication, role guard, operational data, filters, and controlled status actions. */
(() => {
  "use strict";
  const api = window.snappiSupabase;
  const authShell = document.querySelector("[data-admin-auth-shell]");
  const workspace = document.querySelector("[data-admin-workspace]");
  const loginPanel = document.querySelector("[data-admin-login-panel]");
  const passwordPanel = document.querySelector("[data-admin-new-password-panel]");
  const authStatus = document.querySelector("[data-admin-auth-status]");
  const workspaceLockKey = "snappi-admin-workspace-locked";
  let passwordChangeToken = null;
  const TABLE_PAGE_SIZE = 12;
  const tablePages = {};
  const state = { profile: null, permissions: {}, users: [], roles: [], creatorApplications: [], brandRequests: [], subscriptions: [], creators: [], brands: [], campaigns: [], campaignDeletionRequests: [], content: [], support: [], supportNotes: [], careers: [], activity: [] };
  const titles = { overview: "Snappi control center", "creator-applications": "Creator applications", "brand-requests": "Brand requests", subscriptions: "Subscriptions", users: "Administration", creators: "Creator management", brands: "Brand management", campaigns: "Campaign management", content: "Content review", support: "Support queue", careers: "Careers" };
  const statusLabels = (value = "") => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
  const dateTimeLabel = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
  const inputDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const query = (params) => new URLSearchParams(params).toString();
  const emptyRow = (columns, message) => `<tr><td colspan="${columns}"><p class="admin-empty">${escapeHtml(message)}</p></td></tr>`;
  const selectOptions = (values, current) => values.map((value) => `<option value="${value}"${value === current ? " selected" : ""}>${statusLabels(value)}</option>`).join("");
  const displayName = (item, fallback = "User") => item.full_name?.trim() || item.email?.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || fallback;
  const toast = (message, error = false) => {
    const element = document.querySelector("[data-admin-toast]");
    element.textContent = message;
    element.classList.toggle("is-error", error);
    element.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.hidden = true; }, 3200);
  };

  /* Attach column names to cells so tables become readable cards on small screens. */
  const decorateResponsiveTables = () => {
    document.querySelectorAll(".admin-table-wrap table").forEach((table) => {
      const labels = [...table.querySelectorAll("thead th")].map((cell) => cell.textContent.trim());
      table.querySelectorAll("tbody tr").forEach((row) => {
        [...row.children].forEach((cell, index) => {
          if (cell.colSpan > 1) return;
          cell.dataset.label = labels[index] || "Detail";
        });
      });
    });
  };

  // Excel-compatible SpreadsheetML keeps exports dependency-free for the static admin site.
  const spreadsheetValue = (value) => {
    if (Array.isArray(value)) return value.join("\n");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value ?? "";
  };
  const escapeXml = (value) => String(spreadsheetValue(value)).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
  const exportExcel = (filename, sheetName, columns, rows) => {
    if (!rows.length) { toast(`There are no ${sheetName.toLowerCase()} records to export.`, true); return; }
    const rowXml = (values, header = false) => `<Row>${values.map((value) => `<Cell${header ? ' ss:StyleID="Header"' : ""}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D4FF3A" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${rowXml(columns.map((column) => column.label), true)}${rows.map((row) => rowXml(columns.map((column) => typeof column.value === "function" ? column.value(row) : row[column.value]))).join("")}</Table></Worksheet></Workbook>`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    toast(`${sheetName} Excel file downloaded.`);
  };
  const userLabel = (id) => {
    const user = state.users.find((item) => item.id === id);
    return user ? `${displayName(user)} (${user.email})` : id || "";
  };
  const exportCreators = () => {
    const rows = state.creators.map((creator) => ({ ...state.creatorApplications.find((application) => application.converted_user_id === creator.id || application.email?.toLowerCase() === creator.email?.toLowerCase()), ...creator }));
    exportExcel("snappi-creators", "Creator Directory", [
    { label: "User ID", value: "id" }, { label: "Full Name", value: "full_name" }, { label: "Email", value: "email" },
    { label: "Phone", value: "phone" }, { label: "Account Status", value: (row) => statusLabels(row.status) },
    { label: "Application Status", value: (row) => statusLabels(row.application_status) }, { label: "City", value: "city" },
    { label: "Social Profile", value: "social_url" }, { label: "Categories", value: "categories" }, { label: "Languages", value: "languages" },
    { label: "Portfolio URL", value: "portfolio_url" }, { label: "Application Portfolio Links", value: "portfolio_urls" },
    { label: "Availability", value: "availability" }, { label: "Profile Photo Storage Path", value: "profile_photo_path" },
    { label: "18 or Above", value: "is_over_18" }, { label: "Consent Given", value: "consent" },
    { label: "Internal Notes", value: "internal_notes" }, { label: "Last Seen", value: "last_seen_at" },
    { label: "Account Created", value: "created_at" }, { label: "Updated At", value: "updated_at" }
    ], rows);
  };
  const exportBrands = () => {
    const rows = state.brands.map((brand) => ({ ...state.brandRequests.find((request) => request.converted_user_id === brand.id || request.work_email?.toLowerCase() === brand.email?.toLowerCase()), ...brand }));
    exportExcel("snappi-brands", "Brand Directory", [
    { label: "User ID", value: "id" }, { label: "Contact Name", value: "full_name" }, { label: "Email", value: "email" },
    { label: "Phone", value: "phone" }, { label: "Company Name", value: "company_name" }, { label: "Industry", value: "industry" },
    { label: "Website", value: "website_url" }, { label: "Account Status", value: (row) => statusLabels(row.status) },
    { label: "Requested Package", value: "package_name" }, { label: "Campaign Objective", value: "campaign_objective" },
    { label: "Preferred Launch Date", value: "preferred_launch_date" }, { label: "Request Consent", value: "consent" },
    { label: "Assigned Owner", value: (row) => userLabel(row.assigned_owner) }, { label: "Internal Notes", value: "internal_notes" },
    { label: "Last Seen", value: "last_seen_at" }, { label: "Account Created", value: "created_at" }, { label: "Updated At", value: "updated_at" }
    ], rows);
  };
  const exportSubscriptions = () => exportExcel("snappi-subscriptions", "Subscriptions", [
    { label: "Subscription ID", value: "id" }, { label: "Brand", value: (row) => userLabel(row.brand_user_id) },
    { label: "Package", value: "package_name" }, { label: "Status", value: (row) => statusLabels(effectiveSubscriptionStatus(row)) },
    { label: "Start Date", value: "starts_on" }, { label: "End Date", value: "ends_on" }, { label: "Payment Method", value: "payment_method" },
    { label: "Payment Reference", value: "payment_reference" }, { label: "Confirmation Note", value: "confirmation_note" },
    { label: "Confirmed By", value: (row) => userLabel(row.confirmed_by) }, { label: "Created At", value: "created_at" }, { label: "Updated At", value: "updated_at" }
  ], state.subscriptions);

  const showLogin = (message = "") => {
    api.stopInactivityTimeout();
    workspace.hidden = true;
    authShell.hidden = false;
    loginPanel.hidden = false;
    passwordPanel.hidden = true;
    authStatus.textContent = message;
  };
  const showWorkspace = () => {
    sessionStorage.removeItem(workspaceLockKey);
    authShell.hidden = true;
    workspace.hidden = false;
    document.querySelector("[data-admin-name]").textContent = state.profile.full_name || "Basem Shoaib";
    document.querySelector("[data-admin-role]").textContent = statusLabels(state.profile.role);
    applyAccessVisibility();
    api.startInactivityTimeout({
      onTimeout: () => {
        state.profile = null;
        showLogin("You were signed out automatically after 10 minutes without activity.");
      }
    });
  };
  const showRequiredPasswordChange = (session) => {
    passwordChangeToken = session.access_token;
    workspace.hidden = true;
    authShell.hidden = false;
    loginPanel.hidden = true;
    passwordPanel.hidden = false;
    passwordPanel.querySelector("p").textContent = "🔑 First sign-in";
    passwordPanel.querySelector("h1").textContent = "Create your private password.";
  };

  const isSuperAdmin = () => state.profile?.role === "super_admin";
  const can = (permission) => isSuperAdmin() || Boolean(state.permissions?.[permission]);
  const applyAccessVisibility = () => {
    document.querySelectorAll("[data-super-admin-only]").forEach((element) => { if (!isSuperAdmin()) element.hidden = true; else if (!element.matches("[data-admin-subpanel]")) element.hidden = false; });
    document.querySelectorAll("[data-permission]").forEach((element) => { element.hidden = !can(element.dataset.permission); });
    document.querySelectorAll("[data-permissions]").forEach((element) => {
      element.hidden = !element.dataset.permissions.split(",").every((permission) => can(permission.trim()));
    });
  };

  const loadCurrentProfile = async (session) => {
    const rows = await api.rest("profiles", { query: query({ select: "id,email,full_name,phone,role,status", id: `eq.${session.user.id}`, limit: "1" }) });
    const profile = rows?.[0];
    if (!profile || !["super_admin", "operations_admin"].includes(profile.role) || profile.status !== "active") throw new Error("This account does not have active administrator access.");
    state.profile = profile;
    if (profile.role === "operations_admin") {
      const permissionRows = await api.rest("user_permissions", { query: query({ select: "workspace_role_id,manage_users,manage_creators,manage_brands,manage_campaigns,manage_content,manage_support,manage_careers", user_id: `eq.${profile.id}`, limit: "1" }) });
      state.permissions = permissionRows?.[0] || {};
    } else state.permissions = {};
  };

  const fetchAll = async () => {
    const safe = (allowed, task) => allowed ? task() : Promise.resolve([]);
    const results = await Promise.all([
      safe(can("manage_users"), () => api.rest("profiles", { query: query({ select: "id,email,full_name,phone,role,status,created_at,updated_at", order: "created_at.desc" }) })),
      safe(can("manage_users"), () => api.rest("user_permissions", { query: query({ select: "user_id,workspace_role_id,manage_users,manage_creators,manage_brands,manage_campaigns,manage_content,manage_support,manage_careers" }) })),
      safe(can("manage_users"), () => api.rest("workspace_roles", { query: query({ select: "id,name,description,manage_users,manage_creators,manage_brands,manage_campaigns,manage_content,manage_support,manage_careers,created_at,updated_at", order: "name.asc" }) })),
      safe(can("manage_creators"), () => api.rest("creator_applications", { query: query({ select: "id,full_name,email,phone,city,social_url,portfolio_urls,categories,languages,availability,profile_photo_path,is_over_18,consent,status,assigned_to,converted_user_id,internal_notes,source,created_at,updated_at", order: "created_at.desc" }) })),
      safe(can("manage_brands"), () => api.rest("brand_requests", { query: query({ select: "id,contact_name,work_email,phone,company_name,industry,website_url,package_name,campaign_objective,preferred_launch_date,status,assigned_to,converted_user_id,internal_notes,source,consent,created_at,updated_at", order: "created_at.desc" }) })),
      safe(can("manage_brands"), () => api.rest("brand_subscriptions", { query: query({ select: "id,brand_user_id,package_name,status,starts_on,ends_on,payment_method,payment_reference,confirmation_note,confirmed_by,created_at,updated_at", order: "created_at.desc" }) })),
      safe(can("manage_creators"), () => api.rest("profiles", { query: query({ select: "id,email,full_name,phone,status,last_seen_at,created_at,updated_at", role: "eq.creator", order: "created_at.desc" }) })),
      safe(can("manage_creators"), () => api.rest("creator_profiles", { query: query({ select: "user_id,application_status,city,categories,portfolio_url,availability,internal_notes,created_at,updated_at", order: "updated_at.desc" }) })),
      safe(can("manage_brands"), () => api.rest("profiles", { query: query({ select: "id,email,full_name,phone,status,last_seen_at,created_at,updated_at", role: "eq.brand", order: "created_at.desc" }) })),
      safe(can("manage_brands"), () => api.rest("brand_profiles", { query: query({ select: "user_id,company_name,industry,website_url,assigned_owner,internal_notes,created_at,updated_at", order: "updated_at.desc" }) })),
      safe(can("manage_campaigns"), () => api.rest("campaigns", { query: query({ select: "id,title,brand_id,owner_id,status,objective,deliverables_count,next_deadline,brief_url,drive_folder_url,archived_at,archived_by,created_at,updated_at", order: "updated_at.desc" }) })),
      safe(can("manage_campaigns"), () => api.rest("campaign_deletion_requests", { query: query({ select: "id,campaign_id,requested_by,reason,status,reviewed_by,reviewed_at,decision_note,created_at,updated_at", order: "created_at.desc" }) })),
      safe(can("manage_content"), () => api.rest("content_submissions", { query: query({ select: "id,campaign_id,creator_id,version,status,file_path,drive_file_url,thumbnail_url,notes,review_due_at,reviewed_by,reviewed_at,updated_at", order: "updated_at.desc" }) })),
      safe(can("manage_support"), () => api.rest("support_requests", { query: query({ select: "id,requester_id,requester_name,requester_email,requester_phone,preferred_reply,subject,category,message,priority,status,assigned_to,source,created_at,updated_at", order: "created_at.desc" }) })),
      safe(can("manage_support"), () => api.rest("support_request_admin_notes", { query: query({ select: "request_id,internal_notes,updated_by,updated_at" }) })),
      safe(can("manage_careers"), () => api.rest("career_openings", { query: query({ select: "id,title,department,location,workplace_type,employment_type,summary,requirements,application_email,application_url,opens_on,closes_on,status,created_by,created_at,updated_at", order: "created_at.desc" }) })),
      safe(isSuperAdmin(), () => api.rest("activity_log", { query: query({ select: "id,actor_id,action,record_table,record_id,old_data,new_data,created_at", order: "created_at.desc", limit: "100" }) }))
    ]);
    const [allUsers, allPermissions, roles, creatorApplications, brandRequests, subscriptions, creatorUsers, creatorDetails, brandUsers, brandDetails, campaigns, campaignDeletionRequests, content, support, supportNotes, careers, activity] = results;
    const permissionsById = Object.fromEntries(allPermissions.map((item) => [item.user_id, item]));
    state.users = allUsers.map((user) => ({ ...user, permissions: permissionsById[user.id] || {} }));
    state.roles = roles;
    state.creatorApplications = creatorApplications;
    state.brandRequests = brandRequests;
    state.subscriptions = subscriptions;
    const creatorsById = Object.fromEntries(creatorDetails.map((item) => [item.user_id, item]));
    const brandsById = Object.fromEntries(brandDetails.map((item) => [item.user_id, item]));
    state.creators = creatorUsers.map((user) => ({ ...user, ...(creatorsById[user.id] || { user_id: user.id, application_status: "new", city: "", categories: [] }) }));
    state.brands = brandUsers.map((user) => ({ ...user, ...(brandsById[user.id] || { user_id: user.id, company_name: "", industry: "" }) }));
    state.campaigns = campaigns;
    state.campaignDeletionRequests = campaignDeletionRequests;
    state.content = content;
    state.support = support;
    state.supportNotes = supportNotes;
    state.careers = careers;
    state.activity = activity;
    applyAccessVisibility();
    renderAll();
  };

  const renderMetrics = () => {
    const metric = (name, value) => { const element = document.querySelector(`[data-metric="${name}"]`); if (element) element.textContent = value; };
    metric("expired_subscriptions", state.subscriptions.filter((item) => effectiveSubscriptionStatus(item) === "expired").length);
    metric("active_creators", state.creators.filter((item) => item.status === "active").length);
    metric("active_brands", state.brands.filter((item) => item.status === "active").length);
    metric("active_campaigns", state.campaigns.filter((item) => !["completed", "cancelled"].includes(item.status)).length);
    metric("open_support", state.support.filter((item) => !["resolved", "closed"].includes(item.status)).length);
    document.querySelector('[data-count="creators"]').textContent = state.creators.length;
    document.querySelector('[data-count="creator-applications"]').textContent = state.creatorApplications.filter((item) => !["rejected", "onboarded"].includes(item.status)).length;
    document.querySelector('[data-count="brand-requests"]').textContent = state.brandRequests.filter((item) => !["converted", "declined"].includes(item.status)).length;
    document.querySelector('[data-count="subscriptions"]').textContent = state.subscriptions.filter((item) => ["active", "expiring_soon", "awaiting_payment"].includes(item.status)).length;
    document.querySelector('[data-count="users"]').textContent = state.users.length;
    document.querySelector('[data-count="brands"]').textContent = state.brands.length;
    document.querySelector('[data-count="campaigns"]').textContent = state.campaigns.length;
    document.querySelector('[data-count="content"]').textContent = state.content.filter((item) => !["approved", "delivered", "archived"].includes(item.status)).length;
    document.querySelector('[data-count="support"]').textContent = state.support.filter((item) => !["resolved", "closed"].includes(item.status)).length;
    const careerCount = document.querySelector('[data-count="careers"]');
    if (careerCount) careerCount.textContent = state.careers.filter((item) => !["closed", "archived"].includes(item.status)).length;
  };

  const renderUsers = () => {
    const body = document.querySelector('[data-admin-table="users"]');
    if (!body) return;
    const names = { manage_users: "Users", manage_creators: "Creators", manage_brands: "Brands", manage_campaigns: "Campaigns", manage_content: "Content", manage_support: "Support", manage_careers: "Careers" };
    body.innerHTML = state.users.length ? state.users.map((item) => {
      const privileges = item.role === "super_admin" ? "All operations · Audit Trail" : item.role === "operations_admin" ? Object.entries(names).filter(([key]) => item.permissions[key]).map(([,label]) => label).join(", ") || "No privileges" : "Workspace access only";
      const assignedRole = state.roles.find((role) => role.id === item.permissions.workspace_role_id);
      const roleLabel = item.role === "operations_admin" ? assignedRole?.name || "Administrator" : statusLabels(item.role);
      const action = `<button class="admin-table-button" type="button" data-admin-edit-access="${item.id}">${item.role === "super_admin" ? "Edit profile" : "Edit user"}</button>`;
      return `<tr data-search-row="users" data-role="${item.role}" data-status="${item.status}"><td><b>${escapeHtml(displayName(item))}</b><small>${escapeHtml(item.email)}</small><small>${escapeHtml(item.phone || "No phone number")}</small></td><td><span class="admin-status status-${item.role}">${escapeHtml(roleLabel)}</span></td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${escapeHtml(privileges)}</td><td>${dateLabel(item.created_at)}</td><td>${action}</td></tr>`;
    }).join("") : emptyRow(6, "No users found.");
  };
  const permissionNames = { manage_users: "Users", manage_creators: "Creators", manage_brands: "Brands", manage_campaigns: "Campaigns", manage_content: "Content", manage_support: "Support", manage_careers: "Careers" };
  const renderRoles = () => {
    const body = document.querySelector('[data-admin-table="roles"]');
    if (!body) return;
    body.innerHTML = state.roles.length ? state.roles.map((role) => {
      const privileges = Object.entries(permissionNames).filter(([key]) => role[key]).map(([,label]) => label).join(", ") || "No privileges";
      const users = state.users.filter((user) => user.permissions.workspace_role_id === role.id).length;
      return `<tr data-search-row="roles"><td><b>${escapeHtml(role.name)}</b><small>${escapeHtml(role.description || "No description")}</small></td><td>${escapeHtml(privileges)}</td><td>${users}</td><td>${dateLabel(role.updated_at)}</td><td><button class="admin-table-button" type="button" data-admin-edit-role="${role.id}">Edit role</button></td></tr>`;
    }).join("") : emptyRow(5, "No Administration roles have been created.");
    const options = `<option value="">Select a role</option>${state.roles.map((role) => `<option value="${role.id}">${escapeHtml(role.name)}</option>`).join("")}`;
    document.querySelectorAll("[data-admin-role-options]").forEach((select) => { const current = select.value; select.innerHTML = options; select.value = current; });
  };

  const renderOverview = () => {
    const priorities = [
      ...state.creatorApplications.filter((item) => item.status === "new").slice(0, 3).map((item) => ({ type: "Creator", title: item.full_name, meta: "New application", tab: "creator-applications" })),
      ...state.brandRequests.filter((item) => ["new", "consultation_required", "package_selected"].includes(item.status)).slice(0, 3).map((item) => ({ type: "Brand", title: item.company_name, meta: statusLabels(item.status), tab: "brand-requests" })),
      ...state.support.filter((item) => ["new", "open"].includes(item.status)).slice(0, 3).map((item) => ({ type: "Support", title: item.subject, meta: `${statusLabels(item.priority)} priority`, tab: "support" })),
      ...state.content.filter((item) => ["submitted", "internal_review"].includes(item.status)).slice(0, 3).map((item) => ({ type: "Content", title: `Submission ${item.id.slice(0, 8)}`, meta: statusLabels(item.status), tab: "content" }))
    ].slice(0, 6);
    document.querySelector("[data-priority-list]").innerHTML = priorities.length ? priorities.map((item) => `<button type="button" data-admin-tab="${item.tab}"><span>${item.type}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.meta)}</small><i>→</i></button>`).join("") : '<p class="admin-empty">Nothing urgent is waiting right now.</p>';
    document.querySelector("[data-activity-preview]").innerHTML = state.activity.length ? state.activity.slice(0, 6).map((item) => { const event = describeAudit(item); return `<article><span>${escapeHtml(event.verb)}</span><p><b>${escapeHtml(event.summary)}</b><small>${escapeHtml(event.actor)} · ${dateTimeLabel(item.created_at)}</small></p></article>`; }).join("") : '<p class="admin-empty">No administrative activity recorded yet.</p>';
  };

  const renderCreatorApplications = () => {
    const body = document.querySelector('[data-admin-table="creator-applications"]');
    body.innerHTML = state.creatorApplications.length ? state.creatorApplications.map((item) => `<tr data-search-row="creator-applications" data-status="${item.status}"><td><b>${escapeHtml(item.full_name)}</b><small>${escapeHtml(item.email)} · ${escapeHtml(item.phone)}</small><small>${escapeHtml(item.city || "No city")}</small></td><td><b>${escapeHtml((item.categories || []).join(", ") || "No categories")}</b><small>${escapeHtml((item.languages || []).join(", ") || "No languages")}</small><small>${item.portfolio_urls?.length || 0} portfolio link(s)${item.profile_photo_path ? ` · <button class="admin-inline-link" type="button" data-creator-photo="${escapeHtml(item.profile_photo_path)}">View photo</button>` : " · No photo"}</small></td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${dateLabel(item.created_at)}</td><td><button class="admin-table-button" type="button" data-request-detail="creator" data-request-id="${item.id}">View Details</button></td></tr>`).join("") : emptyRow(5, "No creator applications yet.");
  };
  const renderBrandRequests = () => {
    const body = document.querySelector('[data-admin-table="brand-requests"]');
    body.innerHTML = state.brandRequests.length ? state.brandRequests.map((item) => `<tr data-search-row="brand-requests" data-status="${item.status}" data-package="${escapeHtml(item.package_name.toLowerCase())}"><td><b>${escapeHtml(item.company_name)}</b><small>${escapeHtml(item.industry || "Business category not provided")}</small><small>${escapeHtml(item.website_url || "No website")}</small></td><td><b>${escapeHtml(item.contact_name)}</b><small>${escapeHtml(item.work_email)} · ${escapeHtml(item.phone)}</small></td><td><span class="admin-status">${escapeHtml(item.package_name)}</span></td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${dateLabel(item.created_at)}</td><td><button class="admin-table-button" type="button" data-request-detail="brand" data-request-id="${item.id}">View Details</button></td></tr>`).join("") : emptyRow(6, "No brand requests yet.");
  };
  const effectiveSubscriptionStatus = (item) => item.ends_on && new Date(`${item.ends_on}T23:59:59`) < new Date() && !["cancelled","expired"].includes(item.status) ? "expired" : item.status;
  const renderSubscriptions = () => {
    const body = document.querySelector('[data-admin-table="subscriptions"]');
    body.innerHTML = state.subscriptions.length ? state.subscriptions.map((item) => { const brand = state.brands.find((entry) => entry.id === item.brand_user_id); const effective = effectiveSubscriptionStatus(item); return `<tr data-search-row="subscriptions" data-status="${effective}" data-package="${escapeHtml(item.package_name.toLowerCase())}"><td><b>${escapeHtml(brand?.company_name || brand?.full_name || brand?.email || "Brand account")}</b><small>${escapeHtml(brand?.email || item.brand_user_id.slice(0,8))}</small></td><td><b>${escapeHtml(item.package_name)}</b></td><td><span class="admin-status status-${effective}">${statusLabels(effective)}</span></td><td><b>${dateLabel(item.starts_on)} → ${dateLabel(item.ends_on)}</b><small>${escapeHtml(item.payment_method || "Payment method not recorded")}</small></td><td><button class="admin-table-button" type="button" data-admin-edit-subscription="${item.id}">Edit</button></td></tr>`; }).join("") : emptyRow(5, "No brand subscriptions recorded yet.");
    const options = `<option value="">Select a brand</option>${state.brands.map((brand) => `<option value="${brand.id}">${escapeHtml(brand.company_name || brand.full_name || brand.email)}</option>`).join("")}`;
    const select = document.querySelector("[data-admin-brand-options]");
    if (select) { const current = select.value; select.innerHTML = options; select.value = current; }
  };

  const renderCreators = () => {
    const body = document.querySelector('[data-admin-table="creators"]');
    body.innerHTML = state.creators.length ? state.creators.map((item) => `<tr data-search-row="creators" data-status="${item.application_status}"><td><b>${escapeHtml(item.full_name || "Unnamed creator")}</b><small>${escapeHtml(item.email)}</small></td><td><span class="admin-status status-${item.application_status}">${statusLabels(item.application_status)}</span></td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${escapeHtml(item.city || "—")}</td><td>${dateLabel(item.updated_at)}</td><td><select class="admin-row-action" data-creator-action="${item.id}" aria-label="Update ${escapeHtml(item.full_name || item.email)}"><option value="">Choose action</option>${selectOptions(["under_review","shortlisted","interview_requested","approved","waitlisted","rejected","onboarded"], "")}</select></td></tr>`).join("") : emptyRow(6, "No creator accounts yet.");
  };
  const renderBrands = () => {
    const body = document.querySelector('[data-admin-table="brands"]');
    body.innerHTML = state.brands.length ? state.brands.map((item) => `<tr data-search-row="brands" data-status="${item.status}"><td><b>${escapeHtml(item.company_name || "Unnamed brand")}</b><small>${escapeHtml(item.website_url || "No website")}</small></td><td><b>${escapeHtml(item.full_name || "—")}</b><small>${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.industry || "—")}</td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${dateLabel(item.updated_at)}</td><td><select class="admin-row-action" data-brand-action="${item.id}" aria-label="Update ${escapeHtml(item.company_name || item.email)}"><option value="">Choose action</option>${selectOptions(["active","paused","suspended","archived"], "")}</select></td></tr>`).join("") : emptyRow(6, "No brand accounts yet.");
  };
  const renderCampaigns = () => {
    const body = document.querySelector('[data-admin-table="campaigns"]');
    body.innerHTML = state.campaigns.length ? state.campaigns.map((item) => {
      const brand = state.brands.find((entry) => entry.id === item.brand_id);
      const deletion = state.campaignDeletionRequests.find((entry) => entry.campaign_id === item.id && entry.status === "pending");
      const deletionControls = deletion
        ? (isSuperAdmin() ? `<button class="admin-table-button" type="button" data-admin-review-campaign-deletion="${deletion.id}" data-decision="approved">Approve removal</button><button class="admin-table-button" type="button" data-admin-review-campaign-deletion="${deletion.id}" data-decision="rejected">Reject</button>` : `<span class="admin-status status-waitlisted">Removal pending</span>`)
        : `<button class="admin-table-button" type="button" data-admin-request-campaign-deletion="${item.id}">Request removal</button>`;
      return `<tr data-search-row="campaigns" data-status="${item.status}"><td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(brand?.company_name || brand?.full_name || "No brand assigned")}</small><small>${escapeHtml(item.objective || "No objective added")}</small></td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${item.deliverables_count}</td><td>${dateLabel(item.next_deadline)}</td><td>${dateLabel(item.updated_at)}</td><td><div class="admin-row-actions"><select class="admin-row-action" data-campaign-action="${item.id}" aria-label="Update ${escapeHtml(item.title)}"><option value="">Change stage</option>${selectOptions(["discovery","scope_confirmed","creator_matching","creator_approval","concepts","production","brand_review","revisions","final_approval","delivered","completed","cancelled"], "")}</select><button class="admin-table-button" type="button" data-admin-assign-creator="${item.id}">Assign creator</button>${deletionControls}</div></td></tr>`;
    }).join("") : emptyRow(6, "No campaigns yet. Create the first operational campaign record when ready.");
    const brandSelect = document.querySelector("[data-admin-campaign-brand-options]");
    if (brandSelect) brandSelect.innerHTML = `<option value="">Select a brand</option>${state.brands.map((brand) => `<option value="${brand.id}">${escapeHtml(brand.company_name || brand.full_name || brand.email)}</option>`).join("")}`;
    const creatorSelect = document.querySelector("[data-admin-campaign-creator-options]");
    if (creatorSelect) creatorSelect.innerHTML = `<option value="">Select a creator</option>${state.creators.filter((creator) => creator.status === "active").map((creator) => `<option value="${creator.id}">${escapeHtml(creator.full_name || creator.email)}</option>`).join("")}`;
  };

  const renderContent = () => {
    const body = document.querySelector('[data-admin-table="content"]');
    body.innerHTML = state.content.length ? state.content.map((item) => {
      const creator = state.creators.find((entry) => entry.id === item.creator_id);
      const campaign = state.campaigns.find((entry) => entry.id === item.campaign_id);
      let drive = "";
      try { if (item.drive_file_url && ["http:","https:"].includes(new URL(item.drive_file_url).protocol)) drive = item.drive_file_url; } catch {}
      return `<tr data-search-row="content" data-status="${item.status}"><td><b>${escapeHtml(creator?.full_name || creator?.email || item.id.slice(0, 8))}</b><small>${drive ? `<a href="${escapeHtml(drive)}" target="_blank" rel="noopener noreferrer">Open raw video in Google Drive</a>` : "Drive link not added"}</small></td><td>${escapeHtml(campaign?.title || item.campaign_id.slice(0, 8))}</td><td>V${item.version}</td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${dateLabel(item.review_due_at)}</td><td><select class="admin-row-action" data-content-action="${item.id}"><option value="">Change status</option>${selectOptions(["internal_review","revision_requested","ready_for_brand","brand_reviewing","brand_revision_requested","approved","delivered","archived"], "")}</select></td></tr>`;
    }).join("") : emptyRow(6, "No content submissions yet. Raw videos stay in Google Drive; Snappi stores only links and review status.");
  };

  const renderSupport = () => {
    const body = document.querySelector('[data-admin-table="support"]');
    body.innerHTML = state.support.length ? state.support.map((item) => `<tr data-search-row="support" data-status="${item.status}" data-priority="${item.priority}" data-category="${item.category}"><td><b>${escapeHtml(item.subject)}</b><small>${escapeHtml(item.requester_name || item.requester_email || item.requester_id?.slice(0, 8) || item.id.slice(0, 8))}</small><small>${escapeHtml(item.requester_email || "Authenticated workspace request")}</small></td><td>${escapeHtml(statusLabels(item.category))}</td><td><span class="admin-status status-${item.priority}">${statusLabels(item.priority)}</span></td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td>${dateLabel(item.created_at)}</td><td><button class="admin-table-button" type="button" data-support-detail="${item.id}">View Details</button></td></tr>`).join("") : emptyRow(6, "No support requests yet.");
    const assigneeSelect = document.querySelector("[data-admin-support-assignee-options]");
    if (assigneeSelect) assigneeSelect.innerHTML = `<option value="">Unassigned</option>${state.users.filter((user) => ["super_admin","operations_admin"].includes(user.role) && user.status === "active").map((user) => `<option value="${user.id}">${escapeHtml(displayName(user))}</option>`).join("")}`;
  };
  const auditAreaName = (table) => ({ profiles: "user account", user_permissions: "user privileges", workspace_roles: "Administration role", creator_applications: "creator application", brand_requests: "brand request", brand_subscriptions: "brand subscription", creator_profiles: "creator profile", brand_profiles: "brand profile", campaigns: "campaign", content_submissions: "content submission", support_requests: "support request", career_openings: "career opening" }[table] || statusLabels(table));
  const auditSubject = (item) => {
    const data = item.new_data || item.old_data || {};
    const user = state.users.find((entry) => entry.id === item.record_id || entry.id === data.user_id || entry.id === data.id);
    if (user) return displayName(user);
    const creatorApplication = state.creatorApplications.find((entry) => entry.id === item.record_id);
    if (creatorApplication) return creatorApplication.full_name || creatorApplication.email;
    const brandRequest = state.brandRequests.find((entry) => entry.id === item.record_id);
    if (brandRequest) return brandRequest.company_name || brandRequest.contact_name || brandRequest.work_email;
    const creator = state.creators.find((entry) => entry.user_id === item.record_id || entry.id === item.record_id || entry.user_id === data.user_id);
    if (creator) return creator.full_name || creator.email;
    const brand = state.brands.find((entry) => entry.user_id === item.record_id || entry.id === item.record_id || entry.user_id === data.user_id || entry.id === data.brand_user_id);
    if (brand) return brand.company_name || brand.full_name || brand.email;
    if (data.title) return data.title;
    if (data.subject) return data.subject;
    if (data.company_name) return data.company_name;
    if (data.full_name) return data.full_name;
    if (data.contact_name) return data.contact_name;
    if (data.email || data.work_email) return data.email || data.work_email;
    return item.record_id ? `${auditAreaName(item.record_table)} ${String(item.record_id).slice(0, 8)}` : "a record";
  };
  const auditAccountType = (item) => {
    const data = item.new_data || item.old_data || {};
    const user = state.users.find((entry) => entry.id === item.record_id || entry.id === data.user_id || entry.id === data.id);
    if (user?.role) return statusLabels(user.role);
    if (["creator_applications","creator_profiles"].includes(item.record_table)) return "Creator";
    if (["brand_requests","brand_profiles","brand_subscriptions"].includes(item.record_table)) return "Brand";
    if (item.record_table === "campaigns") return "Campaign";
    if (item.record_table === "support_requests") return "Support";
    if (item.record_table === "career_openings") return "Career";
    if (item.record_table === "workspace_roles" || item.record_table === "user_permissions") return "Administrator";
    return statusLabels(data.role || item.record_table || "Record");
  };
  const auditChanges = (item) => {
    if (item.action === "insert") return "A new record was created.";
    if (item.action === "delete") return "The record was removed.";
    const before = item.old_data || {};
    const after = item.new_data || {};
    const labels = { full_name: "name", name: "role name", email: "email", phone: "phone number", role: "role", status: "status", application_status: "application status", title: "title", objective: "objective", priority: "priority", assigned_to: "assignment", manage_users: "user management", manage_creators: "creator access", manage_brands: "brand access", manage_campaigns: "campaign access", manage_content: "content access", manage_support: "support access", manage_careers: "careers access" };
    const changes = Object.keys(labels).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => `${labels[key]}: ${statusLabels(String(before[key] ?? "empty"))} → ${statusLabels(String(after[key] ?? "empty"))}`);
    return changes.length ? changes.join("; ") : "The record was updated.";
  };
  const describeAudit = (item) => {
    const actor = state.users.find((user) => user.id === item.actor_id);
    const verb = item.action === "insert" ? "Created" : item.action === "delete" ? "Deleted" : "Updated";
    return { verb, accountType: auditAccountType(item), subject: auditSubject(item), actor: actor ? displayName(actor) : item.actor_id ? `Administrator ${item.actor_id.slice(0, 8)}` : "System", summary: `${verb} ${auditAreaName(item.record_table)} for ${auditSubject(item)}`, details: auditChanges(item) };
  };
  const renderCareers = () => {
    const body = document.querySelector('[data-admin-table="careers"]');
    if (!body) return;
    body.innerHTML = state.careers.length ? state.careers.map((item) => `<tr data-search-row="careers" data-status="${item.status}" data-workplace="${item.workplace_type}"><td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.department || "No department")}</small><small>${escapeHtml(item.application_email)}</small></td><td><b>${escapeHtml(statusLabels(item.workplace_type))}</b><small>${escapeHtml(item.location || "Egypt")} · ${escapeHtml(statusLabels(item.employment_type))}</small></td><td><span class="admin-status status-${item.status}">${statusLabels(item.status)}</span></td><td><b>${dateLabel(item.opens_on)} → ${dateLabel(item.closes_on)}</b><small>Updated ${dateLabel(item.updated_at)}</small></td><td><button class="admin-table-button" type="button" data-admin-edit-career="${item.id}">Edit</button></td></tr>`).join("") : emptyRow(5, "No career openings yet. Create a draft when recruitment planning begins.");
  };

  const renderActivity = () => {
    const body = document.querySelector('[data-admin-table="activity"]');
    body.innerHTML = state.activity.length ? state.activity.map((item) => { const event = describeAudit(item); return `<tr data-search-row="activity" data-account-type="${escapeHtml(event.accountType.toLowerCase())}" data-action="${escapeHtml(event.verb.toLowerCase())}"><td><b>${dateTimeLabel(item.created_at)}</b></td><td><span class="admin-status">${escapeHtml(event.accountType)}</span><small>${escapeHtml(event.subject)}</small></td><td><span class="admin-status">${escapeHtml(event.verb)}</span><small>${escapeHtml(event.summary)}</small></td><td><b>${escapeHtml(event.actor)}</b></td><td>${escapeHtml(event.details)}</td></tr>`; }).join("") : emptyRow(5, "No activity recorded yet.");
  };
  const renderAll = () => { renderMetrics(); renderOverview(); renderCreatorApplications(); renderBrandRequests(); renderSubscriptions(); renderUsers(); renderRoles(); renderCreators(); renderBrands(); renderCampaigns(); renderContent(); renderSupport(); renderCareers(); renderActivity(); applyFilters(); };

  const selectTab = (name) => {
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => { const active = panel.dataset.adminPanel === name; panel.hidden = !active; panel.classList.toggle("is-active", active); });
    document.querySelectorAll(".admin-navigation [data-admin-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminTab === name));
    document.querySelector("[data-admin-page-title]").textContent = titles[name] || titles.overview;
    document.querySelector("[data-admin-account-menu]").hidden = true;
    document.body.classList.remove("admin-sidebar-open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selectAdminSubtab = (name) => {
    document.querySelectorAll("[data-admin-subpanel]").forEach((panel) => { panel.hidden = panel.dataset.adminSubpanel !== name; });
    document.querySelectorAll("[data-admin-subtab]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminSubtab === name));
  };
  const paginateTable = (name) => {
    const body = document.querySelector(`[data-admin-table="${name}"]`);
    if (!body) return;
    const rows = [...body.querySelectorAll(":scope > tr")];
    const records = rows.filter((row) => !row.querySelector(".admin-empty") && row.dataset.filterHidden !== "true");
    const totalPages = Math.max(1, Math.ceil(records.length / TABLE_PAGE_SIZE));
    const page = Math.min(Math.max(1, tablePages[name] || 1), totalPages);
    tablePages[name] = page;
    let visibleIndex = 0;
    rows.forEach((row) => {
      if (row.dataset.filterHidden === "true") { row.hidden = true; return; }
      if (row.querySelector(".admin-empty")) { row.hidden = false; return; }
      row.hidden = visibleIndex < (page - 1) * TABLE_PAGE_SIZE || visibleIndex >= page * TABLE_PAGE_SIZE;
      visibleIndex += 1;
    });
    const wrap = body.closest(".admin-table-wrap");
    let controls = wrap?.nextElementSibling;
    if (!controls?.matches(`[data-admin-pagination="${name}"]`)) {
      controls = document.createElement("nav");
      controls.className = "admin-pagination";
      controls.dataset.adminPagination = name;
      controls.setAttribute("aria-label", `${statusLabels(name)} pages`);
      wrap?.after(controls);
    }
    controls.hidden = records.length <= TABLE_PAGE_SIZE;
    controls.innerHTML = `<button type="button" data-admin-page-table="${name}" data-admin-page-direction="previous"${page === 1 ? " disabled" : ""}>← Newer</button><span>Page <b>${page}</b> of ${totalPages} · ${records.length} records</span><button type="button" data-admin-page-table="${name}" data-admin-page-direction="next"${page === totalPages ? " disabled" : ""}>Older →</button>`;
  };
  const paginateAllTables = () => {
    decorateResponsiveTables();
    document.querySelectorAll("[data-admin-table]").forEach((body) => paginateTable(body.dataset.adminTable));
  };
  const applyFilters = () => {
    document.querySelectorAll("[data-admin-table]").forEach((body) => {
      const name = body.dataset.adminTable;
      const search = document.querySelector(`[data-admin-search="${name}"]`)?.value.trim().toLowerCase() || "";
      const filters = [...document.querySelectorAll(`[data-admin-filter="${name}"]`)].filter((control) => control.value);
      body.querySelectorAll(`[data-search-row="${name}"]`).forEach((row) => {
        const matchesSearch = !search || row.textContent.toLowerCase().includes(search);
        const matchesFilters = filters.every((control) => String(row.dataset[control.dataset.filterField] || "").toLowerCase() === control.value.toLowerCase());
        row.dataset.filterHidden = String(!(matchesSearch && matchesFilters));
      });
    });
    paginateAllTables();
  };

  const updateRecord = async (table, idField, id, body, success) => {
    try { await api.rest(table, { query: query({ [idField]: `eq.${id}` }), method: "PATCH", body }); toast(success); await fetchAll(); }
    catch (error) { toast(error.message, true); }
  };
  const updateCreatorApplicationStatus = async (applicationId, status) => {
    try {
      const result = await api.invoke("admin-update-creator-application", { applicationId, status });
      if (!result.success) throw new Error(result.message || "Creator application could not be updated.");
      toast(result.warning || "Creator status updated and email sent.", Boolean(result.warning));
      await fetchAll();
    } catch (error) { toast(error.message, true); }
  };

  const detailItem = (label, value, link = false) => {
    const content = Array.isArray(value) ? value.join(", ") : value;
    const safe = escapeHtml(content || "—");
    let safeLink = "";
    if (link && content) { try { const parsed = new URL(String(content)); if (["http:","https:"].includes(parsed.protocol)) safeLink = escapeHtml(parsed.href); } catch {} }
    return `<article><small>${escapeHtml(label)}</small>${safeLink ? `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">${safe}</a>` : `<b>${safe}</b>`}</article>`;
  };
  const creatorEditField = (label, name, value = "", type = "text", required = false) => `<label class="admin-edit-field"><span>${escapeHtml(label)}</span><input name="${name}" type="${type}" value="${escapeHtml(value || "")}" ${required ? "required" : ""} /></label>`;
  const creatorEditArea = (label, name, value = "") => `<label class="admin-edit-field admin-edit-field-wide"><span>${escapeHtml(label)}</span><textarea name="${name}" rows="3">${escapeHtml(Array.isArray(value) ? value.join("\n") : value || "")}</textarea></label>`;
  const openRequestDetail = (type, id) => {
    const creator = type === "creator";
    const record = (creator ? state.creatorApplications : state.brandRequests).find((item) => item.id === id);
    if (!record) return;
    const dialog = document.querySelector('[data-admin-dialog="request-detail"]');
    const form = dialog.querySelector("form");
    form.elements.recordType.value = type;
    form.elements.recordId.value = id;
    form.elements.internalNotes.value = record.internal_notes || "";
    dialog.querySelector("[data-request-detail-kicker]").textContent = creator ? "📝 Creator application" : "📨 Brand request";
    dialog.querySelector("[data-request-detail-title]").textContent = creator ? record.full_name : record.company_name;
    const fields = [
      ["Contact", record.contact_name], ["Email", record.work_email], ["Phone", record.phone], ["Business category", record.industry],
      ["Website", record.website_url, true], ["Requested package", record.package_name], ["Campaign objective", record.campaign_objective],
      ["Preferred launch", dateLabel(record.preferred_launch_date)], ["Consent", record.consent ? "Yes" : "No"], ["Submitted", dateTimeLabel(record.created_at)], ["Updated", dateTimeLabel(record.updated_at)]
    ];
    dialog.querySelector("[data-request-detail-fields]").classList.toggle("is-editable", creator);
    dialog.querySelector("[data-request-detail-fields]").innerHTML = creator ? [
      creatorEditField("Full name", "creatorFullName", record.full_name, "text", true),
      creatorEditField("Email", "creatorEmail", record.email, "email", true),
      creatorEditField("Phone", "creatorPhone", record.phone, "tel", true),
      creatorEditField("City", "creatorCity", record.city, "text", true),
      creatorEditField("Social profile", "creatorSocialUrl", record.social_url, "url"),
      creatorEditField("Availability", "creatorAvailability", record.availability),
      creatorEditArea("Portfolio links — one per line", "creatorPortfolioUrls", record.portfolio_urls),
      creatorEditArea("Categories — one per line", "creatorCategories", record.categories),
      creatorEditArea("Languages — one per line", "creatorLanguages", record.languages),
      `<label class="admin-edit-check"><input name="creatorIsOver18" type="checkbox" ${record.is_over_18 ? "checked" : ""} /><span>Creator confirmed they are 18 or above</span></label>`,
      `<label class="admin-edit-check"><input name="creatorConsent" type="checkbox" ${record.consent ? "checked" : ""} /><span>Application consent confirmed</span></label>`,
      detailItem("Submitted", dateTimeLabel(record.created_at)),
      detailItem("Last updated", dateTimeLabel(record.updated_at)),
      record.profile_photo_path ? `<article><small>Profile photo</small><button class="admin-inline-link" type="button" data-creator-photo="${escapeHtml(record.profile_photo_path)}">Open private photo</button></article>` : detailItem("Profile photo", "Not uploaded")
    ].join("") : fields.map((entry) => detailItem(...entry)).join("");
    const statuses = creator ? ["new","under_review","shortlisted","interview_requested","approved","waitlisted","rejected","onboarded"] : ["new","consultation_required","package_selected","contacted","awaiting_payment","approved","converted","declined"];
    form.elements.status.innerHTML = selectOptions(statuses, record.status);
    const createButton = dialog.querySelector("[data-request-create-account]");
    createButton.hidden = Boolean(record.converted_user_id || ["onboarded","converted","rejected","declined"].includes(record.status));
    dialog.showModal();
  };
  const openSupportDetail = (id) => {
    const record = state.support.find((item) => item.id === id);
    if (!record) return;
    const dialog = document.querySelector('[data-admin-dialog="support-detail"]');
    const form = dialog.querySelector("form");
    const requester = state.users.find((user) => user.id === record.requester_id);
    const privateNote = state.supportNotes.find((note) => note.request_id === record.id);
    const accountType = requester?.role ? statusLabels(requester.role) : record.requester_id ? "Member" : "Public visitor";
    form.elements.requestId.value = record.id;
    form.elements.priority.value = record.priority;
    form.elements.status.value = record.status;
    form.elements.assignedTo.value = record.assigned_to || "";
    form.elements.internalNotes.value = privateNote?.internal_notes || "";
    dialog.querySelector("[data-support-detail-title]").textContent = record.subject;
    dialog.querySelector("[data-support-detail-fields]").innerHTML = [
      ["Requester", record.requester_name || requester?.full_name || "Not provided"],
      ["Account type", accountType],
      ["Email", record.requester_email || requester?.email],
      ["Phone", record.requester_phone || requester?.phone],
      ["Preferred reply", record.preferred_reply],
      ["Category", statusLabels(record.category)],
      ["Submitted", dateTimeLabel(record.created_at)],
      ["Last updated", dateTimeLabel(record.updated_at)],
      ["Source", record.source]
    ].map((entry) => detailItem(...entry)).join("");
    dialog.querySelector("[data-support-detail-message]").textContent = record.message || "No message was provided.";
    dialog.showModal();
  };

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-admin-page-table]");
    if (pageButton) {
      const name = pageButton.dataset.adminPageTable;
      tablePages[name] = Math.max(1, (tablePages[name] || 1) + (pageButton.dataset.adminPageDirection === "next" ? 1 : -1));
      paginateTable(name);
    }
    const tab = event.target.closest("[data-admin-tab]");
    if (tab) { selectTab(tab.dataset.adminTab); if (tab.dataset.adminTab === "users") selectAdminSubtab("user-list"); }
    const subtab = event.target.closest("[data-admin-subtab]");
    if (subtab) selectAdminSubtab(subtab.dataset.adminSubtab);
    if (event.target.closest("[data-admin-open-audit]")) { selectTab("users"); selectAdminSubtab("audit-log"); }
    const editAccess = event.target.closest("[data-admin-edit-access]");
    if (editAccess) {
      const user = state.users.find((item) => item.id === editAccess.dataset.adminEditAccess);
      if (!user) return;
      const form = document.querySelector("[data-admin-access-form]");
      form.elements.userId.value = user.id;
      form.elements.fullName.value = user.full_name || "";
      form.elements.email.value = user.email || "";
      form.elements.phone.value = user.phone || "";
      form.elements.role.value = user.role;
      form.elements.status.value = user.status;
      form.elements.role.disabled = user.role === "super_admin";
      form.elements.status.disabled = user.role === "super_admin";
      form.elements.workspaceRoleId.value = user.permissions.workspace_role_id || "";
      form.querySelector("[data-admin-edit-workspace-role]").hidden = user.role !== "operations_admin";
      document.querySelector('[data-admin-dialog="access"]').showModal();
    }
    const editRole = event.target.closest("[data-admin-edit-role]");
    if (editRole) {
      const role = state.roles.find((item) => item.id === editRole.dataset.adminEditRole);
      if (!role) return;
      const form = document.querySelector("[data-admin-role-form]");
      form.elements.roleId.value = role.id;
      form.elements.name.value = role.name;
      form.elements.description.value = role.description || "";
      Object.keys(permissionNames).forEach((name) => { form.elements[name].checked = Boolean(role[name]); });
      document.querySelector('[data-admin-dialog="role"]').showModal();
    }
    const editSubscription = event.target.closest("[data-admin-edit-subscription]");
    if (editSubscription) {
      const subscription = state.subscriptions.find((item) => item.id === editSubscription.dataset.adminEditSubscription);
      if (!subscription) return;
      const form = document.querySelector("[data-admin-subscription-form]");
      form.elements.subscriptionId.value = subscription.id;
      form.elements.brandUserId.value = subscription.brand_user_id;
      form.elements.packageName.value = subscription.package_name;
      form.elements.status.value = effectiveSubscriptionStatus(subscription);
      form.elements.startsOn.value = subscription.starts_on || "";
      form.elements.endsOn.value = subscription.ends_on || "";
      form.elements.paymentMethod.value = subscription.payment_method || "";
      form.elements.paymentReference.value = subscription.payment_reference || "";
      form.elements.confirmationNote.value = subscription.confirmation_note || "";
      document.querySelector('[data-admin-dialog="subscription"]').showModal();
    }
    const careerEdit = event.target.closest("[data-admin-edit-career]");
    if (careerEdit) {
      const opening = state.careers.find((item) => item.id === careerEdit.dataset.adminEditCareer);
      const form = document.querySelector("[data-admin-career-form]");
      form.reset();
      form.elements.careerId.value = opening.id; form.elements.title.value = opening.title; form.elements.department.value = opening.department || ""; form.elements.location.value = opening.location || "Egypt"; form.elements.workplaceType.value = opening.workplace_type; form.elements.employmentType.value = opening.employment_type; form.elements.summary.value = opening.summary || ""; form.elements.requirements.value = opening.requirements || ""; form.elements.applicationEmail.value = opening.application_email || "careers@snappi-eg.com"; form.elements.applicationUrl.value = opening.application_url || ""; form.elements.opensOn.value = opening.opens_on || ""; form.elements.closesOn.value = opening.closes_on || ""; form.elements.status.value = opening.status;
      document.querySelector('[data-admin-dialog="career"]').showModal();
    }
    const creatorPhoto = event.target.closest("[data-creator-photo]");
    if (creatorPhoto) api.createSignedUrl("creator-profile-photos", creatorPhoto.dataset.creatorPhoto).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch((error) => toast(error.message, true));
    const requestDetail = event.target.closest("[data-request-detail]");
    if (requestDetail) openRequestDetail(requestDetail.dataset.requestDetail, requestDetail.dataset.requestId);
    const supportDetail = event.target.closest("[data-support-detail]");
    if (supportDetail) openSupportDetail(supportDetail.dataset.supportDetail);
    const assignCreator = event.target.closest("[data-admin-assign-creator]");
    if (assignCreator) {
      const form = document.querySelector("[data-admin-campaign-creator-form]");
      form.reset();
      form.elements.campaignId.value = assignCreator.dataset.adminAssignCreator;
      document.querySelector('[data-admin-dialog="campaign-creator"]').showModal();
    }
    const addDirectoryUser = event.target.closest("[data-admin-add-directory-user]");
    if (addDirectoryUser) {
      const form = document.querySelector("[data-admin-user-form]");
      form.reset();
      form.elements.role.value = addDirectoryUser.dataset.adminAddDirectoryUser;
      const subscriptionFields = form.querySelector("[data-admin-brand-subscription]");
      subscriptionFields.hidden = true;
      subscriptionFields.querySelectorAll("select,input").forEach((field) => { field.required = false; });
      document.querySelector('[data-admin-dialog="user"]').showModal();
    }
    const requestDeletion = event.target.closest("[data-admin-request-campaign-deletion]");
    if (requestDeletion) {
      const campaign = state.campaigns.find((item) => item.id === requestDeletion.dataset.adminRequestCampaignDeletion);
      const reason = window.prompt(`Why should “${campaign?.title || "this campaign"}” be removed? The Super Admin will review this request.`);
      if (reason === null) return;
      if (reason.trim().length < 5) return toast("Enter a clear deletion reason of at least 5 characters.", true);
      api.rest("campaign_deletion_requests", { method: "POST", body: { campaign_id: requestDeletion.dataset.adminRequestCampaignDeletion, requested_by: state.profile.id, reason: reason.trim(), status: "pending" } })
        .then(async () => { toast("Campaign removal sent to the Super Admin for approval."); await fetchAll(); })
        .catch((error) => toast(error.message, true));
    }
    const reviewDeletion = event.target.closest("[data-admin-review-campaign-deletion]");
    if (reviewDeletion) {
      const decision = reviewDeletion.dataset.decision;
      const note = window.prompt(decision === "approved" ? "Optional approval note:" : "Why is this request being rejected?") ?? "";
      api.rpc("review_campaign_deletion_request", { request_id: reviewDeletion.dataset.adminReviewCampaignDeletion, decision, note })
        .then(async () => { toast(decision === "approved" ? "Campaign archived. It can be retained for recovery before permanent removal." : "Campaign removal rejected."); await fetchAll(); })
        .catch((error) => toast(error.message, true));
    }
    if (event.target.closest("[data-request-create-account]")) {
      const detailForm = document.querySelector("[data-admin-request-detail-form]");
      const type = detailForm.elements.recordType.value;
      const id = detailForm.elements.recordId.value;
      const record = (type === "creator" ? state.creatorApplications : state.brandRequests).find((item) => item.id === id);
      if (!record) return;
      const userForm = document.querySelector("[data-admin-user-form]");
      userForm.reset();
      userForm.elements.sourceType.value = type === "creator" ? "creator_application" : "brand_request";
      userForm.elements.sourceId.value = id;
      userForm.elements.fullName.value = type === "creator" ? record.full_name : record.contact_name;
      userForm.elements.email.value = type === "creator" ? record.email : record.work_email;
      userForm.elements.phone.value = record.phone;
      userForm.elements.role.value = type;
      const subscriptionFields = userForm.querySelector("[data-admin-brand-subscription]");
      subscriptionFields.hidden = type !== "brand";
      subscriptionFields.querySelectorAll("select,input").forEach((field) => { field.required = type === "brand"; });
      if (type === "brand") {
        const start = new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + 30);
        userForm.elements.subscriptionPackage.value = ["Starter", "Growth", "Premium"].includes(record.package_name) ? record.package_name : "";
        userForm.elements.subscriptionStartsOn.value = inputDate(start);
        userForm.elements.subscriptionEndsOn.value = inputDate(end);
      }
      document.querySelector('[data-admin-dialog="request-detail"]').close();
      document.querySelector('[data-admin-dialog="user"]').showModal();
    }
    const exportButton = event.target.closest("[data-admin-export]");
    if (exportButton?.dataset.adminExport === "creators") exportCreators();
    if (exportButton?.dataset.adminExport === "brands") exportBrands();
    if (exportButton?.dataset.adminExport === "subscriptions") exportSubscriptions();
  });
  document.querySelectorAll("[data-admin-search],[data-admin-filter]").forEach((control) => control.addEventListener("input", () => { tablePages[control.dataset.adminSearch || control.dataset.adminFilter] = 1; applyFilters(); }));
  document.querySelectorAll("[data-admin-clear-filters]").forEach((button) => button.addEventListener("click", () => {
    const name = button.dataset.adminClearFilters;
    document.querySelectorAll(`[data-admin-search="${name}"],[data-admin-filter="${name}"]`).forEach((control) => { control.value = ""; });
    tablePages[name] = 1;
    applyFilters();
  }));
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.value) return;
    if (target.matches("[data-creator-application-action]")) updateCreatorApplicationStatus(target.dataset.creatorApplicationAction, target.value);
    if (target.matches("[data-brand-request-action]")) updateRecord("brand_requests", "id", target.dataset.brandRequestAction, { status: target.value }, "Brand request updated.");
    if (target.matches("[data-creator-action]")) updateRecord("creator_profiles", "user_id", target.dataset.creatorAction, { application_status: target.value }, "Creator application updated.");
    if (target.matches("[data-brand-action]")) api.rpc("admin_set_account_status", { target_user_id: target.dataset.brandAction, next_status: target.value }).then(async () => { toast("Brand account updated."); await fetchAll(); }).catch((error) => toast(error.message, true));
    if (target.matches("[data-campaign-action]")) updateRecord("campaigns", "id", target.dataset.campaignAction, { status: target.value }, "Campaign stage updated.");
    if (target.matches("[data-content-action]")) updateRecord("content_submissions", "id", target.dataset.contentAction, { status: target.value }, "Content status updated.");
  });

  document.querySelector("[data-admin-login-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const label = button.querySelector("[data-admin-login-label]");
    const loader = button.querySelector("[data-admin-login-loader]");
    authStatus.classList.remove("is-error");
    authStatus.textContent = "Checking secure access…";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    label.hidden = true;
    loader.hidden = false;
    try {
      const session = await api.signIn(form.email.value.trim(), form.password.value);
      if (session.user?.user_metadata?.must_change_password) return showRequiredPasswordChange(session);
      await loadCurrentProfile(session); showWorkspace(); await fetchAll();
    }
    catch (error) { await api.signOut(); authStatus.textContent = error.message; authStatus.classList.add("is-error"); }
    finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      label.hidden = false;
      loader.hidden = true;
    }
  });
  document.querySelector("[data-admin-reset-request]").addEventListener("click", async () => {
    const email = document.querySelector('[data-admin-login-form] [name="email"]').value.trim();
    if (!email) { authStatus.textContent = "Enter your admin email first."; return; }
    try { await api.requestPasswordReset(email, `${location.origin}${location.pathname}`); authStatus.textContent = "Password recovery instructions were sent if the account exists."; }
    catch (error) { authStatus.textContent = error.message; }
  });
  document.querySelector("[data-admin-new-password-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const params = new URLSearchParams(location.hash.slice(1));
    const password = event.currentTarget.password.value;
    const confirmation = event.currentTarget.confirmation.value;
    const status = document.querySelector("[data-admin-password-status]");
    if (password !== confirmation) { status.textContent = "The passwords do not match."; return; }
    try { await api.updatePassword(passwordChangeToken || params.get("access_token"), password); passwordChangeToken = null; history.replaceState({}, "", location.pathname); status.textContent = "Password updated. You can now sign in."; setTimeout(() => showLogin("Password updated successfully."), 800); }
    catch (error) { status.textContent = error.message; }
  });
  document.querySelector("[data-admin-logout]").addEventListener("click", async () => { await api.signOut(); state.profile = null; showLogin("You have been signed out."); });
  document.querySelectorAll("[data-admin-exit-home]").forEach((link) => link.addEventListener("click", async (event) => {
    event.preventDefault();
    state.profile = null;
    sessionStorage.removeItem(workspaceLockKey);
    await api.signOut();
    window.location.replace("index.html");
  }));
  window.addEventListener("pagehide", () => { if (state.profile) sessionStorage.setItem(workspaceLockKey, "1"); });
  window.addEventListener("pageshow", async (event) => {
    if (!event.persisted || sessionStorage.getItem(workspaceLockKey) !== "1") return;
    state.profile = null;
    await api.signOut();
    showLogin("Workspace locked. Sign in again to continue.");
  });
  document.querySelector("[data-admin-refresh]").addEventListener("click", async () => { try { await fetchAll(); toast("Workspace refreshed."); } catch (error) { toast(error.message, true); } });
  document.querySelector("[data-admin-account-toggle]").addEventListener("click", () => { const menu = document.querySelector("[data-admin-account-menu]"); menu.hidden = !menu.hidden; });
  document.querySelector("[data-admin-sidebar-toggle]").addEventListener("click", (event) => { const open = document.body.classList.toggle("admin-sidebar-open"); event.currentTarget.setAttribute("aria-expanded", String(open)); });
  document.querySelector("[data-admin-create-campaign]").addEventListener("click", () => document.querySelector('[data-admin-dialog="campaign"]').showModal());
  document.querySelector("[data-admin-add-subscription]").addEventListener("click", () => { document.querySelector("[data-admin-subscription-form]").reset(); document.querySelector('[data-admin-dialog="subscription"]').showModal(); });
  document.querySelector("[data-admin-add-user]").addEventListener("click", () => document.querySelector('[data-admin-dialog="user"]').showModal());
  document.querySelector("[data-admin-add-career]")?.addEventListener("click", () => { document.querySelector("[data-admin-career-form]").reset(); document.querySelector('[data-admin-dialog="career"]').showModal(); });
  document.querySelector("[data-admin-add-role]").addEventListener("click", () => { document.querySelector("[data-admin-role-form]").reset(); document.querySelector('[data-admin-dialog="role"]').showModal(); });
  document.querySelectorAll("[data-admin-dialog-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  document.querySelectorAll(".admin-dialog").forEach((dialog) => dialog.addEventListener("close", () => {
    const form = dialog.querySelector("form");
    form?.reset();
    form?.querySelectorAll(".admin-form-status").forEach((status) => { status.textContent = ""; status.classList.remove("is-error"); });
    const password = form?.querySelector("[data-admin-temp-password]");
    if (password) password.hidden = true;
    form?.querySelectorAll("[data-admin-user-workspace-role],[data-admin-edit-workspace-role]").forEach((field) => { field.hidden = true; });
    form?.querySelectorAll('[name="role"],[name="status"]').forEach((field) => { field.disabled = false; });
  }));
  document.querySelector('[data-admin-user-form] [name="role"]').addEventListener("change", (event) => { document.querySelector("[data-admin-user-workspace-role]").hidden = event.target.value !== "operations_admin"; });
  document.querySelector('[data-admin-access-form] [name="role"]').addEventListener("change", (event) => { document.querySelector("[data-admin-edit-workspace-role]").hidden = event.target.value !== "operations_admin"; });
  document.querySelector("[data-admin-request-detail-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const type = form.elements.recordType.value;
    const table = type === "creator" ? "creator_applications" : "brand_requests";
    const message = form.querySelector("[data-request-detail-status-message]");
    message.textContent = "Saving review…";
    try {
      const nextStatus = form.elements.status.value;
      const body = { internal_notes: form.elements.internalNotes.value.trim() || null };
      if (type === "creator") {
        const list = (name) => String(form.elements[name]?.value || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
        Object.assign(body, {
          full_name: form.elements.creatorFullName.value.trim(),
          email: form.elements.creatorEmail.value.trim().toLowerCase(),
          phone: form.elements.creatorPhone.value.trim(),
          city: form.elements.creatorCity.value.trim(),
          social_url: form.elements.creatorSocialUrl.value.trim() || null,
          availability: form.elements.creatorAvailability.value.trim() || null,
          portfolio_urls: list("creatorPortfolioUrls"),
          categories: list("creatorCategories"),
          languages: list("creatorLanguages"),
          is_over_18: form.elements.creatorIsOver18.checked,
          consent: form.elements.creatorConsent.checked
        });
      }
      if (!type.includes("creator")) body.status = nextStatus;
      await api.rest(table, { query: query({ id: `eq.${form.elements.recordId.value}` }), method: "PATCH", body });
      if (type === "creator") {
        const result = await api.invoke("admin-update-creator-application", { applicationId: form.elements.recordId.value, status: nextStatus });
        if (!result.success) throw new Error(result.message || "Creator status could not be updated.");
        if (result.warning) toast(result.warning, true);
      }
      document.querySelector('[data-admin-dialog="request-detail"]').close();
      toast("Review saved.");
      await fetchAll();
    } catch (error) { message.textContent = error.message; message.classList.add("is-error"); }
  });
  document.querySelector("[data-admin-support-detail-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector("[data-admin-support-detail-status]");
    message.textContent = "Saving support request…";
    message.classList.remove("is-error");
    try {
      await api.invoke("admin-update-support", {
        requestId: form.elements.requestId.value,
        priority: form.elements.priority.value,
        status: form.elements.status.value,
        assignedTo: form.elements.assignedTo.value || null,
        internalNotes: form.elements.internalNotes.value.trim() || null
      });
      document.querySelector('[data-admin-dialog="support-detail"]').close();
      toast("Support request updated.");
      await fetchAll();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("is-error");
    }
  });
  document.querySelector("[data-admin-career-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector("[data-admin-career-status]");
    const data = new FormData(form);
    const id = data.get("careerId");
    const body = { title: String(data.get("title") || "").trim(), department: String(data.get("department") || "").trim(), location: String(data.get("location") || "Egypt").trim(), workplace_type: data.get("workplaceType"), employment_type: data.get("employmentType"), summary: String(data.get("summary") || "").trim(), requirements: String(data.get("requirements") || "").trim(), application_email: String(data.get("applicationEmail") || "careers@snappi-eg.com").trim(), application_url: String(data.get("applicationUrl") || "").trim() || null, opens_on: data.get("opensOn") || null, closes_on: data.get("closesOn") || null, status: data.get("status"), created_by: state.profile.id };
    message.textContent = "Saving opening…";
    try {
      if (id) { delete body.created_by; await api.rest("career_openings", { query: query({ id: `eq.${id}` }), method: "PATCH", body }); }
      else await api.rest("career_openings", { method: "POST", body });
      document.querySelector('[data-admin-dialog="career"]').close();
      toast("Career opening saved.");
      await fetchAll();
    } catch (error) { message.textContent = error.message; message.classList.add("is-error"); }
  });

  document.querySelector("[data-admin-campaign-form]").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-admin-campaign-status]");
    const data = new FormData(form);
    try {
      await api.rest("campaigns", { method: "POST", body: { title: data.get("title"), brand_id: data.get("brandId") || null, objective: data.get("objective") || null, brief_url: data.get("briefUrl") || null, drive_folder_url: data.get("driveFolderUrl") || null, deliverables_count: Number(data.get("deliverables") || 0), next_deadline: data.get("deadline") ? new Date(data.get("deadline")).toISOString() : null, owner_id: state.profile.id } });
      document.querySelector('[data-admin-dialog="campaign"]').close(); form.reset(); toast("Campaign created."); await fetchAll();
    } catch (error) { status.textContent = error.message; }
  });
  document.querySelector("[data-admin-campaign-creator-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-admin-campaign-creator-status]");
    const data = new FormData(form);
    status.textContent = "Assigning creator…";
    status.classList.remove("is-error");
    try {
      await api.rest("campaign_creators", {
        method: "POST",
        body: { campaign_id: data.get("campaignId"), creator_id: data.get("creatorId"), assignment_status: data.get("assignmentStatus") },
        prefer: "resolution=merge-duplicates,return=representation"
      });
      document.querySelector('[data-admin-dialog="campaign-creator"]').close();
      toast("Creator assigned to the campaign.");
      await fetchAll();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    }
  });
  document.querySelector("[data-admin-user-form]").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-admin-user-status]");
    const data = new FormData(form);
    status.textContent = "Creating secure access…";
    try {
      const result = await api.invoke("admin-create-user", { fullName: data.get("fullName"), email: data.get("email"), phone: data.get("phone"), role: data.get("role"), workspaceRoleId: data.get("workspaceRoleId"), sourceType: data.get("sourceType"), sourceId: data.get("sourceId"), subscriptionPackage: data.get("subscriptionPackage"), subscriptionStartsOn: data.get("subscriptionStartsOn"), subscriptionEndsOn: data.get("subscriptionEndsOn") });
      if (!result.success) throw new Error(result.message || "User creation failed.");
      document.querySelector('[data-admin-dialog="user"]').close();
      toast("Secure invitation sent. The user will create their own password.");
      await fetchAll();
    } catch (error) { status.textContent = error.message; status.classList.add("is-error"); }
  });
  document.querySelector("[data-admin-access-form]").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-admin-access-status]");
    const data = new FormData(form);
    status.textContent = "Saving user…";
    status.classList.remove("is-error");
    try {
      await api.invoke("admin-update-user", { userId: data.get("userId"), fullName: data.get("fullName"), email: data.get("email"), phone: data.get("phone"), role: form.elements.role.value, status: form.elements.status.value, workspaceRoleId: data.get("workspaceRoleId") });
      document.querySelector('[data-admin-dialog="access"]').close();
      toast("User information and access updated.");
      await fetchAll();
    } catch (error) { status.textContent = error.message; status.classList.add("is-error"); }
  });
  document.querySelector("[data-admin-role-form]").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-admin-role-status]");
    const data = new FormData(form);
    const roleId = data.get("roleId");
    const body = { name: String(data.get("name") || "").trim(), description: String(data.get("description") || "").trim(), ...Object.fromEntries(Object.keys(permissionNames).map((name) => [name, data.has(name)])) };
    status.textContent = "Saving role…";
    status.classList.remove("is-error");
    try {
      if (roleId) await api.rest("workspace_roles", { query: query({ id: `eq.${roleId}` }), method: "PATCH", body });
      else await api.rest("workspace_roles", { method: "POST", body });
      document.querySelector('[data-admin-dialog="role"]').close();
      toast("Administration role saved.");
      await fetchAll();
    } catch (error) { status.textContent = error.message; status.classList.add("is-error"); }
  });
  document.querySelector("[data-admin-subscription-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-admin-subscription-status]");
    const data = new FormData(form);
    const id = data.get("subscriptionId");
    const body = { brand_user_id: data.get("brandUserId"), package_name: data.get("packageName"), status: data.get("status"), starts_on: data.get("startsOn") || null, ends_on: data.get("endsOn") || null, payment_method: String(data.get("paymentMethod") || "").trim() || null, payment_reference: String(data.get("paymentReference") || "").trim() || null, confirmation_note: String(data.get("confirmationNote") || "").trim() || null, confirmed_by: state.profile.id };
    status.textContent = "Saving subscription…";
    status.classList.remove("is-error");
    try {
      if (id) await api.rest("brand_subscriptions", { query: query({ id: `eq.${id}` }), method: "PATCH", body });
      else await api.rest("brand_subscriptions", { method: "POST", body });
      document.querySelector('[data-admin-dialog="subscription"]').close();
      toast("Brand subscription saved.");
      await fetchAll();
    } catch (error) { status.textContent = error.message; status.classList.add("is-error"); }
  });

  const boot = async () => {
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get("type") === "recovery" && hash.get("access_token")) {
      passwordChangeToken = hash.get("access_token");
      history.replaceState({}, "", `${location.pathname}${location.search}`);
      loginPanel.hidden = true;
      passwordPanel.hidden = false;
      return;
    }
    try {
      if (sessionStorage.getItem(workspaceLockKey) === "1") {
        sessionStorage.removeItem(workspaceLockKey);
        await api.signOut();
        return showLogin("Workspace locked. Sign in again to continue.");
      }
      const session = await api.getSession();
      if (!session) return showLogin();
      if (session.user?.user_metadata?.must_change_password) return showRequiredPasswordChange(session);
      await loadCurrentProfile(session);
      showWorkspace();
      await fetchAll();
    } catch (error) { await api.signOut(); showLogin(error.message); }
  };
  boot();
})();

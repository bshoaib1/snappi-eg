/* SNAPPI MEMBER ACCESS GATE
   Protects the temporary Creator and Brand entry pages until their full workspaces are connected. */
(() => {
  "use strict";
  const api = window.snappiSupabase;
  const requiredRole = document.body.dataset.workspaceRole;
  const status = document.querySelector("[data-member-status]");
  const shell = document.querySelector("[data-member-shell]");
  const workspaceLockKey = `snappi-${requiredRole}-workspace-locked`;
  let currentProfile = null;
  const query = (params) => new URLSearchParams(params).toString();
  const exitToLogin = async (message) => {
    currentProfile = null;
    sessionStorage.removeItem(workspaceLockKey);
    await api.signOut();
    sessionStorage.setItem("snappi-login-message", message);
    window.location.replace("index.html#login");
  };
  document.querySelector("[data-member-logout]")?.addEventListener("click", () => exitToLogin("You have been signed out."));
  document.querySelectorAll("[data-member-exit-home]").forEach((link) => link.addEventListener("click", async (event) => {
    event.preventDefault();
    currentProfile = null;
    sessionStorage.removeItem(workspaceLockKey);
    await api.signOut();
    window.location.replace("index.html");
  }));
  window.addEventListener("pagehide", () => { if (currentProfile) sessionStorage.setItem(workspaceLockKey, "1"); });
  window.addEventListener("pageshow", async (event) => {
    if (!event.persisted || sessionStorage.getItem(workspaceLockKey) !== "1") return;
    shell.hidden = true;
    status.textContent = "Workspace locked. Sign in again to continue.";
    await exitToLogin("For your security, sign in again to reopen the workspace.");
  });
  const supportDialog = document.querySelector("[data-member-support-dialog]");
  document.querySelectorAll("[data-member-support-open]").forEach((button) => button.addEventListener("click", () => { supportDialog?.showModal(); document.body.classList.add("modal-open"); }));
  document.querySelector("[data-member-support-close]")?.addEventListener("click", () => supportDialog?.close());
  supportDialog?.addEventListener("close", () => document.body.classList.remove("modal-open"));
  document.querySelector("[data-member-support-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentProfile || !event.currentTarget.reportValidity()) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('[type="submit"]');
    const label = button.querySelector(":scope > span:first-child");
    const loader = button.querySelector(".typing-indicator");
    const formStatus = form.querySelector(".snappi-form-status");
    button.disabled = true; label.hidden = true; loader.hidden = false;
    formStatus.classList.remove("is-error", "is-success");
    formStatus.textContent = "Submitting your request…";
    try {
      const category = String(data.get("category"));
      await api.invoke("public-support-request", { name: currentProfile.full_name, email: currentProfile.email, phone: currentProfile.phone, preferredReply: "Workspace", subject: String(data.get("subject")).trim(), category, message: String(data.get("message")).trim(), consent: true, source: `${requiredRole} workspace — ${location.href}` });
      form.reset();
      formStatus.textContent = "Your request was added to the Snappi Support Queue.";
      formStatus.classList.add("is-success");
    } catch (error) {
      formStatus.textContent = error.message;
      formStatus.classList.add("is-error");
    } finally { button.disabled = false; label.hidden = false; loader.hidden = true; }
  });
  const formatDate = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
  const safeText = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const safeLink = (value) => { try { const url = new URL(String(value)); return ["http:","https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
  const renderRecords = (container, records, emptyMessage, render) => { if (container) container.innerHTML = records.length ? records.map(render).join("") : `<p>${safeText(emptyMessage)}</p>`; };
  const loadMemberWorkspace = async (profile) => {
    let campaigns = [];
    if (requiredRole === "creator") {
      const assignments = await api.rest("campaign_creators", { query: query({ select: "campaign_id,assignment_status", creator_id: `eq.${profile.id}` }) });
      if (assignments.length) {
        const ids = assignments.map((item) => item.campaign_id);
        campaigns = await api.rest("campaigns", { query: query({ select: "id,title,status,objective,deliverables_count,next_deadline,brief_url,drive_folder_url,updated_at", id: `in.(${ids.join(",")})`, order: "updated_at.desc" }) });
        const assignmentByCampaign = Object.fromEntries(assignments.map((item) => [item.campaign_id, item.assignment_status]));
        campaigns = campaigns.map((campaign) => ({ ...campaign, assignment_status: assignmentByCampaign[campaign.id] }));
      }
      const details = await api.rest("creator_profiles", { query: query({ select: "application_status", user_id: `eq.${profile.id}`, limit: "1" }) });
      const applicationStatus = document.querySelector("[data-member-application-status]");
      if (applicationStatus) applicationStatus.textContent = String(details?.[0]?.application_status || "active").replaceAll("_", " ");
    } else {
      campaigns = await api.rest("campaigns", { query: query({ select: "id,title,status,objective,deliverables_count,next_deadline,brief_url,drive_folder_url,updated_at", brand_id: `eq.${profile.id}`, order: "updated_at.desc" }) });
    }
    const notifications = await api.rest("notifications", { query: query({ select: "id,title,message,category,link_url,read_at,created_at", user_id: `eq.${profile.id}`, order: "created_at.desc", limit: "30" }) });
    const support = await api.rest("support_requests", { query: query({ select: "id,subject,category,priority,status,created_at,updated_at", requester_id: `eq.${profile.id}`, order: "created_at.desc", limit: "30" }) });
    document.querySelector("[data-member-campaign-count]").textContent = campaigns.filter((item) => !["completed","cancelled"].includes(item.status)).length;
    document.querySelector("[data-member-notification-count]").textContent = notifications.filter((item) => !item.read_at).length;
    renderRecords(document.querySelector("[data-member-campaigns]"), campaigns, "No campaigns are connected to your workspace yet.", (item) => { const brief = safeLink(item.brief_url); const drive = safeLink(item.drive_folder_url); return `<article><div><small>${safeText(item.status.replaceAll("_", " "))}</small><b>${safeText(item.title)}</b><p>${safeText(item.objective || "Campaign details will appear here.")}</p></div><div class="member-record-actions">${brief ? `<a href="${safeText(brief)}" target="_blank" rel="noopener">Open brief</a>` : ""}${drive ? `<a href="${safeText(drive)}" target="_blank" rel="noopener">Open Drive folder</a>` : ""}<span>${item.deliverables_count || 0} deliverables · ${formatDate(item.next_deadline)}</span></div></article>`; });
    renderRecords(document.querySelector("[data-member-notifications]"), notifications, "No notifications yet.", (item) => `<article class="${item.read_at ? "" : "is-unread"}"><div><small>${safeText(item.category)}</small><b>${safeText(item.title)}</b><p>${safeText(item.message)}</p></div><span>${formatDate(item.created_at)}</span></article>`);
    renderRecords(document.querySelector("[data-member-support-list]"), support, "No support requests yet.", (item) => `<article><div><small>${safeText(item.priority)} priority</small><b>${safeText(item.subject)}</b><p>${safeText(item.category.replaceAll("_", " "))}</p></div><div><span>${safeText(item.status.replaceAll("_", " "))}</span><span>${formatDate(item.updated_at)}</span></div></article>`);
  };
  document.querySelector("[data-member-read-all]")?.addEventListener("click", async () => {
    if (!currentProfile) return;
    try { await api.rest("notifications", { query: query({ user_id: `eq.${currentProfile.id}`, read_at: "is.null" }), method: "PATCH", body: { read_at: new Date().toISOString() } }); await loadMemberWorkspace(currentProfile); }
    catch (error) { status.textContent = error.message; }
  });
  document.querySelector("[data-member-settings-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const settingsStatus = form.querySelector("[data-member-settings-status]") || document.querySelector("[data-member-settings-status]");
    const fullName = form.elements.fullName.value.trim();
    const phone = form.elements.phone.value.trim();
    try { await api.rpc("update_own_profile", { next_full_name: fullName, next_phone: phone }); currentProfile.full_name = fullName; currentProfile.phone = phone; document.querySelector("[data-member-name]").textContent = currentProfile.full_name; settingsStatus.textContent = "Profile updated."; }
    catch (error) { settingsStatus.textContent = error.message; }
  });
  const boot = async () => {
    try {
      if (sessionStorage.getItem(workspaceLockKey) === "1") return exitToLogin("For your security, sign in again to reopen the workspace.");
      const session = await api.getSession();
      if (!session) return exitToLogin("Sign in to continue to your workspace.");
      const rows = await api.rest("profiles", { query: query({ select: "id,full_name,email,phone,role,status", id: `eq.${session.user.id}`, limit: "1" }) });
      const profile = rows?.[0];
      if (!profile || profile.role !== requiredRole || profile.status !== "active") return exitToLogin("This account cannot access that workspace.");
      sessionStorage.removeItem(workspaceLockKey);
      currentProfile = profile;
      document.querySelector("[data-member-name]").textContent = profile.full_name || profile.email;
      const settingsForm = document.querySelector("[data-member-settings-form]");
      if (settingsForm) { settingsForm.elements.fullName.value = profile.full_name || ""; settingsForm.elements.phone.value = profile.phone || ""; }
      if (requiredRole === "brand") {
        const subscriptions = await api.rest("brand_subscriptions", { query: query({ select: "id,package_name,status,starts_on,ends_on", brand_user_id: `eq.${profile.id}`, order: "created_at.desc", limit: "1" }) });
        const subscription = subscriptions?.[0];
        const banner = document.querySelector("[data-subscription-banner]");
        const accessMessage = document.querySelector("[data-brand-access-message]");
        const today = new Date();
        const start = subscription?.starts_on ? new Date(`${subscription.starts_on}T00:00:00`) : null;
        const expiry = subscription?.ends_on ? new Date(`${subscription.ends_on}T23:59:59`) : null;
        const daysLeft = expiry ? Math.ceil((expiry - today) / 86400000) : null;
        const duration = start && expiry ? Math.max(expiry - start, 1) : null;
        const remainingPercent = duration ? Math.max(0, Math.min(100, Math.round(((expiry - today) / duration) * 100))) : 0;
        const packageLabel = banner.querySelector("[data-subscription-package]");
        const daysLabel = banner.querySelector("[data-subscription-days]");
        const progress = banner.querySelector("[data-subscription-progress]");
        const progressFill = banner.querySelector("[data-subscription-progress-fill]");
        packageLabel.textContent = subscription ? `${subscription.package_name} package` : "Subscription access";
        banner.querySelector("[data-subscription-start]").textContent = `Started ${start ? formatDate(start) : "—"}`;
        banner.querySelector("[data-subscription-end]").textContent = `Expires ${expiry ? formatDate(expiry) : "—"}`;
        progress.setAttribute("aria-valuenow", String(remainingPercent));
        progressFill.style.width = `${remainingPercent}%`;
        banner.classList.remove("is-active", "is-warning", "is-expired", "is-paused", "is-unconfigured");
        if (subscription?.status === "active" && (daysLeft === null || daysLeft > 14)) {
          banner.classList.add("is-active");
          banner.querySelector("[data-subscription-title]").textContent = "Your subscription is active.";
          banner.querySelector("[data-subscription-message]").textContent = expiry ? `Your services remain active through ${formatDate(expiry)}.` : "Your services are active. Contact Snappi when you are ready to discuss renewal.";
          daysLabel.textContent = daysLeft === null ? "ACTIVE" : `${daysLeft} ${daysLeft === 1 ? "DAY" : "DAYS"} LEFT`;
          accessMessage.textContent = `${subscription.package_name} subscription active${expiry ? ` until ${expiry.toLocaleDateString("en-GB")}` : ""}.`;
        } else {
          if (["active", "expiring_soon"].includes(subscription?.status) && daysLeft !== null && daysLeft >= 0) {
            banner.classList.add("is-warning");
            banner.querySelector("[data-subscription-title]").textContent = "Your subscription expires soon.";
            banner.querySelector("[data-subscription-message]").textContent = `Your ${subscription.package_name} access expires on ${formatDate(expiry)}. Renew early to avoid interrupting campaign services.`;
            daysLabel.textContent = `${daysLeft} ${daysLeft === 1 ? "DAY" : "DAYS"} LEFT`;
            accessMessage.textContent = "Your current services remain available until the expiry date.";
          } else if (subscription && ["paused", "cancelled", "awaiting_payment", "consultation_required"].includes(subscription.status)) {
            banner.classList.add("is-paused");
            banner.querySelector("[data-subscription-title]").textContent = subscription.status === "awaiting_payment" ? "Your subscription is awaiting confirmation." : "Your subscription access is paused.";
            banner.querySelector("[data-subscription-message]").textContent = "Contact Snappi to confirm the next step for your account.";
            daysLabel.textContent = subscription.status.replaceAll("_", " ").toUpperCase();
            accessMessage.textContent = "Campaign services will become available after your subscription is activated.";
          } else {
            banner.classList.add(subscription ? "is-expired" : "is-unconfigured");
            banner.querySelector("[data-subscription-title]").textContent = "Your Snappi services are currently paused.";
            banner.querySelector("[data-subscription-message]").textContent = subscription ? "Your subscription is inactive or has expired. Contact Snappi to reactivate your package." : "No active subscription is connected to this account. Contact Snappi to choose or activate a package.";
            daysLabel.textContent = subscription ? "EXPIRED" : "NOT ACTIVE";
            accessMessage.textContent = "Previous records and support remain available. New campaign services are disabled.";
          }
        }
        const subscriptionStatus = document.querySelector("[data-member-subscription-status]");
        if (subscriptionStatus) subscriptionStatus.textContent = subscription ? `${subscription.package_name} · ${subscription.status.replaceAll("_", " ")}` : "Not active";
      }
      await loadMemberWorkspace(profile);
      status.textContent = "Secure access confirmed";
      shell.hidden = false;
      api.startInactivityTimeout({ onTimeout: () => {
        sessionStorage.setItem("snappi-login-message", "You were signed out after 10 minutes without activity.");
        window.location.replace("index.html#login");
      } });
    } catch (error) { exitToLogin(error.message); }
  };
  boot();
})();

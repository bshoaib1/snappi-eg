/*
 * SNAPPI LIVE — PUBLIC INTERACTIONS
 * Shared static interactions for GitHub Pages.
 * Campaign enquiries are sent to Snappi's Google Sheets CRM. Public login
 * routes active creators and brands to their protected workspaces.
 */
(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ANALYTICS_ID = "G-XS1YXFENX6";
  const ANALYTICS_CONSENT_KEY = "snappiAnalyticsConsent";
  const IS_PRODUCTION_HOST = ["snappi-eg.com", "www.snappi-eg.com"].includes(window.location.hostname);

  /* Shared keyboard entry point for every public page. */
  const pageMain = document.querySelector("main");
  if (pageMain && !pageMain.id) pageMain.id = "main-content";

  /* Moving announcements can always be paused, including by keyboard. */
  document.querySelectorAll(".announcement").forEach((announcement) => {
    if (announcement.querySelector("[data-announcement-toggle]")) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "announcement-toggle";
    toggle.dataset.announcementToggle = "";
    const update = (paused) => {
      announcement.classList.toggle("is-paused", paused);
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.textContent = paused ? "Play announcements" : "Pause announcements";
    };
    toggle.addEventListener("click", () => update(!announcement.classList.contains("is-paused")));
    announcement.append(toggle);
    update(reducedMotion.matches);
  });

  /* Privacy-first analytics: Google Analytics loads only after explicit consent. */
  const readAnalyticsConsent = () => {
    try { return window.localStorage.getItem(ANALYTICS_CONSENT_KEY); }
    catch (error) { return null; }
  };
  const saveAnalyticsConsent = (choice) => {
    try { window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice); }
    catch (error) { /* The choice lasts for this page only if storage is blocked. */ }
  };
  const setGoogleConsent = (analyticsStorage) => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag("consent", "update", {
      analytics_storage: analyticsStorage,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
  };
  const loadGoogleAnalytics = () => {
    if (!IS_PRODUCTION_HOST) return;
    if (document.querySelector(`[data-google-analytics="${ANALYTICS_ID}"]`)) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    setGoogleConsent("granted");
    const analyticsScript = document.createElement("script");
    analyticsScript.async = true;
    analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`;
    analyticsScript.dataset.googleAnalytics = ANALYTICS_ID;
    document.head.append(analyticsScript);
    window.gtag("js", new Date());
    window.gtag("config", ANALYTICS_ID);
  };
  const clearAnalyticsCookies = () => {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name === "_ga" || name.startsWith("_ga_")) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.snappi-eg.com; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=snappi-eg.com; SameSite=Lax`;
      }
    });
  };
  const consentNotice = document.createElement("aside");
  consentNotice.className = "cookie-consent";
  consentNotice.setAttribute("aria-label", "Analytics privacy choice");
  consentNotice.hidden = true;
  consentNotice.innerHTML = `<p><strong>Help Snappi improve ✨</strong><span>Allow anonymous website analytics so we can understand what visitors find useful.</span><a href="legal.html">Privacy notice</a></p><div><button type="button" data-consent="denied">Decline</button><button class="is-primary" type="button" data-consent="granted">Accept</button></div>`;
  const privacySettings = document.createElement("button");
  privacySettings.className = "privacy-settings";
  privacySettings.type = "button";
  privacySettings.textContent = "Privacy choices";
  privacySettings.hidden = true;
  document.body.append(consentNotice, privacySettings);

  const showConsentNotice = () => {
    consentNotice.hidden = false;
    privacySettings.hidden = true;
  };
  const storedConsent = readAnalyticsConsent();
  if (storedConsent === "granted") {
    loadGoogleAnalytics();
    privacySettings.hidden = false;
  } else if (storedConsent === "denied") {
    privacySettings.hidden = false;
  } else {
    showConsentNotice();
  }
  consentNotice.querySelectorAll("[data-consent]").forEach((button) => button.addEventListener("click", () => {
    const choice = button.dataset.consent;
    saveAnalyticsConsent(choice);
    if (choice === "granted") loadGoogleAnalytics();
    else {
      setGoogleConsent("denied");
      clearAnalyticsCookies();
    }
    consentNotice.hidden = true;
    privacySettings.hidden = false;
  }));
  privacySettings.addEventListener("click", showConsentNotice);

  /* Prevent placeholder CTAs from navigating while keeping them visible. */
  document.querySelectorAll("[data-disabled-action]").forEach((control) => {
    control.addEventListener("click", (event) => event.preventDefault());
  });

  /* Mobile navigation. */
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");
  const closeMobileMenu = () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    if (mobileNav) mobileNav.hidden = true;
    document.body.classList.remove("menu-open");
  };
  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(open));
    mobileNav.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  });
  mobileNav?.querySelectorAll("a, button").forEach((item) => item.addEventListener("click", closeMobileMenu));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") closeMobileMenu(); });
  window.addEventListener("resize", () => { if (window.innerWidth > 1100) closeMobileMenu(); });

  /* Desktop Platform dropdown. */
  const dropdown = document.querySelector(".nav-dropdown");
  const dropdownToggle = dropdown?.querySelector(".nav-dropdown-toggle");
  const dropdownMenu = dropdown?.querySelector(".nav-mega-menu");
  const setDropdown = (open) => {
    if (!dropdownToggle || !dropdownMenu) return;
    dropdownToggle.setAttribute("aria-expanded", String(open));
    dropdownMenu.hidden = !open;
    dropdown.classList.toggle("is-open", open);
  };
  dropdownToggle?.addEventListener("click", () => setDropdown(dropdownToggle.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("click", (event) => {
    if (dropdown && !dropdown.contains(event.target)) setDropdown(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setDropdown(false);
  });

  /* Homepage pointer depth. */
  const hero = document.querySelector(".hero");
  hero?.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches) return;
    const bounds = hero.getBoundingClientRect();
    hero.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    hero.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
    hero.style.setProperty("--tilt-x", `${((event.clientX / bounds.width) - 0.5) * 8}px`);
    hero.style.setProperty("--tilt-y", `${((event.clientY / bounds.height) - 0.5) * 8}px`);
  });

  /* Scroll reveal animation. */
  const revealItems = document.querySelectorAll(".reveal, main > section, .price-card");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible", "is-in-view"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible", "is-in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    revealItems.forEach((item) => observer.observe(item));
  }

  /* Content category filter. */
  const filterButtons = document.querySelectorAll("[data-filter]");
  const feedCards = document.querySelectorAll("[data-category]");
  filterButtons.forEach((button) => button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    feedCards.forEach((card) => {
      card.hidden = button.dataset.filter !== "all" && card.dataset.category !== button.dataset.filter;
    });
  }));

  /* Sample campaign stages. Update copy and images here. */
  const campaignStages = [
    ["Campaign brief received", "Goals, product details, audience, deliverables, and timing are gathered in one clear starting point.", "assets/real-brand-campaign.webp"],
    ["Creator shortlist prepared", "Relevant creator voices are selected around the campaign category, audience, and content direction.", "assets/real-brand-team.webp"],
    ["Concepts approved", "Hooks, formats, key messages, and calls to action are aligned before production starts.", "assets/real-hero-lifestyle.webp"],
    ["Content in production", "Creators produce the agreed content while communication and deadlines stay organized.", "assets/real-creator-home.webp"],
    ["Deliverables reviewed", "The brand reviews content and provides feedback within the agreed revision scope.", "assets/real-creator-editing.webp"],
    ["Campaign ready to launch", "Final approved files are organized and prepared for the agreed channels and usage rights.", "assets/real-creator-recruitment.webp"],
  ];
  const campaignButtons = document.querySelectorAll("[data-step]");
  const selectCampaignStage = (button) => {
    const index = Number(button.dataset.step);
    const [title, copy, image] = campaignStages[index];
    campaignButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelector("#campaign-progress").textContent = `${String(index + 1).padStart(2, "0")} / 06`;
    document.querySelector("#campaign-label").textContent = `STEP ${String(index + 1).padStart(2, "0")}`;
    document.querySelector("#campaign-title").textContent = title;
    document.querySelector("#campaign-copy").textContent = copy;
    document.querySelector("#campaign-image").src = image;
    document.querySelector("#campaign-stage-panel")?.setAttribute("aria-labelledby", button.id);
    campaignButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
  };
  campaignButtons.forEach((button, index) => {
    button.id = `campaign-stage-${index + 1}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "campaign-stage-panel");
    button.setAttribute("aria-selected", String(index === 0));
    button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener("click", () => selectCampaignStage(button));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = [...campaignButtons].indexOf(button);
      const next = event.key === "Home" ? 0 : event.key === "End" ? campaignButtons.length - 1 : event.key === "ArrowRight" ? (current + 1) % campaignButtons.length : (current - 1 + campaignButtons.length) % campaignButtons.length;
      campaignButtons[next].focus();
      selectCampaignStage(campaignButtons[next]);
    });
  });
  if (campaignButtons.length) document.querySelector("#campaign-stage-panel")?.setAttribute("aria-labelledby", campaignButtons[0].id);

  /* Campaign process description follows the active row. */
  const processItems = document.querySelectorAll(".process-list li");
  const processDescription = document.querySelector("#process-description");
  if (processDescription && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        processItems.forEach((item) => item.classList.toggle("is-active", item === entry.target));
        processDescription.textContent = entry.target.dataset.description;
      });
    }, { threshold: 0.7 });
    processItems.forEach((item) => observer.observe(item));
  }

  /* Interactive platform capability preview. */
  const capabilityContent = {
    match: ["CREATOR MATCH", "Find the right creator voice.", "Review creator options selected around your audience, category, and campaign direction.", ["Category and audience fit", "Clear creator profiles", "Final selection stays with the brand"]],
    brief: ["CAMPAIGN BRIEF", "Start every project with clarity.", "Bring goals, messages, formats, deliverables, and timing into one focused direction.", ["Structured campaign inputs", "Clear deliverables", "Shared production direction"]],
    workflow: ["CONTENT WORKFLOW", "Know what happens next.", "Follow concepts, production, review, and final delivery without chasing scattered updates.", ["Visible campaign stages", "Organized submissions", "Clear next actions"]],
    review: ["FEEDBACK & APPROVALS", "Keep decisions moving.", "Collect focused feedback and keep revision rounds aligned with the agreed scope.", ["Consolidated comments", "Revision visibility", "Approval checkpoints"]],
    creator: ["CREATOR WORKSPACE", "Give creators one clear home.", "Creators can manage their profiles, opportunities, briefs, submissions, and support needs.", ["Profile and portfolio", "Campaign opportunities", "Brief and submission access"]],
    brand: ["BRAND WORKSPACE", "Run campaigns from one place.", "Brands can review campaign activity, creators, collaborations, and conversations.", ["Campaign overview", "Creator coordination", "Support access"]],
  };
  const capabilityButtons = [...document.querySelectorAll("[data-capability]")];
  const selectCapability = (button) => {
    const [label, title, copy, features] = capabilityContent[button.dataset.capability];
    capabilityButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    document.querySelector("#capability-label").textContent = label;
    document.querySelector("#capability-preview-title").textContent = title;
    document.querySelector("#capability-preview-copy").textContent = copy;
    document.querySelector("#capability-preview-list").innerHTML = features.map((feature) => `<li>${feature}</li>`).join("");
    document.querySelector("#capability-preview")?.setAttribute("aria-labelledby", button.id);
  };
  capabilityButtons.forEach((button, index) => {
    button.id = `capability-tab-${index + 1}`;
    button.setAttribute("aria-controls", "capability-preview");
    button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener("click", () => selectCapability(button));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = capabilityButtons.indexOf(button);
      const next = event.key === "Home" ? 0 : event.key === "End" ? capabilityButtons.length - 1 : ["ArrowDown", "ArrowRight"].includes(event.key) ? (current + 1) % capabilityButtons.length : (current - 1 + capabilityButtons.length) % capabilityButtons.length;
      capabilityButtons[next].focus();
      selectCapability(capabilityButtons[next]);
    });
  });
  if (capabilityButtons.length) document.querySelector("#capability-preview")?.setAttribute("aria-labelledby", capabilityButtons[0].id);

  /* Keep one FAQ answer open at a time. */
  const faqItems = document.querySelectorAll(".faq-list details");
  faqItems.forEach((item) => item.addEventListener("toggle", () => {
    if (item.open) faqItems.forEach((other) => { if (other !== item) other.open = false; });
  }));

  /* Shared Snappi modal system. Add data-modal-open="name" to any future trigger. */
  const modalOpeners = document.querySelectorAll("[data-modal-open]");
  const modals = document.querySelectorAll("[data-modal]");
  let lastModalTrigger = null;

  const closeModal = (modal) => {
    if (!modal?.open) return;
    modal.close();
    document.body.classList.toggle("modal-open", Boolean(document.querySelector("[data-modal][open]")));
    lastModalTrigger?.focus();
  };

  modalOpeners.forEach((opener) => opener.addEventListener("click", (event) => {
    event.preventDefault();
    const modal = document.querySelector(`[data-modal="${opener.dataset.modalOpen}"]`);
    if (!modal) return;
    document.querySelectorAll("[data-modal][open]").forEach((openModal) => {
      if (openModal !== modal) openModal.close();
    });
    lastModalTrigger = opener;
    if (opener.dataset.package) {
      const packageSelect = modal.querySelector('[name="package"]');
      if (packageSelect) packageSelect.value = opener.dataset.package;
    }
    if (opener.dataset.contentType) {
      const goalField = modal.querySelector('[name="goal"]');
      if (goalField) goalField.value = `Interested content type: ${opener.dataset.contentType}\nCampaign objective: `;
    }
    modal.showModal();
    if (opener.dataset.supportRoute) {
      modal.querySelector(`[data-support-route="${opener.dataset.supportRoute}"]`)?.click();
    }
    document.body.classList.add("modal-open");
  }));

  modals.forEach((modal) => {
    modal.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", () => closeModal(modal)));
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(modal); });
    modal.addEventListener("close", () => document.body.classList.toggle("modal-open", Boolean(document.querySelector("[data-modal][open]"))));
  });

  /* Public workspace access: creator and brand accounts only. Administrators use /workspace/. */
  const publicLoginModal = document.querySelector('[data-modal="login"]');
  const publicLoginForm = document.querySelector("[data-public-login-form]");
  const publicPasswordForm = document.querySelector("[data-public-password-form]");
  const publicLoginPanel = document.querySelector("[data-public-login-panel]");
  const publicJoinPanel = document.querySelector("[data-public-join-panel]");
  const publicPasswordPanel = document.querySelector("[data-public-password-panel]");
  const authApi = window.snappiSupabase;
  let publicPasswordToken = null;
  const authQuery = (params) => new URLSearchParams(params).toString();
  const setAuthButtonLoading = (button, loading) => {
    const label = button.querySelector(":scope > span:first-child");
    const loader = button.querySelector(".typing-indicator");
    button.disabled = loading;
    button.toggleAttribute("aria-busy", loading);
    label.hidden = loading;
    loader.hidden = !loading;
  };
  const loadPublicProfile = async (session) => {
    const rows = await authApi.rest("profiles", { query: authQuery({ select: "id,role,status", id: `eq.${session.user.id}`, limit: "1" }) });
    return rows?.[0] || null;
  };
  const publicDestination = (role) => role === "creator" ? "creator-workspace.html" : role === "brand" ? "brand-workspace.html" : "";
  const routePublicAccount = async (session) => {
    const profile = await loadPublicProfile(session);
    if (!profile) throw new Error("No Snappi workspace profile is connected to this account.");
    if (["super_admin", "operations_admin"].includes(profile.role)) {
      await authApi.signOut();
      throw new Error("Administrator accounts must use the bookmarked internal workspace.");
    }
    if (!["creator", "brand"].includes(profile.role)) throw new Error("This account does not have Creator or Brand Workspace access.");
    if (profile.status !== "active") throw new Error(`This account is ${String(profile.status || "inactive").replaceAll("_", " ")}. Contact Snappi support for help.`);
    window.location.assign(publicDestination(profile.role));
  };
  const showPublicPasswordPanel = (token) => {
    publicPasswordToken = token;
    publicLoginPanel.hidden = true;
    publicPasswordPanel.hidden = false;
  };
  const showAuthView = (view) => {
    document.querySelectorAll("[data-auth-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.authView === view));
    publicLoginPanel.hidden = view !== "signin";
    publicJoinPanel.hidden = view !== "join";
    publicPasswordPanel.hidden = true;
  };
  document.querySelectorAll("[data-auth-view]").forEach((button) => button.addEventListener("click", () => showAuthView(button.dataset.authView)));
  document.querySelectorAll("[data-join-role]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(".snappi-join-choice").hidden = true;
    document.querySelector("[data-creator-join-form]").hidden = button.dataset.joinRole !== "creator";
    document.querySelector("[data-brand-join-form]").hidden = button.dataset.joinRole !== "brand";
  }));
  document.querySelectorAll("[data-join-back]").forEach((button) => button.addEventListener("click", () => {
    button.closest("form").hidden = true;
    document.querySelector(".snappi-join-choice").hidden = false;
  }));

  const fileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The profile photo could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
  const splitList = (value) => String(value || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  const submitJoinRequest = async (form, type) => {
    const data = new FormData(form);
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector(".snappi-form-status");
    status.classList.remove("is-error", "is-success");
    setAuthButtonLoading(button, true);
    status.textContent = "Submitting securely…";
    try {
      let payload;
      if (type === "creator") {
        const photo = data.get("profilePhoto");
        if (!(photo instanceof File) || !photo.size) throw new Error("Add a profile photo before submitting.");
        if (photo.size > 2097152) throw new Error("The profile photo must be no larger than 2 MB.");
        payload = { type, fullName: data.get("fullName"), email: data.get("email"), phone: data.get("phone"), city: data.get("city"), socialUrl: data.get("socialUrl"), portfolioUrls: splitList(data.get("portfolioUrls")), categories: splitList(data.get("categories")), languages: splitList(data.get("languages")), availability: data.get("availability"), profilePhoto: { type: photo.type, base64: await fileAsBase64(photo) }, isOver18: data.has("isOver18"), consent: data.has("consent"), companyWebsite: data.get("companyWebsite"), source: `${document.title} — ${location.href}` };
      } else {
        payload = { type, contactName: data.get("contactName"), email: data.get("email"), phone: data.get("phone"), companyName: data.get("companyName"), industry: data.get("industry"), websiteUrl: data.get("websiteUrl"), packageName: data.get("packageName"), campaignObjective: data.get("campaignObjective"), preferredLaunchDate: data.get("preferredLaunchDate"), consent: data.has("consent"), companyWebsite: data.get("companyWebsite"), source: `${document.title} — ${location.href}` };
      }
      const result = await authApi.publicInvoke("public-join-request", payload);
      form.reset();
      status.textContent = result.message || "Your request was submitted for review.";
      status.classList.add("is-success");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    } finally { setAuthButtonLoading(button, false); }
  };
  document.querySelector("[data-creator-join-form]")?.addEventListener("submit", (event) => { event.preventDefault(); if (event.currentTarget.reportValidity()) submitJoinRequest(event.currentTarget, "creator"); });
  document.querySelector("[data-brand-join-form]")?.addEventListener("submit", (event) => { event.preventDefault(); if (event.currentTarget.reportValidity()) submitJoinRequest(event.currentTarget, "brand"); });

  publicLoginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector("[data-public-login-status]");
    status.classList.remove("is-error", "is-success");
    form.email.removeAttribute("aria-invalid");
    form.password.removeAttribute("aria-invalid");
    form.email.removeAttribute("aria-describedby");
    form.password.removeAttribute("aria-describedby");
    status.textContent = "Checking secure access…";
    setAuthButtonLoading(button, true);
    try {
      const session = await authApi.signIn(form.email.value.trim(), form.password.value);
      if (session.user?.user_metadata?.must_change_password) {
        showPublicPasswordPanel(session.access_token);
        status.textContent = "";
        return;
      }
      await routePublicAccount(session);
    } catch (error) {
      await authApi.signOut();
      status.textContent = error.message;
      status.classList.add("is-error");
      status.id ||= "public-login-error";
      form.email.setAttribute("aria-invalid", "true");
      form.password.setAttribute("aria-invalid", "true");
      form.email.setAttribute("aria-describedby", status.id);
      form.password.setAttribute("aria-describedby", status.id);
      form.email.focus();
    } finally { setAuthButtonLoading(button, false); }
  });

  document.querySelector("[data-public-reset-request]")?.addEventListener("click", async () => {
    const email = publicLoginForm.email.value.trim();
    const status = publicLoginForm.querySelector("[data-public-login-status]");
    status.classList.remove("is-error", "is-success");
    if (!email) {
      status.textContent = "Enter your email address first.";
      status.classList.add("is-error");
      return;
    }
    try {
      await authApi.requestPasswordReset(email, `${location.origin}${location.pathname}`);
      status.textContent = "Password recovery instructions were sent if the account exists.";
      status.classList.add("is-success");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    }
  });

  publicPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector("[data-public-password-status]");
    status.classList.remove("is-error", "is-success");
    form.password.removeAttribute("aria-invalid");
    form.confirmation.removeAttribute("aria-invalid");
    form.password.removeAttribute("aria-describedby");
    form.confirmation.removeAttribute("aria-describedby");
    if (form.password.value !== form.confirmation.value) {
      status.textContent = "The passwords do not match.";
      status.classList.add("is-error");
      status.id ||= "public-password-error";
      form.confirmation.setAttribute("aria-invalid", "true");
      form.confirmation.setAttribute("aria-describedby", status.id);
      form.confirmation.focus();
      return;
    }
    setAuthButtonLoading(button, true);
    status.textContent = "Updating your password…";
    try {
      await authApi.updatePassword(publicPasswordToken, form.password.value);
      publicPasswordToken = null;
      history.replaceState({}, "", location.pathname);
      publicPasswordPanel.hidden = true;
      publicLoginPanel.hidden = false;
      publicLoginForm.reset();
      const loginStatus = publicLoginForm.querySelector("[data-public-login-status]");
      loginStatus.textContent = "Password updated. Sign in with your new password.";
      loginStatus.classList.add("is-success");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    } finally { setAuthButtonLoading(button, false); }
  });

  const recoveryHash = new URLSearchParams(location.hash.slice(1));
  if (publicLoginModal && ["recovery", "invite"].includes(recoveryHash.get("type")) && recoveryHash.get("access_token")) {
    showPublicPasswordPanel(recoveryHash.get("access_token"));
    history.replaceState({}, "", `${location.pathname}${location.search}`);
    publicLoginModal.showModal();
    document.body.classList.add("modal-open");
  } else if (publicLoginModal && location.hash === "#login") {
    const message = sessionStorage.getItem("snappi-login-message") || "Sign in to continue to your workspace.";
    sessionStorage.removeItem("snappi-login-message");
    publicLoginForm.querySelector("[data-public-login-status]").textContent = message;
    publicLoginModal.showModal();
    document.body.classList.add("modal-open");
    history.replaceState({}, "", location.pathname);
  }

  /* Creator application handoff. The URL lives on creator-application.html. */
  document.querySelectorAll("[data-creator-form-continue]").forEach((button) => button.addEventListener("click", () => {
    const url = document.documentElement.dataset.creatorFormUrl?.trim();
    const status = document.querySelector("[data-creator-form-status]");
    if (!url) {
      status.textContent = "The application link is being connected. Please email support@snappi-eg.com for help.";
      return;
    }
    const label = button.querySelector(":scope > span:first-child");
    const loader = button.querySelector(".typing-indicator");
    button.disabled = true;
    label.hidden = true;
    loader.hidden = false;
    status.textContent = "Opening the secure creator application…";
    window.setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
      button.disabled = false;
      label.hidden = false;
      loader.hidden = true;
      status.textContent = "The application opened in a new tab.";
    }, reducedMotion.matches ? 0 : 700);
  }));

  /* Contact and support routing. Fields stay intact when the reason changes. */
  document.querySelectorAll(".snappi-support-modal").forEach((modal) => {
    const routeButtons = modal.querySelectorAll("[data-support-route]");
    const form = modal.querySelector("[data-support-form]");
    const fields = modal.querySelector(".support-form-fields");
    const diagnostics = modal.querySelector("[data-support-diagnostics]");
    routeButtons.forEach((button) => button.addEventListener("click", () => {
      routeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      form.dataset.route = button.dataset.supportRoute;
      fields.hidden = false;
      diagnostics.hidden = button.dataset.supportRoute !== "website";
    }));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const route = form.dataset.route;
      if (!route) return;
      const data = new FormData(form);
      const phone = form.querySelector('[name="phone"]');
      const reply = data.get("reply");
      const phoneRequired = reply === "Phone" || reply === "WhatsApp";
      phone.setCustomValidity(phoneRequired && !phone.value.trim() ? "Add a mobile number for your selected reply method." : "");
      if (!form.reportValidity()) return;

      const routes = { brand: "Brand Enquiry", creator: "Creator Support", website: "Website Issue", enhancement: "Enhancement Idea" };
      const routeLabel = routes[route];
      const submit = form.querySelector(".snappi-modal-submit");
      const label = submit.querySelector(":scope > span:first-child");
      const loader = submit.querySelector(".typing-indicator");
      const status = form.querySelector(".snappi-form-status");
      const context = [`Page: ${window.location.href}`];
      if (route === "website") {
        context.push(`Browser: ${navigator.userAgent}`, `Screen: ${window.innerWidth} × ${window.innerHeight}`, `Local date and time: ${new Date().toLocaleString()}`);
      }
      submit.disabled = true;
      label.hidden = true;
      loader.hidden = false;
      status.classList.remove("is-error", "is-success");
      status.textContent = "Submitting your support request…";
      try {
        const result = await authApi.publicInvoke("public-support-request", { category: route, name: data.get("name"), email: data.get("email"), phone: data.get("phone"), subject: `[${routeLabel}] ${data.get("subject")}`, message: data.get("message"), preferredReply: reply, consent: data.has("consent"), companyWebsite: data.get("companyWebsite"), source: context.join("\n") });
        form.reset();
        status.textContent = result.message || "Your support request was submitted.";
        status.classList.add("is-success");
      } catch (error) {
        status.textContent = error.message;
        status.classList.add("is-error");
      } finally {
        submit.disabled = false;
        label.hidden = false;
        loader.hidden = true;
      }
    });
  });

  /* Brand enquiries go directly to the Leads sheet through Google Apps Script. */
  document.querySelectorAll("[data-campaign-form]").forEach((form) => {
    form.dataset.openedAt = String(Date.now());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const submit = form.querySelector(".snappi-modal-submit");
      const label = submit.querySelector(":scope > span:first-child");
      const loader = submit.querySelector(".typing-indicator");
      const status = form.querySelector(".snappi-form-status");
      const data = new FormData(form);

      /* The hidden company-website field catches basic automated spam. */
      if (data.get("companyWebsite")) {
        form.reset();
        status.textContent = "Thank you. Your enquiry was received for processing.";
        return;
      }

      const query = new URLSearchParams(window.location.search);
      const leadId = window.crypto?.randomUUID?.() || `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const payload = {
        id: leadId,
        createdAt: new Date().toISOString(),
        ownerName: "Basem Shoaib",
        status: "new",
        contactName: String(data.get("name") || "").trim(),
        workEmail: String(data.get("email") || "").trim(),
        mobile: String(data.get("phone") || "").trim(),
        companyName: String(data.get("brand") || "").trim(),
        industry: String(data.get("industry") || "").trim(),
        packageName: String(data.get("package") || "").trim(),
        campaignObjective: String(data.get("goal") || "").trim(),
        source: `${document.title} — ${window.location.href}`,
        utmSource: query.get("utm_source") || "",
        utmMedium: query.get("utm_medium") || "",
        utmCampaign: query.get("utm_campaign") || "",
        companyWebsite: String(data.get("companyWebsite") || "").trim()
      };

      submit.disabled = true;
      label.hidden = true;
      loader.hidden = false;
      status.classList.remove("is-error", "is-success");
      status.textContent = "Sending your enquiry securely…";

      try {
        const result = await authApi.publicInvoke("public-brand-lead", payload);
        form.reset();
        form.dataset.openedAt = String(Date.now());
        status.classList.add("is-success");
        status.textContent = result.message || "Enquiry submitted. Snappi team will contact you shortly to understand what your brand needs.";
      } catch (error) {
        status.classList.add("is-error");
        status.textContent = "We could not send your enquiry. Please check your connection or email sales@snappi-eg.com.";
      } finally {
        submit.disabled = false;
        label.hidden = false;
        loader.hidden = true;
      }
    });
  });

  /* Focused page navigation follows the section currently in view. */
  const pageSectionLinks = document.querySelectorAll("[data-page-section-link]");
  if (pageSectionLinks.length && "IntersectionObserver" in window) {
    const pageSections = [...new Set([...pageSectionLinks].map((link) => document.querySelector(link.hash)).filter(Boolean))];
    const setActivePageSection = (section) => {
      pageSectionLinks.forEach((link) => {
        const active = link.hash === `#${section.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const pageSectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActivePageSection(visible.target);
    }, { rootMargin: "-28% 0px -55% 0px", threshold: [0, .15, .35] });
    pageSections.forEach((section) => pageSectionObserver.observe(section));
  }

  /* Floating and header Snappi marks return visitors to the page top. */
  const backToTop = document.querySelector("[data-back-to-top]");
  if (backToTop) {
    const updateBackToTop = () => backToTop.classList.toggle("is-visible", window.scrollY > 520);
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" }));
    updateBackToTop();
  }

  document.querySelector(".brand")?.addEventListener("click", (event) => {
    const href = event.currentTarget.getAttribute("href");
    if (href === "#top") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
    }
  });
})();

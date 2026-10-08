/* PUBLIC CAREERS
   Loads only published vacancies. Supabase row security keeps drafts private. */
(() => {
  "use strict";
  const container = document.querySelector("[data-career-openings]");
  if (!container || !window.snappiSupabase) return;
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const label = (value = "") => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  window.snappiSupabase.publicRest("career_openings", { query: "select=id,title,department,location,workplace_type,employment_type,summary,application_email,application_url,closes_on&status=eq.published&order=created_at.desc" })
    .then((roles) => {
      if (!roles.length) return;
      container.innerHTML = roles.map((role) => {
        const destination = role.application_url || `mailto:${role.application_email || "careers@snappi-eg.com"}?subject=${encodeURIComponent(`Application: ${role.title}`)}`;
        return `<article class="career-opening-card"><div><p class="kicker">${escapeHtml(role.department || "Snappi team")}</p><h3>${escapeHtml(role.title)}</h3><p>${escapeHtml(role.summary || "Full role information will be shared with suitable applicants.")}</p></div><ul><li>${escapeHtml(role.location || "Egypt")}</li><li>${escapeHtml(label(role.workplace_type))}</li><li>${escapeHtml(label(role.employment_type))}</li></ul><a class="button button-purple" href="${escapeHtml(destination)}"${role.application_url ? ' target="_blank" rel="noopener"' : ""}>Apply for this role</a></article>`;
      }).join("");
    })
    .catch(() => {});
})();

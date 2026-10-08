# Snappi Live deployment checklist

## Before uploading

- [ ] Review all headings, package prices, inclusions, and contact details.
- [ ] Confirm Instagram, TikTok, Facebook, and LinkedIn URLs.
- [ ] Confirm `sales@snappi-eg.com` and `support@snappi-eg.com` receive mail.
- [x] Keep the public legal notice short and general; the signed brand contract controls campaign-specific commercial terms.
- [ ] Arrange an Egyptian lawyer review when practical, before relying on the website notice for legal advice or expanding it with detailed obligations.
- [ ] Submit one campaign enquiry after deployment and confirm it appears once in the Google Sheet; confirm Login shows its launch notice.
- [x] Connect campaign enquiries to the public Google Apps Script deployment.
- [x] Add the final Google Form URL to `data-creator-form-url` in `creator-application.html`.
- [x] Submit a complete test creator application, including the profile-photo upload and publication-consent question.
- [ ] Test homepage, packages, legal, and 404 pages on desktop and mobile.

## Security controls

- [x] Keep Supabase admin functions behind verified user sessions.
- [x] Restrict role changes so delegated administrators cannot grant Super Admin access.
- [x] Apply database-backed request limits to public creator, support, and brand forms.
- [x] Validate creator profile-photo file signatures and image dimensions before storage.
- [x] Keep creator profile photos in the private Supabase Storage bucket.
- [x] Restrict Edge Function browser access to Snappi production and local preview origins.
- [x] Store browser sessions per tab and remove password-recovery tokens from the address bar.
- [x] Add a Content Security Policy and strict referrer policy to every public and workspace page.
- [ ] **Deferred until a future Supabase Pro upgrade:** enable leaked-password protection.
- [ ] **Deferred until a future Supabase Pro upgrade:** enrol the Super Admin account in MFA.
- [ ] Complete the shared-secret steps in `GOOGLE_SHEETS_WEBHOOK_SETUP.md`, deploy the updated Apps Script, save the two Supabase secrets, deploy `public-brand-lead`, and submit one real enquiry.
- [ ] Put the public domain behind a host or proxy that can set HTTP response headers, then add `X-Content-Type-Options: nosniff`, `Permissions-Policy`, `Referrer-Policy`, and `Content-Security-Policy` as response headers. GitHub Pages cannot configure these custom headers.
- [ ] Add Cloudflare Turnstile to public submission forms when the site begins receiving meaningful automated abuse. Server-side rate limits are already active.

## Automated transactional email

- [x] Verify `updates.snappi-eg.com` in Resend after the Squarespace DNS records propagate.
- [x] Store `resend_api_key` in Supabase **Edge Function Secrets**; never place it in the website, GitHub, database Vault, or Auth SMTP fields. Verified through a delivered support-email test on 8 October 2026.
- [x] Store `snappi_admin_alert_email` and `snappi_support_alert_email` on the same Edge Function Secrets page. Both notification routes were verified through Resend delivery records.
- [x] Configure Supabase Auth custom SMTP with Resend for invitations, verification, and password recovery.
- [ ] Test one invitation, one password recovery, one public support request, one workspace support request, and one administrator alert.
- [x] Confirm the Super Admin no longer enters or sees user passwords.

## GitHub Pages

- [ ] Upload the **contents** of `Snappi Live` to the repository root.
- [ ] Publish from `main` and `/ (root)`.
- [ ] Keep `CNAME`, `.nojekyll`, `robots.txt`, and `sitemap.xml` in the root.
- [ ] Confirm custom-domain DNS succeeds.
- [ ] Enable **Enforce HTTPS**.
- [ ] Open the site in a private browser window and test every visible link.

## After publishing

- [ ] Add the site to Google Search Console.
- [ ] Submit `https://www.snappi-eg.com/sitemap.xml`.
- [x] Add a social sharing image and Open Graph metadata before campaigns begin.
- [x] Connect Google Analytics through an explicit Accept/Decline privacy notice.

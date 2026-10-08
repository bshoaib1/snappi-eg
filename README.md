# Snappi Live

A clean, static public website prepared for GitHub Pages. It includes the current minimal homepage, packages page, legal page, and only the assets those pages use.

## Folder map

- `index.html` — homepage content and section order.
- `packages.html` — full package comparison page.
- `legal.html` — short public legal notice.
- `creator-application.html` — branded creator acquisition page and Google Form handoff.
- `about.html` — generic, editable company story, mission, vision, audiences, and working principles.
- `brands.html` — focused managed-service journey for brand campaign enquiries.
- `content-types.html` — educational UGC format library with campaign-form handoff.
- `workspace/index.html` — bookmarked internal entry for the authenticated Super Admin and authorized administrators.
- `admin.html` — legacy redirect to `/workspace/`.
- `creator-workspace.html` and `brand-workspace.html` — protected member workspaces for campaigns, updates, support history, subscription/application status, and profile settings.
- `supabase-config.js` and `supabase-client.js` — public Supabase connection, browser Auth/REST client, and shared 10-minute inactivity sign-out for every authenticated workspace.
- `admin.js` — Admin role guard, request review windows, account approvals, campaign assignment, live tables, filters, status actions, and password recovery.
- `supabase/snappi_admin_schema.sql` — database schema, triggers, grants, and Row Level Security policies.
- `supabase/admin_permissions_upgrade.sql` — granular admin privileges and Super Admin-only Audit Trail policy.
- `supabase/functions/admin-create-user/` — secured user-creation Edge Function.
- `SUPABASE_ADMIN_SETUP.md` — one-time Supabase configuration and test procedure.
- `styles.css` — ordered entry point for the shared CSS modules.
- `styles/foundation.css` — brand tokens, typography, base layout, and original shared components.
- `styles/public.css` — minimal public-site layout, navigation, pricing, FAQ, and interaction styling.
- `styles/modals-and-pages.css` — dialogs, forms, Creator Application, About, Brands, and Content Types.
- `styles/workspaces.css` — Admin, Creator Workspace, Brand Workspace, and Careers styling.
- `interface-improvements.css` — shared keyboard, responsive-table, motion-control, and accessibility corrections.
- `DESIGN_SYSTEM.md` — rules for applying the approved styling to every future page and pop-up.
- `page-template.html.example` — clean starter markup for a new Snappi page; copy and rename it when building a page from scratch.
- `site.js` — navigation, filters, tabs, FAQ, reveal motion, modal behavior, and the Google Sheets lead connection.
- `assets/` — only images and social icons referenced by these pages.
- `404.html` — branded recovery page for invalid links.
- `CNAME` — GitHub Pages custom domain setting.
- `.nojekyll` — tells GitHub Pages to serve the static files directly.
- `robots.txt` and `sitemap.xml` — search-engine discovery files.

## Important editing locations

### Brand colors and typography

Open `styles/foundation.css` and edit the variables under `:root`. The main brand colors are `--purple`, `--lime`, `--black`, `--white`, and `--off-white`.

### Homepage sections

Open `index.html`. Every major block begins with an uppercase `SECTION` comment, so headings, copy, links, and section order can be found quickly.

### Package prices and inclusions

Edit the three cards in the `PRICING` section of `index.html`, then make the same changes in the comparison cards in `packages.html`.

### Social links

The full footer links are in `index.html` and `packages.html`. Search for `instagram.com`, `tiktok.com`, `facebook.com`, and `linkedin.com`.

### Shared-link preview

`assets/snappi-social-preview.jpg` is the 1200×630 image shown when a page is
shared on WhatsApp, LinkedIn, Facebook, or another compatible platform. Each
public page includes its own title, description, canonical URL, and Open Graph
metadata in the `<head>` section.

### Google Analytics and privacy choice

`site.js` contains the measurement ID `G-XS1YXFENX6` and the shared analytics
consent notice. Analytics stays disabled until a visitor selects **Accept**.
Declining does not load Google Analytics, and the visitor can reopen the notice
from the **Privacy choices** button. Analytics is intentionally restricted to
`snappi-eg.com` and `www.snappi-eg.com`, so local previews do not affect reports.

### Pop-ups, login, and campaign actions

The shared modal design is under `SNAPPI MODAL SYSTEM` in `styles/modals-and-pages.css`. Modal markup is near the bottom of the public pages; modal behavior is under `Shared Snappi modal system` in `site.js`.

- Start Campaign and package Get Started actions open the campaign enquiry modal.
- Selecting a package card automatically fills the package field.
- Campaign forms submit to the `public-brand-lead` Supabase Edge Function. The Google Apps Script URL and receiver secret are stored only as Supabase Edge Function secrets named `snappi_crm_webhook_url` and `snappi_crm_webhook_secret`.
- The Apps Script writes brand enquiries to the `Leads` tab in Google Sheets. Its deployment remains **Execute as: Me** and **Who has access: Anyone**, while the receiver rejects requests that do not contain the matching Script Property secret. Follow `GOOGLE_SHEETS_WEBHOOK_SETUP.md` when rotating or rebuilding this connection.
- The form sends contact name, work email, mobile number, brand, selected package, campaign objective, page source, and available UTM campaign values. Basem Shoaib is the default owner and each lead starts with `new` status.
- Homepage Login authenticates active creator and brand accounts, then sends each role to its protected workspace entry.
- Join Snappi accepts Creator applications and Brand package requests through the `public-join-request` Supabase Edge Function. Submitting a request does not create an active account.
- Creator and Brand request rows open full review windows. **Approve & Create Account** carries the approved request into the secured account-creation flow and links the resulting member profile back to its source request.
- Campaign records can be linked to a Brand, a Google Drive brief, a Google Drive campaign folder, and one or more active Creators. Connected records appear inside the correct member workspace.
- Workspace notifications are created automatically when campaign stages, creator assignments, support statuses, or Brand subscription access change.
- The Super Admin can download complete Creator Directory, Brand Directory, and Subscription records as separate Excel-compatible `.xls` files from those workspace tabs.
- Public, Creator Workspace, and Brand Workspace support forms write directly to the Supabase `support_requests` queue. Priority is assigned from the issue type and can be changed independently from ticket status in the admin workspace.
- Support Queue rows open a complete request window containing the full message, contact information, priority, status, assignment, source, and private administrator notes. Private notes are stored separately so members cannot query them.
- Leaving any authenticated workspace locks it. Returning through browser history requires a new sign-in, and workspace logo/home actions sign out before opening the public site.
- Creator application actions open the connected Google Form in a new tab.
- The three-dot loader is controlled by the `SNAPPI LOADER` section in `styles/modals-and-pages.css`.

### Contact and support

The shared support pop-up is connected from the homepage Explore menu, public footers, legal notice, creator FAQs, and workspace notices. Visitors choose Brand Enquiry, Creator Support, Website Issue, or Enhancement Idea. Public requests use the `public-support-request` Supabase Edge Function; signed-in members write their own requests to the protected support queue. Website-issue messages include the current URL, browser string, viewport size, and local date/time.

### Creator application

The public creator journey is in `creator-application.html`. Homepage creator actions link to it. Its focused navigation jumps to Why Join, What Happens Next, Before You Apply, and Creator FAQs; Back to Snappi returns to the homepage. The connected Google Form URL is stored in `data-creator-form-url` on the opening `<html>` element.

### UGC content types

The brand-facing format guide is in `content-types.html`. Edit format names, explanations, goals, and examples in the `FORMAT LIBRARY` section. Each **Choose This Format** button uses `data-content-type` to place the selected format inside the existing campaign enquiry form.

## Preview locally

From this folder, run:

```sh
npm run dev
```

No installation is required. Open the address printed in the terminal, normally `http://127.0.0.1:8080`. If port 8080 is occupied, the preview automatically tries the next available port.

## Publish with GitHub Pages

1. Upload the contents of this folder to the root of the GitHub repository.
2. In repository **Settings → Pages**, choose **Deploy from a branch**.
3. Select the `main` branch and `/ (root)` folder.
4. Confirm the custom domain is `snappi-eg.com`.
5. Wait for the DNS check to pass, then enable **Enforce HTTPS**.
6. Test both `https://snappi-eg.com` and `https://www.snappi-eg.com`.

The current DNS setup is expected to keep the Squarespace-managed domain pointed at GitHub Pages. Do not publish secrets, `.env` files, databases, or private documents in this repository.

## Admin workspace

The Admin workspace is available at `/workspace/` and requires an active `super_admin` or `operations_admin` profile. Complete `SUPABASE_ADMIN_SETUP.md` before the first login. Do not add the internal workspace to the public sitemap or navigation. The old `admin.html` address redirects to the internal workspace.

Creator applications, Brand requests, and manually verified Brand subscriptions have dedicated Admin tabs. Payments remain external. Administrators record the selected package, access dates, and subscription state after verification. Application and Brand Request detail windows contain private review notes and the approval-to-account workflow. Campaign management connects Brands, Creators, briefs, Drive folders, deadlines, and stages. The workspace notification system then presents relevant operational updates to each member.

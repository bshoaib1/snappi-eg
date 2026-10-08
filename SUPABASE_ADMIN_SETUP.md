# Snappi Admin workspace setup

The internal Admin interface is implemented at `workspace/index.html`. The legacy `admin.html` address redirects there. This document records the live setup and the settings to preserve.

## Current deployment status

Deployment completed on 6 October 2026:

1. Migration `20261006150000_admin_permissions_upgrade.sql` is applied to project `dmcpnwhpcybmvgutwtaf`.
2. Edge Function `admin-create-user` is deployed and rejects requests without an authenticated administrator session.
3. Anonymous access to `user_permissions` is denied by database privileges and Row Level Security.

The shared browser client enforces a 10-minute inactivity sign-out for every authenticated workspace: Super Admin, Operations Admin, creator, and brand. Each workspace starts the shared timer after its role check succeeds.

Public Creator and Brand join requests are accepted by the `public-join-request` Edge Function. It is intentionally public, validates and limits submitted fields, uses a honeypot, and writes through the service role while the application tables deny anonymous Data API access. Creator profile photos are limited to 2 MB and stored in the private `creator-profile-photos` bucket.

## 1. Create the database structure

1. Open the Snappi project in Supabase.
2. Open **SQL Editor**.
3. Create a new query.
4. Paste the complete contents of `supabase/snappi_admin_schema.sql`.
5. Select **Run**.
6. Open **Database → Tables** and confirm the new public tables appear.

The migration enables Row Level Security and denies anonymous database access.

## 2. Disable public registration for the first release

Open **Authentication → Sign In / Providers → Email** and disable public user signups. Admins will create approved accounts manually while the workflows are being tested.

## 3. Create Basem's administrator account

1. Open **Authentication → Users**.
2. Select **Add user**.
3. Create `basem@snappi-eg.com` with a strong temporary password.
4. Mark the email as confirmed if Supabase offers that choice.

If the account is created after the migration, the database trigger assigns `super_admin` automatically. If the account already existed before the migration, run the final commented SQL statement at the bottom of `supabase/snappi_admin_schema.sql`.

## 4. Configure authentication URLs

Open **Authentication → URL Configuration**.

Set **Site URL** to:

```text
https://www.snappi-eg.com
```

Add these **Redirect URLs**:

```text
https://www.snappi-eg.com/workspace/
https://snappi-eg.com/workspace/
http://127.0.0.1:8080/workspace/
http://127.0.0.1:8081/workspace/
http://localhost:8080/workspace/
```

These URLs allow password recovery to return to the Admin page.

## 5. Test locally

From the `Snappi Live` folder:

```text
npm run dev
```

Open the displayed local address followed by `/workspace/`, then sign in as `basem@snappi-eg.com`.

Expected first state:

- Metrics display zero.
- Creator, brand, campaign, content, and support tables display empty states.
- Settings identifies Basem as Super Admin.
- Logging out returns to the secure Admin sign-in screen.

## 6. Security checks before publishing

- Keep `supabase-config.js` limited to the project URL and publishable key.
- Never add a secret key, service-role key, database password, or connection string to GitHub.
- Review Supabase **Security Advisor** after applying the migration.
- Enable multi-factor authentication for the Supabase platform account.
- Configure MFA for the Snappi Super Admin workspace before real operational data is added.
- Configure a private Storage bucket before enabling content uploads.

## Current scope

The first Admin foundation manages operational records only:

- Creators
- Brands
- Campaigns
- Content status
- Support requests
- Activity records
- Essential configuration

Sales, payments, invoices, and commissions remain outside the website.

## Admin permissions upgrade

After the initial schema is installed, run `supabase/admin_permissions_upgrade.sql` once in **SQL Editor**. This adds per-user operational privileges and restricts the Audit Trail to `super_admin` at the database level.

Grantable Operations Admin privileges are:

- Manage creators
- Manage brands
- Manage campaigns
- Manage content review
- Manage support

Audit access is deliberately absent and cannot be granted from the Admin interface.

## Deploy secure user creation

Creating Supabase Auth users requires elevated credentials and cannot run safely in GitHub Pages. The browser therefore calls the secured `admin-create-user` Edge Function.

### Supabase Dashboard method

1. Open **Edge Functions** in the Supabase project.
2. Create a function named `admin-create-user`.
3. Replace its code with `supabase/functions/admin-create-user/index.ts`.
4. Keep JWT verification enabled.
5. Deploy the function.
6. Do not copy the service-role key into any website file. Supabase supplies the function's server-side environment values.

Only an authenticated, active `super_admin` can execute this function. It creates `operations_admin`, `creator`, or `brand` accounts and returns a temporary password once. The `super_admin` role is intentionally unavailable in the Add User form.

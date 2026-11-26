# Marwah Modern School website setup

The site is a static, responsive website. Its public enquiry forms and administrator portal use Supabase; they remain visibly unconfigured until a school-owned project is connected.

## Connect Supabase

1. Create a Supabase project controlled by the school.
2. Open the project's SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). If you already ran the earlier version of this site's schema, run [`supabase/cms_migration.sql`](supabase/cms_migration.sql) to add the new page, fee and location controls.
3. In Supabase Authentication, create an individual account for each authorised administrator. Do not share administrator accounts.
4. In the SQL Editor, associate each account with the administrator role using that account's Auth user ID:

   ```sql
   insert into public.admin_users (user_id)
   values ('REPLACE-WITH-AUTH-USER-UUID');
   ```

   Run this statement as the project owner. The `admin_users` table intentionally has no client-side insert policy.
5. Copy the project's **Project URL** and **publishable/anon key** into `config.js`:

   ```js
   window.SCHOOL_CONFIG = {
     supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
     supabaseAnonKey: 'YOUR-PUBLISHABLE-OR-ANON-KEY'
   };
   ```

   The publishable/anon key is intended for browser use. **Never put a service-role key, database password, or administrator password in website files.**
6. Serve the website from localhost or an HTTPS host, then verify a public enquiry, administrator sign-in, page edit, fee entry, map location, notice edit, and image upload. Set the Supabase Auth site's production URL and redirect allowlist to the final HTTPS website origin.

Row-level security restricts school-content changes and access to enquiries to administrator accounts registered in `admin_users`. Anonymous visitors can insert only the explicitly granted enquiry fields; they cannot read submissions or publish content. Gallery photos are public by design. Add a CAPTCHA/verified server-side rate limit before public launch if spam protection is required.

## Manage pages, fees and map locations

After sign-in, use **Pages & sections** to edit, publish, hide or remove the About and Fee Structure pages, or add a custom page. Use **Fee structure items** to add, edit or remove school-approved fee entries; the public fee page only appears when it is published. Use **Locations & maps** to add, edit, hide or remove map cards. Enter a place name/address, not iframe code—the site builds a Google Maps search link safely.

## School images and confirmed details

The supplied school logo and building image are installed as `assets/school-logo.png` and `assets/school-building.png`; the home, about and gallery use those images. Upload the approved principal portrait from the admin portal.

An authorised administrator can update the announcement, contact information, map search, admissions guidance, school history, mission, vision, values, principal message, notices, pages, fee entries and gallery after Supabase is connected. Keep contact and fee fields empty until the school confirms them. The initial map searches the provided locality; it is not a verified campus pin.

Check all copy, admission details, image permissions, contact information and school approvals with management before publishing. The forms collect personal information; configure access, retention and privacy notices to the school's requirements.

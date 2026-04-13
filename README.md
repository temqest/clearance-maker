# RTC Clearance Editor (Next.js)

This project is a refactor of the original single-file HTML editor into a structured Next.js app.

It now includes Supabase-backed authentication, document storage, and file uploads.

## Structure

- `app/`: Next.js app router entry points
- `components/layout/`: top header UI
- `components/editor/`: form editor panel and photo upload
- `components/preview/`: printable document preview
- `lib/`: reusable data and formatting logic

## Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your project values:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_SUPABASE_BUCKET=documents
   ```
3. Apply database schema in Supabase SQL editor using `supabase/schema.sql`.
4. Apply RLS and storage policies using `supabase/rls-policies.sql`.
5. Ensure your `documents` bucket exists (the SQL file includes an idempotent insert).
6. Create users in Supabase Authentication (email/password) for login access.
7. Start dev server:
   ```bash
   npm run dev
   ```
8. Open `http://localhost:3000`.

## Supabase Features Wired

- Login and logout via Supabase Auth (email/password)
- Route protection for `/home` and `/editor` using Next.js proxy + Supabase session cookies
- Search and list documents from Supabase table `documents`
- Create, edit, and save clearance document data to Supabase
- Upload and update photo/signature files in Supabase Storage bucket `documents`
- RLS enforced for per-user document and file access

## Notes

- The old `file.html` is left in the root for reference.
- Use **Print / Save PDF** to export the clearance layout.

# SunHash — Risk Intelligence Platform

Pre-construction solar risk assessment. AI-powered. Six risk categories. Scored PDF report in minutes.

---

## What this repo contains

| File | Purpose |
|------|---------|
| `index.html` | Company landing page — no auth required |
| `login.html` | Sign in (email/password + Google OAuth) |
| `signup.html` | Create account + profile setup (first name, last name, role, country) |
| `dashboard.html` | Multi-project dashboard |
| `profile.html` | User profile and account settings |

All three files are **standalone HTML** — no build step, no framework, no npm. Each file imports Supabase JS from CDN and Google Fonts. Drop them into any static host and they work.

---

## Stack

| Layer | Tool | Cost |
|-------|------|------|
| Auth + Database | Supabase | Free tier |
| Forms | Tally | Free tier |
| Automation | Make.com | Free tier |
| AI scoring | OpenAI GPT-4o API | ~$0.10–0.30 per report |
| PDF generation | Carbone.io | Free tier |
| Hosting | GitHub Pages / Netlify / Vercel | Free |

**Total monthly cost at low volume: $0–10**

---

## Step-by-step setup

### Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** → give it a name (e.g. `sunhash`) → choose a region close to your users → set a database password (save it somewhere)
3. Wait ~2 minutes for the project to provision
4. Go to **Project Settings → API**
5. Copy two values:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon / public key** → long JWT string starting with `eyJ...`

---

### Step 2 — Create the database tables

In your Supabase project, go to **SQL Editor** and run the following:

```sql
-- User profiles (extends Supabase auth.users)
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  first_name  text,
  last_name   text,
  company     text,
  role        text,
  country     text,
  phone       text,
  created_at  timestamptz default now()
);

-- Projects / assessments
create table public.projects (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  name            text not null,
  location        text,
  capacity_mw     numeric,
  stage           text,
  score_overall   integer,
  score_design    integer,
  score_construct integer,
  score_contract  integer,
  score_intercon  integer,
  score_financial integer,
  score_permit    integer,
  status          text default 'draft',
  report_url      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Row-level security: users only see their own data
alter table public.profiles enable row level security;
alter table public.projects enable row level security;

create policy "Users manage own profile"
  on public.profiles for all using (auth.uid() = id);

create policy "Users manage own projects"
  on public.projects for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

### Step 3 — Enable Google OAuth (optional but recommended)

1. In Supabase → **Authentication → Providers → Google** → toggle ON
2. Go to [console.cloud.google.com](https://console.cloud.google.com)
3. Create a project → **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorised redirect URI: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
6. Copy the **Client ID** and **Client Secret** back into Supabase → Google provider settings
7. Save

> If you skip Google OAuth, email/password login still works out of the box.

---

### Step 4 — Configure the HTML files

Open `login.html`, `signup.html`, `dashboard.html`, and `profile.html` and find the `CONFIG` block near the top of the `<script>` section (`index.html` is a static landing page with no Supabase calls):

```js
// ── CONFIG ────────────────────────────────────────
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_KEY  = 'YOUR_ANON_PUBLIC_KEY';
const TALLY_FORM_ID = 'YOUR_TALLY_FORM_ID';   // index.html and dashboard.html only
// ─────────────────────────────────────────────────
```

Replace the three placeholder values with your real credentials from Steps 1 and 5.

> **Never commit your Supabase service_role key** to a public repo. The `anon` key is safe to expose in frontend code — Supabase's Row Level Security policies protect your data.

---

### Step 5 — Create your Tally form

1. Go to [tally.so](https://tally.so) and create a free account
2. Create a new form — this is your Section 0 intake (project basics)
3. In form settings → **Integrations → Webhooks** → add your Make.com webhook URL (from Step 6)
4. Publish the form and copy the form ID from the URL:
   - URL example: `https://tally.so/r/mYfOrM`
   - Form ID: `mYfOrM`
5. Paste the form ID into the `TALLY_FORM_ID` config variable in your HTML files

---

### Step 6 — Set up Make.com automation

1. Go to [make.com](https://make.com) and create a free account
2. Create a new scenario with this flow:

```
Tally (Watch Responses)
  → OpenAI (Send Message — GPT-4o)
  → Supabase (Insert/Update Row in projects table)
  → Gmail (Send Email — attach PDF report)
```

3. In the OpenAI module, paste your GPT-4o scoring prompt (see `/docs/gpt4_prompt.md`)
4. In the Supabase module, use the **Insert a Row** action → table: `projects`
5. Test with a real Tally submission

> Make.com free tier allows 1,000 operations/month — sufficient for ~30–50 assessments.

---

### Step 7 — Deploy to GitHub Pages

1. Create a new **public** GitHub repository
2. Upload the three HTML files to the root of the repo
3. Go to **Settings → Pages → Source → main branch → / (root)** → Save
4. Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

**File URLs:**
- Login: `https://yoursite.github.io/sunhash/`
- Dashboard: `https://yoursite.github.io/sunhash/dashboard.html`
- Profile: `https://yoursite.github.io/sunhash/profile.html`

> For a custom domain (e.g. `app.sunhash.io`), add a `CNAME` file to the repo containing your domain, then configure your DNS with a CNAME record pointing to `YOUR_USERNAME.github.io`.

---

### Step 8 — Configure auth redirect URLs

> ⚠️ **This is the most common cause of 404 errors after login.** Supabase must know your exact deployed URL or it will redirect to a broken address.

1. In Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your exact GitHub Pages URL — include the trailing slash:
   - Root repo: `https://yoursite.github.io/`
   - Subdirectory repo: `https://yoursite.github.io/sunhash/`
3. Add **all of the following** to **Redirect URLs** (Supabase uses wildcards):
   ```
   https://yoursite.github.io/sunhash/
   https://yoursite.github.io/sunhash/dashboard.html
   https://yoursite.github.io/sunhash/login.html
   https://yoursite.github.io/sunhash/signup.html
   https://yoursite.github.io/sunhash/profile.html
   http://localhost:3000
   http://127.0.0.1:5500
   ```
4. In **Google Cloud Console → OAuth 2.0 Client → Authorised redirect URIs**, confirm this URI is listed:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
   This must be exact — no trailing slash differences.

> **Tip — custom domain:** If you add a custom domain later (e.g. `app.sunhash.io`), add `https://app.sunhash.io/` and `https://app.sunhash.io/dashboard.html` to Supabase redirect URLs and update the Google Console URI list.

---

## Local development

No server needed. Just open the files directly:

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/sunhash.git
cd sunhash

# Open in browser (Mac)
open index.html

# Or use a simple local server to avoid CORS issues
npx serve .
# → http://localhost:3000
```

---

## File structure

```
sunhash/
├── index.html        # Company landing page (no auth)
├── login.html        # Sign in
├── signup.html       # Create account + profile setup
├── dashboard.html    # Project dashboard
├── profile.html      # User profile & settings
└── README.md         # This file
```

---

## Common 404 causes and fixes

| Situation | Cause | Fix |
|-----------|-------|-----|
| 404 after Google login | Supabase redirect URL not matching deployed path | Add `https://yoursite.github.io/sunhash/dashboard.html` to Supabase redirect URLs |
| 404 on direct URL visit | GitHub Pages doesn't have a server-side router | Always navigate from `index.html` — don't bookmark internal pages without a 404.html |
| `profile.html` gives 404 from dashboard | Link works but Supabase session missing | Ensure Supabase Site URL matches the exact origin including `/sunhash/` subfolder |
| 404 on `localhost` during development | Files served from `file://` not `http://` | Use `npx serve .` instead of opening files directly |
| Google OAuth screen then blank/404 | Google Console redirect URI has a trailing slash mismatch | Use exact: `https://YOUR_ID.supabase.co/auth/v1/callback` — no slash at end |
| Password reset link gives 404 | Reset email redirect URL not in Supabase allowed list | Add `https://yoursite.github.io/sunhash/profile.html` to Supabase redirect URLs |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Google OAuth redirect error | Check redirect URI in Google Console matches exactly |
| "Invalid API key" error | Double-check SUPABASE_KEY is the `anon` key, not `service_role` |
| Profile not saving | Run the SQL from Step 2 — check RLS policies are created |
| Tally form not loading | Verify TALLY_FORM_ID is correct (no `https://tally.so/r/` prefix) |
| Dashboard shows blank after login | Check browser console for Supabase auth session errors |

---

## Design system

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#E4E4E0` | Page background |
| `--black` | `#111111` | Primary text, borders, headers |
| `--yellow` | `#DDFF00` | Primary accent, CTAs |
| `--white` | `#F0F0EC` | Card backgrounds |
| `--gray-dk` | `#888884` | Secondary text |
| Font display | Barlow Condensed 700–900 | All headings, labels |
| Font body | Barlow 400–600 | Body text, inputs |
| Border | `2px solid #111111` | All components |

---

*SunHash · Pre-construction Solar Risk Intelligence · v1.0*

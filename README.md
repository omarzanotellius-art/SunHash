# SunHash

Pre-construction solar risk intelligence platform.

---

## Files to upload to GitHub

| File | Purpose |
|------|---------|
| `index.html` | Landing page (no login required) |
| `login.html` | Sign in — email/password + Google |
| `signup.html` | Create account + profile setup |
| `dashboard.html` | Project dashboard |
| `profile.html` | Account settings |
| `CNAME` | Custom domain for GitHub Pages |
| `README.md` | This file |

---

## Step 1 — GitHub repository

1. Go to github.com and create a new repository
2. Name it anything (e.g. `sunhash`)
3. Set it to **Public**
4. Upload all 7 files above
5. Go to **Settings > Pages**
6. Under "Source" select **Deploy from a branch**
7. Select branch: **main**, folder: **/ (root)**
8. Click Save
9. Under "Custom domain" enter `sun-hash.xyz` and click Save

GitHub Pages will be live at `https://sun-hash.xyz` within a few minutes.

---

## Step 2 — DNS settings (at your domain registrar)

Add these DNS records at wherever you registered sun-hash.xyz:

| Type | Name | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | YOUR_GITHUB_USERNAME.github.io |

Wait up to 24 hours for DNS to propagate.

---

## Step 3 — Supabase project

1. Go to supabase.com and create a new project
2. Go to **Settings > API**
3. Copy your **Project URL** (looks like `https://xxxx.supabase.co`)
4. Copy your **anon/public key** (long string starting with `eyJ...`)

---

## Step 4 — Add Supabase credentials to your files

Open `login.html`, `signup.html`, `dashboard.html`, and `profile.html`.

In each file, find these two lines near the bottom and replace with your real values:

```
var SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
var SUPABASE_KEY = "YOUR_ANON_KEY";
```

Becomes:

```
var SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

`index.html` does NOT need credentials (it has no JavaScript).

---

## Step 5 — Supabase database

Go to **SQL Editor** in Supabase and run this:

```sql
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name  text,
  company    text,
  role       text,
  country    text,
  phone      text,
  created_at timestamptz default now()
);

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

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

create policy "Users manage own profile"
  on public.profiles for all using (auth.uid() = id);

create policy "Users manage own projects"
  on public.projects for all using (auth.uid() = user_id);
```

If you get an error saying a table or policy already exists, that is fine — skip that line and run the rest.

---

## Step 6 — Supabase URL configuration

Go to **Authentication > URL Configuration**:

1. **Site URL**: `https://sun-hash.xyz`
2. **Redirect URLs** — add all of these:
   ```
   https://sun-hash.xyz/dashboard.html
   https://sun-hash.xyz/profile.html
   https://sun-hash.xyz/login.html
   ```

---

## Step 7 — Google OAuth

### In Supabase:

1. Go to **Authentication > Providers > Google**
2. Toggle **Enable** to ON
3. You will see a **Callback URL** — copy it (looks like `https://xxxx.supabase.co/auth/v1/callback`)
4. Leave this tab open

### In Google Cloud Console (console.cloud.google.com):

1. Create a new project (or use an existing one)
2. Go to **APIs & Services > OAuth consent screen**
   - User type: External
   - Fill in app name (SunHash), support email, developer email
   - Save
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Name: SunHash
   - Under **Authorised redirect URIs** add the Supabase callback URL you copied above
   - Click Create
5. Copy the **Client ID** and **Client Secret**

### Back in Supabase:

1. Paste the Client ID and Client Secret into the Google provider fields
2. Click Save

---

## Step 8 — Test the full flow

1. Go to `https://sun-hash.xyz`
2. Click "Get Started"
3. Try "Continue with Google" — it should open Google sign-in
4. After signing in, you should land on the dashboard

---

## Troubleshooting

**Google button does nothing**
- Open browser console (F12) and check for red errors
- Most likely cause: Supabase credentials not saved in the HTML files
- Check that `SUPABASE_URL` and `SUPABASE_KEY` in each file contain your real values, not the placeholder text

**After Google sign-in, redirected back to login**
- Go to Supabase > Authentication > URL Configuration
- Confirm `https://sun-hash.xyz/dashboard.html` is in the Redirect URLs list
- Confirm the Site URL is `https://sun-hash.xyz` (no trailing slash)

**404 on any page**
- Confirm all files are uploaded to the root of the repository (not inside a subfolder)
- Confirm GitHub Pages is enabled and set to deploy from main branch

**"trigger already exists" error in SQL**
- This means the trigger was created in a previous session — safe to ignore
- Just run the remaining lines

---

## Tech stack

- **Frontend**: Plain HTML/CSS/JS — no frameworks, no build step
- **Auth & Database**: Supabase (free tier)
- **Hosting**: GitHub Pages (free)
- **Forms**: Tally.so (for assessment intake)
- **Cost**: $0/month during development

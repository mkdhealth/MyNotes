# Notes — your Notion-like note app

A personal note-taking app with Notion-style editing, page nesting, tags, search, and AI features (summarize, insights, action items, ask-your-note). Works on any device via the browser once deployed.

**Stack:** React + Vite · Tiptap editor · Supabase (database + login) · Vercel (hosting + AI serverless function) · Gemini API (AI features). Everything runs on free tiers.

## Setup (one time, ~15 minutes)

### 1. Supabase (database + login)
1. Go to https://supabase.com → sign up (free) → **New project**. Pick any name/password/region.
2. When the project is ready, open **SQL Editor** → **New query** → paste the contents of `supabase-schema.sql` → **Run**.
3. Go to **Project Settings → API** and copy two values: **Project URL** and **anon public key**.

### 2. Put the code on GitHub
1. Sign up at https://github.com (free) → **New repository** (e.g. `notion-notes`, private is fine).
2. Upload this project folder's files to the repo (GitHub's "uploading an existing file" works, or use git:
   `git init && git add . && git commit -m "init" && git remote add origin <repo-url> && git push -u origin main`).

### 3. Gemini API key (for AI features — free)
1. Go to https://aistudio.google.com → sign in with Google → **Get API key** → create a key. Copy it.
2. Free tier (no card needed): ~10 requests/min, 250/day on Gemini 2.5 Flash — plenty for personal use. Note: Google may use free-tier prompts to improve its products.
3. (Alternative: an Anthropic key from https://console.anthropic.com works too — set `ANTHROPIC_API_KEY` instead.)

### 4. Vercel (hosting)
1. Go to https://vercel.com → sign up with your GitHub account → **Add New → Project** → import your repo.
2. Framework preset: **Vite** (auto-detected). Before deploying, add **Environment Variables**:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - `GEMINI_API_KEY` = your Gemini key
3. Click **Deploy**. You'll get a URL like `https://notion-notes-xyz.vercel.app`.

### 5. Use it anywhere
Open that URL on any device and sign up with your email + password (first sign-up sends a confirmation email). On your phone, use the browser's **Add to Home Screen** for an app-like icon.

## Features
- **Rich text**: headings (`#` + space), bold/italic, bullet & numbered lists, checkboxes, quotes, code blocks — standard markdown shortcuts work.
- **Pages & nesting**: hover a page in the sidebar → **＋** to add a sub-page, **🗑** to delete (deletes children too).
- **Tags**: add tags under the page title.
- **Search**: `Ctrl/Cmd + K` — searches titles, content, and tags.
- **AI (✨ button)**: Summarize, Key insights, Action items, Improve writing, or ask any question about the open note. Your API key stays server-side; only signed-in users can call it.
- **Autosave**: everything saves automatically as you type.

## Running locally (optional)
```
npm install
cp .env.example .env   # fill in the two VITE_ values
npm run dev
```
Note: AI features run through a Vercel serverless function, so they work on the deployed site (or with `npx vercel dev` locally).

## Adding your team later
Each person can already sign up and gets their own private notes. For *shared* notes you'd extend the database policies (e.g. a `shared_with` column or a workspace table) — ask me when you're ready and I'll add it.

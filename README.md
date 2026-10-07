# JobFit

Local job-search workspace. You keep one master resume. You paste a job description. JobFit scores the fit. You edit the resume.

It does **not** generate a rewritten resume. There is no cloud account and no Google login. Data stays in SQLite on the machine that runs the app (`.data/`). Clone the repo and you get an empty workspace.

## What you get

| Area | Behavior |
| --- | --- |
| **Master resume** | Upload a PDF or start from a template and save text. Source of truth for the fit check. |
| **Applications** | Company, role, JD, URL, status (`draft` → `applied` → `interview` → `rejected` → `offer`), notes, recruiter fields. |
| **Fit check** | Compares the master resume to the JD. Lists concrete skills and requirements (not filler like “experience” or “features”): what is missing, what matches, what to improve, what not to change. Does not rewrite the resume. Not Workday or Greenhouse. |
| **Cover letter / cold email** | Optional. Needs an API key. Uses only facts already on the resume. |
| **Apply profile** | Contact fields used by the Chrome extension. |
| **JobFit Fill** | Unpacked Chrome extension. Fills **empty** matching inputs on the job tab. Never submits. Skips salary, EEO, SSN, and similar. |

The tracker always works offline. Fit check uses `OPENAI_API_KEY` when set (concrete skills); otherwise it falls back to local word overlap. Optional letters need the key.

## Screenshots

<p align="center">
  <img src="docs/screenshots/jobfit-tracker.png" alt="Application tracker" width="900" />
</p>
<p align="center"><em>Tracker — pipeline, statuses, and every role in one list.</em></p>

<p align="center">
  <img src="docs/screenshots/jobfit-application.png" alt="Application workspace" width="900" />
</p>
<p align="center"><em>Application — paste a JD, then score fit against the master resume.</em></p>

<p align="center">
  <img src="docs/screenshots/jobfit-resume.png" alt="Master resume" width="900" />
</p>
<p align="center"><em>Master resume — paste or upload PDF. Fit checks start here.</em></p>

## Give this repo to someone

They get the app, not your search.

- `.data/` (SQLite, uploaded resume PDF) is gitignored.
- `.env.local` (API key) is gitignored.
- First `npm run dev` creates a fresh `.data/` on their machine.

Do not put keys in `.env.example`. Do not commit resumes or PDFs.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (landing), then **Open workspace**, or go to [http://localhost:3000/app](http://localhost:3000/app).

Add `OPENAI_API_KEY` to `.env.local` for a stronger fit check and for cover letter / cold email.

```bash
npm test
npm run lint
npm run build
```

## Chrome extension

1. Keep the app running on port 3000.
2. Save an **Apply profile** in the workspace.
3. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → the `extension/` folder.
4. On the application form, click **JobFit Fill** → **Fill this page**. Review every field, then you submit.

Workday-style widgets often are not real inputs until you click them. The extension only fills what it can map.

## Tech stack

- **App:** [Next.js](https://nextjs.org/) 13 (App Router), React 18, TypeScript
- **Data:** SQLite via `better-sqlite3` (`.data/job-helper.db`, gitignored)
- **PDF in:** `pdf-parse` (master resume upload)
- **Optional generation:** OpenAI Chat Completions (`gpt-4o-mini` by default) for cover letter / cold email
- **Extension:** Chrome Manifest V3 (`activeTab` + `scripting`; reads `http://localhost:3000/api/profile`)

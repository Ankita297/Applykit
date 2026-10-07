import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'JobFit — local job search workspace',
  description: 'Save a master resume, score it against each job description, and track applications on your machine.',
}

export default function Home() {
  return (
    <div className="landing">
      <header className="landingTop">
        <Link className="brand" href="/"><span>J</span> JobFit</Link>
        <Link className="secondary small" href="/app">Open workspace</Link>
      </header>

      <section className="landingHero">
        <p className="eyebrow">Local-first · You edit the resume</p>
        <h1>See how your resume fits the job. Do not let a model rewrite your career.</h1>
        <p className="landingLead">
          JobFit is a private workspace for a job search. Save a master resume, paste a job description, and get a fit score: what is missing, what already matches, what to improve, and what you should not change.
        </p>
        <div className="actions">
          <Link className="primary" href="/app">Open workspace</Link>
          <a className="secondary" href="#how">How it works</a>
        </div>
      </section>

      <section className="landingBand" id="how">
        <h2>How it works</h2>
        <ol className="landingSteps">
          <li>
            <strong>Master resume</strong>
            <span>Upload a PDF or start from the template. That text is the source of truth.</span>
          </li>
          <li>
            <strong>Paste a job</strong>
            <span>Company, role, and the full description. Track status as you apply.</span>
          </li>
          <li>
            <strong>Read the fit, then you edit</strong>
            <span>Missing terms, matches, what to tighten, and what to leave alone. You change the resume.</span>
          </li>
        </ol>
      </section>

      <section className="landingBand">
        <h2>What it includes</h2>
        <div className="landingGrid">
          <article>
            <strong>Fit score</strong>
            <p>Keyword overlap plus simple structure. Not Workday or Greenhouse. Not a rewritten resume.</p>
          </article>
          <article>
            <strong>Cover letter and cold email</strong>
            <p>Optional drafts from the same resume facts. No extra biography.</p>
          </article>
          <article>
            <strong>Application tracker</strong>
            <p>draft, applied, interview, rejected, offer — with the JD next to each role.</p>
          </article>
          <article>
            <strong>Form fill</strong>
            <p>A Chrome extension fills empty contact fields from your profile. It never submits.</p>
          </article>
        </div>
      </section>

      <footer className="landingFoot">
        <p>Data lives in SQLite on this computer. There is no JobFit cloud account. Fit check needs no API key; optional letters need one in <code>.env.local</code>.</p>
        <Link className="primary" href="/app">Open workspace</Link>
      </footer>
    </div>
  )
}

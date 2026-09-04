'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Application, ApplyProfile, AtsResult, DocumentType } from '@/lib/types'
import { STATUSES } from '@/lib/types'

type View = 'tracker' | 'application' | 'resume' | 'profile'
type ApplicationDraft = Omit<Application, 'id' | 'created_at' | 'updated_at'> & { id?: number }

const emptyProfile = (): ApplyProfile => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  linkedin: '',
  github: '',
  website: '',
  address: '',
  city: '',
  region: '',
  postal_code: '',
  country: '',
  work_authorization: '',
})
type ApplicationDraft = Omit<Application, 'id' | 'created_at' | 'updated_at'> & { id?: number }

const emptyApplication = (): ApplicationDraft => ({
  company: '',
  role: '',
  job_url: '',
  jd_text: '',
  status: 'draft',
  applied_at: null,
  notes: '',
  recruiter_name: '',
  recruiter_email: '',
  documents: {},
})

async function responseJson(response: Response) {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong.')
  return data
}

export default function JobApp() {
  const [view, setView] = useState<View>('tracker')
  const [applications, setApplications] = useState<Application[]>([])
  const [masterResume, setMasterResume] = useState('')
  const [profile, setProfile] = useState<ApplyProfile>(emptyProfile)
  const [draft, setDraft] = useState<ApplicationDraft>(emptyApplication)
  const [ats, setAts] = useState<AtsResult | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const loadApplications = async () => {
    const data = await responseJson(await fetch('/api/applications'))
    setApplications(data)
    return data as Application[]
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/resume').then(responseJson),
      fetch('/api/applications').then(responseJson),
      fetch('/api/profile').then(responseJson),
    ])
      .then(([resume, apps, savedProfile]) => {
        setMasterResume(resume.body)
        setApplications(apps)
        setProfile({ ...emptyProfile(), ...savedProfile })
      })
      .catch((error) => setMessage(error.message))
  }, [])

  const counts = useMemo(() => ({
    total: applications.length,
    active: applications.filter((item) => ['applied', 'interview'].includes(item.status)).length,
    interviews: applications.filter((item) => item.status === 'interview').length,
    offers: applications.filter((item) => item.status === 'offer').length,
  }), [applications])

  function editApplication(application?: Application) {
    setDraft(application ? { ...application } : emptyApplication())
    setAts(null)
    setMessage('')
    setView('application')
  }

  async function saveResume() {
    setBusy('resume')
    setMessage('')
    try {
      await responseJson(await fetch('/api/resume', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: masterResume }),
      }))
      setMessage('Master resume saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setBusy('')
    }
  }

  async function uploadResume(file: File) {
    setBusy('upload')
    setMessage('')
    try {
      const data = new FormData()
      data.append('file', file)
      const saved = await responseJson(await fetch('/api/resume', { method: 'PUT', body: data }))
      setMasterResume(saved.body)
      setMessage(`Imported ${file.name}. Review the text, then generate from it.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read that file.')
    } finally {
      setBusy('')
    }
  }

  async function saveProfile() {
    setBusy('profile')
    setMessage('')
    try {
      const saved = await responseJson(await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      }))
      setProfile({ ...emptyProfile(), ...saved })
      setMessage('Apply profile saved. Use the JobFit Fill extension on the job tab.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setBusy('')
    }
  }

  async function saveApplication() {
    setBusy('application')
    setMessage('')
    try {
      const response = await responseJson(await fetch('/api/applications', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }))
      const id = draft.id ?? response.id
      const apps = await loadApplications()
      const saved = apps.find((application) => application.id === id)
      if (saved) setDraft({ ...saved })
      setMessage('Application saved.')
      return id as number
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setBusy('')
    }
  }

  async function generate(type: DocumentType) {
    let applicationId = draft.id
    if (!applicationId) applicationId = await saveApplication()
    if (!applicationId) return

    setBusy(type)
    setMessage('')
    try {
      const result = await responseJson(await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, type }),
      }))
      setDraft((current) => ({
        ...current,
        id: applicationId,
        documents: { ...current.documents, [type]: result.body },
      }))
      if (result.ats) setAts(result.ats)
      await loadApplications()
      setMessage(`${type.replace('_', ' ')} generated. Review every claim before using it.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Generation failed.')
    } finally {
      setBusy('')
    }
  }

  async function saveDocument(type: DocumentType) {
    if (!draft.id) return
    setBusy(`save-${type}`)
    try {
      await responseJson(await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: draft.id, type, body: draft.documents[type] ?? '' }),
      }))
      await loadApplications()
      setMessage('Edits saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save edits.')
    } finally {
      setBusy('')
    }
  }

  async function checkAts() {
    const resume = draft.documents.resume || masterResume
    if (!resume || !draft.jd_text) {
      setMessage('Add a resume and job description first.')
      return
    }
    setBusy('ats')
    try {
      setAts(await responseJson(await fetch('/api/ats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jobDescription: draft.jd_text }),
      })))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ATS check failed.')
    } finally {
      setBusy('')
    }
  }

  async function removeApplication(id: number) {
    if (!window.confirm('Delete this application and its documents?')) return
    await responseJson(await fetch('/api/applications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }))
    await loadApplications()
  }

  function downloadMarkdown() {
    const body = draft.documents.resume
    if (!body) return
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${draft.company}-${draft.role}-resume.md`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span>J</span> JobFit</div>
        <p className="eyebrow">Your private job search workspace</p>
        <nav>
          <button className={view === 'tracker' ? 'active' : ''} onClick={() => setView('tracker')}>Application tracker</button>
          <button className={view === 'application' ? 'active' : ''} onClick={() => editApplication()}>New application</button>
          <button className={view === 'resume' ? 'active' : ''} onClick={() => setView('resume')}>Master resume</button>
          <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>Apply profile</button>
        </nav>
        <div className="privacy">Stored locally in <strong>.data</strong><br />Nothing is sent until you generate.</div>
      </aside>

      <main className="content">
        {message && <div className="notice" role="status">{message}<button onClick={() => setMessage('')}>×</button></div>}

        {view === 'tracker' && (
          <>
            <header className="pageHeader">
              <div><p className="eyebrow">Pipeline</p><h1>Applications</h1><p>Every role, document, and follow-up in one place.</p></div>
              <button className="primary" onClick={() => editApplication()}>+ New application</button>
            </header>
            <section className="stats">
              <article><strong>{counts.total}</strong><span>Total roles</span></article>
              <article><strong>{counts.active}</strong><span>Active</span></article>
              <article><strong>{counts.interviews}</strong><span>Interviews</span></article>
              <article><strong>{counts.offers}</strong><span>Offers</span></article>
            </section>
            <section className="card">
              {applications.length === 0 ? (
                <div className="empty"><h2>Your tracker is ready</h2><p>Add a job description to create your first tailored application.</p><button className="primary" onClick={() => editApplication()}>Add first application</button></div>
              ) : (
                <div className="applicationList">
                  {applications.map((application) => (
                    <article className="applicationRow" key={application.id}>
                      <button className="rowMain" onClick={() => editApplication(application)}>
                        <span className="companyMark">{application.company.slice(0, 1).toUpperCase()}</span>
                        <span><strong>{application.role}</strong><small>{application.company} · Updated {new Date(application.updated_at).toLocaleDateString()}</small></span>
                      </button>
                      <span className={`status status-${application.status}`}>{application.status}</span>
                      <span className="docCount">{Object.keys(application.documents).length} docs</span>
                      <button className="iconButton" aria-label={`Delete ${application.role}`} onClick={() => removeApplication(application.id)}>×</button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view === 'resume' && (
          <>
            <header className="pageHeader"><div><p className="eyebrow">Source of truth</p><h1>Master resume</h1><p>Upload a PDF or paste your complete, truthful resume. Tailored versions start here.</p></div></header>
            <section className="card formCard">
              <label>Upload PDF, Markdown, or text
                <input
                  type="file"
                  accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
                  disabled={busy === 'upload'}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void uploadResume(file)
                  }}
                />
              </label>
              <label>Resume text or Markdown<textarea className="large" value={masterResume} onChange={(event) => setMasterResume(event.target.value)} placeholder="Name, contact details, summary, experience, education, skills…" /></label>
              <div className="actions"><span className="hint">PDF text is extracted locally. Image-only scans will not work. Review after upload.</span><button className="primary" disabled={busy === 'resume'} onClick={saveResume}>{busy === 'resume' ? 'Saving…' : 'Save master resume'}</button></div>
            </section>
          </>
        )}

        {view === 'profile' && (
          <>
            <header className="pageHeader"><div><p className="eyebrow">Browser fill</p><h1>Apply profile</h1><p>Save the facts you want typed into job forms. The extension fills empty fields only, then you submit.</p></div></header>
            <section className="card formCard">
              <div className="grid2">
                <label>First name<input value={profile.first_name} onChange={(event) => setProfile({ ...profile, first_name: event.target.value })} /></label>
                <label>Last name<input value={profile.last_name} onChange={(event) => setProfile({ ...profile, last_name: event.target.value })} /></label>
                <label>Email<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
                <label>Phone<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
                <label>LinkedIn<input value={profile.linkedin} onChange={(event) => setProfile({ ...profile, linkedin: event.target.value })} placeholder="https://linkedin.com/in/…" /></label>
                <label>GitHub<input value={profile.github} onChange={(event) => setProfile({ ...profile, github: event.target.value })} /></label>
                <label>Website<input value={profile.website} onChange={(event) => setProfile({ ...profile, website: event.target.value })} /></label>
                <label>Country<input value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} /></label>
                <label>City<input value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></label>
                <label>State / region<input value={profile.region} onChange={(event) => setProfile({ ...profile, region: event.target.value })} /></label>
                <label>Postal code<input value={profile.postal_code} onChange={(event) => setProfile({ ...profile, postal_code: event.target.value })} /></label>
                <label>Address<input value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></label>
              </div>
              <label>Work authorization (optional)<input value={profile.work_authorization} onChange={(event) => setProfile({ ...profile, work_authorization: event.target.value })} placeholder="e.g. Yes, authorized to work in India" /></label>
              <div className="actions"><span className="hint">It skips gender, race, salary, SSN, and similar questions. Workday custom widgets may need a click first.</span><button className="primary" disabled={busy === 'profile'} onClick={saveProfile}>{busy === 'profile' ? 'Saving…' : 'Save apply profile'}</button></div>
            </section>
            <section className="card formCard">
              <p className="eyebrow">Chrome extension</p>
              <ol className="install">
                <li>Keep this app running at localhost:3000</li>
                <li>Open chrome://extensions, turn on Developer mode, Load unpacked, choose the <strong>extension</strong> folder in this project</li>
                <li>Open the Workday (or other) application tab, click JobFit Fill → Fill this page</li>
              </ol>
            </section>
          </>
        )}

        {view === 'application' && (
          <>
            <header className="pageHeader">
              <div><p className="eyebrow">{draft.id ? 'Application workspace' : 'Start a match'}</p><h1>{draft.id ? `${draft.role} · ${draft.company}` : 'New application'}</h1><p>Save the role, then create only the documents you need.</p></div>
              <button className="secondary" onClick={() => setView('tracker')}>Back to tracker</button>
            </header>
            <section className="card formCard">
              <div className="grid2">
                <label>Company<input value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} placeholder="Acme" /></label>
                <label>Role<input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} placeholder="Product Designer" /></label>
                <label>Job URL<input type="url" value={draft.job_url} onChange={(event) => setDraft({ ...draft, job_url: event.target.value })} placeholder="https://…" /></label>
                <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Application['status'] })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
              </div>
              <label>Job description<textarea className="large" value={draft.jd_text} onChange={(event) => setDraft({ ...draft, jd_text: event.target.value })} placeholder="Paste the full job description…" /></label>
              <details>
                <summary>Recruiter and notes (optional)</summary>
                <div className="grid2 inset">
                  <label>Recruiter name<input value={draft.recruiter_name} onChange={(event) => setDraft({ ...draft, recruiter_name: event.target.value })} /></label>
                  <label>Recruiter email<input type="email" value={draft.recruiter_email} onChange={(event) => setDraft({ ...draft, recruiter_email: event.target.value })} /></label>
                </div>
                <label>Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
              </details>
              <div className="actions"><span className="hint">AI never invents experience or skills.</span><button className="primary" disabled={busy === 'application'} onClick={saveApplication}>{busy === 'application' ? 'Saving…' : 'Save application'}</button></div>
            </section>

            <section className="generatorGrid">
              {(['resume', 'cover_letter', 'cold_email'] as DocumentType[]).map((type) => (
                <article className="card documentCard" key={type}>
                  <div className="documentHeader">
                    <div><p className="eyebrow">{type === 'resume' ? 'Core document' : 'Optional'}</p><h2>{type.replace('_', ' ')}</h2></div>
                    <button className="secondary small" disabled={busy === type} onClick={() => generate(type)}>{busy === type ? 'Writing…' : draft.documents[type] ? 'Regenerate' : 'Generate'}</button>
                  </div>
                  {draft.documents[type] ? (
                    <>
                      <textarea className="document" value={draft.documents[type]} onChange={(event) => setDraft({ ...draft, documents: { ...draft.documents, [type]: event.target.value } })} />
                      <div className="actions compact">
                        {type === 'resume' && <><button className="linkButton" onClick={downloadMarkdown}>Download .md</button>{draft.id && <a className="linkButton" href={`/api/export/${draft.id}`}>Download PDF</a>}</>}
                        <button className="linkButton push" disabled={busy === `save-${type}`} onClick={() => saveDocument(type)}>Save edits</button>
                      </div>
                    </>
                  ) : <p className="placeholder">Generate a focused {type.replace('_', ' ')} from your master resume and this job description.</p>}
                </article>
              ))}
            </section>

            <section className="card atsCard">
              <div className="documentHeader"><div><p className="eyebrow">Transparent heuristic</p><h2>Keyword / format fit</h2></div><button className="secondary small" disabled={busy === 'ats'} onClick={checkAts}>Check fit</button></div>
              {!ats ? <p className="placeholder">This is not a score from a real ATS. It checks important JD terms and basic parsing-safe structure.</p> : (
                <div className="atsResult">
                  <div className="score"><strong>{ats.score}</strong><span>/ 100</span></div>
                  <div><h3>Missing terms to review</h3><div className="tags">{ats.missing.slice(0, 12).map((word) => <span key={word}>{word}</span>)}</div><p className="hint">Add a term only when it truthfully describes your experience.</p></div>
                  <ul>{ats.checks.map((check) => <li key={check.label} className={check.passed ? 'pass' : 'fail'}>{check.passed ? '✓' : '○'} {check.label}</li>)}</ul>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

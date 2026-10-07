'use client'

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { RESUME_TEMPLATE } from '@/lib/resumeFormat'
import { STATUSES, type Application, type ApplyProfile, type AtsResult, type DocumentType } from '@/lib/types'

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
  const fileInput = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<View>('tracker')
  const [applications, setApplications] = useState<Application[]>([])
  const [masterResume, setMasterResume] = useState('')
  const [hasPdf, setHasPdf] = useState(false)
  const [resumeFile, setResumeFile] = useState('')
  const [pdfStamp, setPdfStamp] = useState('')
  const [profile, setProfile] = useState<ApplyProfile>(emptyProfile)
  const [draft, setDraft] = useState<ApplicationDraft>(emptyApplication)
  const [ats, setAts] = useState<AtsResult | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState(false)
  const [showLetter, setShowLetter] = useState(false)
  const [showEmail, setShowEmail] = useState(false)

  function flash(text: string, isError = false) {
    setMessageError(isError)
    setMessage(text)
  }

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
        setHasPdf(Boolean(resume.hasPdf))
        setResumeFile(resume.filename ?? '')
        setPdfStamp(resume.updated_at ?? '')
        setApplications(apps)
        setProfile({ ...emptyProfile(), ...savedProfile })
      })
      .catch((error) => flash(error.message, true))
  }, [])

  useEffect(() => {
    const viewParam = new URLSearchParams(window.location.search).get('view')
    if (viewParam === 'resume' || viewParam === 'profile' || viewParam === 'application' || viewParam === 'tracker') {
      setView(viewParam)
    }
  }, [])

  const counts = useMemo(() => ({
    total: applications.length,
    active: applications.filter((item) => ['applied', 'interview'].includes(item.status)).length,
    interviews: applications.filter((item) => item.status === 'interview').length,
    offers: applications.filter((item) => item.status === 'offer').length,
  }), [applications])

  function editApplication(application?: Application) {
    const next = application ? { ...application } : emptyApplication()
    setDraft(next)
    setAts(null)
    setShowLetter(Boolean(application?.documents.cover_letter))
    setShowEmail(Boolean(application?.documents.cold_email))
    setMessage('')
    setView('application')
    if (application?.jd_text.trim() && masterResume.trim()) {
      void scoreFit(masterResume, application.jd_text)
    }
  }

  function useTemplate() {
    if (masterResume.trim() && masterResume !== RESUME_TEMPLATE && !window.confirm('Replace the current resume text with the template?')) {
      return
    }
    setMasterResume(RESUME_TEMPLATE)
    flash('Fill in the template, then Save. That becomes your master resume.')
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
      setHasPdf(false)
      setResumeFile('')
      flash('Master resume saved.')
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save.', true)
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
      setHasPdf(Boolean(saved.hasPdf))
      setResumeFile(saved.filename || file.name)
      setPdfStamp(saved.updated_at ?? String(Date.now()))
      flash(saved.hasPdf ? `${file.name} is your master resume.` : `Imported ${file.name}.`)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not read that file.', true)
    } finally {
      setBusy('')
    }
  }

  async function removePdf() {
    const saved = await responseJson(await fetch('/api/resume/file', { method: 'DELETE' }))
    setHasPdf(false)
    setResumeFile('')
    setMasterResume(saved.body ?? masterResume)
    flash('PDF removed. You can paste or upload again.')
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
      flash('Apply profile saved.')
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save.', true)
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
      if (saved) {
        setDraft({ ...saved })
        if (masterResume.trim() && saved.jd_text.trim()) void scoreFit(masterResume, saved.jd_text)
      }
      flash('Application saved.')
      return id as number
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save.', true)
    } finally {
      setBusy('')
    }
  }

  async function generate(type: DocumentType) {
    if (!masterResume.trim()) {
      flash('Add a master resume first.', true)
      setView('resume')
      return
    }
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
      await loadApplications()
      flash(`${type.replace('_', ' ')} ready. Check every claim before you send it.`)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Generation failed.', true)
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
      flash('Edits saved.')
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save edits.', true)
    } finally {
      setBusy('')
    }
  }

  async function scoreFit(resume: string, jobDescription: string) {
    if (!resume.trim()) {
      flash('Add a master resume first.', true)
      setView('resume')
      return
    }
    if (!jobDescription.trim()) {
      flash('Paste a job description first.', true)
      return
    }
    setBusy('ats')
    try {
      const result = await responseJson(await fetch('/api/ats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jobDescription }),
      })) as AtsResult
      setAts(result)
      if (result.warning) flash(result.warning, true)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Fit check failed.', true)
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

  function onDropResume(event: DragEvent) {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void uploadResume(file)
  }

  const documentTypes = (['cover_letter', 'cold_email'] as DocumentType[]).filter((type) => (
    type === 'cover_letter' ? showLetter : showEmail
  ))

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span>J</span> JobFit</a>
        <p className="eyebrow">Your private job search workspace</p>
        <nav>
          <button className={view === 'tracker' || view === 'application' ? 'active' : ''} onClick={() => setView('tracker')}>Applications</button>
          <button className={view === 'resume' ? 'active' : ''} onClick={() => setView('resume')}>Resume</button>
          <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>Profile</button>
        </nav>
        <div className="privacy">Stored on this machine.<br />Fit check needs no API key.</div>
      </aside>

      <main className="content">
        {message && <div className={`notice ${messageError ? 'error' : ''}`} role="status">{message}<button onClick={() => setMessage('')}>×</button></div>}

        {view === 'tracker' && (
          <>
            <header className="pageHeader">
              <div>
                <p className="eyebrow">Pipeline</p>
                <h1>Applications</h1>
                <p>{counts.total} roles · {counts.active} active · {counts.interviews} interviews · {counts.offers} offers</p>
              </div>
              <button className="primary" onClick={() => editApplication()}>+ New application</button>
            </header>
            <section className="card">
              {applications.length === 0 ? (
                <div className="empty"><h2>Paste a job description</h2><p>See what matches your master resume, and what you should not invent.</p><button className="primary" onClick={() => editApplication()}>Add first application</button></div>
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
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view === 'resume' && (
          <>
            <header className="pageHeader"><div><p className="eyebrow">Source of truth</p><h1>Master resume</h1><p>Upload a PDF, or start from the template, fill in your details, and save.</p></div></header>
            <section className="card formCard">
              <input
                ref={fileInput}
                className="fileHidden"
                type="file"
                accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
                disabled={busy === 'upload'}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void uploadResume(file)
                }}
              />
              <div
                className={`dropzone ${hasPdf ? 'filled' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDropResume}
              >
                {hasPdf ? (
                  <>
                    <strong>{resumeFile || 'Resume.pdf'}</strong>
                    <span>Drop a file to replace, or use the buttons.</span>
                    <div className="dropActions">
                      <button type="button" className="secondary small" disabled={busy === 'upload'} onClick={() => fileInput.current?.click()}>Replace</button>
                      <button type="button" className="secondary small" onClick={() => void removePdf()}>Remove</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>Drop a PDF here</strong>
                    <span>or click to upload PDF, Markdown, or text</span>
                    <button type="button" className="secondary small" disabled={busy === 'upload'} onClick={() => fileInput.current?.click()}>
                      {busy === 'upload' ? 'Uploading…' : 'Choose file'}
                    </button>
                  </>
                )}
              </div>
              {hasPdf ? (
                <iframe
                  className="pdfPreview"
                  title="Master resume PDF"
                  src={`/api/resume/file?t=${encodeURIComponent(pdfStamp)}`}
                />
              ) : (
                <>
                  <label>Or paste resume text<textarea className="large" value={masterResume} onChange={(event) => setMasterResume(event.target.value)} placeholder="Name, title, links, skills, experience, education…" /></label>
                  <div className="actions">
                    <span className="hint">Use the template, replace the placeholders, then Save.</span>
                    <button type="button" className="secondary" onClick={useTemplate}>Use template</button>
                    <button className="primary" disabled={busy === 'resume'} onClick={saveResume}>{busy === 'resume' ? 'Saving…' : 'Save master resume'}</button>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {view === 'profile' && (
          <>
            <header className="pageHeader"><div><p className="eyebrow">Form fill</p><h1>Profile</h1><p>Facts typed into job forms. The extension fills empty fields only; you submit.</p></div></header>
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
              <div className="actions"><span className="hint">Skips gender, race, salary, and SSN-like fields.</span><button className="primary" disabled={busy === 'profile'} onClick={saveProfile}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button></div>
            </section>
            <details className="card formCard">
              <summary>How to fill forms in Chrome</summary>
              <ol className="install">
                <li>Keep this app running at localhost:3000</li>
                <li>Chrome → Extensions → Developer mode → Load unpacked → the extension folder in this project</li>
                <li>On the job tab, click JobFit Fill → Fill this page</li>
              </ol>
            </details>
          </>
        )}

        {view === 'application' && (
          <>
            <header className="pageHeader">
              <div>
                <p className="eyebrow">{draft.id ? `${draft.company}` : 'New role'}</p>
                <h1>{draft.id ? draft.role : 'New application'}</h1>
                <p>Save the job, then check how your master resume fits this description.</p>
              </div>
              <button className="secondary" onClick={() => setView('tracker')}>Back</button>
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
              <div className="actions"><span className="hint">Fit check uses your master resume and this JD. It does not rewrite the resume.</span><button className="primary" disabled={busy === 'application'} onClick={saveApplication}>{busy === 'application' ? 'Saving…' : 'Save application'}</button></div>
            </section>

            <section className="card atsCard">
              <div className="documentHeader">
                <div><p className="eyebrow">Not a real ATS</p><h2>Fit against this job</h2></div>
                <button type="button" className="secondary small" disabled={busy === 'ats'} onClick={() => void scoreFit(masterResume, draft.jd_text)}>
                  {busy === 'ats' ? 'Scoring…' : ats ? 'Score again' : 'Score this job'}
                </button>
              </div>
              {!ats ? <p className="placeholder">Save the job or click Score. This compares your master resume to the JD. It does not rewrite anything.</p> : (
                <div className="atsResult">
                  {ats.warning && <p className="hint">{ats.warning}</p>}
                  <div className="score"><strong>{ats.score}</strong><span>/ 100 keyword fit</span></div>
                  <div className="atsPanes">
                    <div>
                      <h3>What am I missing?</h3>
                      {ats.missing.length
                        ? <div className="tags miss">{ats.missing.slice(0, 16).map((word) => <span key={word}>{word}</span>)}</div>
                        : <p className="hint">No extra JD terms stood out.</p>}
                    </div>
                    <div>
                      <h3>What matches?</h3>
                      {ats.matched.length
                        ? <div className="tags match">{ats.matched.slice(0, 16).map((word) => <span key={word}>{word}</span>)}</div>
                        : <p className="hint">No overlapping terms yet. Check the JD and master resume.</p>}
                    </div>
                    <div>
                      <h3>What should I improve?</h3>
                      <ul>{ats.improve.map((line) => <li key={line} className="fail">○ {line}</li>)}</ul>
                    </div>
                    <div>
                      <h3>What should I NOT change?</h3>
                      <ul>{ats.keep.map((line) => <li key={line} className="pass">✓ {line}</li>)}</ul>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="outreachActions">
              {!showLetter && <button className="secondary" onClick={() => setShowLetter(true)}>Also write a cover letter</button>}
              {!showEmail && <button className="secondary" onClick={() => setShowEmail(true)}>Also write a cold email</button>}
            </div>

            {documentTypes.length > 0 && (
            <section className="generatorGrid">
              {documentTypes.map((type) => (
                <article className="card documentCard" key={type}>
                  <div className="documentHeader">
                    <div><p className="eyebrow">Optional</p><h2>{type.replace('_', ' ')}</h2></div>
                    <div className="headerActions">
                      <button className="secondary small" disabled={busy === type} onClick={() => generate(type)}>{busy === type ? 'Writing…' : draft.documents[type] ? 'Regenerate' : 'Generate'}</button>
                    </div>
                  </div>
                  {draft.documents[type] ? (
                    <>
                      <textarea className="document" value={draft.documents[type]} onChange={(event) => setDraft({ ...draft, documents: { ...draft.documents, [type]: event.target.value } })} />
                      <div className="actions compact">
                        <button className="linkButton push" disabled={busy === `save-${type}`} onClick={() => saveDocument(type)}>Save edits</button>
                      </div>
                    </>
                  ) : <p className="placeholder">{`Generate a ${type.replace('_', ' ')}.`}</p>}
                </article>
              ))}
            </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

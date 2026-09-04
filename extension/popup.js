function fillPage(profile) {
  const blocked = /ssn|social security|password|race|ethnic|gender|sex\b|veteran|disabilit|sexual|religion|salary|compensation|criminal|date of birth|birthdate|dob\b/
  const patterns = [
    ['first_name', /legal first|given name|first name|firstname|fname/],
    ['last_name', /family name|last name|lastname|surname|lname/],
    ['email', /e-?mail/],
    ['phone', /phone|mobile|cell|tel\b/],
    ['linkedin', /linkedin/],
    ['github', /github/],
    ['website', /portfolio|website|personal (site|url)|homepage/],
    ['work_authorization', /work authori|authorized to work|work eligibility|legally authori/],
    ['postal_code', /postal|zip\s?code|zipcode/],
    ['address', /address line|street address|^address$|addr1/],
    ['city', /\bcity\b|town/],
    ['region', /\bstate\b|province|region/],
    ['country', /country|nation/],
    ['full_name', /^(full )?name$|legal name|applicant name/],
  ]

  const values = {
    ...profile,
    full_name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[_/]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  }

  function matchKey(label) {
    const text = normalize(label)
    if (!text || blocked.test(text)) return null
    for (const [key, pattern] of patterns) {
      if (pattern.test(text)) return key
    }
    return null
  }

  function fieldLabel(el) {
    const labelled = el.getAttribute('aria-label')
      || el.getAttribute('placeholder')
      || el.getAttribute('autocomplete')
      || el.getAttribute('name')
      || el.id
      || el.getAttribute('data-automation-id')
      || ''
    const byId = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    const wrap = el.closest('label')
    return [labelled, byId?.textContent, wrap?.textContent].filter(Boolean).join(' ')
  }

  function setValue(el, value) {
    if (el instanceof HTMLSelectElement) {
      const match = [...el.options].find((option) => option.value && normalize(option.textContent).includes(normalize(value)))
        || [...el.options].find((option) => option.value && normalize(option.value) === normalize(value))
      if (!match) return false
      el.value = match.value
    } else {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      setter ? setter.call(el, value) : (el.value = value)
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  let filled = 0
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (el instanceof HTMLInputElement && /hidden|password|file|submit|button|checkbox|radio|date/.test(el.type)) continue
    if (el.disabled || el.readOnly) continue
    if ('value' in el && String(el.value).trim()) continue
    const key = matchKey(fieldLabel(el))
    const value = key ? String(values[key] || '').trim() : ''
    if (!value) continue
    if (setValue(el, value)) filled += 1
  }
  return filled
}

async function loadProfile() {
  const errors = []
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
    try {
      const response = await fetch(`${origin}/api/profile`)
      if (response.ok) return response.json()
      errors.push(`${origin}: ${response.status}`)
    } catch (error) {
      errors.push(`${origin}: ${error instanceof Error ? error.message : 'unreachable'}`)
    }
  }
  throw new Error(`Start JobFit (npm run dev), then try again. ${errors.join('; ')}`)
}

document.getElementById('fill').addEventListener('click', async () => {
  const button = document.getElementById('fill')
  const status = document.getElementById('status')
  button.disabled = true
  status.textContent = 'Filling…'
  try {
    const profile = await loadProfile()
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active tab.')
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillPage,
      args: [profile],
    })
    const count = results.reduce((sum, item) => sum + (item.result ?? 0), 0)
    status.textContent = count
      ? `Filled ${count} field${count === 1 ? '' : 's'}. Review before you submit.`
      : 'No empty matching fields on this page. Workday widgets sometimes need a click in the field first.'
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not fill.'
  } finally {
    button.disabled = false
  }
})

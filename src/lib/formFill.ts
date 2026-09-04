export const PROFILE_KEYS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'linkedin',
  'github',
  'website',
  'address',
  'city',
  'region',
  'postal_code',
  'country',
  'work_authorization',
  'full_name',
] as const

export type FillKey = (typeof PROFILE_KEYS)[number]

const BLOCKED = /ssn|social security|password|race|ethnic|gender|sex\b|veteran|disabilit|sexual|religion|salary|compensation|criminal|date of birth|birthdate|dob\b/

const PATTERNS: [FillKey, RegExp][] = [
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

export function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[_/]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function matchFillKey(label: string): FillKey | null {
  const text = normalizeLabel(label)
  if (!text || BLOCKED.test(text)) return null
  for (const [key, pattern] of PATTERNS) {
    if (pattern.test(text)) return key
  }
  return null
}

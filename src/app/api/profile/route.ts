import { NextResponse } from 'next/server'
import db from '@/lib/db'
import type { ApplyProfile } from '@/lib/types'

export const runtime = 'nodejs'

const EMPTY: ApplyProfile = {
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
}

function cors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export function GET() {
  const row = db.prepare(`
    SELECT first_name, last_name, email, phone, linkedin, github, website,
      address, city, region, postal_code, country, work_authorization
    FROM profiles WHERE user_id = ?
  `).get('local') as ApplyProfile | undefined
  return cors(NextResponse.json(row ?? EMPTY))
}

export async function PUT(request: Request) {
  const incoming = await request.json() as Partial<ApplyProfile>
  const profile = { ...EMPTY }
  for (const key of Object.keys(EMPTY) as (keyof ApplyProfile)[]) {
    if (typeof incoming[key] === 'string') profile[key] = incoming[key].trim()
  }
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO profiles (
      user_id, first_name, last_name, email, phone, linkedin, github, website,
      address, city, region, postal_code, country, work_authorization, updated_at
    ) VALUES ('local', @first_name, @last_name, @email, @phone, @linkedin, @github, @website,
      @address, @city, @region, @postal_code, @country, @work_authorization, @updated_at)
    ON CONFLICT(user_id) DO UPDATE SET
      first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email,
      phone = excluded.phone, linkedin = excluded.linkedin, github = excluded.github,
      website = excluded.website, address = excluded.address, city = excluded.city,
      region = excluded.region, postal_code = excluded.postal_code, country = excluded.country,
      work_authorization = excluded.work_authorization, updated_at = excluded.updated_at
  `).run({ ...profile, updated_at: now })
  return cors(NextResponse.json(profile))
}

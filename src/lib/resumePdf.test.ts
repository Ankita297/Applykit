import assert from 'node:assert/strict'
import test from 'node:test'
import { buildResumePdf } from './resumePdf'

const sample = `Ankita
Software Engineer
LinkedIn : https://linkedin.com/in/ankita0930
Email : ankitapal7777@gmail.com
Mobile : +91 7015038098
Skills & Tech Stack
Languages: JavaScript (ES6+) · TypeScript · **React**
Frontend: **Next.js** · Redux
Experience
Orange Health Labs	Bengaluru, Karnataka, India
Software Engineer 2	March 2024 - Present
- Clinic Front-Desk Application: Built the TypeScript, **React** and **Next.js** booking flow.
- Partner Finance Automation: Built invoicing with role-based access.
Education
UIET, Panjab University	Chandigarh, India
B.Tech - Computer Science and Engineering	2023
`

const mashed = `Ankita
LinkedIn : https://linkedin.com/in/ankita0930 | Email : you@email.com | Software Engineer | Mobile : +91 7015038098 | LeetCode : https://leetcode.com/u/ankita_12345
Skills & Tech Stack
Languages: TypeScript · **React**
Experience
Orange Health Labs Bengaluru Karnataka, India
Software Engineer 2 March 2024 - Present
- Built the TypeScript, **React** and **Next.js** booking flow.
Education
UIET, Panjab University Chandigarh, India
B.Tech - Computer Science and Engineering 2023
`

test('resume PDF stays on one page', () => {
  const pdf = buildResumePdf(sample)
  assert.equal(pdf.getNumberOfPages(), 1)
})

test('mashed header and job lines still fit on one page', () => {
  const pdf = buildResumePdf(mashed)
  assert.equal(pdf.getNumberOfPages(), 1)
})

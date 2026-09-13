# StudySnap

> Turn lecture material into focused revision notes and practice questions—without the noise.

StudySnap is a student-focused study workspace that turns course material into a clearer revision flow. Add lecture PDFs, DOCX files, or slides, choose how you want to revise, and build a study pack with concise notes, source evidence, and five practice questions.

## Why StudySnap?

Most students do not need another overwhelming productivity dashboard. They need a fast way to turn dense lecture material into something they can actually revise.

StudySnap is built around one focused flow:

```text
Lecture material → Focus selected content → Revision notes + 5 questions → Review and return
```

## Features

- Multi-file study packs: combine PDFs, DOCX files, and PPTX slides
- Local-first document reading: original source files are processed in the browser
- Subject, note-style, and difficulty preferences
- Revision notes with source references
- Exactly five practice questions from the same material
- Evidence Mode for tracing notes back to source material
- Review Next flags for difficult concepts and questions
- Quick Recall mode for a focused five-question review
- Supabase authentication with email/password and Google sign-in
- Personal study library for saved study packs
- Light, Matte Black, AMOLED, and System themes
- Responsive design for desktop and mobile

## Current status

StudySnap is actively being built for a hackathon.

| Area                         | Status      |
| ---------------------------- | ----------- |
| Landing page and themes      | Complete    |
| Supabase authentication      | Complete    |
| Dynamic study-library states | Complete    |
| Multi-file import interface  | In progress |
| Local document extraction    | In progress |
| AI-generated notes and quiz  | In progress |
| Save/export study packs      | Planned     |

## Tech stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- Supabase Auth and Postgres
- Google Gemini API
- Vercel AI SDK
- PDF.js for PDF text extraction
- Mammoth for DOCX parsing
- JSZip for PPTX text extraction
- IndexedDB for temporary local study drafts

## Privacy approach

StudySnap is designed to avoid storing original lecture files.

- Original PDFs, DOCX files, and PPTX files are read in the browser.
- Original source-file binaries are not stored in Supabase.
- Only generated study-pack content is intended to be saved when a signed-in user explicitly chooses to save it.
- AI generation sends selected extracted text—not original file binaries—to the configured AI provider.

> Always review generated content against your original course material.

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/Pranjalbudaniya/studysnap.git
cd studysnap
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

Never commit `.env.local`.

### 4. Configure Supabase

Create a Supabase project, then add its Project URL and Publishable Key to `.env.local`.

Run the SQL migration found in:

```text
supabase/migrations/202609130001_create_study_packs.sql
```

Use **Supabase Dashboard → SQL Editor → New query**, paste the contents of the migration file, and run it.

For local authentication, add these to **Supabase → Authentication → URL Configuration**:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/auth/callback
```

### 5. Optional: enable Google sign-in

In Supabase:

```text
Authentication → Providers → Google
```

Create a Google OAuth Web Client in Google Cloud Console, then add the callback URL displayed in Supabase to Google’s allowed redirect URIs.

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project flow

```text
Landing page
   ↓
Sign in or continue as guest
   ↓
Study workspace
   ↓
Create a study pack
   ↓
Add and focus lecture material
   ↓
Generate notes and five practice questions
   ↓
Review, recall, save, and export
```

## Themes

StudySnap supports four appearance modes:

- Light
- Matte Black
- AMOLED
- System

## Roadmap

- [ ] Complete local PDF, DOCX, and PPTX extraction
- [ ] Connect Gemini-powered structured generation
- [ ] Save completed study packs
- [ ] Export notes as Markdown, text, and print-friendly PDF
- [ ] Add production rate limiting and error monitoring
- [ ] Deploy to Vercel

## Contributing

This is currently a hackathon project, but suggestions and issues are welcome.

1. Fork the repository.
2. Create a branch.
3. Make your changes.
4. Open a pull request.

## License

Add a license before public release.

---

Built for focused study, one lecture at a time.

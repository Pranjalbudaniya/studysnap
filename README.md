# StudySnap

> Turn lecture material into focused revision notes and practice questions—without the noise.

StudySnap is a student-focused study workspace that turns course material into a clearer revision flow. Add lecture PDFs, DOCX files, or slides, choose how you want to revise, and build a study pack with concise notes, source evidence, and five practice questions powered by Google Gemini.

---

## Features

- **Multi-File Study Packs**: Combine PDFs, DOCX files, and PPTX slides into a single pack (up to 5 files).
- **Local-First Document Reading**: Original source files are parsed in the browser via PDF.js, Mammoth, and JSZip.
- **AI-Powered Synthesis**: Server-side Google Gemini (`gemini-3.6-flash`) generates structured revision notes and practice quizzes.
- **Strict Evidence Mode**: Trace notes and practice questions directly to verbatim quotes and source citations.
- **Active Recall Mode**: Interactive 5-question flashcard flip mode with confidence tracking.
- **Supabase Cloud Library**: Real database persistence with Row-Level Security (RLS).
- **Multiple Themes**: Light (Warm Ivory), Matte Black (Charcoal), and AMOLED (Pitch Black).

---

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & CSS Custom Properties
- **Database & Auth**: [Supabase](https://supabase.com/) (`@supabase/ssr`, `@supabase/supabase-js`)
- **AI Engine**: Google Gemini via [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/google`, `zod`)
- **Document Parsing**: `pdfjs-dist`, `mammoth`, `jszip`

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/) API Key

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

### Database Migration

Run the migration script in `supabase/migrations/202609130001_create_study_packs.sql` in your Supabase SQL Editor.

### Installation & Local Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start revising.

### Supabase Authentication & URL Configuration

To ensure confirmation emails and password reset links route to your live deployment rather than `localhost`:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) -> **Authentication** -> **URL Configuration**.
2. **Site URL**: Set to your production domain (e.g. `https://your-app.vercel.app` or `https://studysnap.onrender.com`).
3. **Redirect URLs**: Add both your production and local paths:
   - `https://your-app.vercel.app/**`
   - `http://localhost:3000/**`
4. *(Recommended for deliverability)*: Under **Authentication** -> **SMTP Settings**, configure custom SMTP (e.g. Resend, SendGrid) to bypass Supabase's default rate limits.

---

## Deployment

### Deploy on Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com/new) and import the repository.
3. Configure the Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-app.vercel.app`)
   - `GOOGLE_GENERATIVE_AI_API_KEY`
4. Click **Deploy**.

### Deploy on Render

1. Create a **Web Service** on [render.com](https://render.com).
2. Connect this repository.
3. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Add the same Environment Variables under the **Environment** tab:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `https://studysnap.onrender.com`)
   - `GOOGLE_GENERATIVE_AI_API_KEY`


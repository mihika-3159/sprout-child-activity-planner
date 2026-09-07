# Sprout — Evidence-Grounded Child Activity Planner

Sprout is a thoughtful, privacy-first web application that creates tailored, screen-free activity schedules for children aged 2–10. Grounded in peer-reviewed child development science, Sprout designs engaging, developmentally balanced routines using materials families already have at home.

---

## What the Application Does

- **Evidence-Informed Activity Generation**: Generates 7-day, monthly, or yearly screen-free routines where every activity targets verified developmental milestones (fine motor skills, executive function, spatial reasoning, emotional regulation, and numeracy).
- **Zero-Waste / At-Home Materials**: Parents specify what they have available (cardboard, paper, crayons, pegs, string, tape, etc.), ensuring activities require no expensive supplies.
- **Parent-Controlled Involvement**: Supports schedules customized to the parent's available time—from quick setup with independent child play to collaborative parent-child projects.
- **Scientific Evidence Transparency**: Every activity cites open-access scientific literature (PMC Open Access, NIH, CDC) explaining the developmental benefit and research context.
- **Smart Adaptations**: Each activity includes an "easier" variation for younger siblings or beginners and an "extension" challenge.
- **Instant Printable Export**: Families can download or print an elegant offline schedule with supply checklists, safety precautions, and step-by-step guidance.
- **Free Family Beta Access**: During the pilot testing phase, full activity plans are unlocked at zero cost.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Frontend**: React 19, TypeScript, Vanilla CSS design tokens with Tailwind CSS v4 utility support, [Lucide React](https://lucide.dev/) icons
- **AI Engine**: Google Gemini API (`gemini-2.0-flash-lite` via `@google/generative-ai` with structured output validation)
- **Security & Sessions**: Stateless encrypted JWT session cookies via [`jose`](https://github.com/panva/jose) (no third-party authentication or tracking cookies)
- **Storage Engine**: Zero-dependency lightweight file and serverless ephemeral storage engine (`data/app_store.json` / `/tmp`)
- **Payments / Beta Access**: Stripe sandbox integration with automatic free beta fallback (`MockPaymentProvider`)
- **Testing**: [Vitest](https://vitest.dev/) for unit & integration testing

---

## 🔒 Privacy & Data Protection Notice

> ### **IMPORTANT PRIVACY NOTE FOR FAMILIES AND TESTERS**
> **Please DO NOT submit personally identifiable information (PII) about yourself or your children.**
> 
> - **Do NOT enter**: Child names, exact birth dates, home addresses, school/nursery names, phone numbers, or emails into prompt fields.
> - **Only enter**: General age bands (e.g., *4–5 years*), child interests (e.g., *dinosaurs, space, painting*), and household supplies.
> 
> **How Your Data is Handled**:
> 1. **Anonymous Sessions**: Sprout does not require accounts, logins, or emails. Sessions are identified purely through an ephemeral, cryptographically signed anonymous session cookie.
> 2. **Client-Side & Server-Side Redaction**: Built-in privacy filters automatically detect and strip names, addresses, emails, and phone numbers before data is processed or passed to the AI model.
> 3. **No Persistent Tracking**: There are no tracking pixels, ad cookies, or third-party analytics scripts.
> 4. **Session Clearing**: Families can permanently erase their session data at any time by clicking the "Clear Session & Cache" button on the planner page.

---

## Getting Started Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v20.x or later
- npm v10.x or later
- A free [Google AI Studio API key](https://aistudio.google.com/) (for Gemini AI generation)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/sprout-child-activity-planner.git
   cd sprout-child-activity-planner
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` in your editor and add your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   SESSION_SECRET=a_random_32_character_secret_string_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run the automated test suite**:
   ```bash
   npm test
   ```

6. **Build for production locally**:
   ```bash
   npm run build
   npm run start
   ```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `GEMINI_API_KEY` | **Yes (Prod)** | *None* | Google Gemini API key from [Google AI Studio](https://aistudio.google.com/). Kept strictly server-side. |
| `SESSION_SECRET` | **Yes** | *None* | 32+ character random string used to sign anonymous session tokens. |
| `AI_PROVIDER` | No | `gemini` | Primary AI provider (`gemini` or `mock`). |
| `AI_MODEL` | No | `gemini-2.0-flash-lite` | Gemini model variant. |
| `AI_ALLOW_PAID_USAGE`| No | `false` | Prevents calls to paid models; keeps usage within free quotas. |
| `AI_FALLBACK_PROVIDER`| No | `mock` | Fallback provider if primary quota is exhausted. |
| `DATABASE_PATH` | No | `./data/app_store.json` | Path to storage JSON. On Vercel, defaults to `/tmp/app_store.json`. |
| `PRODUCT_CURRENCY` | No | `GBP` | Currency displayed for plans. |
| `PRODUCT_PRICE_*` | No | *Empty* | Leave empty/unconfigured for 100% free beta access. |
| `STRIPE_SECRET_KEY` | No | *Empty* | Leave empty to use built-in free sandbox checkout. |

---

## Deployment Guide

### Why Not GitHub Pages?

GitHub Pages is a static file host (HTML/CSS/JS only). Sprout utilizes Next.js App Router with server-side Route Handlers (`/api/...`) to keep your `GEMINI_API_KEY` secure, execute AI prompts server-side, issue encrypted JWT cookies, and manage rate limiting. Static hosting cannot run server code or protect private secrets.

### Recommended Free Host: **Vercel**

[Vercel](https://vercel.com) was created by the maintainers of Next.js and provides the simplest, zero-configuration free deployment for Next.js full-stack applications.

#### 1. Push to GitHub
```bash
git add .
git commit -m "feat: initial commit for Sprout Child Activity Planner"
git remote add origin https://github.com/<your-username>/sprout-child-activity-planner.git
git branch -M main
git push -u origin main
```

#### 2. Deploy on Vercel (1-Click Free Setup)
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New...** > **Project**.
3. Select your `sprout-child-activity-planner` repository and click **Import**.
4. In the **Environment Variables** section, add:
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `SESSION_SECRET`: A secure 32+ character random string (e.g. `sprout-production-session-secret-key-99881122`).
   - `AI_ALLOW_PAID_USAGE`: `false`
5. Click **Deploy**.
6. Within 60 seconds, Vercel will provide you with a live `https://sprout-child-activity-planner.vercel.app` URL that you can immediately send to families!

---

## Updating & Redeploying

Once linked to GitHub:
1. Make your changes locally and test them:
   ```bash
   npm test
   npm run build
   ```
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "fix: improve activity instruction clarity"
   git push origin main
   ```
3. Vercel will automatically build and deploy the update with zero downtime.

---

## License & Scientific Attribution

- Scientific evidence chunks are extracted from peer-reviewed open-access literature under Creative Commons Attribution (CC-BY 4.0) and Public Domain licenses from PMC Open Access, CDC, and NIH.
- Attribution records and reviewer rights verification are inspectable in the application under `/admin`.

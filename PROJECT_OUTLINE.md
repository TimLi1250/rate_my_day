# Rate My Day — Project Outline

## Product goal

Create a personal, installable web app for recording how each day went. The owner can give every calendar day a score from 1–10, see the year as a compact colour-coded history inspired by the supplied references, and save an optional note for the day.

## First release (MVP)

- On first launch, ask for the owner's name and birthday. Store this profile with the day entries and use the name in the greeting; birthday can support a small birthday highlight later.
- Use one private personal access code—rather than accounts, email, or third-party sign-in—to protect the single shared diary when it is opened from a new device.
- Show a **Year view by default**: a compact 31-row × 12-month grid that closely follows the visual scanning pattern in the reference image. Each column is a month and each row is a date; rated days show their score colour.
- Open a day by tapping/clicking its square to add or edit its score and optional comment. On a larger screen, the selected day's details can sit alongside the grid; on a phone, they open in a focused sheet.
- Include a secondary **Month view** optimized for phones, with easy previous/next-month controls.
- Select a day to add or edit:
  - a 1–10 rating,
  - an optional text comment,
  - save, clear, or delete the entry.
- Include a visible, fixed score legend. The palette will follow the supplied spreadsheet: red/orange for hard days, yellow in the middle, and progressively richer greens for great days. Score **1** is labelled “Worst” and score **10** is labelled “Best”; scores 2–9 use numbers only. Numeric scores remain available for accessibility.
- Let people revisit past dates and rate today. Unrated dates remain neutral.
- Work well on desktop and mobile, including dark-mode-aware styling.

## Deliberately outside the first release

- Accounts, email/social sign-in, friends, and public profiles.
- Multiple ratings or structured journals per day.
- Analytics, reminders, export/import, and offline write-sync (good follow-up features).

## Recommended technical approach

| Area | Choice | Why |
| --- | --- | --- |
| Web app | Next.js + TypeScript | Reliable Vercel deployment, responsive UI, and room to grow. |
| Styling | Tailwind CSS + a small reusable component set | Fast custom visual design without spreadsheet-like limitations. |
| Data | Neon Postgres, connected through the Vercel Marketplace | Durable cloud storage that the Vercel app can access from any device. |
| Data access | Server-side Next.js routes + one personal access code | Keeps database credentials off the device without introducing user accounts. |
| Hosting | Vercel | Git-based preview deployments and simple production hosting. |
| Installability | PWA manifest, icons, service worker | Users can add it to an iPhone/Android home screen or install it on desktop. |

## Data model

`profile` (one cloud-stored profile)

- `name` — owner's preferred display name
- `birthday` — optional month and day

`day_entries` (cloud-stored)

- `id` — unique entry ID
- `entry_date` — calendar date in the user's chosen timezone
- `score` — integer from 1 to 10
- `comment` — optional text
- `created_at`, `updated_at`

There is at most one entry per calendar date. The app reads and writes the shared personal diary through protected server routes, so the same information appears on every device.

### Privacy approach

The app has no user accounts or third-party login. On a new device, it asks for one strong personal access code selected during setup; the browser can remember it for convenient later visits. This small protection is necessary because Vercel hosts a public website—without it, anyone who discovers the URL could read or overwrite entries. The database connection itself remains server-side and is never shipped to the browser.

A simple JSON **export** remains available as an optional personal backup.

## Experience and visual direction

- Keep the visual language warm and playful, taking cues from both supplied images: the grid-led annual tracker, handwritten-feeling title treatment, and friendly rating legend. We will use original UI assets rather than copying the reference illustration.
- The main screen is the annual grid; on a large screen it should make a whole year scannable at a glance.
- On a phone, prioritize quick daily entry: tap a date, choose a score, write a note, save.
- Use clear labels and numeric scores alongside colour so information is never conveyed by colour alone.

## Delivery milestones

1. **Project foundation** — Initialize the Next.js project, configure TypeScript, styling, linting, and the initial responsive shell.
2. **Calendar UI** — Build the year/month views, score legend, and a polished day-entry editor using temporary local data.
3. **Cloud persistence and privacy** — Provision Neon Postgres through Vercel, create the profile/entry schema, and connect protected server routes so the same diary works from every device. Add JSON export as an optional backup.
4. **PWA support** — Add manifest, icons, install prompt guidance, and offline caching for the app shell.
5. **Quality pass** — Test important flows on desktop and phone layouts, accessibility, empty/error states, and timezone/date handling.
6. **Production launch** — Create a Git repository scoped to this folder, connect it to Vercel, provision and connect its Neon database integration, deploy, and verify the production URL and home-screen installation.

## Deployment setup needed later

- A GitHub account/repository for this project.
- A Vercel account (free tier is sufficient to start).
- A Neon database created through the Vercel Marketplace (a free plan is sufficient to start). Vercel connects its credentials to the deployed project as environment variables.

No credentials are needed until the deployment milestone. The personal access code and database connection details will never be committed to the repository.

## Decisions to confirm before implementation

- The score labels are fixed: **1 = Worst**, **10 = Best**, and **2–9 have no labels**. The visual palette is fixed from difficult (1) to excellent (10).

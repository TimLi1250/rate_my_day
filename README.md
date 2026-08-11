# Rate My Day

A private, installable year-at-a-glance diary. Pick a 1–10 score for each day, add a note if you want to remember it, and see the year fill with colour.

## What is included

- A responsive 12-month tracker inspired by the supplied references.
- Fixed colour scale: **1 = Worst**, **10 = Best**, and scores 2–9 are numeric only.
- A first-run name and optional birthday setup.
- Day editor with rating, note, update, and clear actions.
- A single personal access code instead of accounts or social sign-in.
- Neon Postgres storage, accessed only by server-side routes so entries work on every device.
- A web app manifest and service worker for home-screen installation.

## Run it locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Neon Postgres database and copy its connection string. Then copy `.env.example` to `.env.local` and fill in both values:

   ```env
   DATABASE_URL=your-neon-connection-string
   RATE_MY_DAY_ACCESS_CODE=a-long-private-code-you-will-remember
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

The tables are created automatically the first time the app successfully opens. Use your access code on the first device, then add your name and optional birthday.

## Deploy to Vercel

1. Put this folder in a GitHub repository and import that repository into Vercel.
2. In the Vercel project, open **Marketplace**, install the **Neon** integration, create a database, and connect it to the project. Vercel adds the connection credentials as environment variables.
3. In [**Settings → Environment Variables**](https://vercel.com/dashboard), open your new project, then add `RATE_MY_DAY_ACCESS_CODE` for Production, Preview, and Development. Use a long, private value. Once the project exists, its direct URL will be `https://vercel.com/<your-team>/<your-project>/settings/environment-variables`.
4. Deploy. Open the resulting URL and enter the same personal code to set up or access your diary.

Do not expose the access code or commit `.env.local`. It is the lightweight protection for your personal diary; without it, anyone who discovers the site URL could attempt to read or change entries.

## Install on a phone

After deployment, open the site in Safari on iPhone and use **Share → Add to Home Screen**, or open it in Chrome on Android and choose **Install app** / **Add to Home screen**. It will open as a standalone app.

## Check before deploying

```bash
npm run typecheck
npm run build
```

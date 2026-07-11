This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Mobile Apps

This project includes Capacitor wrappers for Android and iOS. The mobile shells load the
existing Next.js app from `CAPACITOR_SERVER_URL`.

For local testing, start the web app first:

```bash
npm run dev
```

Then sync the native projects with the URL for the web app:

```powershell
$env:CAPACITOR_SERVER_URL="http://localhost:3000"
npm run mobile:sync
```

For Android emulators, use `http://10.0.2.2:3000` instead of `localhost`. For release
builds, point Capacitor at the deployed HTTPS site before syncing:

```powershell
$env:CAPACITOR_SERVER_URL="https://your-production-domain.example"
npm run mobile:sync
```

Open the native projects with:

```bash
npm run mobile:android
npm run mobile:ios
```

Android builds can be produced from Android Studio. iOS builds require Xcode on macOS.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

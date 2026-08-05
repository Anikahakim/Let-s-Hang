# Let's Hang

Live app: [let-s-hang-gray.vercel.app](https://let-s-hang-gray.vercel.app)

A friend-scheduling web app. Add friends, mark your availability, and see where your free time overlaps with theirs, then turn that overlap into an actual event with one click.

## Features

- **Auth** — email/password login, onboarding flow, and password reset, all via Supabase
- **Friends** — send and accept friend requests, view your friends list
- **Availability** — mark your free time on a calendar grid; event titles persist in localStorage so they survive a page reload
- **Match** — once availability overlaps with a friend's, schedule an event directly, download it as an `.ics` file, and trigger an email notification to everyone involved
- **Calendar legend** — see event names at a glance across the shared calendar view
- Responsive, colorful UI built for both desktop and mobile

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript |
| Auth, database | Supabase |
| Calendar export | `.ics` generation for downloadable/importable events |

## Project structure

```
app/
├── (app)/
│   ├── dashboard/       # landing view after login
│   ├── friends/         # friend requests + friends list
│   ├── availability/    # mark and view free time
│   └── match/           # overlapping availability → scheduled event, ICS + email
├── login/
├── onboarding/
├── reset-password/
lib/
└── supabaseClient.ts
```

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project

### Setup

```
git clone <your-repo-url>
cd lets-hang
npm install
```

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the dev server:

```
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

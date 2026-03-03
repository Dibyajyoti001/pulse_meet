# PulseMeet (React + Supabase) — 1:1 WebRTC Video + Chat (Resume-Grade)

This is a production-style 1:1 video + chat app:
- React (Vite) + TypeScript + Tailwind
- Supabase Auth (email/password) + Postgres (rooms, participants, chat)
- Supabase Realtime for:
  - presence (who's in room)
  - signaling (offer/answer/ICE broadcast) — no extra signaling server
  - realtime chat updates (postgres changes)

## 0) Requirements
- Node 18+
- A Supabase project

## 1) Supabase setup (SQL + RLS)
In Supabase dashboard → SQL Editor, run:
- `supabase/schema.sql`

Then in Authentication:
- Enable Email/Password
- (Optional) configure email confirmations

## 2) Configure env
Copy `.env.example` → `.env.local` and set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 3) Install + run
```bash
npm install
npm run dev
```

Open: http://localhost:5173

## 4) How to use
- Register / login
- Create a room → share the link
- Both users join → one auto-initiates WebRTC (deterministic initiator)
- Video + chat runs, with reconnection hints and device toggles

## Notes on reliability
- Uses STUN by default. Some enterprise/mobile networks require a TURN server for 100% reliability.
- The code is structured so adding TURN is a one-line change in `src/webrtc/rtc.ts` (iceServers).

## Project structure
- `src/pages/*` routes
- `src/lib/supabase.ts` client
- `src/webrtc/*` WebRTC + signaling utilities
- `supabase/schema.sql` database schema + RLS

---
If you want "guest join without login", you must redesign RLS (recommended only after the authenticated version is solid).

import React from "react";
import { Link } from "react-router-dom";
import Shell from "../components/Shell";
import { Button, Card } from "../components/Ui";

export default function Landing() {
  return (
    <Shell>
      <div className="grid gap-4 md:grid-cols-2 items-start">
        <Card className="p-6">
          <div className="text-sm text-emerald-300/90 font-semibold">Production-style WebRTC app</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            PulseMeet — secure 1:1 video + chat
          </h1>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Built with React + Supabase + WebRTC. Real auth, real database, realtime signaling & presence.
            Clean UI, fast interactions, and a backend you can justify in interviews.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/auth"><Button variant="primary">Get started</Button></Link>
            <Link to="/app"><Button>Open dashboard</Button></Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-300 font-semibold">What you can demo in 60 seconds</div>
          <ul className="mt-3 space-y-2 text-slate-300">
            <li>• Create room → share link → join → auto-connect WebRTC</li>
            <li>• Presence: see when the other user arrives</li>
            <li>• Device switch (cam/mic) and mic/cam toggles</li>
            <li>• Persisted chat with realtime updates</li>
            <li>• RLS policies: only participants can read/write</li>
          </ul>
          <div className="mt-4 text-xs text-slate-400">
            Tip: deploy over HTTPS for camera/mic (Vercel recommended).
          </div>
        </Card>
      </div>
    </Shell>
  );
}

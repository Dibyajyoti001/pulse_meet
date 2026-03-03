import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import Shell from "../components/Shell";
import { Badge, Button, Card, Input } from "../components/Ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/auth";
import type { Room } from "../types";

export default function Dashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("1:1 Session");
  const inviteBase = useMemo(() => window.location.origin, []);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setRooms((data as Room[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function createRoom() {
    if (!user) return;
    const slug = nanoid(10).toLowerCase();
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        slug,
        title: title.trim() || "1:1 Session",
        visibility: "link",
        owner_id: user.id,
      })
      .select("*")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    // Make owner participant
    const { error: e2 } = await supabase
      .from("room_participants")
      .insert({ room_id: (room as any).id, user_id: user.id, role: "owner" });

    if (e2) {
      alert(e2.message);
      return;
    }

    nav(`/room/${(room as any).slug}`);
  }

  return (
    <Shell>
      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <Card className="lg:col-span-1 p-6">
          <div className="text-sm text-slate-400">Create a room</div>
          <div className="mt-2 text-xl font-extrabold">Start a session</div>
          <div className="mt-3 space-y-3">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button variant="primary" className="w-full" onClick={createRoom}>
              Create + join
            </Button>
            <div className="text-xs text-slate-400">
              Rooms are link-based. Share the URL with one person.
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-400">Your rooms</div>
              <div className="text-xl font-extrabold">Recent sessions</div>
            </div>
            <Badge>Auth + RLS protected</Badge>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="text-slate-300">Loading…</div>
            ) : rooms.length === 0 ? (
              <div className="text-slate-300">No rooms yet. Create one.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {rooms.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-700/35 bg-slate-950/30 p-4">
                    <div className="font-bold">{r.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link to={`/room/${r.slug}`}><Button variant="primary">Open</Button></Link>
                      <Button
                        onClick={() => navigator.clipboard.writeText(`${inviteBase}/room/${r.slug}`)}
                      >
                        Copy link
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 mono">
                      /room/{r.slug}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Shell from "../components/Shell";
import { Badge, Button, Card, Select } from "../components/Ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/auth";
import { fmtTime } from "../lib/ui";
import type { Message, Room } from "../types";
import { getMedia, listDevices, makePeerConnection } from "../webrtc/rtc";
import {
  joinRoomChannel,
  onPresenceSync,
  onSignal,
  sendSignal,
  trackPresence,
} from "../webrtc/signaling";

type ConnState = "idle" | "connecting" | "connected" | "error";

function isDupKeyErr(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  // PostgREST duplicate key usually includes "duplicate key value" or "23505"
  return msg.includes("duplicate") || msg.includes("23505");
}

function isMediaBusyErr(err: any) {
  const name = String(err?.name ?? "");
  const msg = String(err?.message ?? "");
  return (
    name === "NotReadableError" || // device in use
    msg.toLowerCase().includes("device in use")
  );
}

export default function RoomPage() {
  const nav = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<ConnState>("idle");
  const [hint, setHint] = useState<string>("");
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);

  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const otherUserId = useMemo(
    () => peerIds.find((id) => id !== user?.id) ?? null,
    [peerIds, user?.id]
  );

  const isInitiator = useMemo(() => {
    if (!user?.id || !otherUserId) return false;
    // deterministic initiator to avoid both creating offer
    return user.id < otherUserId;
  }, [user?.id, otherUserId]);

  // Load room + messages
  useEffect(() => {
    if (!slug) return;

    (async () => {
      setHint("");
      setRoom(null);

      const { data: r, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        alert(error.message);
        nav("/app");
        return;
      }
      if (!r) {
        alert("Room not found (or you don't have access).");
        nav("/app");
        return;
      }

      setRoom(r as Room);

      // Load recent messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", (r as any).id)
        .order("created_at", { ascending: true })
        .limit(200);

      setMessages((msgs as any) ?? []);

      
      const sub = supabase
        .channel(`db:messages:${(r as any).id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${(r as any).id}` },
          (payload) => {
            const m = payload.new as any as Message;
            setMessages((prev) => [...prev, m]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sub);
      };
    })();
  }, [slug, nav]);

  
  useEffect(() => {
    (async () => {
      try {
        const preview = await getMedia();
        preview.getTracks().forEach((t) => t.stop());
      } catch {
        // user may grant later
      }

      const { cams, mics } = await listDevices();
      setCams(cams);
      setMics(mics);

      if (!camId && cams[0]?.deviceId) setCamId(cams[0].deviceId);
      if (!micId && mics[0]?.deviceId) setMicId(mics[0].deviceId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  useEffect(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const v = s.getVideoTracks()[0];
    if (v) v.enabled = camOn;
    const a = s.getAudioTracks()[0];
    if (a) a.enabled = micOn;
  }, [camOn, micOn]);

  async function ensureParticipantRow() {
    if (!user || !room) return;

    
    const { error } = await supabase.from("room_participants").insert({
      room_id: room.id,
      user_id: user.id,
      role: "member",
    });

    if (error && !isDupKeyErr(error)) {
      // This is the real reason join fails (RLS/policy)
      throw error;
    }
  }

  async function join() {
    if (!slug || !user || !room) return;

    setHint("");
    setState("connecting");

   
    try {
      await ensureParticipantRow();
    } catch (e: any) {
      setState("error");
      setHint(`Join blocked by DB policy: ${e?.message ?? "unknown error"}`);
      return;
    }

    
    const ch = await joinRoomChannel(supabase as any, slug, user.id);
    channelRef.current = ch;

    onPresenceSync(ch, (ids) => {
      setPeerIds(ids);
      if (ids.length > 2) setHint("More than 2 users detected. This build is 1:1 by design.");
    });

    onSignal(ch, async (sig: any) => {
      if (!user) return;
      if (sig.from === user.id) return;

      const pc = pcRef.current;
      if (!pc) return;

      try {
        if (sig.t === "offer") {
          await pc.setRemoteDescription(sig.sdp);
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          await sendSignal(ch, { t: "answer", sdp: ans, from: user.id });
        } else if (sig.t === "answer") {
          await pc.setRemoteDescription(sig.sdp);
        } else if (sig.t === "ice") {
          if (sig.candidate) await pc.addIceCandidate(sig.candidate);
        } else if (sig.t === "hangup") {
          hangup(false);
        }
      } catch (e: any) {
        setState("error");
        setHint(e?.message ?? "Signaling error");
      }
    });

    await trackPresence(ch, user.id);

    const pc = await makePeerConnection();
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setState("connected");
      else if (s === "connecting" || s === "new") setState("connecting");
      else if (s === "failed" || s === "disconnected") {
        setHint("Connection unstable. If this persists on your network, you may need TURN.");
      }
    };

    pc.onicecandidate = async (e) => {
      if (e.candidate && channelRef.current) {
        await sendSignal(channelRef.current, { t: "ice", candidate: e.candidate.toJSON(), from: user.id });
      }
    };

   
    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    };

   
    let stream: MediaStream | null = null;
    try {
      stream = await getMedia({ videoId: camId || undefined, audioId: micId || undefined });
    } catch (e: any) {
      // Do not block join
      if (isMediaBusyErr(e)) {
        setHint("Camera/Mic is in use. Joined as viewer (receive-only).");
      } else {
        setHint(`Media unavailable. Joined as viewer. (${e?.name ?? "error"})`);
      }
      stream = null;
      // receive-only transceivers so offers include receiving tracks
      try {
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
      } catch {
        // ignore: older browsers may behave differently
      }
      setCamOn(false);
      setMicOn(false);
    }

    if (stream) {
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn));

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    } else {
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    }

    setJoined(true);

    // If peer already present, initiator can start offer
    setTimeout(async () => {
      if (isInitiator && otherUserId && channelRef.current) {
        await makeOffer();
      }
    }, 150);
  }

  // when peer arrives, initiator makes offer
  useEffect(() => {
    (async () => {
      if (!joined) return;
      if (!channelRef.current) return;
      if (!pcRef.current) return;

      if (isInitiator && otherUserId && pcRef.current.signalingState === "stable") {
        await makeOffer();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, isInitiator, otherUserId]);

  async function makeOffer() {
    const userId = user?.id;
    const ch = channelRef.current;
    const pc = pcRef.current;
    if (!userId || !ch || !pc) return;
    if (peerIds.length < 2) return;

    try {
      setState("connecting");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(ch, { t: "offer", sdp: offer, from: userId });
    } catch (e: any) {
      setState("error");
      setHint(e?.message ?? "Offer failed");
    }
  }

  async function hangup(send = true) {
    const ch = channelRef.current;
    const u = user?.id;

    try {
      if (send && ch && u) await sendSignal(ch, { t: "hangup", from: u });
    } catch {}

    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;

    try {
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    remoteStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setJoined(false);
    setPeerIds([]);
    setState("idle");
    setHint("");
  }

  async function toggle(kind: "cam" | "mic") {
    if (kind === "cam") setCamOn((v) => !v);
    else setMicOn((v) => !v);
  }

  async function switchDevice(kind: "cam" | "mic", deviceId: string) {
    const pc = pcRef.current;
    const stream = localStreamRef.current;

    // If we joined as viewer/no media, just remember selection.
    if (!stream) {
      if (kind === "cam") setCamId(deviceId);
      else setMicId(deviceId);
      setHint("No local media active. Free your camera/mic and re-join to publish.");
      return;
    }

    // Create new stream with selected device, then replace track
    const newStream = await getMedia({
      videoId: kind === "cam" ? deviceId : camId || undefined,
      audioId: kind === "mic" ? deviceId : micId || undefined,
    });

    const newTrack = kind === "cam" ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];
    if (!newTrack) return;

    // carry enable states
    if (kind === "cam") newTrack.enabled = camOn;
    else newTrack.enabled = micOn;

    const oldTrack = kind === "cam" ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
    if (oldTrack) oldTrack.stop();

    stream.removeTrack(oldTrack);
    stream.addTrack(newTrack);

    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    if (pc) {
      const sender = pc
        .getSenders()
        .find((s) => s.track?.kind === (kind === "cam" ? "video" : "audio"));
      if (sender) await sender.replaceTrack(newTrack);
    }

    // stop unused tracks from newStream
    newStream.getTracks().forEach((t) => {
      if (t !== newTrack) t.stop();
    });

    if (kind === "cam") setCamId(deviceId);
    else setMicId(deviceId);
  }

  async function sendMsg() {
    if (!user || !room) return;
    const text = msgText.trim();
    if (!text) return;

    setMsgText("");
    const { error } = await supabase.from("messages").insert({
      room_id: room.id,
      sender_id: user.id,
      body: text,
    });

    if (error) setHint(error.message);
  }

  const badge =
    state === "connected" ? (
      <Badge>Connected</Badge>
    ) : state === "connecting" ? (
      <Badge>Connecting…</Badge>
    ) : state === "error" ? (
      <Badge>Error</Badge>
    ) : (
      <Badge>Lobby</Badge>
    );

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-slate-400">Room</div>
          <div className="text-2xl font-extrabold">{room?.title ?? "…"}</div>
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            {badge}
            <Badge>Presence: {peerIds.length}/2</Badge>
            <Badge>
              Slug: <span className="mono">{slug}</span>
            </Badge>
          </div>
          {hint && <div className="mt-2 text-sm text-amber-200/90">{hint}</div>}
        </div>

        <div className="flex gap-2">
          <Button onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy link</Button>
          <Button variant="danger" onClick={() => nav("/app")}>
            Exit
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3 items-start">
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-extrabold">Call</div>
            <div className="flex gap-2">
              {!joined ? (
                <Button variant="primary" onClick={join}>
                  Join
                </Button>
              ) : (
                <Button variant="danger" onClick={() => hangup(true)}>
                  Hang up
                </Button>
              )}
              <Button onClick={() => toggle("mic")}>{micOn ? "Mic: On" : "Mic: Off"}</Button>
              <Button onClick={() => toggle("cam")}>{camOn ? "Cam: On" : "Cam: Off"}</Button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/35 bg-slate-950/30 overflow-hidden">
              <div className="px-3 py-2 text-xs text-slate-300 border-b border-slate-700/25">You</div>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover bg-black"
              />
            </div>
            <div className="rounded-2xl border border-slate-700/35 bg-slate-950/30 overflow-hidden">
              <div className="px-3 py-2 text-xs text-slate-300 border-b border-slate-700/25">Peer</div>
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video object-cover bg-black" />
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Select label="Camera" value={camId} onChange={(e) => switchDevice("cam", e.target.value)}>
              {cams.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || "Camera"}
                </option>
              ))}
            </Select>
            <Select label="Microphone" value={micId} onChange={(e) => switchDevice("mic", e.target.value)}>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || "Microphone"}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-3 text-xs text-slate-400">
            Initiator: <span className="mono">{isInitiator ? "you" : "peer"}</span>
            {" • "}Connection: <span className="mono">{pcRef.current?.connectionState ?? "—"}</span>
          </div>
        </Card>

        <Card className="lg:col-span-1 p-4">
          <div className="font-extrabold">Chat</div>
          <div className="mt-2 h-[360px] overflow-auto rounded-2xl border border-slate-700/35 bg-slate-950/30 p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  "mb-2 rounded-2xl border px-3 py-2 " +
                  (m.sender_id === user?.id
                    ? "border-emerald-400/25 bg-emerald-400/10"
                    : "border-slate-700/30 bg-slate-900/20")
                }
              >
                <div className="text-xs text-slate-400 flex justify-between gap-2">
                  <span className="mono">{m.sender_id === user?.id ? "You" : "Peer"}</span>
                  <span>{fmtTime(m.created_at)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-100 whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMsg();
                }
              }}
              placeholder="Type…"
              className="flex-1 rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-400/35"
            />
            <Button variant="primary" onClick={sendMsg}>
              Send
            </Button>
          </div>

          <div className="mt-2 text-xs text-slate-400">Messages are stored in Postgres + streamed via realtime DB changes.</div>
        </Card>
      </div>
    </Shell>
  );
}
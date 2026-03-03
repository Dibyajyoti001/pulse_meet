import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type Signal =
  | { t: "offer"; sdp: RTCSessionDescriptionInit; from: string }
  | { t: "answer"; sdp: RTCSessionDescriptionInit; from: string }
  | { t: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { t: "hangup"; from: string };

export async function joinRoomChannel(supabase: SupabaseClient, roomSlug: string, userId: string) {
  const channel = supabase.channel(`room:${roomSlug}`, {
    config: {
      broadcast: { self: false },
      presence: { key: userId },
    }
  });

  await channel.subscribe((status) => {
    // handled in caller if needed
  });

  return channel;
}

export async function trackPresence(channel: RealtimeChannel, userId: string) {
  await channel.track({ userId, at: Date.now() });
}

export function onPresenceSync(channel: RealtimeChannel, cb: (ids: string[]) => void) {
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const ids = Object.keys(state);
    cb(ids);
  });
}

export function onSignal(channel: RealtimeChannel, cb: (sig: Signal) => void) {
  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    cb(payload as Signal);
  });
}

export async function sendSignal(channel: RealtimeChannel, sig: Signal) {
  await channel.send({ type: "broadcast", event: "signal", payload: sig });
}

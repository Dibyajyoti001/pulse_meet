async function fetchIceServers(): Promise<RTCIceServer[]> {
  const fallback: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  const enableTurn = (import.meta.env.VITE_ENABLE_TURN ?? "0") === "1";
  if (!enableTurn) return fallback;

  try {
    const res = await fetch("/api/turn");
    if (!res.ok) return fallback;

    const servers = (await res.json()) as RTCIceServer[] | null;
    if (!servers || !Array.isArray(servers) || servers.length === 0) return fallback;

    return servers;
  } catch {
    return fallback;
  }
}

export async function makePeerConnection() {
  const iceServers = await fetchIceServers();

  return new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 4,
  });
}
export async function getMedia(devices?: { videoId?: string; audioId?: string }) {
  const constraints: MediaStreamConstraints = {
    video: devices?.videoId ? { deviceId: { exact: devices.videoId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: devices?.audioId ? { deviceId: { exact: devices.audioId } } : true,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function listDevices() {
  const d = await navigator.mediaDevices.enumerateDevices();
  return {
    cams: d.filter(x => x.kind === "videoinput"),
    mics: d.filter(x => x.kind === "audioinput"),
  };
}

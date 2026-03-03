export function makePeerConnection() {
  // NOTE: Add TURN here if you want 100% reliability on strict NATs.
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302"] },
      { urls: ["stun:stun1.l.google.com:19302"] },
    ],
    iceCandidatePoolSize: 4,
  });
  return pc;
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

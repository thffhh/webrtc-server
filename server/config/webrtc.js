import { buildIceServers, getRtcConfig, EXTERNAL_APIS } from './masterApiHub.js';

export const setupWebRTC = (server, io) => {
  const studioNS = io.of('/studio');
  const iceServers = buildIceServers();
  console.log(`🌐 ICE servers loaded: ${iceServers.length} (${iceServers.filter(s => s.urls?.includes('turn:')).length} TURN)`);

  studioNS.on('connection', (socket) => {
    socket.on('webrtc:get-ice-config', ({ studioId }) => {
      if (!socket.data?.studioId || socket.data.studioId !== studioId) return socket.emit('error', { message: 'Invalid session' });
      socket.emit('webrtc:ice-config', { iceServers, rtcConfig: getRtcConfig(), codecPreferences: EXTERNAL_APIS.WEBRTC.codecs, fallbackEnabled: true });
    });

    const relay = (event, { studioId, from, to, offer, answer, candidate }) => {
      if (!socket.data?.studioId || socket.data.studioId !== studioId) return;
      const payload = { from: socket.data.userId, timestamp: new Date().toISOString() };
      if (offer) payload.offer = offer;
      if (answer) payload.answer = answer;
      if (candidate) payload.candidate = candidate;
      socket.to(studioId).to(to).emit(`${event}-received`, payload);
    };

    socket.on('webrtc:offer', (data) => relay('webrtc:offer', data));
    socket.on('webrtc:answer', (data) => relay('webrtc:answer', data));
    socket.on('webrtc:ice', (data) => relay('webrtc:ice', data));

    socket.on('audio:mute-toggle', ({ studioId, userId, isMuted }) => {
      if (socket.data?.studioId !== studioId) return;
      socket.to(studioId).emit('audio:mute-status', { userId, isMuted, timestamp: new Date().toISOString() });
    });

    socket.on('audio:fallback-request', ({ studioId, userId, reason }) => {
      socket.to(studioId).emit('audio:fallback-activated', { userId, reason, timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => console.log(`❌ WebRTC signaling disconnected: ${socket.id}`));
  });

  return { getIceServers: () => iceServers };
};

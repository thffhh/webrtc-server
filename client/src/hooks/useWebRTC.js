import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import { useSocket } from './useSocket';

export const useWebRTC = ({ studioId, role, userId, targetUserId, onStreamReady, onError, onConnectionChange }) => {
  const { socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const iceConfigRef = useRef(null);

  useEffect(() => {
    if (!socket || !studioId) return;
    socket.emit('webrtc:get-ice-config', { studioId });
    const handler = (config) => { iceConfigRef.current = config; console.log('🌐 ICE config received'); };
    socket.on('webrtc:ice-config', handler);
    return () => socket.off('webrtc:ice-config', handler);
  }, [socket, studioId]);

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 }, video: false });
      streamRef.current = stream;
      if (isMuted) stream.getAudioTracks().forEach(t => t.enabled = false);
      return stream;
    } catch (e) { onError?.({ type: 'MIC_ERROR', message: e.message }); throw e; }
  }, [isMuted, onError]);

  const createPeer = useCallback((initiator, target) => {
    if (!iceConfigRef.current) return null;
    const { iceServers, rtcConfig, codecPreferences } = iceConfigRef.current;
    const peer = new Peer({
      initiator, trickle: true, config: rtcConfig, iceConfig: iceServers,
      sdpTransform: (sdp) => {
        let mod = sdp;
        mod = mod.replace(/a=rtpmap:(\d+) opus\/48000\/2\r\n/g, (m, pt) => {
          const o = codecPreferences?.audio?.options?.opus || {};
          return `a=rtpmap:${pt} opus/48000/2\r\na=fmtp:${pt} minptime=${o.minptime||10};useinbandfec=${o.useinbandfec||1};maxaveragebitrate=${o.maxaveragebitrate||510000};stereo=${o.stereo||0};dtx=${o.dtx||1}\r\n`;
        });
        return mod.replace(/m=video.*?(\r\n|\n){2}/gs, '');
      },
      offerOptions: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      stream: initiator ? (streamRef.current || null) : null
    });

    peer.on('signal', (data) => {
      const type = data.type === 'offer' ? 'webrtc:offer' : data.type === 'answer' ? 'webrtc:answer' : 'webrtc:ice';
      socket.emit(type, { studioId, from: userId, to: target, [type.split(':')[1]]: data });    });
    peer.on('stream', (s) => { setIsConnected(true); onStreamReady?.(s); onConnectionChange?.(true); });
    peer.on('connect', () => { setIsConnected(true); onConnectionChange?.(true); });
    peer.on('error', (err) => { console.error('❌ Peer error:', err); setIsConnected(false); onConnectionChange?.(false); onError?.({ type: 'WEBRTC_ERROR', message: err.message }); });
    peer.on('iceStateChange', (st) => { if (st === 'failed' || st === 'disconnected') { setIsConnected(false); onConnectionChange?.(false); socket.emit('audio:fallback-request', { studioId, userId, reason: 'ICE_'+st }); setIsFallbackMode(true); } });
    return peer;
  }, [socket, studioId, userId, onStreamReady, onError, onConnectionChange]);

  const startCall = useCallback(async () => {
    if (!targetUserId) return onError?.({ type: 'MISSING_TARGET', message: 'Target required' });
    if (!streamRef.current) await startLocalStream();
    const peer = createPeer(true, targetUserId);
    if (!peer) throw new Error('Peer creation failed');
    peerRef.current = peer;
    return peer;
  }, [targetUserId, startLocalStream, createPeer, onError]);

  const answerCall = useCallback((offer, from) => {
    const peer = createPeer(false, from);
    if (!peer) throw new Error('Answer peer failed');
    peerRef.current = peer;
    peer.signal(offer);
  }, [createPeer]);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    const tracks = streamRef.current.getAudioTracks();
    if (tracks.length === 0) return;
    const next = !tracks[0].enabled;
    tracks.forEach(t => t.enabled = !next);
    setIsMuted(next);
    socket.emit('audio:mute-toggle', { studioId, userId, isMuted: next });
  }, [socket, studioId, userId]);

  useEffect(() => {
    if (!socket) return;
    const h = {
      'webrtc:offer-received': ({ offer, from }) => role === 'director' && from === targetUserId && answerCall(offer, from),
      'webrtc:answer-received': ({ answer }) => peerRef.current && peerRef.current.signal(answer),
      'webrtc:ice-received': ({ candidate }) => peerRef.current && peerRef.current.signal(candidate)
    };
    Object.entries(h).forEach(([e, fn]) => socket.on(e, fn));
    return () => Object.keys(h).forEach(e => socket.off(e));
  }, [socket, role, targetUserId, answerCall]);

  useEffect(() => () => {
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsConnected(false); setIsFallbackMode(false);
  }, []);
  return { isConnected, isMuted, isFallbackMode, startCall, answerCall, toggleMute, startLocalStream };
};

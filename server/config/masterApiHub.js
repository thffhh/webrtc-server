import dotenv from 'dotenv';
dotenv.config();

export const SECRETS = {
  DIRECTOR_MASTER_KEY: process.env.DIRECTOR_SECRET_CODE || '.BDDUBBINGSOCIETY',
  JWT: { secret: process.env.JWT_SECRET || 'change_this_in_production', expiresIn: '24h' },
  ENCRYPTION: { key: process.env.ENCRYPTION_KEY || 'default-key-change-me', algorithm: 'aes-256-gcm' }
};

export const EXTERNAL_APIS = {
  MEDIA_IMPORT: { youtube: { apiKey: process.env.YOUTUBE_API_KEY || '', maxDuration: 7200 } },
  AI_SERVICES: { voiceIsolation: { provider: process.env.VOICE_AI_PROVIDER || 'local' } },
  STORAGE: { provider: process.env.STORAGE_PROVIDER || 'local' },
  EMAIL: { provider: process.env.EMAIL_PROVIDER || 'nodemailer', from: process.env.EMAIL_FROM || 'noreply@bddubbing.com' },
  ANALYTICS: { enabled: process.env.ENABLE_ANALYTICS === 'true' },
  
  // 🆕 WEBRTC CONFIG (NEW SECTION)
  WEBRTC: {
    iceServers: { default: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] },
    rtcConfig: { iceTransportPolicy: 'all', bundlePolicy: 'balanced', rtcpMuxPolicy: 'require', iceCandidatePoolSize: 10, sdpSemantics: 'unified-plan' },
    codecs: { audio: { preferred: 'opus', options: { minptime: 10, useinbandfec: 1, maxaveragebitrate: 510000, stereo: 0, dtx: 1 } } },
    thresholds: { maxLatency: 300, maxJitter: 50, maxPacketLoss: 5, reconnectTimeout: 10 }
  },

  FEATURE_FLAGS: {
    ENABLE_WEBRTC: process.env.ENABLE_WEBRTC !== 'false',
    ENABLE_REALTIME_SYNC: process.env.ENABLE_REALTIME_SYNC !== 'false',
    ENABLE_MULTI_TRACK_AUDIO: process.env.ENABLE_MULTI_TRACK !== 'false',
    PREMIUM: { voiceIsolation: false, transcription: false, cloudRender: false },
    MAINTENANCE: { enabled: process.env.MAINTENANCE_MODE === 'false' }
  },

  SYSTEM_CONFIG: {
    server: { port: parseInt(process.env.PORT) || 3000, host: '0.0.0.0', nodeEnv: process.env.NODE_ENV || 'development' },
    security: { allowedOrigins: (process.env.CLIENT_URL || '').split(','), rateLimit: { windowMs: 900000, maxRequests: 100 } },
    uploads: { maxFileSize: 500 * 1024 * 1024, allowedVideoTypes: ['mp4','webm','mov'], allowedAudioTypes: ['mp3','wav','ogg','m4a'] },
    realtime: { socket: { pingTimeout: 60000, pingInterval: 25000, maxBufferSize: 1e6 } },
    export: { resolutions: ['720p','1080p'], audioBitrates: ['192k','320k'], maxConcurrentExports: 3 }
  }
};

// 🆕 HELPER FUNCTIONS
export const buildIceServers = () => {
  const servers = [];
  const stunUrls = (process.env.ICE_SERVERS_STUN || '').split(',').map(u => u.trim()).filter(u => u.startsWith('stun:'));
  stunUrls.forEach(url => servers.push({ urls: url }));
  if (servers.length === 0) servers.push(...EXTERNAL_APIS.WEBRTC.iceServers.default);
  
  if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL && process.env.TURN_URL) {
    servers.push({ urls: process.env.TURN_URL, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return servers;
};

export const getRtcConfig = () => {
  const config = { ...EXTERNAL_APIS.WEBRTC.rtcConfig };
  if (process.env.FORCE_TURN === 'true') config.iceTransportPolicy = 'relay';
  return config;
};

export const validateDirectorSecret = (code) => code === SECRETS.DIRECTOR_MASTER_KEY;
export const isFeatureEnabled = (flag) => {
  const keys = flag.split('.'); let val = EXTERNAL_APIS.FEATURE_FLAGS;
  for (const k of keys) if (val && typeof val === 'object' && k in val) val = val[k]; else return false;
  return val === true;
};
export default { SECRETS, EXTERNAL_APIS, buildIceServers, getRtcConfig, validateDirectorSecret, isFeatureEnabled };

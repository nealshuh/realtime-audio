import React, { useState, useEffect } from 'react';
import DailyIframe from '@daily-co/daily-js';

export default function VoiceChat() {
  const [apiKey, setApiKey] = useState('');
  const [roomName, setRoomName] = useState('debate-room');
  const [callFrame, setCallFrame] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [audioStatus, setAudioStatus] = useState('checking');

  useEffect(() => {
    return () => {
      if (callFrame) {
        callFrame.destroy();
      }
    };
  }, [callFrame]);

  // Ensure room exists and join automatically
  const setupAndJoin = async () => {
    if (!apiKey) {
      setError('Please enter your Daily.co API key');
      return;
    }

    setError('');
    try {
      // First, try to get or create the room
      let roomUrl;
      
      // Try to get existing room
      const getResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (getResponse.ok) {
        const room = await getResponse.json();
        roomUrl = room.url;
      } else if (getResponse.status === 404) {
        // Room doesn't exist, create it
        const createResponse = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            name: roomName,
            properties: {
              enable_chat: false,
              enable_screenshare: false,
              enable_recording: false,
              start_video_off: true,
              start_audio_off: false
            }
          })
        });

        if (!createResponse.ok) {
          throw new Error('Failed to create room. Check your API key.');
        }

        const room = await createResponse.json();
        roomUrl = room.url;
      } else {
        throw new Error('Failed to access room. Check your API key.');
      }

      // Now join the room
      const daily = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false
      });

      // Request microphone permission explicitly
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted');
        setAudioStatus('granted');
      } catch (permError) {
        console.warn('Microphone permission denied:', permError);
        setError('Microphone permission is required for voice chat');
        setAudioStatus('denied');
        return;
      }

      setCallFrame(daily);

      daily.on('participant-joined', (event) => {
        console.log('Participant joined:', event.participant);
        updateParticipants();
        setTimeout(updateParticipants, 100);
        setTimeout(updateParticipants, 500);
      });
      daily.on('participant-updated', (event) => {
        console.log('Participant updated:', event.participant);
        updateParticipants();
        setTimeout(updateParticipants, 100);
      });
      daily.on('participant-left', (event) => {
        console.log('Participant left:', event.participant);
        updateParticipants();
        setTimeout(updateParticipants, 100);
      });

      daily.on('joined-meeting', () => {
        console.log('Joined meeting successfully');
        setIsInCall(true);
        setIsConfigured(true);
        updateParticipants();
        setTimeout(updateParticipants, 200);
        setTimeout(updateParticipants, 1000);
      });

      daily.on('left-meeting', () => {
        setIsInCall(false);
        setParticipants([]);
      });

      daily.on('error', (error) => {
        console.error('Daily.co error:', error);
        setError('Call error: ' + error.errorMsg);
      });

      daily.on('camera-error', (error) => {
        console.error('Camera/audio error:', error);
        setError('Audio/video error: ' + error.errorMsg);
      });

      await daily.join({ url: roomUrl });
      
      // Ensure audio is enabled after joining
      setTimeout(async () => {
        try {
          await daily.setLocalAudio(true);
          console.log('Audio enabled after join');
          setIsMuted(false);
          setAudioStatus('active');
        } catch (audioError) {
          console.error('Failed to enable audio:', audioError);
          setAudioStatus('error');
        }
      }, 1000);
    } catch (err) {
      setError('Failed to setup room: ' + err.message);
    }
  };

  const updateParticipants = () => {
    if (callFrame) {
      const parts = callFrame.participants();
      console.log('Raw participants from Daily:', parts);
      const participantList = Object.values(parts).map(p => ({
        id: p.session_id,
        name: p.user_name || 'Anonymous',
        audio: p.audio,
        isLocal: p.local,
        audioTrack: p.audioTrack ? 'present' : 'missing'
      }));
      console.log('Participants updated:', participantList);
      setParticipants(participantList);
    } else {
      console.log('callFrame not available for updateParticipants');
    }
  };

  const leaveCall = async () => {
    if (callFrame) {
      await callFrame.leave();
      callFrame.destroy();
      setCallFrame(null);
      setIsInCall(false);
      setIsMuted(false);
      setParticipants([]);
    }
  };

  const toggleMute = () => {
    if (callFrame) {
      const newMutedState = !isMuted;
      callFrame.setLocalAudio(!newMutedState);
      setIsMuted(newMutedState);
      console.log('Audio toggled:', newMutedState ? 'muted' : 'unmuted');
    }
  };

  const testAudio = () => {
    if (callFrame) {
      console.log('Current participants for audio test:', callFrame.participants());
      console.log('Local audio state:', callFrame.localAudio());
      console.log('Microphone state:', callFrame.getInputSettings());
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Voice Chat</h1>
        <p style={styles.subtitle}>Everyone joins the same room automatically</p>

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {!isConfigured ? (
          <div style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Daily.co API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Daily.co API key"
                style={styles.input}
                onKeyPress={(e) => e.key === 'Enter' && setupAndJoin()}
              />
              <p style={styles.hint}>
                Get your API key from{' '}
                <a 
                  href="https://dashboard.daily.co/developers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  dashboard.daily.co
                </a>
              </p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Room Name (optional)</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="debate-room"
                style={styles.input}
              />
              <p style={styles.hint}>
                Everyone who visits will join this room
              </p>
            </div>

            <button
              onClick={setupAndJoin}
              disabled={!apiKey}
              style={{...styles.button, ...styles.buttonPrimary, ...((!apiKey) && styles.buttonDisabled)}}
            >
              Join Voice Chat
            </button>
          </div>
        ) : (
          <div style={styles.callContainer}>
            <div style={styles.callStatus}>
              <div style={styles.statusIndicator}>
                <span style={styles.pulse}></span>
                <span>Connected - Audio: {audioStatus}</span>
              </div>

              <div style={styles.controls}>
                <button
                  onClick={toggleMute}
                  style={{...styles.button, ...(isMuted ? styles.buttonDanger : styles.buttonSecondary)}}
                >
                  {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                </button>

                <button
                  onClick={testAudio}
                  style={{...styles.button, ...styles.buttonSecondary}}
                >
                  🔊 Test Audio
                </button>

                <button
                  onClick={leaveCall}
                  style={{...styles.button, ...styles.buttonDanger}}
                >
                  📞 Leave
                </button>
              </div>
            </div>

            <div style={styles.participantsSection}>
              <h3 style={styles.participantsTitle}>
                Active Users ({participants.length})
              </h3>
              {participants.length === 1 && (
                <p style={styles.waitingMessage}>
                  Waiting for others to join...
                </p>
              )}
              <div style={styles.participantsList}>
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    style={styles.participant}
                  >
                    <div style={styles.participantInfo}>
                      <div style={{
                        ...styles.avatar,
                        backgroundColor: participant.isLocal ? '#3b82f6' : '#9ca3af'
                      }}>
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span style={styles.participantName}>
                          {participant.name}
                          {participant.isLocal && (
                            <span style={styles.youBadge}>You</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div style={styles.audioIndicator}>
                      {participant.audio ? '🎤' : '🔇'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.infoBox}>
              <p style={styles.infoText}>
                Anyone who visits this page will automatically join the same voice chat room.
              </p>
            </div>
          </div>
        )}
      </div>

      {!isConfigured && (
        <div style={styles.instructions}>
          <h2 style={styles.instructionsTitle}>How it works:</h2>
          <ol style={styles.instructionsList}>
            <li>Enter your Daily.co API key</li>
            <li>Click "Join Voice Chat"</li>
            <li>You'll be connected to the shared room</li>
            <li>Anyone else who visits will join the same room</li>
            <li>Start talking - everyone hears each other!</li>
          </ol>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    maxWidth: '600px',
    margin: '0 auto',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    padding: '40px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '8px'
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: '32px'
  },
  error: {
    padding: '16px',
    background: '#fee',
    border: '1px solid #fcc',
    borderRadius: '8px',
    color: '#c00',
    marginBottom: '24px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '16px',
    boxSizing: 'border-box'
  },
  hint: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none'
  },
  button: {
    padding: '14px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  buttonPrimary: {
    background: '#3b82f6',
    color: 'white'
  },
  buttonSuccess: {
    background: '#10b981',
    color: 'white'
  },
  buttonSecondary: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db'
  },
  buttonDanger: {
    background: '#ef4444',
    color: 'white'
  },
  buttonDisabled: {
    background: '#d1d5db',
    cursor: 'not-allowed',
    opacity: 0.6
  },
  callContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  callStatus: {
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #86efac'
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    color: '#065f46',
    fontWeight: '500'
  },
  pulse: {
    width: '12px',
    height: '12px',
    background: '#10b981',
    borderRadius: '50%',
    marginRight: '8px',
    animation: 'pulse 2s infinite'
  },
  controls: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  participantsSection: {
    marginTop: '8px'
  },
  participantsTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px'
  },
  waitingMessage: {
    textAlign: 'center',
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: '16px'
  },
  participantsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  participant: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  participantInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600'
  },
  participantName: {
    fontWeight: '500',
    color: '#1f2937'
  },
  youBadge: {
    marginLeft: '8px',
    fontSize: '11px',
    background: '#dbeafe',
    color: '#1e40af',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  audioIndicator: {
    fontSize: '20px'
  },
  infoBox: {
    padding: '16px',
    background: '#eff6ff',
    borderRadius: '8px',
    border: '1px solid #bfdbfe'
  },
  infoText: {
    fontSize: '14px',
    color: '#1e40af',
    margin: 0,
    textAlign: 'center'
  },
  instructions: {
    maxWidth: '600px',
    margin: '24px auto 0',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    padding: '24px'
  },
  instructionsTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px'
  },
  instructionsList: {
    paddingLeft: '24px',
    lineHeight: '1.8',
    color: '#374151'
  }
};
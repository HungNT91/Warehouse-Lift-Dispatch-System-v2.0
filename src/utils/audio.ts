// Web Audio API & SpeechSynthesis Voice Announcement Helper
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Auto-unlock AudioContext on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {
      // ignore
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
}

/**
 * Text-to-Speech (TTS) voice announcement in Vietnamese
 */
export function speakText(text: string) {
  // Always trigger chime sound alert for clear audibility
  playElevatorChime();

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    // Resume speech synthesis if browser paused audio
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Strip HTML tags and normalize whitespace for clean voice playback
    const cleanText = text
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, ' và ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    // Small timeout after chime so speech follows chime smoothly
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.95; // Clear natural voice rate for warehouse speakers
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
        if (viVoice) {
          utterance.voice = viVoice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis inner error:', err);
      }
    }, 300);
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
  }
}

/**
 * Announcement when a lift arrives at a target floor with goods
 */
export function speakLiftArrival(liftName: string, floor: number) {
  const formattedLift = liftName.replace(/^Lift\s*/i, 'Thang P').replace(/^Tời\s*/i, 'Thang P');
  const message = `Thông báo, ${formattedLift} đã vận chuyển hàng đến Tầng ${floor}. Mời nhân viên kiểm tra kéo hàng!`;
  speakText(message);
}

/**
 * Warning announcement when cargo remains uncollected after 3 minutes (180s)
 */
export function speakUncollectedWarning(liftName: string, floor: number, minutes: number = 3) {
  const formattedLift = liftName.replace(/^Lift\s*/i, 'Thang P').replace(/^Tời\s*/i, 'Thang P');
  const message = `Cảnh báo! ${formattedLift} tại Tầng ${floor} chưa được kéo hàng quá ${minutes} phút. Yêu cầu bộ phận kho Tầng ${floor} khẩn trương kéo hàng!`;
  speakText(message);
}

/**
 * Plays a classic elevator "Ding-Dong" arrival chime (legacy fallback).
 */
export function playElevatorChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 1.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    const startTime2 = now + 0.28;
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, startTime2);

    gain2.gain.setValueAtTime(0, startTime2);
    gain2.gain.linearRampToValueAtTime(0.45, startTime2 + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime2 + 1.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(startTime2);
    osc2.stop(startTime2 + 1.5);
  } catch (err) {
    console.warn('Could not play elevator chime audio:', err);
  }
}

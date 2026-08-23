/**
 * Browser Web Notification Manager
 * Handles native desktop and mobile browser notifications with sound & tag deduplication.
 */

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  onClick?: () => void;
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) {
    console.warn('[BrowserNotification] Notifications API not supported in this browser.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('[BrowserNotification] Error requesting permission:', err);
    return false;
  }
}

export function sendBrowserNotification(options: BrowserNotificationOptions): boolean {
  // Always trigger platform-adaptive audio notification
  playNotificationSound();

  if (!isBrowserNotificationSupported()) return false;

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notifOptions: any = {
      body: options.body,
      icon: options.icon || '/icon.png',
      badge: options.badge || '/icon.png',
      tag: options.tag || 'sge-activity-notification',
      renotify: true,
      data: options.data,
      silent: false
    };

    const notification = new Notification(options.title, notifOptions);

    if (options.onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    return true;
  } catch (err) {
    console.error('[BrowserNotification] Error dispatching notification:', err);
    return false;
  }
}

/**
 * Plays a rich, pleasant multi-platform audio notification chime
 * Adapts to device capabilities using Web Audio API and hardware vibration on mobile.
 */
export function playNotificationSound(type: 'sucesso' | 'alerta' | 'erro' | 'info' | 'cargo' | 'default' = 'default'): void {
  if (typeof window === 'undefined') return;

  try {
    // Hardware haptic feedback for mobile/tablet devices
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'alerta' || type === 'erro') {
          navigator.vibrate([100, 40, 100]);
        } else if (type === 'cargo' || type === 'sucesso') {
          navigator.vibrate([60, 30, 80]);
        } else {
          navigator.vibrate(50);
        }
      } catch {
        // Ignore haptics failure if blocked by OS
      }
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.2, now);
    masterGain.connect(ctx.destination);

    if (type === 'sucesso' || type === 'cargo') {
      // Harmonious upward major chime (C5 -> E5 -> G5 -> C6)
      const freqs = type === 'cargo' ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        
        noteGain.gain.setValueAtTime(0, now + i * 0.09);
        noteGain.gain.linearRampToValueAtTime(0.28, now + i * 0.09 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.38);
      });
    } else if (type === 'alerta' || type === 'erro') {
      // Subtle double-pulse alert tone
      [0, 0.15].forEach((delay) => {
        const osc = ctx.createOscillator();
        const toneGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(698.46, now + delay);
        
        toneGain.gain.setValueAtTime(0.22, now + delay);
        toneGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.13);

        osc.connect(toneGain);
        toneGain.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.14);
      });
    } else {
      // Crisp bell pop chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch (err) {
    console.debug('[Sound] Audio playback skipped:', err);
  }
}

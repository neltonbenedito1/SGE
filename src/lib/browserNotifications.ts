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

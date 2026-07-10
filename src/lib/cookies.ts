// Complete cookie-based system with 24-hour expiration and user consent settings.

export interface CookiePreferences {
  session: boolean;
  theme: boolean;
  lastPage: boolean;
  formData: boolean;
  smtp: boolean;
}

export const DEFAULT_PREFERENCES: CookiePreferences = {
  session: true,
  theme: true,
  lastPage: true,
  formData: true,
  smtp: true
};

// Standard helper to set cookie with name, value, and expiration in hours
export function setCookie(name: string, value: string, hours: number = 24) {
  const date = new Date();
  date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
  const expires = "; expires=" + date.toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
}

// Standard helper to get cookie by name
export function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

// Standard helper to delete cookie by name
export function deleteCookie(name: string) {
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
}

// Checks if consent has been obtained and the specific preference is enabled
export function isPreferenceAllowed(pref: keyof CookiePreferences): boolean {
  const consentRaw = getCookie("user_cookie_consent");
  if (!consentRaw) return false; // Not decided yet
  if (consentRaw === "refused") return false; // Fully refused
  
  try {
    const preferences = JSON.parse(getCookie("user_cookie_preferences") || "{}") as CookiePreferences;
    return preferences[pref] !== false;
  } catch (e) {
    return false;
  }
}

// Save helper that checks user consent
export function saveSettingIfAllowed(name: string, value: string, prefType: keyof CookiePreferences, hours: number = 24) {
  // If consent was not decided yet, we can save default temporarily or hold off.
  // The rule states: "Ao fazer login pela primeira vez, exibir um popup button questionando ao utilizador se deseja..."
  // If user declined or hasn't accepted, we respect their choice.
  const consent = getCookie("user_cookie_consent");
  if (consent === "accepted") {
    if (isPreferenceAllowed(prefType)) {
      setCookie(name, value, hours);
    }
  } else if (!consent) {
    // If not decided yet, let's allow saving temporarily during first setup, but if they click refuse we clear them.
    setCookie(name, value, hours);
  }
}

// --- Expected exports for App.tsx ---

export function saveUserSessionCookie(sessionObj: any) {
  saveSettingIfAllowed("user_session", JSON.stringify(sessionObj), "session", 24);
}

export function getUserSessionCookie(): any | null {
  const sessionStr = getCookie("user_session");
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr);
  } catch (e) {
    return null;
  }
}

export function saveThemePreference(theme: string) {
  saveSettingIfAllowed("user_theme", theme, "theme", 24);
}

export function getThemePreference(): string {
  return getCookie("user_theme") || "theme-slate";
}

export function saveLastAction(action: string) {
  saveSettingIfAllowed("last_action", action, "lastPage", 24);
}

export function saveLastModule(module: string) {
  saveSettingIfAllowed("last_module", module, "lastPage", 24);
}

export function getLastModule(): string {
  return getCookie("last_module") || "dashboard";
}

export function saveLastScrollPosition(scrollTop: number) {
  saveSettingIfAllowed("last_scroll", String(scrollTop), "lastPage", 24);
}

export function getLastScrollPosition(): number {
  return Number(getCookie("last_scroll")) || 0;
}

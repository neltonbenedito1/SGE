/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getCookie, saveSettingIfAllowed } from './cookies';

export interface UserPreferences {
  theme: string;
  language: string;
  lastModule: string;
  scrollPosition: number;
  drafts: Record<string, any>;
}

export const DEFAULT_USER_PREFS: UserPreferences = {
  theme: 'theme-slate',
  language: 'pt',
  lastModule: 'dashboard',
  scrollPosition: 0,
  drafts: {},
};

/**
 * Service to manage high-performance, hybrid user preferences (cookies + cloud firestore)
 * and autosaving draft forms.
 */
export class SessionStateService {
  private static debounceTimers: Record<string, any> = {};

  /**
   * Saves a single preference value. Writes to browser cookies immediately for near-zero latency,
   * then schedules an asynchronous, debounced update to the Firestore database.
   */
  static savePreference(
    userId: string | null,
    key: keyof UserPreferences,
    value: any,
    fieldName: string = ''
  ) {
    // 1. Save to client storage (cookies / local storage) immediately for fast reads
    if (key === 'theme') {
      saveSettingIfAllowed('user_theme', value as string, 'theme', 24);
    } else if (key === 'language') {
      saveSettingIfAllowed('saas_educ_system_lang', value as string, 'theme', 24);
    } else if (key === 'lastModule') {
      saveSettingIfAllowed('last_module', value as string, 'lastPage', 24);
    } else if (key === 'scrollPosition') {
      saveSettingIfAllowed('last_scroll', String(value), 'lastPage', 24);
    } else if (key === 'drafts' && fieldName) {
      saveSettingIfAllowed(`draft_${fieldName}`, JSON.stringify(value), 'formData', 24);
    }

    // 2. If user is logged in, sync with Firestore using a 1.5-second debounce
    if (userId) {
      const timerKey = `${userId}_${key}_${fieldName}`;
      if (this.debounceTimers[timerKey]) {
        clearTimeout(this.debounceTimers[timerKey]);
      }

      this.debounceTimers[timerKey] = setTimeout(async () => {
        try {
          const userDocRef = doc(db, 'users', userId);
          const updateData: Record<string, any> = {};
          
          if (key === 'drafts' && fieldName) {
            updateData[`drafts.${fieldName}`] = value;
          } else {
            updateData[key] = value;
          }

          await updateDoc(userDocRef, updateData);
          console.log(`[SessionStateService] Synced '${key}' preference to user document successfully.`);
        } catch (error) {
          console.warn(`[SessionStateService] Async sync failed for ${key}:`, error);
        }
      }, 1500);
    }
  }

  /**
   * Retrieves all permanent preferences from the user profile database, 
   * merging with local cookies as fallback.
   */
  static async loadUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          theme: data.theme || getCookie('user_theme') || DEFAULT_USER_PREFS.theme,
          language: data.language || getCookie('saas_educ_system_lang') || DEFAULT_USER_PREFS.language,
          lastModule: data.lastModule || getCookie('last_module') || DEFAULT_USER_PREFS.lastModule,
          scrollPosition: data.scrollPosition !== undefined ? Number(data.scrollPosition) : Number(getCookie('last_scroll')) || 0,
          drafts: data.drafts || {},
        };
      }
    } catch (err) {
      console.warn('[SessionStateService] Failed to fetch cloud preferences. Reverting to cookies.', err);
    }

    return {
      theme: getCookie('user_theme') || DEFAULT_USER_PREFS.theme,
      language: getCookie('saas_educ_system_lang') || DEFAULT_USER_PREFS.language,
      lastModule: getCookie('last_module') || DEFAULT_USER_PREFS.lastModule,
      scrollPosition: Number(getCookie('last_scroll')) || 0,
      drafts: {},
    };
  }
}

/**
 * Custom React hook to capture and auto-restore page scroll positions with a performance-optimized debounce.
 */
export function useDebouncedScroll(
  userId: string | null,
  containerId: string,
  delay: number = 500
) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    let timeoutId: any = null;

    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const scrollTop = container.scrollTop;
        SessionStateService.savePreference(userId, 'scrollPosition', scrollTop);
      }, delay);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [userId, containerId, delay]);
}

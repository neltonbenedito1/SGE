import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { SessionStateService } from '../lib/userState';
import { getUserSessionCookie } from '../lib/cookies';

export function useLanguage() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language || 'pt';

  // Apply blocking auto-translation configurations on HTML tag dynamically
  const applyHtmlLanguageAttributes = (lang: string) => {
    const htmlElement = document.documentElement;
    if (htmlElement) {
      // Update dynamic lang attribute for accessibility
      htmlElement.setAttribute('lang', lang);
      // Force translate="no" to disable automated translate popups/features in Chrome, Edge, Safari, etc.
      htmlElement.setAttribute('translate', 'no');
      // Add 'notranslate' class to the html tag to ensure elements inherit blocking instructions
      htmlElement.classList.add('notranslate');
    }
  };

  const changeLanguage = async (lang: string) => {
    // 1. Update i18next state
    await i18n.changeLanguage(lang);

    // 2. Persist to localStorage
    localStorage.setItem('saas_educ_system_lang', lang);

    // 3. Update dynamic HTML attributes
    applyHtmlLanguageAttributes(lang);

    // 4. Synchronize with Firestore & Cookies
    const session = getUserSessionCookie();
    const userId = session?.id || auth.currentUser?.uid || null;

    if (userId) {
      // Sync via standard SessionStateService (updates cookie and schedules debounced Firestore update for 'language')
      SessionStateService.savePreference(userId, 'language', lang);

      // Save also under requested field 'preferredLanguage' in user document directly for immediate device synchronization
      try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
          preferredLanguage: lang,
          language: lang // Keep both fields in sync
        });
        console.log(`[useLanguage] Saved preferredLanguage '${lang}' to Firestore.`);
      } catch (error) {
        console.warn(`[useLanguage] Failed to save preferredLanguage to Firestore:`, error);
      }
    }

    // Trigger languagechange event for non-react modules or compatibility
    window.dispatchEvent(new Event('languagechange'));
  };

  // Sync HTML tags on initial load or language change
  useEffect(() => {
    applyHtmlLanguageAttributes(currentLanguage);
  }, [currentLanguage]);

  return {
    language: currentLanguage,
    t,
    changeLanguage,
  };
}
export default useLanguage;

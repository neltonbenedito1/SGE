/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

/**
 * Custom React Hook to protect against accidental data loss when navigating
 * away from forms with unsaved modifications.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // 1. Intercept browser window closure or external page leaves (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        // Standard confirmation dialogue text for compliant browsers
        const confirmationMessage = 'Tem alterações não salvas no formulário. Deseja sair sem salvar?';
        event.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  /**
   * Guards an internal transition (e.g. sidebar tab click, module change, or logoff).
   * If the form is dirty, opens the custom modal and defers the action.
   */
  const guardAction = (action: () => void) => {
    if (isDirty) {
      setPendingNavigation(() => action);
      setShowConfirmModal(true);
    } else {
      action();
    }
  };

  /**
   * Confirms the navigation. Discards unsaved modifications and runs the deferred action.
   */
  const confirmLeave = () => {
    setShowConfirmModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  /**
   * Cancels the navigation, closing the warning modal and remaining on the active page.
   */
  const cancelLeave = () => {
    setShowConfirmModal(false);
    setPendingNavigation(null);
  };

  return {
    showConfirmModal,
    guardAction,
    confirmLeave,
    cancelLeave,
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import {
  CatalogItem,
  LESSON_STATUS_CATALOG,
  GENERIC_STATUS_CATALOG,
  USER_ROLES_CATALOG,
  EDUCATION_LEVELS_CATALOG,
  INSTITUTION_TYPES_CATALOG,
  SHIFTS_CATALOG,
  GENDERS_CATALOG,
  MARITAL_STATUS_CATALOG,
  DOCUMENT_TYPES_CATALOG,
  BLOOD_GROUPS_CATALOG,
  GUARDIAN_RELATIONSHIPS_CATALOG,
  MOZAMBIQUE_PROVINCES,
  getAutomaticProvincesForCountries
} from '../catalogs';

export type CatalogName =
  | 'lessonStatus'
  | 'genericStatus'
  | 'userRoles'
  | 'educationLevels'
  | 'institutionTypes'
  | 'shifts'
  | 'genders'
  | 'maritalStatus'
  | 'documentTypes'
  | 'bloodGroups'
  | 'guardianRelationships';

const CATALOGS: Record<CatalogName, CatalogItem<any>[]> = {
  lessonStatus: LESSON_STATUS_CATALOG,
  genericStatus: GENERIC_STATUS_CATALOG,
  userRoles: USER_ROLES_CATALOG,
  educationLevels: EDUCATION_LEVELS_CATALOG,
  institutionTypes: INSTITUTION_TYPES_CATALOG,
  shifts: SHIFTS_CATALOG,
  genders: GENDERS_CATALOG,
  maritalStatus: MARITAL_STATUS_CATALOG,
  documentTypes: DOCUMENT_TYPES_CATALOG,
  bloodGroups: BLOOD_GROUPS_CATALOG,
  guardianRelationships: GUARDIAN_RELATIONSHIPS_CATALOG,
};

export function useCatalog(name: CatalogName) {
  const items = useMemo(() => {
    return CATALOGS[name] || [];
  }, [name]);

  const activeItems = useMemo(() => {
    return items.filter(i => i.active).sort((a, b) => a.order - b.order);
  }, [items]);

  const getLabel = (value: string, fallback?: string): string => {
    const found = items.find(i => String(i.value).toLowerCase() === String(value).toLowerCase());
    return found?.labelDefault || fallback || value;
  };

  const getItem = (value: string): CatalogItem | undefined => {
    return items.find(i => String(i.value).toLowerCase() === String(value).toLowerCase());
  };

  return {
    items,
    activeItems,
    getLabel,
    getItem,
  };
}

export { MOZAMBIQUE_PROVINCES, getAutomaticProvincesForCountries };

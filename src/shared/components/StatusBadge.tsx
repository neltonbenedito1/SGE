/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CatalogItem } from '../catalogs';

interface StatusBadgeProps {
  status: string;
  catalog: CatalogItem[];
  fallbackLabel?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  catalog,
  fallbackLabel,
  className = '',
}) => {
  const item = catalog.find(i => String(i.value).toLowerCase() === String(status).toLowerCase());
  const label = item?.labelDefault || fallbackLabel || status;
  const badgeClass = item?.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeClass} ${className}`}
    >
      {label}
    </span>
  );
};

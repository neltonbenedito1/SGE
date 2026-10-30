/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CatalogItem } from '../catalogs';

interface CatalogSelectProps<T = string> {
  catalog: CatalogItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

export const CatalogSelect = <T extends string = string>({
  catalog,
  value,
  onChange,
  label,
  placeholder = '-- Selecionar --',
  required = false,
  disabled = false,
  className = '',
  id,
  name,
}: CatalogSelectProps<T>) => {
  const activeItems = catalog.filter(i => i.active).sort((a, b) => a.order - b.order);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-600 dark:text-slate-400">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {activeItems.map((item) => (
          <option key={String(item.value)} value={String(item.value)}>
            {item.labelDefault}
          </option>
        ))}
      </select>
    </div>
  );
};

import { useState, useEffect } from 'react';

/**
 * Hook de debounce genérico para pesquisas e filtros em listas extensas.
 * Mantém o input controlado responsivo imediatamente e atrasa a re-filtragem
 * até que o utilizador pause a digitação.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebouncedValue(value);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

export default useDebouncedValue;

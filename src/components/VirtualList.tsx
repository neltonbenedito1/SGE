import React, { useState, useRef, useMemo, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  maxHeight?: number;
  overscan?: number;
  virtualizeThreshold?: number;
  className?: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string;
  emptyState?: React.ReactNode;
}

/**
 * Contentor virtualizado leve e compatível com WebView Android (Fase 6).
 * - Para listas pequenas (<= virtualizeThreshold), renderiza diretamente sem sobrecarga.
 * - Para listas extensas (> virtualizeThreshold), mantém apenas as linhas visíveis no DOM.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  maxHeight = 560,
  overscan = 5,
  virtualizeThreshold = 35,
  className = '',
  renderItem,
  getKey,
  emptyState,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const shouldVirtualize = items.length > virtualizeThreshold;

  const windowSlice = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        startIndex: 0,
        endIndex: items.length,
        topSpacer: 0,
        bottomSpacer: 0,
      };
    }

    const visibleCount = Math.ceil(maxHeight / itemHeight);
    const rawStart = Math.floor(scrollTop / itemHeight) - overscan;
    const startIndex = Math.max(0, rawStart);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

    return {
      startIndex,
      endIndex,
      topSpacer: startIndex * itemHeight,
      bottomSpacer: Math.max(0, (items.length - endIndex) * itemHeight),
    };
  }, [shouldVirtualize, items.length, maxHeight, itemHeight, scrollTop, overscan]);

  if (items.length === 0) {
    return <>{emptyState || null}</>;
  }

  if (!shouldVirtualize) {
    return (
      <div className={className}>
        {items.map((item, idx) => (
          <React.Fragment key={getKey(item, idx)}>
            {renderItem(item, idx)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  const visibleItems = items.slice(windowSlice.startIndex, windowSlice.endIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ maxHeight }}
      className={`overflow-y-auto overscroll-contain ${className}`}
    >
      {windowSlice.topSpacer > 0 && <div style={{ height: windowSlice.topSpacer }} aria-hidden="true" />}
      {visibleItems.map((item, offset) => {
        const absoluteIndex = windowSlice.startIndex + offset;
        return (
          <React.Fragment key={getKey(item, absoluteIndex)}>
            {renderItem(item, absoluteIndex)}
          </React.Fragment>
        );
      })}
      {windowSlice.bottomSpacer > 0 && <div style={{ height: windowSlice.bottomSpacer }} aria-hidden="true" />}
    </div>
  );
}

interface VirtualTableRowsProps<T> {
  items: T[];
  rowHeight?: number;
  containerHeight?: number;
  overscan?: number;
  virtualizeThreshold?: number;
  scrollTop: number;
  colSpan: number;
  renderRow: (item: T, index: number) => React.ReactNode;
}

/**
 * Helper para virtualizar `<tbody>` mantendo semântica HTML `<table>` intacta.
 */
export function useVirtualizedTableWindow<T>(
  items: T[],
  options?: { rowHeight?: number; containerHeight?: number; overscan?: number; threshold?: number }
) {
  const rowHeight = options?.rowHeight ?? 58;
  const containerHeight = options?.containerHeight ?? 580;
  const overscan = options?.overscan ?? 6;
  const threshold = options?.threshold ?? 40;

  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const isVirtualized = items.length > threshold;

  const slice = useMemo(() => {
    if (!isVirtualized) {
      return {
        visibleItems: items,
        startIndex: 0,
        topPaddingPx: 0,
        bottomPaddingPx: 0,
      };
    }
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
    return {
      visibleItems: items.slice(startIndex, endIndex),
      startIndex,
      topPaddingPx: startIndex * rowHeight,
      bottomPaddingPx: Math.max(0, (items.length - endIndex) * rowHeight),
    };
  }, [isVirtualized, items, containerHeight, rowHeight, scrollTop, overscan]);

  return {
    ...slice,
    isVirtualized,
    containerStyle: isVirtualized ? { maxHeight: containerHeight, overflowY: 'auto' as const } : undefined,
    onScroll: isVirtualized ? onScroll : undefined,
  };
}

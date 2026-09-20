import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Adjustments, FilterId, SessionPage } from './types';
import { NEUTRAL_ADJUSTMENTS } from './filters';

type SessionValue = {
  pages: SessionPage[];
  filterId: FilterId;
  adjustments: Adjustments;
  addPage: (page: SessionPage) => void;
  replacePage: (id: string, page: SessionPage) => void;
  removePage: (id: string) => void;
  movePage: (id: string, direction: -1 | 1) => void;
  setFilterId: (id: FilterId) => void;
  setAdjustments: (adj: Adjustments) => void;
  resetSession: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<SessionPage[]>([]);
  const [filterId, setFilterId] = useState<FilterId>('magic');
  const [adjustments, setAdjustments] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);

  const addPage = useCallback((page: SessionPage) => {
    setPages((prev) => [...prev, page]);
  }, []);

  const replacePage = useCallback((id: string, page: SessionPage) => {
    setPages((prev) => prev.map((p) => (p.id === id ? page : p)));
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const movePage = useCallback((id: string, direction: -1 | 1) => {
    setPages((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const resetSession = useCallback(() => {
    setPages([]);
    setFilterId('magic');
    setAdjustments(NEUTRAL_ADJUSTMENTS);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      pages,
      filterId,
      adjustments,
      addPage,
      replacePage,
      removePage,
      movePage,
      setFilterId,
      setAdjustments,
      resetSession,
    }),
    [pages, filterId, adjustments, addPage, replacePage, removePage, movePage, resetSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

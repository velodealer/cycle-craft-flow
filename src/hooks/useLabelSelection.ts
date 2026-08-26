import { useCallback, useMemo, useState } from 'react';

/** Tracks which bikes in a list are ticked for bulk label printing. */
export function useLabelSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => (ids.every((id) => prev.has(id)) && ids.length > 0 ? new Set() : new Set(ids)));
  }, [ids]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(
    () => ({ selected, toggle, toggleAll, allSelected, clear }),
    [selected, toggle, toggleAll, allSelected, clear],
  );
}

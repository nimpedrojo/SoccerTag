import { useMemo, useState } from "react";
import { categoryConfig, CategoryKey } from "../../config/categories";

type SelectionsState = Record<CategoryKey, Set<string>>;

export interface UseSelections {
  selections: SelectionsState;
  toggle: (category: CategoryKey, option: string) => void;
  resetCategory: (category: CategoryKey) => void;
  resetAll: () => void;
  toObject: () => Record<CategoryKey, string[]>;
}

/**
 * Hook de selección múltiple por categoría (toggle + reset).
 * Internamente usa Set para evitar duplicados; expone transform a objeto plano.
 */
export function useSelections(
  categories: CategoryKey[] = categoryConfig.map((c) => c.key)
): UseSelections {
  const initial = useMemo(() => createEmptySelections(categories), [categories]);
  const [state, setState] = useState<SelectionsState>(initial);

  const toggle = (category: CategoryKey, option: string) => {
    setState((prev) => {
      const current = new Set(prev[category]);
      current.has(option) ? current.delete(option) : current.add(option);
      return { ...prev, [category]: current };
    });
  };

  const resetCategory = (category: CategoryKey) => {
    setState((prev) => ({ ...prev, [category]: new Set() }));
  };

  const resetAll = () => setState(createEmptySelections(categories));

  const toObject = () => selectionsToObject(state);

  return { selections: state, toggle, resetCategory, resetAll, toObject };
}

export const selectionsToObject = (
  selections: SelectionsState
): Record<CategoryKey, string[]> =>
  Object.fromEntries(
    Object.entries(selections).map(([k, set]) => [k, Array.from(set as Set<string>)])
  ) as Record<CategoryKey, string[]>;

export const hydrateSelections = (
  data: Partial<Record<CategoryKey, string[]>>,
  categories: CategoryKey[] = categoryConfig.map((c) => c.key)
): SelectionsState => {
  const base = createEmptySelections(categories);
  for (const key of categories) {
    if (data[key]) {
      base[key] = new Set(data[key]);
    }
  }
  return base;
};

const createEmptySelections = (categories: CategoryKey[]): SelectionsState =>
  categories.reduce((acc, key) => {
    acc[key] = new Set<string>();
    return acc;
  }, {} as SelectionsState);

/**
 * Ejemplo de uso:
 *
 * const { selections, toggle, resetCategory, resetAll, toObject } = useSelections();
 * const selectedInicio = selections.inicioJuego;
 * // Render:
 * <TagButton active={selectedInicio.has("Corto")} onClick={() => toggle("inicioJuego", "Corto")} />
 * // Convertir a objeto plano para persistir:
 * const payload = toObject();
 */

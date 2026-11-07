export interface MapEditorItem {
  id?: string;
}

/**
 * Produces a non-destructive delta for the Admin map editor.
 * Save/updates must succeed before obsolete rows may be deleted.
 */
export function planMapaCollectionChanges<T extends MapEditorItem>(
  previous: readonly T[],
  next: readonly T[],
  hasSameContent: (a: T, b: T) => boolean,
): { toSave: T[]; toRemoveIds: string[] } {
  const persisted = new Map(previous.filter((item) => item.id).map((item) => [item.id!, item]));
  const currentIds = new Set<string>();
  const toSave: T[] = [];

  for (const item of next) {
    if (!item.id) {
      toSave.push(item);
      continue;
    }
    if (currentIds.has(item.id) || !persisted.has(item.id)) {
      throw new Error("Elemento não pertence ao mapa ou está duplicado");
    }
    currentIds.add(item.id);
    if (!hasSameContent(item, persisted.get(item.id)!)) toSave.push(item);
  }
  const toRemoveIds = [...persisted.keys()].filter((id) => !currentIds.has(id));
  return { toSave, toRemoveIds };
}

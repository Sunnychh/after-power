import type { Inventory, ItemDefinition } from '../types.ts';

export type BatchExpiryState = 'stable' | 'fresh' | 'due' | 'spoiled';

export function batchExpiryStatus(expiresOn: number | undefined, currentDay: number): {
  state: BatchExpiryState;
  remainingDays?: number;
  label: string;
} {
  if (expiresOn === undefined) return { state: 'stable', label: '长期保存' };
  const remainingDays = expiresOn - currentDay;
  if (remainingDays < 0) return { state: 'spoiled', remainingDays, label: '已经失效' };
  if (remainingDays === 0) return { state: 'due', remainingDays, label: '今天到期（今日可用）' };
  return { state: 'fresh', remainingDays, label: `剩余 ${remainingDays} 天` };
}

export function inventoryCount(inventory: Inventory, itemId: string): number {
  return (inventory[itemId] ?? []).reduce((sum, batch) => sum + batch.quantity, 0);
}

export function inventoryWeight(inventory: Inventory, itemMap: Record<string, ItemDefinition>): number {
  return Object.entries(inventory).reduce((total, [itemId, batches]) => {
    const item = itemMap[itemId];
    if (!item) return total;
    return total + batches.reduce((sum, batch) => sum + batch.quantity, 0) * item.weight;
  }, 0);
}

export function addItem(
  inventory: Inventory,
  item: ItemDefinition,
  quantity: number,
  currentDay: number,
): Inventory {
  if (quantity <= 0) return inventory;
  const next = { ...inventory };
  const batches = (next[item.id] ?? []).map((batch) => ({ ...batch }));
  const expiresOn = item.perishableDays ? currentDay + item.perishableDays : undefined;
  const matching = batches.find((batch) => batch.acquiredOn === currentDay && batch.expiresOn === expiresOn);
  if (matching) matching.quantity += quantity;
  else batches.push({ quantity, acquiredOn: currentDay, expiresOn });
  next[item.id] = batches;
  return next;
}

export function removeItem(inventory: Inventory, itemId: string, quantity: number): Inventory | null {
  if (quantity <= 0) return inventory;
  if (inventoryCount(inventory, itemId) < quantity) return null;
  let remaining = quantity;
  const batches = [...(inventory[itemId] ?? [])]
    .map((batch) => ({ ...batch }))
    .sort((a, b) => (a.expiresOn ?? Infinity) - (b.expiresOn ?? Infinity));
  for (const batch of batches) {
    const taken = Math.min(batch.quantity, remaining);
    batch.quantity -= taken;
    remaining -= taken;
    if (remaining === 0) break;
  }
  const next = { ...inventory };
  const kept = batches.filter((batch) => batch.quantity > 0);
  if (kept.length) next[itemId] = kept;
  else delete next[itemId];
  return next;
}

export function expireItems(inventory: Inventory, day: number): { inventory: Inventory; expired: Record<string, number> } {
  const next: Inventory = {};
  const expired: Record<string, number> = {};
  for (const [itemId, batches] of Object.entries(inventory)) {
    const kept = [];
    for (const batch of batches) {
      if (batch.expiresOn !== undefined && batch.expiresOn < day) {
        expired[itemId] = (expired[itemId] ?? 0) + batch.quantity;
      } else {
        kept.push({ ...batch });
      }
    }
    if (kept.length) next[itemId] = kept;
  }
  return { inventory: next, expired };
}

export function canAddWeight(
  inventory: Inventory,
  item: ItemDefinition,
  quantity: number,
  capacity: number,
  itemMap: Record<string, ItemDefinition>,
): boolean {
  return inventoryWeight(inventory, itemMap) + item.weight * quantity <= capacity + 0.0001;
}

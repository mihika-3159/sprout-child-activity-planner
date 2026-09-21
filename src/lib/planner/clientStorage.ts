import type { MonthlyPlanner, WeeklyPlanner } from "@/lib/schemas/preferences";

export type StoredPlanner = {
  planner: WeeklyPlanner | MonthlyPlanner;
  productType: "weekly" | "monthly";
  generationToken?: string;
  savedAt: string;
};

const keyFor = (generationId: string) => `sprout_planner_${generationId}`;

export function savePlanner(generationId: string, value: StoredPlanner): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(generationId), JSON.stringify(value));
}

export function loadPlanner(generationId: string): StoredPlanner | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(keyFor(generationId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPlanner;
  } catch {
    localStorage.removeItem(keyFor(generationId));
    return null;
  }
}

export function clearSproutStorage(): void {
  if (typeof window === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith("sprout_planner_")) localStorage.removeItem(key);
  }
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith("sprout_token_")) sessionStorage.removeItem(key);
  }
}

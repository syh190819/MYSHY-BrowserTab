export const STORES = [
  'expense_categories',
  'expenses',
  'budgets',
  'notes',
  'todos',
  'link_groups',
  'links',
  'weight_records',
  'weight_settings',
  'pain_entries',
  'ingredients',
  'shopping_items',
  'recipes',
  'meal_plans',
  'settings',
] as const;

export type StoreName = (typeof STORES)[number];

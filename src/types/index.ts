export type PageId =
  | 'home'
  | 'accounting'
  | 'weight'
  | 'pain'
  | 'ingredients'
  | 'recipes'
  | 'shopping'
  | 'notes'
  | 'todos'
  | 'settings';

export interface ExpenseCategory {
  id?: number;
  name: string;
  type: 'income' | 'expense';
  sort: number;
  deletedAt: string | null;
}

export interface Expense {
  id?: number;
  type: 'income' | 'expense';
  amount: number;
  categoryId: number;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface Budget {
  id?: number;
  month: string; // YYYY-MM
  categoryId: number | null; // null 表示总预算
  amount: number;
}

export interface Note {
  id?: number;
  text: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id?: number;
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  done: boolean;
  createdAt: string;
}

export interface LinkGroup {
  id?: number;
  name: string;
  sort: number;
}

export interface LinkItem {
  id?: number;
  groupId: number;
  name: string;
  url: string;
  iconUrl: string | null;
  sort: number;
}

export interface WeightRecord {
  id?: number;
  date: string; // YYYY-MM-DD
  weightKg: number;
  note: string;
}

export interface PainEntry {
  id?: number;
  time: string; // YYYY-MM-DDTHH:mm
  part: string;
  level: number; // 1-10
  trigger: string;
  note: string;
}

export interface Ingredient {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  category: '蔬菜' | '肉蛋' | '调料' | '主食' | '其他';
  expiryDate: string | null; // YYYY-MM-DD
  updatedAt: string;
}

export interface ShoppingItem {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  done: boolean;
  source: 'manual' | 'recipe' | 'low_stock';
  createdAt: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id?: number;
  name: string;
  ingredients: RecipeIngredient[];
  steps: string;
  servings: number;
  createdAt: string;
}

export interface MealPlan {
  id?: number;
  date: string; // YYYY-MM-DD
  recipeId: number;
  status: 'planned' | 'cooked';
  cookedAt: string | null;
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string; // 含 {q} 占位符
}

export interface WorkbenchSettings {
  defaultEngine: string;
  engines: SearchEngine[];
  heightCm: number;
  goalWeightKg: number;
  weightRemindEnabled: boolean;
  seeded: boolean;
}

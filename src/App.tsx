import { useState } from 'react';
import type { ReactElement } from 'react';
import type { PageId } from './types';
import HomePage from './pages/HomePage';
import AccountingPage from './pages/AccountingPage';
import WeightPage from './pages/WeightPage';
import PainPage from './pages/PainPage';
import IngredientsPage from './pages/IngredientsPage';
import RecipesPage from './pages/RecipesPage';
import ShoppingPage from './pages/ShoppingPage';
import NotesPage from './pages/NotesPage';
import TodosPage from './pages/TodosPage';
import SettingsPage from './pages/SettingsPage';

const NAV: Array<{ id: PageId; label: string }> = [
  { id: 'home', label: '工作台' },
  { id: 'accounting', label: '记账' },
  { id: 'weight', label: '体重' },
  { id: 'pain', label: '疼痛' },
  { id: 'ingredients', label: '食材' },
  { id: 'recipes', label: '菜谱' },
  { id: 'shopping', label: '采购' },
  { id: 'notes', label: '便签' },
  { id: 'todos', label: '待办' },
  { id: 'settings', label: '设置' },
];

export default function App() {
  const [page, setPage] = useState<PageId>('home');
  const pages: Record<PageId, ReactElement> = {
    home: <HomePage onNavigate={setPage} />,
    accounting: <AccountingPage />,
    weight: <WeightPage />,
    pain: <PainPage />,
    ingredients: <IngredientsPage />,
    recipes: <RecipesPage />,
    shopping: <ShoppingPage />,
    notes: <NotesPage />,
    todos: <TodosPage />,
    settings: <SettingsPage />,
  };
  return (
    <div className="app-shell">
      <nav className="top-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main>{pages[page]}</main>
    </div>
  );
}

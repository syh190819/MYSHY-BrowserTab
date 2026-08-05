import type { PageId } from '../types';

interface Props {
  onNavigate: (page: PageId) => void;
}

export default function HomePage({ onNavigate }: Props) {
  void onNavigate;
  return <div className="card">工作台（开发中）</div>;
}

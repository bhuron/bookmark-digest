import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gallery-50/30 to-gallery-100/20">
      <Header />
      <main className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-10 lg:py-12">
        <Outlet />
      </main>
    </div>
  );
}

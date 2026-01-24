import { Link, NavLink } from 'react-router-dom';
import { BookOpen, FileText, Settings, Book } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', icon: FileText, label: 'Articles' },
  { to: '/epub', icon: Book, label: 'EPUB' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gallery-200/80 bg-white/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-coral-500/10 rounded-xl scale-0 group-hover:scale-100 transition-transform duration-300" />
              <div className="relative bg-gallery-900 rounded-xl p-2.5 group-hover:bg-gallery-800 transition-colors duration-200">
                <BookOpen className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-gallery-900">
              Bookmark Digest
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item, index) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 animate-fade-in-up',
                    isActive
                      ? 'nav-active'
                      : 'text-gallery-600 hover:text-gallery-900 hover:bg-gallery-100',
                  )
                }
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <item.icon className="w-4 h-4" strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

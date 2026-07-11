import React from 'react';
import { LogOut } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import MFIcon from './MFIcon';
import DefaultAvatar from './DefaultAvatar';
import NotificationCenter from './NotificationCenter';
import { useTheme } from '../design-system/theme/useTheme';
import { getLogo } from '../design-system/branding/logo';

export default function Navbar() {
  const [showHeader, setShowHeader] = React.useState(true);
  const [showBottomNav, setShowBottomNav] = React.useState(true);
  const [lastScrollY, setLastScrollY] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY && currentScrollY > 80;
      setShowHeader(!scrollingDown);
      setShowBottomNav(!scrollingDown);
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const { activeTab, setActiveTab, currentUser, handleLogout, userProfile, isAdmin, theme, setTheme } = useAppContext();
  const { mode } = useTheme();
  const logo = getLogo(mode);
  const onLogout = handleLogout;

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const navItems = [
    { key: 'home',        icon: 'consistency',  label: 'Início'    },
    { key: 'myday',       icon: 'tasks',        label: 'Meu Dia'   },
    { key: 'focus',       icon: 'focus',        label: 'Foco'      },
    { key: 'evolution',   icon: 'evolution',    label: 'Evolução'  },
  ];

  if (isAdmin) {
    navItems.push({ key: 'admin', icon: 'admin', label: 'Admin' });
    navItems.push({ key: 'revenue', icon: 'performance', label: 'Finanças' });
  }

  return (
    <>


      {/* ── Menu Flutuante Inferior ──────────────────────── */}
      <nav
        className={`mobile-bottom-nav hide-on-desktop${showBottomNav ? '' : ' hidden'}`}
        role="navigation"
        aria-label="Navegação principal"
      >
        {navItems.slice(0, 4).map(({ key, icon, label }) => (
          <button
            key={key}
            id={`tour-nav-mobile-${key}`}
            onClick={() => setActiveTab(key)}
            className={`mobile-bottom-nav-btn ${activeTab === key ? 'active' : ''}`}
            aria-current={activeTab === key ? 'page' : undefined}
          >
            <MFIcon name={icon} size={20} className="nav-icon" />
            <span className="nav-text">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}


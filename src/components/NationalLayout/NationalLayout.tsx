import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import ClubCrest from '../ClubCrest/ClubCrest';
import { clubThemeVars, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import styles from '../Layout/Layout.module.css';

interface NavLinkItem {
  to: string;
  label: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavLinkItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'selecao',
    label: 'Seleção',
    icon: '🌐',
    items: [
      { to: '/national/windows', label: 'Datas FIFA' },
      { to: '/national/players', label: 'Base de Jogadores' },
      { to: '/national/history', label: 'Histórico' },
      { to: '/national/board', label: 'Diretoria' },
    ],
  },
];

/** Ativo na rota exata ou em qualquer sub-rota dela (ex.: hub da Data FIFA). */
function isNavItemActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function NationalLayout() {
  const { state, setActiveContext } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      init[g.id] = g.items.some(i => isNavItemActive(location.pathname, i.to));
    }
    return init;
  });

  const nationalTeam = state.nationalTeam;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function toggleGroup(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function backToClub() {
    setActiveContext('club');
    navigate('/dashboard');
  }

  const primary = nationalTeam?.primaryColor ?? DEFAULT_PRIMARY;
  const secondary = nationalTeam?.secondaryColor ?? DEFAULT_SECONDARY;
  const themeStyle = useMemo(
    () => clubThemeVars(primary, secondary) as CSSProperties,
    [primary, secondary],
  );

  if (!nationalTeam) {
    // Guarda defensiva — App.tsx só monta este layout quando nationalTeam existe.
    return null;
  }

  const navContent = (
    <>
      <div className={styles.brand}>
        <ClubCrest primary={primary} secondary={secondary} size={26} title={nationalTeam.name} />
        <span className={styles.brandName}>ClubOS Seleção</span>
        <button
          type="button"
          className={styles.closeMenu}
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        >
          ×
        </button>
      </div>

      <div className={styles.club}>
        <div className={styles.clubRow}>
          <ClubCrest primary={primary} secondary={secondary} size={32} />
          <div>
            <p className={styles.clubLabel}>Seleção Atual</p>
            <p className={styles.clubName}>{nationalTeam.name}</p>
          </div>
        </div>
        <p className={styles.managerName}>Ranking FIFA #{nationalTeam.fifaRanking}</p>
        <p className={styles.clubSeason}>Temporada {state.season}</p>
      </div>

      <nav className={styles.nav}>
        <NavLink
          to="/national/dashboard"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
          }
        >
          <span className={styles.navIcon}>⊞</span>
          <span>Dashboard</span>
        </NavLink>

        {NAV_GROUPS.map(group => {
          const isOpen = expanded[group.id];
          const hasActive = group.items.some(i => isNavItemActive(location.pathname, i.to));

          return (
            <div key={group.id} className={styles.navGroup}>
              <button
                type="button"
                className={`${styles.navGroupBtn} ${hasActive ? styles.navGroupActive : ''}`}
                onClick={() => toggleGroup(group.id)}
              >
                <span className={styles.navIcon}>{group.icon}</span>
                <span className={styles.navGroupLabel}>{group.label}</span>
                <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>›</span>
              </button>

              {isOpen && (
                <div className={styles.navSub}>
                  {group.items.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `${styles.navSubItem} ${isActive ? styles.navSubActive : ''}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <button className={styles.resetBtn} onClick={backToClub}>
          ← Voltar ao Clube
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.root} style={themeStyle}>
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
        <span className={styles.mobileTitle}>{nationalTeam.name}</span>
      </header>

      {menuOpen && (
        <button
          type="button"
          className={styles.overlay}
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        {navContent}
      </aside>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

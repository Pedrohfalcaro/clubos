import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import Tutorial from '../Tutorial/Tutorial';
import styles from './Layout.module.css';

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
    id: 'clube',
    label: 'Clube',
    icon: '◈',
    items: [
      { to: '/squad', label: 'Elenco' },
      { to: '/tactics', label: 'Tática' },
      { to: '/under/treinamento', label: 'Treinamento' },
      { to: '/under/transferencias', label: 'Transferências' },
      { to: '/under/diretoria', label: 'Diretoria' },
      { to: '/under/financas', label: 'Finanças' },
      { to: '/under/trofeus', label: 'Sala de troféus' },
    ],
  },
  {
    id: 'jogos',
    label: 'Jogos',
    icon: '◉',
    items: [
      { to: '/matches', label: 'Registro de partida' },
      { to: '/calendar', label: 'Calendário' },
      { to: '/competitions', label: 'Competições' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    icon: '💬',
    items: [
      { to: '/under/redes-sociais', label: 'Redes sociais' },
      { to: '/under/manchetes', label: 'Manchetes' },
      { to: '/under/coletivas', label: 'Coletivas' },
      { to: '/under/social-jogadores', label: 'Jogadores' },
    ],
  },
  {
    id: 'manager',
    label: 'Manager',
    icon: '👤',
    items: [
      { to: '/under/pessoal', label: 'Pessoal' },
      { to: '/under/metas', label: 'Metas' },
      { to: '/under/conquistas', label: 'Conquistas' },
    ],
  },
];

const WIP_ROUTES = new Set([
  '/under/treinamento', '/under/transferencias', '/under/diretoria',
  '/under/financas', '/under/trofeus', '/under/redes-sociais',
  '/under/manchetes', '/under/coletivas', '/under/social-jogadores',
  '/under/pessoal', '/under/metas', '/under/conquistas',
]);

export default function Layout() {
  const { state, resetGame, completeTutorial } = useGame();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      init[g.id] = g.items.some(i => location.pathname === i.to);
    }
    return init;
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function toggleGroup(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const navContent = (
    <>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>⬡</span>
        <span className={styles.brandName}>ClubOS</span>
        <button
          type="button"
          className={styles.closeMenu}
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        >
          ×
        </button>
      </div>

      {state.team && (
        <div className={styles.club}>
          <p className={styles.clubLabel}>Clube Atual</p>
          <p className={styles.clubName}>{state.team.name}</p>
          {state.manager && (
            <p className={styles.managerName}>{state.manager.name}</p>
          )}
          <p className={styles.clubSeason}>Temporada {state.season}</p>
        </div>
      )}

      <nav className={styles.nav}>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
          }
        >
          <span className={styles.navIcon}>⊞</span>
          <span>Dashboard</span>
        </NavLink>

        {NAV_GROUPS.map(group => {
          const isOpen = expanded[group.id];
          const hasActive = group.items.some(i => location.pathname === i.to);

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
                      {WIP_ROUTES.has(item.to) && (
                        <span className={styles.wipTag}>soon</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <button className={styles.resetBtn} onClick={resetGame}>
          Reiniciar Carreira
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.root}>
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
        <span className={styles.mobileTitle}>{state.team?.name ?? 'ClubOS'}</span>
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

      {state.started && !state.tutorialCompleted && (
        <Tutorial onComplete={completeTutorial} />
      )}
    </div>
  );
}

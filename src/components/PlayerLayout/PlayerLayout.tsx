import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import Tutorial from '../Tutorial/Tutorial';
import {
  PLAYER_SECTION_TUTORIALS,
  hasSeenPlayerSection,
  markPlayerSectionSeen,
} from '../../utils/playerTutorials';
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
    id: 'carreira',
    label: 'Carreira',
    icon: '⚽',
    items: [
      { to: '/player/profile', label: 'Perfil' },
      { to: '/player/contract', label: 'Contrato' },
      { to: '/player/evolution', label: 'Evolução' },
      { to: '/player/history', label: 'Histórico' },
      { to: '/player/under/conquistas', label: 'Conquistas' },
    ],
  },
  {
    id: 'jogos',
    label: 'Jogos',
    icon: '◉',
    items: [
      { to: '/player/matches', label: 'Registro de partida' },
      { to: '/player/calendar', label: 'Calendário' },
      { to: '/player/competitions', label: 'Competições' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    icon: '💬',
    items: [
      { to: '/player/under/manchetes', label: 'Manchetes' },
      { to: '/player/under/redes', label: 'Redes sociais' },
      { to: '/player/under/relations', label: 'Relacionamentos' },
    ],
  },
];

const WIP_ROUTES = new Set([
  '/player/under/conquistas',
  '/player/under/manchetes',
  '/player/under/redes',
  '/player/under/relations',
]);

export default function PlayerLayout() {
  const { state, resetGame } = useGame();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sectionTutorial, setSectionTutorial] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      init[g.id] = g.items.some(i => location.pathname === i.to);
    }
    return init;
  });

  const player = state.careerPlayer;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!state.started) return;
    const steps = PLAYER_SECTION_TUTORIALS[location.pathname];
    if (steps && !hasSeenPlayerSection(location.pathname)) {
      setSectionTutorial(location.pathname);
    }
  }, [location.pathname, state.started]);

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

      {player && (
        <div className={styles.club}>
          <p className={styles.clubLabel}>Jogador</p>
          <p className={styles.clubName}>{player.name}</p>
          <p className={styles.managerName}>{player.currentClub.name}</p>
          <p className={styles.clubSeason}>Temporada {state.season}</p>
        </div>
      )}

      <nav className={styles.nav}>
        <NavLink
          to="/player/dashboard"
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
        <span className={styles.mobileTitle}>{player?.name ?? 'ClubOS'}</span>
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

      {sectionTutorial && PLAYER_SECTION_TUTORIALS[sectionTutorial] && (
        <Tutorial
          steps={PLAYER_SECTION_TUTORIALS[sectionTutorial]}
          onComplete={() => {
            markPlayerSectionSeen(sectionTutorial);
            setSectionTutorial(null);
          }}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CountrySelect.module.css';

interface Country {
  id: string;
  name: string;
  flag: string;
  available: boolean;
  leagues: string[];
}

const COUNTRIES: Country[] = [
  {
    id: 'england',
    name: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    available: false,
    leagues: ['Premier League', 'Championship', 'FA Cup', 'Carabao Cup'],
  },
  {
    id: 'brazil',
    name: 'Brasil',
    flag: '🇧🇷',
    available: true,
    leagues: [
      'Campeonato Brasileiro Série A',
      'Copa do Brasil',
      'Libertadores',
      'Campeonato Paulista',
      'Sul-Americana',
    ],
  },
  {
    id: 'saudi',
    name: 'Arábia Saudita',
    flag: '🇸🇦',
    available: false,
    leagues: ['Saudi Pro League', 'King\'s Cup', 'Super Cup'],
  },
];

export default function CountrySelect() {
  const navigate = useNavigate();
  const [infoCountry, setInfoCountry] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function handleSelect(country: Country) {
    if (!country.available) {
      setToast(`${country.name} — Em construção`);
      setTimeout(() => setToast(null), 2500);
      return;
    }
    navigate('/new/team');
  }

  function toggleInfo(countryId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setInfoCountry(prev => (prev === countryId ? null : countryId));
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate('/menu')}>
            ← Voltar
          </button>
          <h1 className={styles.title}>Escolha o país</h1>
          <p className={styles.sub}>Selecione onde deseja iniciar sua carreira</p>
        </header>

        <div className={styles.grid}>
          {COUNTRIES.map(country => {
            const isOpen = infoCountry === country.id;
            return (
              <div
                key={country.id}
                className={`${styles.card} ${!country.available ? styles.cardDisabled : ''} ${isOpen ? styles.cardExpanded : ''}`}
              >
                <div className={styles.cardMain}>
                  <button
                    type="button"
                    className={styles.cardSelect}
                    onClick={() => handleSelect(country)}
                  >
                    <span className={styles.flag}>{country.flag}</span>
                    <span className={styles.name}>{country.name}</span>
                    {!country.available && <span className={styles.badge}>Em breve</span>}
                  </button>
                  <button
                    type="button"
                    className={`${styles.infoBtn} ${isOpen ? styles.infoBtnActive : ''}`}
                    onClick={e => toggleInfo(country.id, e)}
                    aria-expanded={isOpen}
                    title="Ligas disponíveis"
                  >
                    ?
                  </button>
                </div>

                <div className={`${styles.infoPanel} ${isOpen ? styles.infoPanelOpen : ''}`}>
                  <div className={styles.infoInner}>
                    <p className={styles.infoTitle}>Ligas em {country.name}</p>
                    <ul>
                      {country.leagues.map(l => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}

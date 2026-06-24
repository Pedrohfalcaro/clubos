import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import Layout from './components/Layout/Layout';
import Splash from './pages/Splash/Splash';
import MainMenu from './pages/MainMenu/MainMenu';
import CountrySelect from './pages/CountrySelect/CountrySelect';
import TeamSelect from './pages/TeamSelect/TeamSelect';
import ManagerSetup from './pages/Setup/ManagerSetup';
import CompetitionsSetup from './pages/Setup/CompetitionsSetup';
import Dashboard from './pages/Dashboard/Dashboard';
import Squad from './pages/Squad/Squad';
import MatchRegistration from './pages/Matches/Matches';
import Calendar from './pages/Calendar/Calendar';
import Tactics from './pages/Tactics/Tactics';
import MatchPlay from './pages/MatchPlay/MatchPlay';
import Competitions from './pages/Competitions/Competitions';
import UnderConstruction from './pages/UnderConstruction/UnderConstruction';

function AppRoutes() {
  const { state } = useGame();

  if (!state.started) {
    return (
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/menu" element={<MainMenu />} />
        <Route path="/new/country" element={<CountrySelect />} />
        <Route path="/new/team" element={<TeamSelect />} />
        <Route path="/setup/manager" element={<ManagerSetup />} />
        <Route path="/setup/competitions" element={<CompetitionsSetup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/match/:matchId/play" element={<MatchPlay />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/squad" element={<Squad />} />
        <Route path="/matches" element={<MatchRegistration />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/tactics" element={<Tactics />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/under/:section" element={<UnderConstruction />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <BrowserRouter basename={basename || undefined}>
      <GameProvider>
        <AppRoutes />
      </GameProvider>
    </BrowserRouter>
  );
}

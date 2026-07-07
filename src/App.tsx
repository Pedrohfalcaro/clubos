import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import Layout from './components/Layout/Layout';
import PlayerLayout from './components/PlayerLayout/PlayerLayout';
import Splash from './pages/Splash/Splash';
import MainMenu from './pages/MainMenu/MainMenu';
import CareerModeSelect from './pages/CareerModeSelect/CareerModeSelect';
import CountrySelect from './pages/CountrySelect/CountrySelect';
import TeamSelect from './pages/TeamSelect/TeamSelect';
import ManagerSetup from './pages/Setup/ManagerSetup';
import CompetitionsSetup from './pages/Setup/CompetitionsSetup';
import PlayerCreate from './pages/PlayerSetup/PlayerCreate';
import PlayerClubSetup from './pages/PlayerSetup/PlayerClubSetup';
import Dashboard from './pages/Dashboard/Dashboard';
import Squad from './pages/Squad/Squad';
import MatchRegistration from './pages/Matches/Matches';
import Calendar from './pages/Calendar/Calendar';
import Tactics from './pages/Tactics/Tactics';
import MatchPlay from './pages/MatchPlay/MatchPlay';
import Competitions from './pages/Competitions/Competitions';
import UnderConstruction from './pages/UnderConstruction/UnderConstruction';
import PlayerDashboard from './pages/Player/Dashboard/PlayerDashboard';
import PlayerMatches from './pages/Player/Matches/PlayerMatches';
import PlayerCalendar from './pages/Player/Calendar/PlayerCalendar';
import PlayerCompetitions from './pages/Player/Competitions/PlayerCompetitions';
import PlayerMatchPlay from './pages/Player/MatchPlay/PlayerMatchPlay';
import PlayerProfile from './pages/Player/Profile/PlayerProfile';
import PlayerContract from './pages/Player/Contract/PlayerContract';
import PlayerEvolution from './pages/Player/Evolution/PlayerEvolution';
import PlayerHistory from './pages/Player/History/PlayerHistory';

function SetupRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/menu" element={<MainMenu />} />
      <Route path="/new/mode" element={<CareerModeSelect />} />
      <Route path="/new/country" element={<CountrySelect />} />
      <Route path="/new/team" element={<TeamSelect />} />
      <Route path="/setup/manager" element={<ManagerSetup />} />
      <Route path="/setup/competitions" element={<CompetitionsSetup />} />
      <Route path="/new/player" element={<PlayerCreate />} />
      <Route path="/setup/player-club" element={<PlayerClubSetup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function CoachRoutes() {
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

function PlayerRoutes() {
  return (
    <Routes>
      <Route path="/player/match/:matchId/play" element={<PlayerMatchPlay />} />
      <Route element={<PlayerLayout />}>
        <Route path="/player/dashboard" element={<PlayerDashboard />} />
        <Route path="/player/matches" element={<PlayerMatches />} />
        <Route path="/player/calendar" element={<PlayerCalendar />} />
        <Route path="/player/competitions" element={<PlayerCompetitions />} />
        <Route path="/player/profile" element={<PlayerProfile />} />
        <Route path="/player/contract" element={<PlayerContract />} />
        <Route path="/player/evolution" element={<PlayerEvolution />} />
        <Route path="/player/history" element={<PlayerHistory />} />
        <Route path="/player/under/:section" element={<UnderConstruction />} />
        <Route path="*" element={<Navigate to="/player/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/player/dashboard" replace />} />
    </Routes>
  );
}

function AppRoutes() {
  const { state } = useGame();

  if (!state.started) {
    return <SetupRoutes />;
  }

  if (state.careerMode === 'player') {
    return <PlayerRoutes />;
  }

  return <CoachRoutes />;
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

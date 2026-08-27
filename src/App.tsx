import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import Layout from './components/Layout/Layout';
import PlayerLayout from './components/PlayerLayout/PlayerLayout';
import NationalLayout from './components/NationalLayout/NationalLayout';
import Splash from './pages/Splash/Splash';
import MainMenu from './pages/MainMenu/MainMenu';
import CareerModeSelect from './pages/CareerModeSelect/CareerModeSelect';
import CountrySelect from './pages/CountrySelect/CountrySelect';
import ClubCreate from './pages/ClubCreate/ClubCreate';
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
import PulseMatch from './pages/PulseMatch/PulseMatch';
import PulsePage from './pages/Pulse/Pulse';
import Competitions from './pages/Competitions/Competitions';
import UnderConstruction from './pages/UnderConstruction/UnderConstruction';
import Social from './pages/Social/Social';
import PressConference from './pages/PressConference/PressConference';
import ManagerPage from './pages/Manager/Manager';
import Trophies from './pages/Trophies/Trophies';
import Finance from './pages/Finance/Finance';
import Board from './pages/Board/Board';
import Transfers from './pages/Transfers/Transfers';
import PlayerDashboard from './pages/Player/Dashboard/PlayerDashboard';
import PlayerMatches from './pages/Player/Matches/PlayerMatches';
import PlayerCalendar from './pages/Player/Calendar/PlayerCalendar';
import PlayerCompetitions from './pages/Player/Competitions/PlayerCompetitions';
import PlayerMatchPlay from './pages/Player/MatchPlay/PlayerMatchPlay';
import PlayerProfile from './pages/Player/Profile/PlayerProfile';
import PlayerContract from './pages/Player/Contract/PlayerContract';
import PlayerEvolution from './pages/Player/Evolution/PlayerEvolution';
import PlayerHistory from './pages/Player/History/PlayerHistory';
import NationalDashboard from './pages/National/Dashboard/NationalDashboard';
import NationalWindows from './pages/National/Windows/NationalWindows';
import NationalWindowHub from './pages/National/WindowHub/NationalWindowHub';
import NationalPlayerBase from './pages/National/PlayerBase/NationalPlayerBase';
import NationalHistory from './pages/National/History/NationalHistory';
import NationalBoard from './pages/National/Board/NationalBoard';
import NationalMatchPlay from './pages/National/MatchPlay/NationalMatchPlay';
import { useAuth } from './context/AuthContext';

function SetupRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/menu" element={<MainMenu />} />
      <Route path="/new/mode" element={<RequireAuth><CareerModeSelect /></RequireAuth>} />
      <Route path="/new/country" element={<RequireAuth><CountrySelect /></RequireAuth>} />
      <Route path="/new/team" element={<RequireAuth><ClubCreate /></RequireAuth>} />
      <Route path="/setup/manager" element={<RequireAuth><ManagerSetup /></RequireAuth>} />
      <Route path="/setup/competitions" element={<RequireAuth><CompetitionsSetup /></RequireAuth>} />
      <Route path="/new/player" element={<RequireAuth><PlayerCreate /></RequireAuth>} />
      <Route path="/setup/player-club" element={<RequireAuth><PlayerClubSetup /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  if (loading) return null;
  if (!configured || !user) return <Navigate to="/menu" replace />;
  return <>{children}</>;
}

function CoachRoutes() {
  const { state } = useGame();
  // Modo Seleção (Dual Career, v1.4) — substitui o Layout de clube inteiro
  // enquanto ativo. `nationalTeam` é a guarda real: sem ele, sempre cai no clube.
  const inNational = state.activeContext === 'national' && !!state.nationalTeam;

  if (inNational) {
    return (
      <Routes>
        <Route path="/national/match/:windowId/:gameId/play" element={<NationalMatchPlay />} />
        <Route element={<NationalLayout />}>
          <Route path="/national/dashboard" element={<NationalDashboard />} />
          <Route path="/national/windows" element={<NationalWindows />} />
          <Route path="/national/windows/:windowId" element={<NationalWindowHub />} />
          <Route path="/national/players" element={<NationalPlayerBase />} />
          <Route path="/national/history" element={<NationalHistory />} />
          <Route path="/national/board" element={<NationalBoard />} />
          <Route path="*" element={<Navigate to="/national/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/national/dashboard" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/match/:matchId/pulse" element={<PulseMatch />} />
      <Route path="/match/:matchId/play" element={<MatchPlay />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/squad" element={<Squad />} />
        <Route path="/matches" element={<MatchRegistration />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/tactics" element={<Tactics />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/pulse" element={<PulsePage />} />
        <Route path="/financas" element={<Finance />} />
        <Route path="/diretoria" element={<Board />} />
        <Route path="/transferencias" element={<Transfers />} />
        <Route path="/social" element={<Social />} />
        <Route path="/press-conference" element={<PressConference />} />
        <Route path="/manager" element={<ManagerPage />} />
        <Route path="/trofeus" element={<Trophies />} />
        <Route path="/under/redes-sociais" element={<Navigate to="/social" replace />} />
        <Route path="/under/manchetes" element={<Navigate to="/social" replace />} />
        <Route path="/under/coletivas" element={<Navigate to="/press-conference" replace />} />
        <Route path="/under/pessoal" element={<Navigate to="/manager" replace />} />
        <Route path="/under/trofeus" element={<Navigate to="/trofeus" replace />} />
        <Route path="/under/conquistas" element={<Navigate to="/trofeus" replace />} />
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
      <AuthProvider>
        <GameProvider>
          <AppRoutes />
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

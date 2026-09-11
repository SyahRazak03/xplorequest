import React, { createContext, useState, useContext, ReactNode } from 'react';
import { UserRole, UserProfile, EventConfig, mockEvent, mockEventsList, Checkpoint, mockCheckpoints, Team, mockTeams } from './mockData';

import { Theme, getThemeForRole } from './theme';

export interface RaceRules {
  maxRaceTime: number; // minutes
  taskTimeLimit: number; // minutes
  latePenaltyMin: number; // minutes
  pointPenaltyPts: number; // points
  bonusPoints: number; // points
  pointsSystemEnabled: boolean;
  latePenaltyEnabled: boolean;
  taskTimeLimitEnabled: boolean;
  pointPenaltyEnabled: boolean;
  bonusPointsEnabled: boolean;
}

interface AppContextType {
  role: UserRole | null;
  user: UserProfile | null;
  theme: Theme;
  activeEvent: EventConfig | null;
  events: EventConfig[];
  selectedEventId: string | null;
  teams: Team[];
  checkpoints: Checkpoint[];
  rules: RaceRules;
  isOffline: boolean;
  syncQueueCount: number;
  crewPinCode: string;
  isRaceStarted: boolean;
  raceStartTime: number | null;
  startRace: () => void;
  resetDemoState: () => void;
  login: (role: UserRole, userProfile: UserProfile | null) => void;
  logout: () => void;
  setTemporaryRole: (role: UserRole) => void;
  setActiveEvent: (event: EventConfig) => void;
  setEvents: React.Dispatch<React.SetStateAction<EventConfig[]>>;
  setSelectedEventId: (id: string | null) => void;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  setCheckpoints: React.Dispatch<React.SetStateAction<Checkpoint[]>>;
  setRules: React.Dispatch<React.SetStateAction<RaceRules>>;
  setIsOffline: (offline: boolean) => void;
  setSyncQueueCount: React.Dispatch<React.SetStateAction<number>>;
  setCrewPinCode: React.Dispatch<React.SetStateAction<string>>;
}




const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<EventConfig[]>(mockEventsList);
  const [selectedEventId, setSelectedEventId] = useState<string | null>('EV-001');
  const [teams, setTeams] = useState<Team[]>(mockTeams);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(mockCheckpoints);
  
  const [rules, setRules] = useState<RaceRules>({
    maxRaceTime: 240,
    taskTimeLimit: 15,
    latePenaltyMin: 10,
    pointPenaltyPts: 50,
    bonusPoints: 100,
    pointsSystemEnabled: true,
    latePenaltyEnabled: true,
    taskTimeLimitEnabled: true,
    pointPenaltyEnabled: true,
    bonusPointsEnabled: true,
  });


  const [isOffline, setIsOffline] = useState(false);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [crewPinCode, setCrewPinCode] = useState('1234');
  const [isRaceStarted, setIsRaceStarted] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

  const startRace = () => {
    setIsRaceStarted(true);
    setRaceStartTime(Date.now());
  };

  const resetDemoState = () => {
    setIsRaceStarted(false);
    setRaceStartTime(null);
    setEvents(mockEventsList);
    setSelectedEventId('EV-001');
    setTeams(mockTeams);
    setCheckpoints(mockCheckpoints);
    setRules({
      maxRaceTime: 240,
      taskTimeLimit: 15,
      latePenaltyMin: 10,
      pointPenaltyPts: 50,
      bonusPoints: 100,
      pointsSystemEnabled: true,
      latePenaltyEnabled: true,
      taskTimeLimitEnabled: true,
      pointPenaltyEnabled: true,
      bonusPointsEnabled: true,
    });
    setSyncQueueCount(0);
    setIsOffline(false);
    setCrewPinCode('1234');
    setRole(null);
    setUser(null);
  };

  // Derive activeEvent dynamically
  const activeEvent = events.find(e => e.id === selectedEventId) || null;

  // Derive theme from active role; fallback to 'participant' if not logged in/set
  const activeTheme = getThemeForRole(role || 'participant');

  const login = (newRole: UserRole, userProfile: UserProfile | null) => {
    setRole(newRole);
    setUser(userProfile);
  };

  const logout = () => {
    setRole(null);
    setUser(null);
  };

  const setTemporaryRole = (newRole: UserRole) => {
    setRole(newRole);
  };

  const setActiveEvent = (newEvent: EventConfig) => {
    setEvents(prev => {
      const exists = prev.some(e => e.id === newEvent.id);
      if (exists) {
        return prev.map(e => e.id === newEvent.id ? newEvent : e);
      }
      return [...prev, newEvent];
    });
    setSelectedEventId(newEvent.id);
  };

  return (
    <AppContext.Provider
      value={{
        role,
        user,
        theme: activeTheme,
        activeEvent,
        events,
        selectedEventId,
        teams,
        checkpoints,
        rules,
        isOffline,
        syncQueueCount,
        crewPinCode,
        isRaceStarted,
        raceStartTime,
        startRace,
        resetDemoState,
        login,
        logout,
        setTemporaryRole,
        setActiveEvent,
        setEvents,
        setSelectedEventId,
        setTeams,
        setCheckpoints,
        setRules,
        setIsOffline,
        setSyncQueueCount,
        setCrewPinCode,
      }}
    >





      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
};

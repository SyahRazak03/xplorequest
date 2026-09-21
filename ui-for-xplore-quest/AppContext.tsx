import React, { createContext, useState, useContext, ReactNode } from 'react';
import { UserRole, UserProfile, EventConfig, Checkpoint, Team } from './types';

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
  attendanceMarshalId: string | null;
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
  setAttendanceMarshalId: React.Dispatch<React.SetStateAction<string | null>>;
}




const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  
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
  const [attendanceMarshalId, setAttendanceMarshalId] = useState<string | null>(null);
  const [isRaceStarted, setIsRaceStarted] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

  // Initialize SQLite database queue (Objective 1.4.3) and poll sync queue count
  React.useEffect(() => {
    let isMounted = true;
    import('./services/sqliteQueueService').then(({ initQueueDatabase, getPendingTelemetryScans, syncPendingQueue }) => {
      initQueueDatabase().then(() => {
        if (!isMounted) return;
        getPendingTelemetryScans().then(pending => {
          if (isMounted) setSyncQueueCount(pending.length);
        });
      });

      // Auto drain SQLite queue when online
      if (!isOffline && selectedEventId) {
        syncPendingQueue(selectedEventId, user?.idToken).then(({ syncedCount }) => {
          if (!isMounted) return;
          if (syncedCount > 0) {
            getPendingTelemetryScans().then(pending => {
              if (isMounted) setSyncQueueCount(pending.length);
            });
          }
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOffline, selectedEventId, user?.idToken]);

  // Fetch real live events from Firestore on app startup
  React.useEffect(() => {
    let isMounted = true;
    import('./services/eventService').then(({ fetchLiveEvents }) => {
      fetchLiveEvents().then((liveEvents) => {
        if (!isMounted) return;
        if (liveEvents && liveEvents.length > 0) {
          setEvents(liveEvents);
          if (!selectedEventId) {
            setSelectedEventId(liveEvents[0].id);
          }
        }
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Automatically fetch live checkpoints from Cloud API/Firestore whenever selectedEventId changes
  React.useEffect(() => {
    if (!selectedEventId) return;
    let isMounted = true;
    import('./services/checkpointService').then(({ getCheckpoints }) => {
      getCheckpoints(selectedEventId, user?.idToken || 'token-admin-casaria')
        .then((liveCPs) => {
          if (!isMounted) return;
          if (liveCPs && Array.isArray(liveCPs)) {
            setCheckpoints(liveCPs);
          }
        })
        .catch((err) => {
          console.warn('Failed to load live checkpoints for event:', err);
        });
    });
    return () => {
      isMounted = false;
    };
  }, [selectedEventId, user?.idToken]);

  const startRace = () => {
    setIsRaceStarted(true);
    setRaceStartTime(Date.now());
  };

  const resetDemoState = () => {
    setIsRaceStarted(false);
    setRaceStartTime(null);
    setEvents([]);
    setSelectedEventId(null);
    setTeams([]);
    setCheckpoints([]);
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
    setAttendanceMarshalId(null);
    setRole(null);
    setUser(null);
  };

  // Derive activeEvent dynamically
  const activeEvent = events.find(e => e.id === selectedEventId) || null;

  // Derive theme from active role; fallback to 'participant' if not logged in/set
  const activeTheme = getThemeForRole(role || 'participant');

  // Restore persisted hardware-encrypted session on app mount
  React.useEffect(() => {
    let isMounted = true;
    import('./services/storageService').then(({ loadUserSession }) => {
      loadUserSession().then((session) => {
        if (!isMounted) return;
        if (session && session.user) {
          setRole(session.role);
          setUser(session.user);
          if (session.user.eventId) {
            setSelectedEventId(session.user.eventId);
          }
        }
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const login = (newRole: UserRole, userProfile: UserProfile | null) => {
    setRole(newRole);
    setUser(userProfile);
    import('./services/storageService').then(({ saveUserSession }) => {
      saveUserSession(newRole, userProfile);
    });
  };

  const logout = () => {
    setRole(null);
    setUser(null);
    import('./services/storageService').then(({ clearUserSession }) => {
      clearUserSession();
    });
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
        attendanceMarshalId,
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
        setAttendanceMarshalId,
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

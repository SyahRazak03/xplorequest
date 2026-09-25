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
  
  // Derive activeEvent dynamically
  const activeEvent = events.find(e => e.id === selectedEventId) || null;
  
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
  const [crewPinCode, setCrewPinCode] = useState('');
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

  // Fetch real live events from API/Firestore scoped to current user & role
  React.useEffect(() => {
    let isMounted = true;
    const token = user?.idToken;
    const uid = user?.id;
    const currentRole = role || 'participant';

    import('./services/eventService').then(({ fetchLiveEvents }) => {
      fetchLiveEvents(token, uid, currentRole).then((liveEvents) => {
        if (!isMounted) return;
        setEvents(liveEvents || []);

        if (liveEvents && liveEvents.length > 0) {
          const currentValid = liveEvents.some((e) => e.id === selectedEventId);
          if (!currentValid || !selectedEventId) {
            setSelectedEventId(liveEvents[0].id);
          }
        } else {
          setSelectedEventId(null);
        }
      });
    });
    return () => {
      isMounted = false;
    };
  }, [user?.idToken, user?.id, role]);

  // Automatically fetch live checkpoints from Cloud API/Firestore whenever selectedEventId changes
  React.useEffect(() => {
    if (!selectedEventId) return;
    let isMounted = true;
    import('./services/checkpointService').then(({ getCheckpoints }) => {
      if (!user?.idToken) return;
      getCheckpoints(selectedEventId, user.idToken)
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

  // Real-time Firestore listener for event race start status (isStarted / status)
  React.useEffect(() => {
    const eventId = activeEvent?.id || selectedEventId;
    if (!eventId) return;
    let isMounted = true;
    let unsub: (() => void) | null = null;

    import('./services/eventService').then(({ subscribeToEventState }) => {
      if (!isMounted) return;
      unsub = subscribeToEventState(eventId, ({ isStarted, startedAt }) => {
        if (!isMounted) return;
        if (isStarted) {
          setIsRaceStarted(true);
          if (startedAt) {
            setRaceStartTime(startedAt);
          }
        }
      });
    });

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [activeEvent?.id, selectedEventId]);

  const startRace = () => {
    setIsRaceStarted(true);
    setRaceStartTime(Date.now());
    const eventId = activeEvent?.id || selectedEventId;
    if (!eventId) return;
    import('./services/eventService').then(({ startRaceService }) => {
      startRaceService(eventId, user?.idToken).catch((err) => {
        console.warn('Failed to broadcast race start to Firestore:', err);
      });
    });
  };



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
    setEvents([]);
    setSelectedEventId(null);
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

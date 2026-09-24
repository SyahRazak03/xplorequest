import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppContextProvider } from './AppContext';
import { useFonts, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { COLORS } from './theme';
import DashboardScreen from './screens/DashboardScreen';
import LoginScreen from './screens/LoginScreen';
import RoleSelectScreen from './screens/RoleSelectScreen';
import SplashScreen from './screens/SplashScreen';
import OrganizerEntryScreen from './screens/OrganizerEntryScreen';
import StaggeredStartScreen from './screens/StaggeredStartScreen';
import CrewVerificationWizard from './screens/CrewVerificationWizard';
import AdminCreateEventScreen from './screens/AdminCreateEventScreen';
import AdminGeofenceDesignerScreen from './screens/AdminGeofenceDesignerScreen';
import AdminCheckpointManagerScreen from './screens/AdminCheckpointManagerScreen';
import AdminRulesConfigScreen from './screens/AdminRulesConfigScreen';
import AdminLeaderboardScreen from './screens/AdminLeaderboardScreen';
import AntiCheatExplainerScreen from './screens/AntiCheatExplainerScreen';
import AdminEventDetailScreen from './screens/AdminEventDetailScreen';
import AdminTeamsManagerScreen from './screens/AdminTeamsManagerScreen';
import AdminPreRegistrationsScreen from './screens/AdminPreRegistrationsScreen';

import { getThemeForRole, UserRole } from './theme';



import FinishLineScreen from './screens/FinishLineScreen';
import ParticipantJoinScreen from './screens/ParticipantJoinScreen';
import ParticipantAttendanceScanScreen from './screens/ParticipantAttendanceScanScreen';
import CrewSelectCheckpointScreen from './screens/CrewSelectCheckpointScreen';
import PersonalResultsScreen from './screens/PersonalResultsScreen';
import { navigationRef } from './components';


export type RootStackParamList = {
  Splash: undefined;
  RoleSelect: undefined;
  Login: { role: UserRole };
  ParticipantJoin: undefined;
  ParticipantAttendanceScan: undefined;
  CrewSelectCheckpoint: undefined;
  OrganizerEntry: undefined;
  StaggeredStart: undefined;
  Dashboard: { completedTeamId?: string } | undefined;
  CrewVerificationWizard: { teamId: string };
  AdminCreateEvent: undefined;
  AdminEventDetail: undefined;
  AdminTeamsManager: undefined;
  AdminPreRegistrations: undefined;
  AdminGeofenceDesigner: undefined;
  AdminCheckpointManager: undefined;
  AdminRulesConfig: undefined;
  AdminLeaderboard: undefined;


  AntiCheatExplainer: undefined;






  FinishLine: {
    completedCps: string[];
    skippedCps: string[];
    points: number;
    elapsedTime: number;
  };
  PersonalResults: {
    finalPoints: number;
    elapsedTime: number;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({ Caveat_700Bold });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.participant.primary} />
      </View>
    );
  }

  return (
    <AppContextProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ParticipantJoin" component={ParticipantJoinScreen} />
          <Stack.Screen name="ParticipantAttendanceScan" component={ParticipantAttendanceScanScreen} />
          <Stack.Screen name="CrewSelectCheckpoint" component={CrewSelectCheckpointScreen} />
          <Stack.Screen name="OrganizerEntry" component={OrganizerEntryScreen} />
          <Stack.Screen name="StaggeredStart" component={StaggeredStartScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="CrewVerificationWizard" component={CrewVerificationWizard} />
          <Stack.Screen name="AdminCreateEvent" component={AdminCreateEventScreen} />
          <Stack.Screen name="AdminEventDetail" component={AdminEventDetailScreen} />
          <Stack.Screen name="AdminTeamsManager" component={AdminTeamsManagerScreen} />
          <Stack.Screen name="AdminPreRegistrations" component={AdminPreRegistrationsScreen} />
          <Stack.Screen name="AdminGeofenceDesigner" component={AdminGeofenceDesignerScreen} />


          <Stack.Screen name="AdminCheckpointManager" component={AdminCheckpointManagerScreen} />
          <Stack.Screen name="AdminRulesConfig" component={AdminRulesConfigScreen} />
          <Stack.Screen name="AdminLeaderboard" component={AdminLeaderboardScreen} />
          <Stack.Screen name="AntiCheatExplainer" component={AntiCheatExplainerScreen} />
          <Stack.Screen name="FinishLine" component={FinishLineScreen} />






          <Stack.Screen name="PersonalResults" component={PersonalResultsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppContextProvider>
  );
}




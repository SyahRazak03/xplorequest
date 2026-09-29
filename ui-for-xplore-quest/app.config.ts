import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const DEFAULT_MAPS_KEY = ['AIzaSy', 'AfJAm6O8LX1PNGMTtqaNmLApLCEzg6Zps'].join('');
  const googleMapsApiKeyAndroid =
    process.env['GOOGLE_MAPS_API_KEY_ANDROID'] ||
    process.env['EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'] ||
    DEFAULT_MAPS_KEY;
  const googleMapsApiKeyIos =
    process.env['GOOGLE_MAPS_API_KEY_IOS'] ||
    process.env['EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'] ||
    DEFAULT_MAPS_KEY;

  return {
    ...config,
    name: config.name ?? 'XploreQuest',
    slug: config.slug ?? 'xplore-quest',
    version: config.version ?? '1.0.0',
    orientation: 'portrait',
    icon: './assets/XploreQuest_Icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/XploreQuest_Icon.png',
      resizeMode: 'contain',
      backgroundColor: '#FAF9F6',
    },
    ios: {
      ...config.ios,
      supportsTablet: true,
      bundleIdentifier: 'com.syahzxyz.xplorequest',
      config: {
        googleMapsApiKey: googleMapsApiKeyIos,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'XploreQuest requires location access to detect checkpoint arrivals and verify event geofence zones.',
      },
    },
    android: {
      ...config.android,
      package: 'com.syahzxyz.xplorequest',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundColor: '#FAF9F6',
      },
      config: {
        googleMaps: {
          apiKey: googleMapsApiKeyAndroid,
        },
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
      ],
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-font',
      [
        'expo-image-picker',
        {
          photosPermission:
            'The app accesses your photos to let you share images for checkpoints.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'XploreQuest requires location access to detect checkpoint arrivals.',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: '9b74acd4-461a-4684-8aa6-875b8b36ee7b',
      },
    },
    owner: 'syahzxyz',
  };
};

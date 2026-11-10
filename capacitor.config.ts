import type { CapacitorConfig } from '@capacitor/cli';

// Identita' dell'app in un solo punto: app.config.json (nome ancora da decidere).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const identita = require('./app.config.json') as {
  appId: string;
  nome: string;
  coloreSfondo: string;
};

const config: CapacitorConfig = {
  appId: identita.appId,
  appName: identita.nome,
  webDir: 'out',
  backgroundColor: identita.coloreSfondo,
  // Le pagine sono servite da capacitor://localhost (iOS) e https://localhost (Android):
  // il backend accetta queste origini nel CORS.
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: identita.coloreSfondo,
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

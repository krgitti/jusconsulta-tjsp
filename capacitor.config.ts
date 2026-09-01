import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.jusconsulta.tjsp',
  appName: 'JusConsulta TJSP',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: 'release.keystore',
      keystorePassword: process.env.KEYSTORE_PASSWORD || '',
      keystoreAlias: 'jusconsulta',
      keystoreAliasPassword: process.env.KEY_PASSWORD || '',
      releaseType: 'APK',
    },
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

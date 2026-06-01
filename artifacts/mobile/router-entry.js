// App-local copy of expo-router/entry-classic (avoids OneDrive + pnpm hardlink SHA-1 issues).
import '@expo/metro-runtime';

import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

renderRootComponent(App);

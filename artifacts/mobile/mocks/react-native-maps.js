import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = React.forwardRef(({ style, children }, ref) => (
  <View
    ref={ref}
    style={[{ backgroundColor: '#1d2c4d', alignItems: 'center', justifyContent: 'center' }, style]}
  >
    <Text style={{ color: '#8ec3b9', fontSize: 14, fontFamily: 'System' }}>
      🗺 Map (native only)
    </Text>
    {children}
  </View>
));

MapView.displayName = 'MapView';

export default MapView;

export const Marker = ({ children }) => <>{children}</>;
export const Polyline = () => null;
export const Circle = () => null;
export const Polygon = () => null;
export const Callout = ({ children }) => <>{children}</>;
export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = 'google';
export const MapCallout = ({ children }) => <>{children}</>;
export const LatLng = () => null;
export const AnimatedRegion = class {
  constructor(region) { Object.assign(this, region); }
  timing() { return { start: () => {} }; }
  spring() { return { start: () => {} }; }
};

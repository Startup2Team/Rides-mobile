// Config plugin: set $RNFirebaseAsStaticFramework = true in the Podfile.
//
// With `useFrameworks: "static"`, @react-native-firebase podspecs require this
// global (RNFBApp.podspec / RNFBMessaging.podspec check `defined?`) so the RNFB
// pods build as STATIC frameworks. Without it their headers can't resolve React
// types across module boundaries and RNFBMessaging fails to compile:
//   "Declaration of 'RCTPromiseRejectBlock' must be imported from module
//    'RNFBApp.RNFBAppModule' before it is required"
// This is the fix documented by react-native-firebase for use_frameworks.
// Same Podfile-patch pattern as withNonModularHeaders.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const LINE = '$RNFirebaseAsStaticFramework = true';

module.exports = function withRNFirebaseStaticFramework(config) {
  return withDangerousMod(config, [
    'ios',
    innerConfig => {
      const podfilePath = path.join(innerConfig.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(LINE)) return innerConfig;
      // Must be defined before the target/podspecs are evaluated — top of file.
      contents = `${LINE}\n${contents}`;
      fs.writeFileSync(podfilePath, contents);
      return innerConfig;
    },
  ]);
};

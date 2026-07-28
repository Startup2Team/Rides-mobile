// Config plugin: allow non-modular includes in framework modules on iOS.
//
// With `useFrameworks: "static"` (required by @react-native-firebase), RNFB's
// RNFBUtilsModule includes RN's RCTBridgeModule.h non-modularly, which -Werror
// turns into a fatal build error:
//   "include of non-modular header inside framework module 'RNFBApp...'"
// Setting CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES on every pod
// target makes that a non-fatal warning, which is the standard Firebase + static
// frameworks fix. Applied via a Podfile post_install patch during prebuild.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SETTING = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';

module.exports = function withNonModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    innerConfig => {
      const podfilePath = path.join(innerConfig.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(SETTING)) return innerConfig;

      const inject = [
        '',
        '    installer.pods_project.targets.each do |target|',
        '      target.build_configurations.each do |bc|',
        `        bc.build_settings['${SETTING}'] = 'YES'`,
        '      end',
        '    end',
      ].join('\n');

      // Inject into the Expo-generated `post_install do |installer|` block.
      if (contents.match(/post_install do \|installer\|/)) {
        contents = contents.replace(/post_install do \|installer\|/, `post_install do |installer|${inject}`);
      } else {
        // No post_install block — append one before the final `end` of the target.
        contents += `\n\npost_install do |installer|${inject}\nend\n`;
      }
      fs.writeFileSync(podfilePath, contents);
      return innerConfig;
    },
  ]);
};

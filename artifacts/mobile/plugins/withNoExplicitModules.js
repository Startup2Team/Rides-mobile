// Config plugin: disable Xcode's "Explicitly Built Modules" for all targets.
//
// Xcode 26 builds C/ObjC modules explicitly by default. Under that mode, a
// declaration textually swallowed into a framework module (which is what
// CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES makes RNFBApp do with
// React headers) becomes owned by that module, and any other pod touching it
// fails with:
//   "Declaration of 'RCTPromiseRejectBlock' must be imported from module
//    'RNFBApp.RNFBAppModule' before it is required"
// followed by a cascade of macro-expansion errors in RNFBMessaging. Turning
// explicit modules off restores the classic semantics the RN + Firebase +
// static-frameworks stack was built around. Same Podfile-patch pattern as
// withNonModularHeaders; applies to every pod target and the app project.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'CLANG_ENABLE_EXPLICIT_MODULES';

module.exports = function withNoExplicitModules(config) {
  return withDangerousMod(config, [
    'ios',
    innerConfig => {
      const podfilePath = path.join(innerConfig.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) return innerConfig;

      const inject = [
        '',
        '    # Disable explicitly built modules (Xcode 26 default) — see plugins/withNoExplicitModules.js.',
        '    installer.pods_project.targets.each do |target|',
        '      target.build_configurations.each do |bc|',
        `        bc.build_settings['${MARKER}'] = 'NO'`,
        "        bc.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'",
        '      end',
        '    end',
        '    installer.aggregate_targets.each do |aggregate_target|',
        '      aggregate_target.user_project.native_targets.each do |target|',
        '        target.build_configurations.each do |bc|',
        `          bc.build_settings['${MARKER}'] = 'NO'`,
        "          bc.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'",
        '        end',
        '      end',
        '      aggregate_target.user_project.save',
        '    end',
      ].join('\n');

      if (contents.match(/post_install do \|installer\|/)) {
        contents = contents.replace(/post_install do \|installer\|/, `post_install do |installer|${inject}`);
      } else {
        contents += `\n\npost_install do |installer|${inject}\nend\n`;
      }
      fs.writeFileSync(podfilePath, contents);
      return innerConfig;
    },
  ]);
};

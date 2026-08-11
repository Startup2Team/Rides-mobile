// Config plugin: raise every pod's iOS deployment target to the app minimum.
//
// Third-party pods (Firebase, Sentry, SDWebImage, lottie, …) declare ancient
// minimums (iOS 9–13). New Xcode versions flag every one of them with
// "deployment target … is set to X, but the range of supported versions is
// 15.0 to …", drowning the build log in warnings. The app never ships below
// the Podfile's platform version anyway, so pin every pod target up to it.
// Applied via a Podfile post_install patch during prebuild, same pattern as
// withNonModularHeaders.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'IPHONEOS_DEPLOYMENT_TARGET floor';
const MIN_IOS = '15.1';

module.exports = function withPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    innerConfig => {
      const podfilePath = path.join(innerConfig.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) return innerConfig;

      const inject = [
        '',
        `    # ${MARKER}: silence "deployment target is set to X" warning wall.`,
        '    installer.pods_project.targets.each do |target|',
        '      target.build_configurations.each do |bc|',
        `        if bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS}`,
        `          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'`,
        '        end',
        '      end',
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

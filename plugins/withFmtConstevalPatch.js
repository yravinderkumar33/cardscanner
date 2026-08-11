const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Xcode 26.4 / Apple Clang 21 breaks fmt's consteval formatting in RN pods
// (react-native-executorch#1081, facebook/react-native#55601). Same workaround
// the library's own example app uses, injected into the generated Podfile's
// post_install hook so it survives `expo prebuild --clean`.
const PATCH = `    # Xcode 26.4 fmt-consteval workaround (react-native-executorch#1081)
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt' || target.name == 'RCT-Folly'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FMT_USE_CONSTEVAL=0'
        end
      end
    end
`;

module.exports = function withFmtConstevalPatch(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('FMT_USE_CONSTEVAL')) {
        // Insert inside the existing post_install block (a second post_install
        // block would be a CocoaPods error).
        contents = contents.replace(/post_install do \|installer\|\n/, (m) => m + PATCH);
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};

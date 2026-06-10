# Mobile Release Validation

Pull requests and pushes to `main` or `develop` run mobile release validation in GitHub Actions.

## What It Validates

- Required public Expo environment variables are present and structurally valid without printing values.
- Expo can resolve the public application configuration and config plugins.
- Metro can produce a minified production Android export.
- Expo prebuild can generate the Android native project from the current configuration.

The CI workflow uses a non-secret placeholder Mapbox public token. This validates configuration and
bundling only; it does not make production Mapbox requests.

The release job installs all workspace dependencies first, then applies `NODE_ENV=production` only
to Expo configuration, export, and prebuild commands so required build tooling remains available.

## What It Does Not Validate

- Signed APK or AAB creation.
- App Store or Play Store credentials and submission.
- Production service availability or API credentials.
- Runtime behavior on physical Android or iOS devices.
- iOS native compilation, which requires a macOS runner.

Before a production release, build signed native artifacts with the release environment and run
device-level smoke tests.

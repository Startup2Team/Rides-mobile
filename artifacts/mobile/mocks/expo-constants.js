// Jest stub for expo-constants: the real package ships untransformed ESM that
// jest can't parse (it sits outside the transform allowlist), which broke any
// suite whose import graph reached data/remote/client/deviceMetadata.ts.
module.exports = {
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0' },
  },
};

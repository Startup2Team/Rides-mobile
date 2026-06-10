export function isDriverApprovalDevtoolEnabled(isDev: boolean, explicitFlag: string | undefined) {
  return isDev && explicitFlag === 'true';
}

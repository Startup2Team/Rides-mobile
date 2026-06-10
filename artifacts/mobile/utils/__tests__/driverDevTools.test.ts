import { isDriverApprovalDevtoolEnabled } from '../driverDevTools';

describe('driver approval development tools', () => {
  test('is hidden unless development mode and explicit flag are both enabled', () => {
    expect(isDriverApprovalDevtoolEnabled(false, 'true')).toBe(false);
    expect(isDriverApprovalDevtoolEnabled(true, undefined)).toBe(false);
    expect(isDriverApprovalDevtoolEnabled(true, 'false')).toBe(false);
    expect(isDriverApprovalDevtoolEnabled(true, 'true')).toBe(true);
  });
});

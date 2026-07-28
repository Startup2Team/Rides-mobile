import { BackendPackageCampaignAdapter } from '../packageSyncRepositories';
import { validatePackageCampaigns } from '@/domain/driverRideCampaigns';
import { listActiveCampaigns, type CampaignDto } from '@/services/driverPackages';

jest.mock('@/services/driverPackages', () => ({
  listActiveCampaigns: jest.fn(),
}));

const mockedList = listActiveCampaigns as jest.MockedFunction<typeof listActiveCampaigns>;

// Payloads captured verbatim from GET /api/v1/driver/campaigns/active on the
// local Go backend (a GLOBAL and a VEHICLE_TYPE campaign).
const REAL_BACKEND_CAMPAIGNS: CampaignDto[] = [
  {
    id: '9754427d-0f38-4f07-b22c-ca6387413de2',
    code: 'verify_global',
    name: 'Verify Global Promo',
    description: 'Extra rides this week',
    type: 'GLOBAL',
    starts_at: '2026-07-14T00:30:56.209741+02:00',
    ends_at: '2026-07-22T00:30:56.209741+02:00',
    override_rides: 10,
    override_bonus_rides: 3,
  },
  {
    id: 'b54626dc-260b-4e80-9963-967553016ab8',
    code: 'verify_moto',
    name: 'Verify Moto Promo',
    type: 'VEHICLE_TYPE',
    target_vehicle_type_code: 'MOTO_BIKE',
    starts_at: '2026-07-14T00:30:57.019176+02:00',
    ends_at: '2026-07-22T00:30:57.019176+02:00',
    override_price_rwf: 1500,
  },
];

describe('BackendPackageCampaignAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  test('maps real backend campaigns into valid domain campaigns', async () => {
    mockedList.mockResolvedValue(REAL_BACKEND_CAMPAIGNS);
    const { data } = await new BackendPackageCampaignAdapter().fetchCampaigns();

    // Both map, and the strict domain validator accepts them unchanged.
    expect(data).toHaveLength(2);
    expect(() => validatePackageCampaigns(data)).not.toThrow();

    expect(data[0]).toMatchObject({
      campaignId: '9754427d-0f38-4f07-b22c-ca6387413de2',
      campaignName: 'Verify Global Promo',
      campaignType: 'global',
      status: 'active',
      ridesGranted: 10,
      bonusRidesGranted: 3,
    });
    expect(data[1]).toMatchObject({
      campaignType: 'vehicle_type',
      vehicleTypes: ['moto'],
      priceRwf: 1500,
    });
  });

  test('drops campaigns with no mobile-equivalent type (PACKAGE) instead of throwing', async () => {
    mockedList.mockResolvedValue([
      { id: 'p1', code: 'pkg', name: 'Package Promo', type: 'PACKAGE' },
      ...REAL_BACKEND_CAMPAIGNS,
    ]);
    const { data } = await new BackendPackageCampaignAdapter().fetchCampaigns();
    expect(data).toHaveLength(2);
    expect(() => validatePackageCampaigns(data)).not.toThrow();
  });

  test('returns empty (never throws) when the endpoint is forbidden/unreachable', async () => {
    mockedList.mockRejectedValue(new Error('403 FORBIDDEN'));
    const { data } = await new BackendPackageCampaignAdapter().fetchCampaigns();
    expect(data).toEqual([]);
  });

  test('synthesises a valid window when start/end are open-ended', async () => {
    mockedList.mockResolvedValue([
      { id: 'g1', code: 'g', name: 'Open Ended', type: 'GLOBAL', starts_at: null, ends_at: null },
    ]);
    const { data } = await new BackendPackageCampaignAdapter().fetchCampaigns();
    expect(data).toHaveLength(1);
    expect(() => validatePackageCampaigns(data)).not.toThrow();
    expect(new Date(data[0].endDate).getTime()).toBeGreaterThan(new Date(data[0].startDate).getTime());
  });
});

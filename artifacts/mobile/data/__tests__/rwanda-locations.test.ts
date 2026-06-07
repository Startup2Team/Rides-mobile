import {
  RWANDA_PROVINCES,
  getCells,
  getDistricts,
  getSectors,
  getVillages,
} from '../rwanda-locations';

describe('Rwanda administrative locations', () => {
  test('contains the official province and district hierarchy', () => {
    const expectedDistricts = {
      'City of Kigali': ['Gasabo', 'Kicukiro', 'Nyarugenge'],
      'Northern Province': ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
      'Southern Province': ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
      'Eastern Province': ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
      'Western Province': ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'],
    };

    expect(RWANDA_PROVINCES.map(province => province.name)).toEqual(Object.keys(expectedDistricts));

    for (const [province, districts] of Object.entries(expectedDistricts)) {
      expect(getDistricts(province).map(district => district.name)).toEqual(districts);
    }
  });

  test('contains every administrative entity', () => {
    const districts = RWANDA_PROVINCES.flatMap(province => province.districts ?? []);
    const sectors = districts.flatMap(district => district.sectors ?? []);
    const cells = sectors.flatMap(sector => sector.cells ?? []);
    const villages = cells.flatMap(cell => cell.villages ?? []);

    expect(RWANDA_PROVINCES).toHaveLength(5);
    expect(districts).toHaveLength(30);
    expect(sectors).toHaveLength(416);
    expect(cells).toHaveLength(2148);
    expect(villages).toHaveLength(14837);
  });

  test('resolves villages through province, district, sector, and cell', () => {
    const sector = getSectors('City of Kigali', 'Gasabo')[0];
    const cell = getCells('City of Kigali', 'Gasabo', sector.name)[0];

    expect(getVillages('City of Kigali', 'Gasabo', sector.name, cell.name)).toEqual(cell.villages);
    expect(getVillages('City of Kigali', 'Gasabo', sector.name, 'Unknown cell')).toEqual([]);
  });
});

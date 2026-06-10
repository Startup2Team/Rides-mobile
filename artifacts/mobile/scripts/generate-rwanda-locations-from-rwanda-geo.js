const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [dataDirectory, outputPath] = process.argv.slice(2);

if (!outputPath) {
  throw new Error('Usage: node generate-rwanda-locations-from-rwanda-geo.js <data-directory> <output.json>');
}

const PROVINCE_ORDER = ['RW-01', 'RW-04', 'RW-02', 'RW-05', 'RW-03'];
const PROVINCE_NAMES = {
  'RW-01': 'City of Kigali',
  'RW-02': 'Southern Province',
  'RW-03': 'Western Province',
  'RW-04': 'Northern Province',
  'RW-05': 'Eastern Province',
};

function readData(name) {
  const compressed = fs.readFileSync(path.join(dataDirectory, `${name}.json.gz`));
  return JSON.parse(zlib.gunzipSync(compressed));
}

const provinces = readData('provinces');
const districts = readData('districts');
const sectors = readData('sectors');
const cells = readData('cells');
const villages = readData('villages');

const villagesByCell = Map.groupBy(villages, village => village.parentCode);
const cellsBySector = Map.groupBy(cells, cell => cell.parentCode);
const sectorsByDistrict = Map.groupBy(sectors, sector => sector.parentCode);
const districtsByProvince = Map.groupBy(districts, district => district.parentCode);
const compareNames = (left, right) => left.name.localeCompare(right.name);

const hierarchy = PROVINCE_ORDER.map(provinceCode => ({
  name: PROVINCE_NAMES[provinceCode],
  districts: (districtsByProvince.get(provinceCode) ?? []).sort(compareNames).map(district => ({
    name: district.name,
    sectors: (sectorsByDistrict.get(district.code) ?? []).sort(compareNames).map(sector => ({
      name: sector.name,
      cells: (cellsBySector.get(sector.code) ?? []).sort(compareNames).map(cell => ({
        name: cell.name,
        villages: (villagesByCell.get(cell.code) ?? []).map(village => village.name).sort((left, right) => left.localeCompare(right)),
      })),
    })),
  })),
}));

fs.writeFileSync(outputPath, `${JSON.stringify(hierarchy)}\n`);
console.log(JSON.stringify({
  provinces: provinces.length,
  districts: districts.length,
  sectors: sectors.length,
  cells: cells.length,
  villages: villages.length,
}, null, 2));

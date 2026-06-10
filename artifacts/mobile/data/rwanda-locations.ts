import generatedRwandaLocations from './rwanda-locations.generated.json';

export interface RwandaLocation {
  name: string;
  districts?: RwandaDistrict[];
}

export interface RwandaDistrict {
  name: string;
  sectors?: RwandaSector[];
}

export interface RwandaSector {
  name: string;
  cells?: RwandaCell[];
}

export interface RwandaCell {
  name: string;
  villages?: string[];
}

export const RWANDA_PROVINCES: RwandaLocation[] = generatedRwandaLocations;

export function getDistricts(provinceName: string): RwandaDistrict[] {
  const province = RWANDA_PROVINCES.find(p => p.name === provinceName);
  return province?.districts ?? [];
}

export function getSectors(provinceName: string, districtName: string): RwandaSector[] {
  const districts = getDistricts(provinceName);
  const district = districts.find(d => d.name === districtName);
  return district?.sectors ?? [];
}

export function getCells(provinceName: string, districtName: string, sectorName: string): RwandaCell[] {
  const sectors = getSectors(provinceName, districtName);
  const sector = sectors.find(s => s.name === sectorName);
  return sector?.cells ?? [];
}

export function getVillages(provinceName: string, districtName: string, sectorName: string, cellName: string): string[] {
  const cells = getCells(provinceName, districtName, sectorName);
  const cell = cells.find(c => c.name === cellName);
  return cell?.villages ?? [];
}

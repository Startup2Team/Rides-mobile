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

export const RWANDA_PROVINCES: RwandaLocation[] = [
  {
    name: 'Kigali City',
    districts: [
      {
        name: 'Gasabo',
        sectors: [
          { name: 'Bumbogo', cells: [{ name: 'Gasura', villages: ['Gasura', 'Kigarama', 'Muhororo'] }, { name: 'Gisiza', villages: ['Gisiza', 'Kabuye', 'Nyabisiga'] }] },
          { name: 'Gatsata', cells: [{ name: 'Gasanze', villages: ['Gasanze', 'Kaniga', 'Rubirizi'] }, { name: 'Muganza', villages: ['Muganza', 'Nyabageri', 'Rwezamenyo'] }] },
          { name: 'Gikomero', cells: [{ name: 'Gikomero', villages: ['Gikomero', 'Kabeza', 'Rukiri'] }, { name: 'Murama', villages: ['Murama', 'Nyagahinga', 'Rusororo'] }] },
          { name: 'Gisozi', cells: [{ name: 'Gisozi', villages: ['Gisozi', 'Kamashashi', 'Mulindi'] }, { name: 'Rebero', villages: ['Rebero', 'Rugando', 'Rwampara'] }] },
          { name: 'Jabana', cells: [{ name: 'Bibare', villages: ['Bibare', 'Gasabo', 'Kacyiru'] }, { name: 'Jabana', villages: ['Jabana', 'Kabuga', 'Masaka'] }] },
          { name: 'Jali', cells: [{ name: 'Jali', villages: ['Jali', 'Kaniga', 'Nyabisindu'] }, { name: 'Rwezamenyo', villages: ['Rwezamenyo', 'Kimisagara', 'Nyakabanda'] }] },
          { name: 'Kacyiru', cells: [{ name: 'Kamatamu', villages: ['Kamatamu', 'Kibaza', 'Nyarutarama'] }, { name: 'Kibaza', villages: ['Kibaza', 'Kacyiru', 'Kamutwa'] }] },
          { name: 'Kimironko', cells: [{ name: 'Bibare', villages: ['Bibare', 'Gisimenti', 'Kibaza'] }, { name: 'Gisimenti', villages: ['Gisimenti', 'Kimironko', 'Nyamirambo'] }] },
          { name: 'Kinyinya', cells: [{ name: 'Kinyinya', villages: ['Kinyinya', 'Kagugu', 'Rusororo'] }, { name: 'Kagugu', villages: ['Kagugu', 'Masaka', 'Nyagahinga'] }] },
          { name: 'Ndera', cells: [{ name: 'Gasogi', villages: ['Gasogi', 'Kabeza', 'Ndera'] }, { name: 'Murama', villages: ['Murama', 'Rusororo', 'Nyagahinga'] }] },
          { name: 'Nduba', cells: [{ name: 'Buranga', villages: ['Buranga', 'Gatuna', 'Nduba'] }, { name: 'Gasaka', villages: ['Gasaka', 'Kabuye', 'Nyabisindu'] }] },
          { name: 'Remera', cells: [{ name: 'Kibaza', villages: ['Kibaza', 'Kami', 'Remera'] }, { name: 'Nyabisindu', villages: ['Nyabisindu', 'Rukiri', 'Sonatube'] }] },
          { name: 'Rusororo', cells: [{ name: 'Gaseke', villages: ['Gaseke', 'Kagugu', 'Rusororo'] }, { name: 'Kagugu', villages: ['Kagugu', 'Nyagahinga', 'Rusororo'] }] },
          { name: 'Rutunga', cells: [{ name: 'Kabeza', villages: ['Kabeza', 'Karuruma', 'Rutunga'] }, { name: 'Karuruma', villages: ['Karuruma', 'Masaka', 'Rutunga'] }] },
        ],
      },
      {
        name: 'Kicukiro',
        sectors: [
          { name: 'Gahanga', cells: [{ name: 'Gahanga', villages: ['Gahanga', 'Kabuye', 'Kigarama'] }, { name: 'Kigarama', villages: ['Kigarama', 'Nyarugunga', 'Rebero'] }] },
          { name: 'Gatenga', cells: [{ name: 'Gatenga', villages: ['Gatenga', 'Kagina', 'Nyanza'] }, { name: 'Kagina', villages: ['Kagina', 'Nyarugunga', 'Sonatube'] }] },
          { name: 'Gikondo', cells: [{ name: 'Gikondo', villages: ['Gikondo', 'Nyamirambo', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Gikondo'] }] },
          { name: 'Kagarama', cells: [{ name: 'Kagarama', villages: ['Kagarama', 'Kabuye', 'Muyange'] }, { name: 'Muyange', villages: ['Muyange', 'Nyarugunga', 'Rebero'] }] },
          { name: 'Kanombe', cells: [{ name: 'Kanombe', villages: ['Kanombe', 'Masaka', 'Rugunga'] }, { name: 'Rugunga', villages: ['Rugunga', 'Nyarugunga', 'Kanombe'] }] },
          { name: 'Kicukiro', cells: [{ name: 'Kabuye', villages: ['Kabuye', 'Kicukiro', 'Nyarugenge'] }, { name: 'Kicukiro', villages: ['Kicukiro', 'Nyarugenge', 'Sonatube'] }] },
          { name: 'Kigarama', cells: [{ name: 'Kigarama', villages: ['Kigarama', 'Mayange', 'Nyarugunga'] }, { name: 'Mayange', villages: ['Mayange', 'Nyarugunga', 'Rebero'] }] },
          { name: 'Masaka', cells: [{ name: 'Biryogo', villages: ['Biryogo', 'Masaka', 'Nyarugunga'] }, { name: 'Masaka', villages: ['Masaka', 'Sonatube', 'Nyarugunga'] }] },
          { name: 'Niboye', cells: [{ name: 'Niboye', villages: ['Niboye', 'Sonatube', 'Nyarugunga'] }, { name: 'Sonatube', villages: ['Sonatube', 'Nyarugunga', 'Niboye'] }] },
          { name: 'Nyarugunga', cells: [{ name: 'Nyarugunga', villages: ['Nyarugunga', 'Rebero', 'Rugunga'] }, { name: 'Rebero', villages: ['Rebero', 'Rugunga', 'Nyarugunga'] }] },
        ],
      },
      {
        name: 'Nyarugenge',
        sectors: [
          { name: 'Gitega', cells: [{ name: 'Gitega', villages: ['Gitega', 'Nyarugenge', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Gitega'] }] },
          { name: 'Kanyinya', cells: [{ name: 'Kanyinya', villages: ['Kanyinya', 'Nyarugenge', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Kanyinya'] }] },
          { name: 'Kigali', cells: [{ name: 'Biryogo', villages: ['Biryogo', 'Nyarugenge', 'Rugando'] }, { name: 'Nyarugenge', villages: ['Nyarugenge', 'Rugando', 'Kigali'] }] },
          { name: 'Kimisagara', cells: [{ name: 'Kimisagara', villages: ['Kimisagara', 'Nyarugenge', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Kimisagara'] }] },
          { name: 'Mageragere', cells: [{ name: 'Mageragere', villages: ['Mageragere', 'Nyarugenge', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Mageragere'] }] },
          { name: 'Muhima', cells: [{ name: 'Muhima', villages: ['Muhima', 'Nyarugenge', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Muhima'] }] },
          { name: 'Nyakabanda', cells: [{ name: 'Nyakabanda', villages: ['Nyakabanda', 'Nyarugenge', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Nyakabanda'] }] },
          { name: 'Nyamirambo', cells: [{ name: 'Cyivugiza', villages: ['Cyivugiza', 'Nyamirambo', 'Rugando'] }, { name: 'Nyamirambo', villages: ['Nyamirambo', 'Rugando', 'Cyivugiza'] }] },
          { name: 'Nyarugenge', cells: [{ name: 'Nyarugenge', villages: ['Nyarugenge', 'Rugando', 'Kigali'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Kigali'] }] },
          { name: 'Rwezamenyo', cells: [{ name: 'Rwezamenyo', villages: ['Rwezamenyo', 'Nyarugenge', 'Rugando'] }, { name: 'Rugando', villages: ['Rugando', 'Nyarugenge', 'Rwezamenyo'] }] },
        ],
      },
    ],
  },
  {
    name: 'Northern',
    districts: [
      {
        name: 'Burera',
        sectors: [
          { name: 'Bungwe', cells: [{ name: 'Bungwe', villages: ['Bungwe', 'Gatuna', 'Nyabisindu'] }] },
          { name: 'Butaro', cells: [{ name: 'Butaro', villages: ['Butaro', 'Cyeru', 'Nyakabanda'] }] },
          { name: 'Cyanika', cells: [{ name: 'Cyanika', villages: ['Cyanika', 'Gatuna', 'Musanze'] }] },
          { name: 'Cyeru', cells: [{ name: 'Cyeru', villages: ['Cyeru', 'Gatuna', 'Musanze'] }] },
          { name: 'Gahunga', cells: [{ name: 'Gahunga', villages: ['Gahunga', 'Gatuna', 'Musanze'] }] },
          { name: 'Gatebe', cells: [{ name: 'Gatebe', villages: ['Gatebe', 'Gatuna', 'Musanze'] }] },
          { name: 'Gitovu', cells: [{ name: 'Gitovu', villages: ['Gitovu', 'Gatuna', 'Musanze'] }] },
          { name: 'Kagogo', cells: [{ name: 'Kagogo', villages: ['Kagogo', 'Gatuna', 'Musanze'] }] },
          { name: 'Kinoni', cells: [{ name: 'Kinoni', villages: ['Kinoni', 'Gatuna', 'Musanze'] }] },
          { name: 'Kinyababa', cells: [{ name: 'Kinyababa', villages: ['Kinyababa', 'Gatuna', 'Musanze'] }] },
          { name: 'Kivuye', cells: [{ name: 'Kivuye', villages: ['Kivuye', 'Gatuna', 'Musanze'] }] },
          { name: 'Nemba', cells: [{ name: 'Nemba', villages: ['Nemba', 'Gatuna', 'Musanze'] }] },
          { name: 'Rugarama', cells: [{ name: 'Rugarama', villages: ['Rugarama', 'Gatuna', 'Musanze'] }] },
          { name: 'Rugendabari', cells: [{ name: 'Rugendabari', villages: ['Rugendabari', 'Gatuna', 'Musanze'] }] },
          { name: 'Ruhunde', cells: [{ name: 'Ruhunde', villages: ['Ruhunde', 'Gatuna', 'Musanze'] }] },
          { name: 'Rusarabuye', cells: [{ name: 'Rusarabuye', villages: ['Rusarabuye', 'Gatuna', 'Musanze'] }] },
          { name: 'Rwerere', cells: [{ name: 'Rwerere', villages: ['Rwerere', 'Gatuna', 'Musanze'] }] },
        ],
      },
      {
        name: 'Gakenke',
        sectors: [
          { name: 'Busengo', cells: [{ name: 'Busengo', villages: ['Busengo', 'Gakenke', 'Kivuye'] }] },
          { name: 'Coko', cells: [{ name: 'Coko', villages: ['Coko', 'Gakenke', 'Kivuye'] }] },
          { name: 'Cyabingo', cells: [{ name: 'Cyabingo', villages: ['Cyabingo', 'Gakenke', 'Kivuye'] }] },
          { name: 'Gakenke', cells: [{ name: 'Gakenke', villages: ['Gakenke', 'Kivuye', 'Musanze'] }] },
          { name: 'Gashenyi', cells: [{ name: 'Gashenyi', villages: ['Gashenyi', 'Gakenke', 'Kivuye'] }] },
          { name: 'Janja', cells: [{ name: 'Janja', villages: ['Janja', 'Gakenke', 'Kivuye'] }] },
          { name: 'Kamubuga', cells: [{ name: 'Kamubuga', villages: ['Kamubuga', 'Gakenke', 'Kivuye'] }] },
          { name: 'Karambo', cells: [{ name: 'Karambo', villages: ['Karambo', 'Gakenke', 'Kivuye'] }] },
          { name: 'Kivuye', cells: [{ name: 'Kivuye', villages: ['Kivuye', 'Gakenke', 'Musanze'] }] },
          { name: 'Mataba', cells: [{ name: 'Mataba', villages: ['Mataba', 'Gakenke', 'Kivuye'] }] },
          { name: 'Minazi', cells: [{ name: 'Minazi', villages: ['Minazi', 'Gakenke', 'Kivuye'] }] },
          { name: 'Muhondo', cells: [{ name: 'Muhondo', villages: ['Muhondo', 'Gakenke', 'Kivuye'] }] },
          { name: 'Muyongwe', cells: [{ name: 'Muyongwe', villages: ['Muyongwe', 'Gakenke', 'Kivuye'] }] },
          { name: 'Muzo', cells: [{ name: 'Muzo', villages: ['Muzo', 'Gakenke', 'Kivuye'] }] },
          { name: 'Nemba', cells: [{ name: 'Nemba', villages: ['Nemba', 'Gakenke', 'Kivuye'] }] },
          { name: 'Ruli', cells: [{ name: 'Ruli', villages: ['Ruli', 'Gakenke', 'Kivuye'] }] },
          { name: 'Rusasa', cells: [{ name: 'Rusasa', villages: ['Rusasa', 'Gakenke', 'Kivuye'] }] },
          { name: 'Rushashi', cells: [{ name: 'Rushashi', villages: ['Rushashi', 'Gakenke', 'Kivuye'] }] },
        ],
      },
      {
        name: 'Gicumbi',
        sectors: [
          { name: 'Bukure', cells: [{ name: 'Bukure', villages: ['Bukure', 'Gicumbi', 'Mutete'] }] },
          { name: 'Bwisige', cells: [{ name: 'Bwisige', villages: ['Bwisige', 'Gicumbi', 'Mutete'] }] },
          { name: 'Byumba', cells: [{ name: 'Byumba', villages: ['Byumba', 'Gicumbi', 'Mutete'] }] },
          { name: 'Cyumba', cells: [{ name: 'Cyumba', villages: ['Cyumba', 'Gicumbi', 'Mutete'] }] },
          { name: 'Gicumbi', cells: [{ name: 'Gicumbi', villages: ['Gicumbi', 'Mutete', 'Byumba'] }] },
          { name: 'Kaniga', cells: [{ name: 'Kaniga', villages: ['Kaniga', 'Gicumbi', 'Mutete'] }] },
          { name: 'Manyagiro', cells: [{ name: 'Manyagiro', villages: ['Manyagiro', 'Gicumbi', 'Mutete'] }] },
          { name: 'Miyove', cells: [{ name: 'Miyove', villages: ['Miyove', 'Gicumbi', 'Mutete'] }] },
          { name: 'Mukarange', cells: [{ name: 'Mukarange', villages: ['Mukarange', 'Gicumbi', 'Mutete'] }] },
          { name: 'Muko', cells: [{ name: 'Muko', villages: ['Muko', 'Gicumbi', 'Mutete'] }] },
          { name: 'Mutete', cells: [{ name: 'Mutete', villages: ['Mutete', 'Gicumbi', 'Byumba'] }] },
          { name: 'Nyamiyaga', cells: [{ name: 'Nyamiyaga', villages: ['Nyamiyaga', 'Gicumbi', 'Mutete'] }] },
          { name: 'Nyankenke I', cells: [{ name: 'Nyankenke', villages: ['Nyankenke', 'Gicumbi', 'Mutete'] }] },
          { name: 'Nyankenke II', cells: [{ name: 'Nyankenke II', villages: ['Nyankenke II', 'Gicumbi', 'Mutete'] }] },
          { name: 'Rubaya', cells: [{ name: 'Rubaya', villages: ['Rubaya', 'Gicumbi', 'Mutete'] }] },
          { name: 'Rukomo', cells: [{ name: 'Rukomo', villages: ['Rukomo', 'Gicumbi', 'Mutete'] }] },
          { name: 'Rushaki', cells: [{ name: 'Rushaki', villages: ['Rushaki', 'Gicumbi', 'Mutete'] }] },
          { name: 'Rutare', cells: [{ name: 'Rutare', villages: ['Rutare', 'Gicumbi', 'Mutete'] }] },
          { name: 'Ruvune', cells: [{ name: 'Ruvune', villages: ['Ruvune', 'Gicumbi', 'Mutete'] }] },
          { name: 'Rwamiko', cells: [{ name: 'Rwamiko', villages: ['Rwamiko', 'Gicumbi', 'Mutete'] }] },
          { name: 'Shangasha', cells: [{ name: 'Shangasha', villages: ['Shangasha', 'Gicumbi', 'Mutete'] }] },
        ],
      },
      {
        name: 'Musanze',
        sectors: [
          { name: 'Busogo', cells: [{ name: 'Busogo', villages: ['Busogo', 'Musanze', 'Cyuve'] }] },
          { name: 'Cyuve', cells: [{ name: 'Cyuve', villages: ['Cyuve', 'Musanze', 'Busogo'] }] },
          { name: 'Gacaca', cells: [{ name: 'Gacaca', villages: ['Gacaca', 'Musanze', 'Cyuve'] }] },
          { name: 'Gashaki', cells: [{ name: 'Gashaki', villages: ['Gashaki', 'Musanze', 'Cyuve'] }] },
          { name: 'Gataraga', cells: [{ name: 'Gataraga', villages: ['Gataraga', 'Musanze', 'Cyuve'] }] },
          { name: 'Kimonyi', cells: [{ name: 'Kimonyi', villages: ['Kimonyi', 'Musanze', 'Cyuve'] }] },
          { name: 'Kinigi', cells: [{ name: 'Kinigi', villages: ['Kinigi', 'Musanze', 'Cyuve'] }] },
          { name: 'Muhoza', cells: [{ name: 'Muhoza', villages: ['Muhoza', 'Musanze', 'Cyuve'] }] },
          { name: 'Muko', cells: [{ name: 'Muko', villages: ['Muko', 'Musanze', 'Cyuve'] }] },
          { name: 'Musanze', cells: [{ name: 'Musanze', villages: ['Musanze', 'Cyuve', 'Busogo'] }] },
          { name: 'Nkotsi', cells: [{ name: 'Nkotsi', villages: ['Nkotsi', 'Musanze', 'Cyuve'] }] },
          { name: 'Nyange', cells: [{ name: 'Nyange', villages: ['Nyange', 'Musanze', 'Cyuve'] }] },
          { name: 'Remera', cells: [{ name: 'Remera', villages: ['Remera', 'Musanze', 'Cyuve'] }] },
          { name: 'Rwaza', cells: [{ name: 'Rwaza', villages: ['Rwaza', 'Musanze', 'Cyuve'] }] },
          { name: 'Shingiro', cells: [{ name: 'Shingiro', villages: ['Shingiro', 'Musanze', 'Cyuve'] }] },
        ],
      },
      {
        name: 'Rulindo',
        sectors: [
          { name: 'Base', cells: [{ name: 'Base', villages: ['Base', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Burega', cells: [{ name: 'Burega', villages: ['Burega', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Bushoki', cells: [{ name: 'Bushoki', villages: ['Bushoki', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Buyoga', cells: [{ name: 'Buyoga', villages: ['Buyoga', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Cyinzuzi', cells: [{ name: 'Cyinzuzi', villages: ['Cyinzuzi', 'Rulindo', 'Base'] }] },
          { name: 'Cyungo', cells: [{ name: 'Cyungo', villages: ['Cyungo', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Kinihira', cells: [{ name: 'Kinihira', villages: ['Kinihira', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Kisaro', cells: [{ name: 'Kisaro', villages: ['Kisaro', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Masoro', cells: [{ name: 'Masoro', villages: ['Masoro', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Mbogo', cells: [{ name: 'Mbogo', villages: ['Mbogo', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Murambi', cells: [{ name: 'Murambi', villages: ['Murambi', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Ngoma', cells: [{ name: 'Ngoma', villages: ['Ngoma', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Ntarabana', cells: [{ name: 'Ntarabana', villages: ['Ntarabana', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Rukozo', cells: [{ name: 'Rukozo', villages: ['Rukozo', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Rusiga', cells: [{ name: 'Rusiga', villages: ['Rusiga', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Shyorongi', cells: [{ name: 'Shyorongi', villages: ['Shyorongi', 'Rulindo', 'Cyinzuzi'] }] },
          { name: 'Tumba', cells: [{ name: 'Tumba', villages: ['Tumba', 'Rulindo', 'Cyinzuzi'] }] },
        ],
      },
    ],
  },
  {
    name: 'Southern',
    districts: [
      { name: 'Gisagara', sectors: [{ name: 'Gisagara', cells: [{ name: 'Gisagara', villages: ['Gisagara', 'Muganza', 'Nyanza'] }] }, { name: 'Gikonko', cells: [{ name: 'Gikonko', villages: ['Gikonko', 'Muganza', 'Nyanza'] }] }, { name: 'Gishubi', cells: [{ name: 'Gishubi', villages: ['Gishubi', 'Muganza', 'Nyanza'] }] }, { name: 'Muganza', cells: [{ name: 'Muganza', villages: ['Muganza', 'Gisagara', 'Nyanza'] }] }, { name: 'Ndora', cells: [{ name: 'Ndora', villages: ['Ndora', 'Muganza', 'Nyanza'] }] }, { name: 'Nyanza', cells: [{ name: 'Nyanza', villages: ['Nyanza', 'Muganza', 'Gisagara'] }] }] },
      { name: 'Huye', sectors: [{ name: 'Butare', cells: [{ name: 'Butare', villages: ['Butare', 'Huye', 'Ngoma'] }] }, { name: 'Gishamvu', cells: [{ name: 'Gishamvu', villages: ['Gishamvu', 'Huye', 'Ngoma'] }] }, { name: 'Huye', cells: [{ name: 'Huye', villages: ['Huye', 'Ngoma', 'Butare'] }] }, { name: 'Karama', cells: [{ name: 'Karama', villages: ['Karama', 'Huye', 'Ngoma'] }] }, { name: 'Kigoma', cells: [{ name: 'Kigoma', villages: ['Kigoma', 'Huye', 'Ngoma'] }] }, { name: 'Kinazi', cells: [{ name: 'Kinazi', villages: ['Kinazi', 'Huye', 'Ngoma'] }] }, { name: 'Maraba', cells: [{ name: 'Maraba', villages: ['Maraba', 'Huye', 'Ngoma'] }] }, { name: 'Mbazi', cells: [{ name: 'Mbazi', villages: ['Mbazi', 'Huye', 'Ngoma'] }] }, { name: 'Mukura', cells: [{ name: 'Mukura', villages: ['Mukura', 'Huye', 'Ngoma'] }] }, { name: 'Ngoma', cells: [{ name: 'Ngoma', villages: ['Ngoma', 'Huye', 'Butare'] }] }, { name: 'Ruhashya', cells: [{ name: 'Ruhashya', villages: ['Ruhashya', 'Huye', 'Ngoma'] }] }, { name: 'Rusatira', cells: [{ name: 'Rusatira', villages: ['Rusatira', 'Huye', 'Ngoma'] }] }, { name: 'Rwaniro', cells: [{ name: 'Rwaniro', villages: ['Rwaniro', 'Huye', 'Ngoma'] }] }, { name: 'Simbi', cells: [{ name: 'Simbi', villages: ['Simbi', 'Huye', 'Ngoma'] }] }, { name: 'Tumba', cells: [{ name: 'Tumba', villages: ['Tumba', 'Huye', 'Ngoma'] }] }] },
      { name: 'Kamonyi', sectors: [{ name: 'Gacurabwenge', cells: [{ name: 'Gacurabwenge', villages: ['Gacurabwenge', 'Kamonyi', 'Mugina'] }] }, { name: 'Kamonyi', cells: [{ name: 'Kamonyi', villages: ['Kamonyi', 'Mugina', 'Gacurabwenge'] }] }, { name: 'Mugina', cells: [{ name: 'Mugina', villages: ['Mugina', 'Kamonyi', 'Gacurabwenge'] }] }, { name: 'Musambira', cells: [{ name: 'Musambira', villages: ['Musambira', 'Kamonyi', 'Mugina'] }] }, { name: 'Ngamba', cells: [{ name: 'Ngamba', villages: ['Ngamba', 'Kamonyi', 'Mugina'] }] }, { name: 'Nyamiyaga', cells: [{ name: 'Nyamiyaga', villages: ['Nyamiyaga', 'Kamonyi', 'Mugina'] }] }, { name: 'Nyarubaka', cells: [{ name: 'Nyarubaka', villages: ['Nyarubaka', 'Kamonyi', 'Mugina'] }] }, { name: 'Rugarika', cells: [{ name: 'Rugarika', villages: ['Rugarika', 'Kamonyi', 'Mugina'] }] }, { name: 'Rukoma', cells: [{ name: 'Rukoma', villages: ['Rukoma', 'Kamonyi', 'Mugina'] }] }, { name: 'Runda', cells: [{ name: 'Runda', villages: ['Runda', 'Kamonyi', 'Mugina'] }] }] },
      { name: 'Muhanga', sectors: [{ name: 'Cyeza', cells: [{ name: 'Cyeza', villages: ['Cyeza', 'Muhanga', 'Shyogwe'] }] }, { name: 'Kabacuzi', cells: [{ name: 'Kabacuzi', villages: ['Kabacuzi', 'Muhanga', 'Shyogwe'] }] }, { name: 'Kibangu', cells: [{ name: 'Kibangu', villages: ['Kibangu', 'Muhanga', 'Shyogwe'] }] }, { name: 'Kiyumba', cells: [{ name: 'Kiyumba', villages: ['Kiyumba', 'Muhanga', 'Shyogwe'] }] }, { name: 'Muhanga', cells: [{ name: 'Muhanga', villages: ['Muhanga', 'Shyogwe', 'Cyeza'] }] }, { name: 'Mushishiro', cells: [{ name: 'Mushishiro', villages: ['Mushishiro', 'Muhanga', 'Shyogwe'] }] }, { name: 'Nyabinema', cells: [{ name: 'Nyabinema', villages: ['Nyabinema', 'Muhanga', 'Shyogwe'] }] }, { name: 'Nyamabuye', cells: [{ name: 'Nyamabuye', villages: ['Nyamabuye', 'Muhanga', 'Shyogwe'] }] }, { name: 'Nyarusange', cells: [{ name: 'Nyarusange', villages: ['Nyarusange', 'Muhanga', 'Shyogwe'] }] }, { name: 'Rongi', cells: [{ name: 'Rongi', villages: ['Rongi', 'Muhanga', 'Shyogwe'] }] }, { name: 'Rugendabari', cells: [{ name: 'Rugendabari', villages: ['Rugendabari', 'Muhanga', 'Shyogwe'] }] }, { name: 'Shyogwe', cells: [{ name: 'Shyogwe', villages: ['Shyogwe', 'Muhanga', 'Cyeza'] }] }] },
      { name: 'Nyamagabe', sectors: [{ name: 'Buruhukiro', cells: [{ name: 'Buruhukiro', villages: ['Buruhukiro', 'Nyamagabe', 'Gatare'] }] }, { name: 'Cyanika', cells: [{ name: 'Cyanika', villages: ['Cyanika', 'Nyamagabe', 'Gatare'] }] }, { name: 'Gasaka', cells: [{ name: 'Gasaka', villages: ['Gasaka', 'Nyamagabe', 'Gatare'] }] }, { name: 'Gatare', cells: [{ name: 'Gatare', villages: ['Gatare', 'Nyamagabe', 'Buruhukiro'] }] }, { name: 'Kaduha', cells: [{ name: 'Kaduha', villages: ['Kaduha', 'Nyamagabe', 'Gatare'] }] }, { name: 'Kamegeri', cells: [{ name: 'Kamegeri', villages: ['Kamegeri', 'Nyamagabe', 'Gatare'] }] }, { name: 'Kibirizi', cells: [{ name: 'Kibirizi', villages: ['Kibirizi', 'Nyamagabe', 'Gatare'] }] }, { name: 'Kibumbwe', cells: [{ name: 'Kibumbwe', villages: ['Kibumbwe', 'Nyamagabe', 'Gatare'] }] }, { name: 'Kitabi', cells: [{ name: 'Kitabi', villages: ['Kitabi', 'Nyamagabe', 'Gatare'] }] }, { name: 'Mbazi', cells: [{ name: 'Mbazi', villages: ['Mbazi', 'Nyamagabe', 'Gatare'] }] }, { name: 'Mugano', cells: [{ name: 'Mugano', villages: ['Mugano', 'Nyamagabe', 'Gatare'] }] }, { name: 'Musange', cells: [{ name: 'Musange', villages: ['Musange', 'Nyamagabe', 'Gatare'] }] }, { name: 'Musebeya', cells: [{ name: 'Musebeya', villages: ['Musebeya', 'Nyamagabe', 'Gatare'] }] }, { name: 'Mushubi', cells: [{ name: 'Mushubi', villages: ['Mushubi', 'Nyamagabe', 'Gatare'] }] }, { name: 'Nkomane', cells: [{ name: 'Nkomane', villages: ['Nkomane', 'Nyamagabe', 'Gatare'] }] }, { name: 'Tare', cells: [{ name: 'Tare', villages: ['Tare', 'Nyamagabe', 'Gatare'] }] }, { name: 'Uwinkingi', cells: [{ name: 'Uwinkingi', villages: ['Uwinkingi', 'Nyamagabe', 'Gatare'] }] }] },
      { name: 'Nyanza', sectors: [{ name: 'Busasamana', cells: [{ name: 'Busasamana', villages: ['Busasamana', 'Nyanza', 'Mukingo'] }] }, { name: 'Busoro', cells: [{ name: 'Busoro', villages: ['Busoro', 'Nyanza', 'Mukingo'] }] }, { name: 'Cyabakamyi', cells: [{ name: 'Cyabakamyi', villages: ['Cyabakamyi', 'Nyanza', 'Mukingo'] }] }, { name: 'Kibirizi', cells: [{ name: 'Kibirizi', villages: ['Kibirizi', 'Nyanza', 'Mukingo'] }] }, { name: 'Kigoma', cells: [{ name: 'Kigoma', villages: ['Kigoma', 'Nyanza', 'Mukingo'] }] }, { name: 'Mukingo', cells: [{ name: 'Mukingo', villages: ['Mukingo', 'Nyanza', 'Busasamana'] }] }, { name: 'Muyira', cells: [{ name: 'Muyira', villages: ['Muyira', 'Nyanza', 'Mukingo'] }] }, { name: 'Ntyazo', cells: [{ name: 'Ntyazo', villages: ['Ntyazo', 'Nyanza', 'Mukingo'] }] }, { name: 'Nyagisozi', cells: [{ name: 'Nyagisozi', villages: ['Nyagisozi', 'Nyanza', 'Mukingo'] }] }, { name: 'Rwabicuma', cells: [{ name: 'Rwabicuma', villages: ['Rwabicuma', 'Nyanza', 'Mukingo'] }] }] },
      { name: 'Nyaruguru', sectors: [{ name: 'Busanze', cells: [{ name: 'Busanze', villages: ['Busanze', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Cyahinda', cells: [{ name: 'Cyahinda', villages: ['Cyahinda', 'Nyaruguru', 'Busanze'] }] }, { name: 'Kibeho', cells: [{ name: 'Kibeho', villages: ['Kibeho', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Kivu', cells: [{ name: 'Kivu', villages: ['Kivu', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Mata', cells: [{ name: 'Mata', villages: ['Mata', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Muganza', cells: [{ name: 'Muganza', villages: ['Muganza', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Munini', cells: [{ name: 'Munini', villages: ['Munini', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Ngera', cells: [{ name: 'Ngera', villages: ['Ngera', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Ngoma', cells: [{ name: 'Ngoma', villages: ['Ngoma', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Nyabimata', cells: [{ name: 'Nyabimata', villages: ['Nyabimata', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Nyagisozi', cells: [{ name: 'Nyagisozi', villages: ['Nyagisozi', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Ruheru', cells: [{ name: 'Ruheru', villages: ['Ruheru', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Ruramba', cells: [{ name: 'Ruramba', villages: ['Ruramba', 'Nyaruguru', 'Cyahinda'] }] }, { name: 'Rusenge', cells: [{ name: 'Rusenge', villages: ['Rusenge', 'Nyaruguru', 'Cyahinda'] }] }] },
      { name: 'Ruhango', sectors: [{ name: 'Byimana', cells: [{ name: 'Byimana', villages: ['Byimana', 'Ruhango', 'Kinazi'] }] }, { name: 'Kinazi', cells: [{ name: 'Kinazi', villages: ['Kinazi', 'Ruhango', 'Byimana'] }] }, { name: 'Mbuye', cells: [{ name: 'Mbuye', villages: ['Mbuye', 'Ruhango', 'Kinazi'] }] }, { name: 'Mwendo', cells: [{ name: 'Mwendo', villages: ['Mwendo', 'Ruhango', 'Kinazi'] }] }, { name: 'Ntongwe', cells: [{ name: 'Ntongwe', villages: ['Ntongwe', 'Ruhango', 'Kinazi'] }] }, { name: 'Ruhango', cells: [{ name: 'Ruhango', villages: ['Ruhango', 'Kinazi', 'Byimana'] }] }] },
    ],
  },
  {
    name: 'Eastern',
    districts: [
      { name: 'Bugesera', sectors: [{ name: 'Gashora', cells: [{ name: 'Gashora', villages: ['Gashora', 'Bugesera', 'Nyamata'] }] }, { name: 'Juru', cells: [{ name: 'Juru', villages: ['Juru', 'Bugesera', 'Nyamata'] }] }, { name: 'Kamabuye', cells: [{ name: 'Kamabuye', villages: ['Kamabuye', 'Bugesera', 'Nyamata'] }] }, { name: 'Mareba', cells: [{ name: 'Mareba', villages: ['Mareba', 'Bugesera', 'Nyamata'] }] }, { name: 'Mayange', cells: [{ name: 'Mayange', villages: ['Mayange', 'Bugesera', 'Nyamata'] }] }, { name: 'Musenyi', cells: [{ name: 'Musenyi', villages: ['Musenyi', 'Bugesera', 'Nyamata'] }] }, { name: 'Mwogo', cells: [{ name: 'Mwogo', villages: ['Mwogo', 'Bugesera', 'Nyamata'] }] }, { name: 'Ngeruka', cells: [{ name: 'Ngeruka', villages: ['Ngeruka', 'Bugesera', 'Nyamata'] }] }, { name: 'Ntarama', cells: [{ name: 'Ntarama', villages: ['Ntarama', 'Bugesera', 'Nyamata'] }] }, { name: 'Nyamata', cells: [{ name: 'Nyamata', villages: ['Nyamata', 'Bugesera', 'Gashora'] }] }, { name: 'Nyarugenge', cells: [{ name: 'Nyarugenge', villages: ['Nyarugenge', 'Bugesera', 'Nyamata'] }] }, { name: 'Rilima', cells: [{ name: 'Rilima', villages: ['Rilima', 'Bugesera', 'Nyamata'] }] }, { name: 'Ruhuha', cells: [{ name: 'Ruhuha', villages: ['Ruhuha', 'Bugesera', 'Nyamata'] }] }, { name: 'Rweru', cells: [{ name: 'Rweru', villages: ['Rweru', 'Bugesera', 'Nyamata'] }] }, { name: 'Shyara', cells: [{ name: 'Shyara', villages: ['Shyara', 'Bugesera', 'Nyamata'] }] }] },
      { name: 'Gatsibo', sectors: [{ name: 'Gasange', cells: [{ name: 'Gasange', villages: ['Gasange', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Gatsibo', cells: [{ name: 'Gatsibo', villages: ['Gatsibo', 'Kiziguro', 'Gasange'] }] }, { name: 'Gitoki', cells: [{ name: 'Gitoki', villages: ['Gitoki', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Kabarore', cells: [{ name: 'Kabarore', villages: ['Kabarore', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Kageyo', cells: [{ name: 'Kageyo', villages: ['Kageyo', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Kiramuruzi', cells: [{ name: 'Kiramuruzi', villages: ['Kiramuruzi', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Kiziguro', cells: [{ name: 'Kiziguro', villages: ['Kiziguro', 'Gatsibo', 'Gasange'] }] }, { name: 'Muhura', cells: [{ name: 'Muhura', villages: ['Muhura', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Murambi', cells: [{ name: 'Murambi', villages: ['Murambi', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Ngarama', cells: [{ name: 'Ngarama', villages: ['Ngarama', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Nyagihanga', cells: [{ name: 'Nyagihanga', villages: ['Nyagihanga', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Remera', cells: [{ name: 'Remera', villages: ['Remera', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Rugarama', cells: [{ name: 'Rugarama', villages: ['Rugarama', 'Gatsibo', 'Kiziguro'] }] }, { name: 'Rwimbogo', cells: [{ name: 'Rwimbogo', villages: ['Rwimbogo', 'Gatsibo', 'Kiziguro'] }] }] },
      { name: 'Kayonza', sectors: [{ name: 'Gahini', cells: [{ name: 'Gahini', villages: ['Gahini', 'Kayonza', 'Mukarange'] }] }, { name: 'Kabare', cells: [{ name: 'Kabare', villages: ['Kabare', 'Kayonza', 'Mukarange'] }] }, { name: 'Kabarondo', cells: [{ name: 'Kabarondo', villages: ['Kabarondo', 'Kayonza', 'Mukarange'] }] }, { name: 'Mukarange', cells: [{ name: 'Mukarange', villages: ['Mukarange', 'Kayonza', 'Gahini'] }] }, { name: 'Murama', cells: [{ name: 'Murama', villages: ['Murama', 'Kayonza', 'Mukarange'] }] }, { name: 'Murundi', cells: [{ name: 'Murundi', villages: ['Murundi', 'Kayonza', 'Mukarange'] }] }, { name: 'Mwiri', cells: [{ name: 'Mwiri', villages: ['Mwiri', 'Kayonza', 'Mukarange'] }] }, { name: 'Ndego', cells: [{ name: 'Ndego', villages: ['Ndego', 'Kayonza', 'Mukarange'] }] }, { name: 'Nyamirama', cells: [{ name: 'Nyamirama', villages: ['Nyamirama', 'Kayonza', 'Mukarange'] }] }, { name: 'Rukara', cells: [{ name: 'Rukara', villages: ['Rukara', 'Kayonza', 'Mukarange'] }] }, { name: 'Ruramira', cells: [{ name: 'Ruramira', villages: ['Ruramira', 'Kayonza', 'Mukarange'] }] }, { name: 'Rwinkwavu', cells: [{ name: 'Rwinkwavu', villages: ['Rwinkwavu', 'Kayonza', 'Mukarange'] }] }] },
      { name: 'Kirehe', sectors: [{ name: 'Gahara', cells: [{ name: 'Gahara', villages: ['Gahara', 'Kirehe', 'Mahama'] }] }, { name: 'Gatore', cells: [{ name: 'Gatore', villages: ['Gatore', 'Kirehe', 'Mahama'] }] }, { name: 'Kigarama', cells: [{ name: 'Kigarama', villages: ['Kigarama', 'Kirehe', 'Mahama'] }] }, { name: 'Kigina', cells: [{ name: 'Kigina', villages: ['Kigina', 'Kirehe', 'Mahama'] }] }, { name: 'Kirehe', cells: [{ name: 'Kirehe', villages: ['Kirehe', 'Mahama', 'Gahara'] }] }, { name: 'Mahama', cells: [{ name: 'Mahama', villages: ['Mahama', 'Kirehe', 'Gahara'] }] }, { name: 'Mpanga', cells: [{ name: 'Mpanga', villages: ['Mpanga', 'Kirehe', 'Mahama'] }] }, { name: 'Musaza', cells: [{ name: 'Musaza', villages: ['Musaza', 'Kirehe', 'Mahama'] }] }, { name: 'Mushikiri', cells: [{ name: 'Mushikiri', villages: ['Mushikiri', 'Kirehe', 'Mahama'] }] }, { name: 'Nasho', cells: [{ name: 'Nasho', villages: ['Nasho', 'Kirehe', 'Mahama'] }] }, { name: 'Nyamugari', cells: [{ name: 'Nyamugari', villages: ['Nyamugari', 'Kirehe', 'Mahama'] }] }, { name: 'Nyarubuye', cells: [{ name: 'Nyarubuye', villages: ['Nyarubuye', 'Kirehe', 'Mahama'] }] }] },
      { name: 'Ngoma', sectors: [{ name: 'Gashanda', cells: [{ name: 'Gashanda', villages: ['Gashanda', 'Ngoma', 'Karembo'] }] }, { name: 'Jarama', cells: [{ name: 'Jarama', villages: ['Jarama', 'Ngoma', 'Karembo'] }] }, { name: 'Karembo', cells: [{ name: 'Karembo', villages: ['Karembo', 'Ngoma', 'Gashanda'] }] }, { name: 'Kazo', cells: [{ name: 'Kazo', villages: ['Kazo', 'Ngoma', 'Karembo'] }] }, { name: 'Kibungo', cells: [{ name: 'Kibungo', villages: ['Kibungo', 'Ngoma', 'Karembo'] }] }, { name: 'Mugesera', cells: [{ name: 'Mugesera', villages: ['Mugesera', 'Ngoma', 'Karembo'] }] }, { name: 'Murama', cells: [{ name: 'Murama', villages: ['Murama', 'Ngoma', 'Karembo'] }] }, { name: 'Mutenderi', cells: [{ name: 'Mutenderi', villages: ['Mutenderi', 'Ngoma', 'Karembo'] }] }, { name: 'Remera', cells: [{ name: 'Remera', villages: ['Remera', 'Ngoma', 'Karembo'] }] }, { name: 'Rukira', cells: [{ name: 'Rukira', villages: ['Rukira', 'Ngoma', 'Karembo'] }] }, { name: 'Rukumberi', cells: [{ name: 'Rukumberi', villages: ['Rukumberi', 'Ngoma', 'Karembo'] }] }, { name: 'Rurenge', cells: [{ name: 'Rurenge', villages: ['Rurenge', 'Ngoma', 'Karembo'] }] }, { name: 'Sake', cells: [{ name: 'Sake', villages: ['Sake', 'Ngoma', 'Karembo'] }] }, { name: 'Zaza', cells: [{ name: 'Zaza', villages: ['Zaza', 'Ngoma', 'Karembo'] }] }] },
      { name: 'Nyagatare', sectors: [{ name: 'Gatunda', cells: [{ name: 'Gatunda', villages: ['Gatunda', 'Nyagatare', 'Karangazi'] }] }, { name: 'Karama', cells: [{ name: 'Karama', villages: ['Karama', 'Nyagatare', 'Karangazi'] }] }, { name: 'Karangazi', cells: [{ name: 'Karangazi', villages: ['Karangazi', 'Nyagatare', 'Gatunda'] }] }, { name: 'Katabagemu', cells: [{ name: 'Katabagemu', villages: ['Katabagemu', 'Nyagatare', 'Karangazi'] }] }, { name: 'Matimba', cells: [{ name: 'Matimba', villages: ['Matimba', 'Nyagatare', 'Karangazi'] }] }, { name: 'Mimuli', cells: [{ name: 'Mimuli', villages: ['Mimuli', 'Nyagatare', 'Karangazi'] }] }, { name: 'Mukama', cells: [{ name: 'Mukama', villages: ['Mukama', 'Nyagatare', 'Karangazi'] }] }, { name: 'Musheli', cells: [{ name: 'Musheli', villages: ['Musheli', 'Nyagatare', 'Karangazi'] }] }, { name: 'Nyagatare', cells: [{ name: 'Nyagatare', villages: ['Nyagatare', 'Karangazi', 'Gatunda'] }] }, { name: 'Rukomo', cells: [{ name: 'Rukomo', villages: ['Rukomo', 'Nyagatare', 'Karangazi'] }] }, { name: 'Rwempasha', cells: [{ name: 'Rwempasha', villages: ['Rwempasha', 'Nyagatare', 'Karangazi'] }] }, { name: 'Rwimiyaga', cells: [{ name: 'Rwimiyaga', villages: ['Rwimiyaga', 'Nyagatare', 'Karangazi'] }] }, { name: 'Tabagwe', cells: [{ name: 'Tabagwe', villages: ['Tabagwe', 'Nyagatare', 'Karangazi'] }] }] },
      { name: 'Rwamagana', sectors: [{ name: 'Fumbwe', cells: [{ name: 'Fumbwe', villages: ['Fumbwe', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Gahengeri', cells: [{ name: 'Gahengeri', villages: ['Gahengeri', 'Rwamagana', 'Fumbwe'] }] }, { name: 'Gishari', cells: [{ name: 'Gishari', villages: ['Gishari', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Karenge', cells: [{ name: 'Karenge', villages: ['Karenge', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Kigabiro', cells: [{ name: 'Kigabiro', villages: ['Kigabiro', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Muhazi', cells: [{ name: 'Muhazi', villages: ['Muhazi', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Munyaga', cells: [{ name: 'Munyaga', villages: ['Munyaga', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Munyiginya', cells: [{ name: 'Munyiginya', villages: ['Munyiginya', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Musha', cells: [{ name: 'Musha', villages: ['Musha', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Muyumbu', cells: [{ name: 'Muyumbu', villages: ['Muyumbu', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Mwulire', cells: [{ name: 'Mwulire', villages: ['Mwulire', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Nyakariro', cells: [{ name: 'Nyakariro', villages: ['Nyakariro', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Nzige', cells: [{ name: 'Nzige', villages: ['Nzige', 'Rwamagana', 'Gahengeri'] }] }, { name: 'Rubona', cells: [{ name: 'Rubona', villages: ['Rubona', 'Rwamagana', 'Gahengeri'] }] }] },
    ],
  },
  {
    name: 'Western',
    districts: [
      { name: 'Karongi', sectors: [{ name: 'Bwishyura', cells: [{ name: 'Bwishyura', villages: ['Bwishyura', 'Karongi', 'Kibuye'] }] }, { name: 'Gashari', cells: [{ name: 'Gashari', villages: ['Gashari', 'Karongi', 'Kibuye'] }] }, { name: 'Gishyita', cells: [{ name: 'Gishyita', villages: ['Gishyita', 'Karongi', 'Kibuye'] }] }, { name: 'Gitesi', cells: [{ name: 'Gitesi', villages: ['Gitesi', 'Karongi', 'Kibuye'] }] }, { name: 'Mubuga', cells: [{ name: 'Mubuga', villages: ['Mubuga', 'Karongi', 'Kibuye'] }] }, { name: 'Murambi', cells: [{ name: 'Murambi', villages: ['Murambi', 'Karongi', 'Kibuye'] }] }, { name: 'Murundi', cells: [{ name: 'Murundi', villages: ['Murundi', 'Karongi', 'Kibuye'] }] }, { name: 'Mutuntu', cells: [{ name: 'Mutuntu', villages: ['Mutuntu', 'Karongi', 'Kibuye'] }] }, { name: 'Rubengera', cells: [{ name: 'Rubengera', villages: ['Rubengera', 'Karongi', 'Kibuye'] }] }, { name: 'Rugabano', cells: [{ name: 'Rugabano', villages: ['Rugabano', 'Karongi', 'Kibuye'] }] }, { name: 'Ruganda', cells: [{ name: 'Ruganda', villages: ['Ruganda', 'Karongi', 'Kibuye'] }] }, { name: 'Rwankuba', cells: [{ name: 'Rwankuba', villages: ['Rwankuba', 'Karongi', 'Kibuye'] }] }, { name: 'Twumba', cells: [{ name: 'Twumba', villages: ['Twumba', 'Karongi', 'Kibuye'] }] }] },
      { name: 'Ngororero', sectors: [{ name: 'Bwira', cells: [{ name: 'Bwira', villages: ['Bwira', 'Ngororero', 'Kageyo'] }] }, { name: 'Gatumba', cells: [{ name: 'Gatumba', villages: ['Gatumba', 'Ngororero', 'Kageyo'] }] }, { name: 'Hindiro', cells: [{ name: 'Hindiro', villages: ['Hindiro', 'Ngororero', 'Kageyo'] }] }, { name: 'Kageyo', cells: [{ name: 'Kageyo', villages: ['Kageyo', 'Ngororero', 'Bwira'] }] }, { name: 'Kavumu', cells: [{ name: 'Kavumu', villages: ['Kavumu', 'Ngororero', 'Kageyo'] }] }, { name: 'Matyazo', cells: [{ name: 'Matyazo', villages: ['Matyazo', 'Ngororero', 'Kageyo'] }] }, { name: 'Muhanda', cells: [{ name: 'Muhanda', villages: ['Muhanda', 'Ngororero', 'Kageyo'] }] }, { name: 'Muhororo', cells: [{ name: 'Muhororo', villages: ['Muhororo', 'Ngororero', 'Kageyo'] }] }, { name: 'Ndaro', cells: [{ name: 'Ndaro', villages: ['Ndaro', 'Ngororero', 'Kageyo'] }] }, { name: 'Ngororero', cells: [{ name: 'Ngororero', villages: ['Ngororero', 'Kageyo', 'Bwira'] }] }, { name: 'Nyange', cells: [{ name: 'Nyange', villages: ['Nyange', 'Ngororero', 'Kageyo'] }] }, { name: 'Sovu', cells: [{ name: 'Sovu', villages: ['Sovu', 'Ngororero', 'Kageyo'] }] }] },
      { name: 'Nyabihu', sectors: [{ name: 'Bigogwe', cells: [{ name: 'Bigogwe', villages: ['Bigogwe', 'Nyabihu', 'Rambura'] }] }, { name: 'Jomba', cells: [{ name: 'Jomba', villages: ['Jomba', 'Nyabihu', 'Rambura'] }] }, { name: 'Kabatwa', cells: [{ name: 'Kabatwa', villages: ['Kabatwa', 'Nyabihu', 'Rambura'] }] }, { name: 'Karago', cells: [{ name: 'Karago', villages: ['Karago', 'Nyabihu', 'Rambura'] }] }, { name: 'Kintobo', cells: [{ name: 'Kintobo', villages: ['Kintobo', 'Nyabihu', 'Rambura'] }] }, { name: 'Mukamira', cells: [{ name: 'Mukamira', villages: ['Mukamira', 'Nyabihu', 'Rambura'] }] }, { name: 'Muringa', cells: [{ name: 'Muringa', villages: ['Muringa', 'Nyabihu', 'Rambura'] }] }, { name: 'Rambura', cells: [{ name: 'Rambura', villages: ['Rambura', 'Nyabihu', 'Bigogwe'] }] }, { name: 'Rurembo', cells: [{ name: 'Rurembo', villages: ['Rurembo', 'Nyabihu', 'Rambura'] }] }, { name: 'Shyira', cells: [{ name: 'Shyira', villages: ['Shyira', 'Nyabihu', 'Rambura'] }] }] },
      { name: 'Nyamasheke', sectors: [{ name: 'Bushekeri', cells: [{ name: 'Bushekeri', villages: ['Bushekeri', 'Nyamasheke', 'Kagano'] }] }, { name: 'Bushenge', cells: [{ name: 'Bushenge', villages: ['Bushenge', 'Nyamasheke', 'Kagano'] }] }, { name: 'Cyato', cells: [{ name: 'Cyato', villages: ['Cyato', 'Nyamasheke', 'Kagano'] }] }, { name: 'Gihombo', cells: [{ name: 'Gihombo', villages: ['Gihombo', 'Nyamasheke', 'Kagano'] }] }, { name: 'Kagano', cells: [{ name: 'Kagano', villages: ['Kagano', 'Nyamasheke', 'Bushekeri'] }] }, { name: 'Kanjongo', cells: [{ name: 'Kanjongo', villages: ['Kanjongo', 'Nyamasheke', 'Kagano'] }] }, { name: 'Karambi', cells: [{ name: 'Karambi', villages: ['Karambi', 'Nyamasheke', 'Kagano'] }] }, { name: 'Karengera', cells: [{ name: 'Karengera', villages: ['Karengera', 'Nyamasheke', 'Kagano'] }] }, { name: 'Kirimbi', cells: [{ name: 'Kirimbi', villages: ['Kirimbi', 'Nyamasheke', 'Kagano'] }] }, { name: 'Macuba', cells: [{ name: 'Macuba', villages: ['Macuba', 'Nyamasheke', 'Kagano'] }] }, { name: 'Mahembe', cells: [{ name: 'Mahembe', villages: ['Mahembe', 'Nyamasheke', 'Kagano'] }] }, { name: 'Nyabitekeri', cells: [{ name: 'Nyabitekeri', villages: ['Nyabitekeri', 'Nyamasheke', 'Kagano'] }] }, { name: 'Rangiro', cells: [{ name: 'Rangiro', villages: ['Rangiro', 'Nyamasheke', 'Kagano'] }] }, { name: 'Ruharambuga', cells: [{ name: 'Ruharambuga', villages: ['Ruharambuga', 'Nyamasheke', 'Kagano'] }] }, { name: 'Shangi', cells: [{ name: 'Shangi', villages: ['Shangi', 'Nyamasheke', 'Kagano'] }] }] },
      { name: 'Rubavu', sectors: [{ name: 'Bugeshi', cells: [{ name: 'Bugeshi', villages: ['Bugeshi', 'Rubavu', 'Gisenyi'] }] }, { name: 'Busasamana', cells: [{ name: 'Busasamana', villages: ['Busasamana', 'Rubavu', 'Gisenyi'] }] }, { name: 'Cyanzarwe', cells: [{ name: 'Cyanzarwe', villages: ['Cyanzarwe', 'Rubavu', 'Gisenyi'] }] }, { name: 'Gisenyi', cells: [{ name: 'Gisenyi', villages: ['Gisenyi', 'Rubavu', 'Bugeshi'] }] }, { name: 'Kanama', cells: [{ name: 'Kanama', villages: ['Kanama', 'Rubavu', 'Gisenyi'] }] }, { name: 'Kanzenze', cells: [{ name: 'Kanzenze', villages: ['Kanzenze', 'Rubavu', 'Gisenyi'] }] }, { name: 'Mudende', cells: [{ name: 'Mudende', villages: ['Mudende', 'Rubavu', 'Gisenyi'] }] }, { name: 'Nyamyumba', cells: [{ name: 'Nyamyumba', villages: ['Nyamyumba', 'Rubavu', 'Gisenyi'] }] }, { name: 'Nyundo', cells: [{ name: 'Nyundo', villages: ['Nyundo', 'Rubavu', 'Gisenyi'] }] }, { name: 'Rubavu', cells: [{ name: 'Rubavu', villages: ['Rubavu', 'Gisenyi', 'Bugeshi'] }] }, { name: 'Rugerero', cells: [{ name: 'Rugerero', villages: ['Rugerero', 'Rubavu', 'Gisenyi'] }] }] },
      { name: 'Rusizi', sectors: [{ name: 'Bugarama', cells: [{ name: 'Bugarama', villages: ['Bugarama', 'Rusizi', 'Kamembe'] }] }, { name: 'Butare', cells: [{ name: 'Butare', villages: ['Butare', 'Rusizi', 'Kamembe'] }] }, { name: 'Bweyeye', cells: [{ name: 'Bweyeye', villages: ['Bweyeye', 'Rusizi', 'Kamembe'] }] }, { name: 'Gashonga', cells: [{ name: 'Gashonga', villages: ['Gashonga', 'Rusizi', 'Kamembe'] }] }, { name: 'Giheke', cells: [{ name: 'Giheke', villages: ['Giheke', 'Rusizi', 'Kamembe'] }] }, { name: 'Gihundwe', cells: [{ name: 'Gihundwe', villages: ['Gihundwe', 'Rusizi', 'Kamembe'] }] }, { name: 'Gitambi', cells: [{ name: 'Gitambi', villages: ['Gitambi', 'Rusizi', 'Kamembe'] }] }, { name: 'Kamembe', cells: [{ name: 'Kamembe', villages: ['Kamembe', 'Rusizi', 'Bugarama'] }] }, { name: 'Muganza', cells: [{ name: 'Muganza', villages: ['Muganza', 'Rusizi', 'Kamembe'] }] }, { name: 'Mururu', cells: [{ name: 'Mururu', villages: ['Mururu', 'Rusizi', 'Kamembe'] }] }, { name: 'Nkanka', cells: [{ name: 'Nkanka', villages: ['Nkanka', 'Rusizi', 'Kamembe'] }] }, { name: 'Nkungu', cells: [{ name: 'Nkungu', villages: ['Nkungu', 'Rusizi', 'Kamembe'] }] }, { name: 'Nyakarenzo', cells: [{ name: 'Nyakarenzo', villages: ['Nyakarenzo', 'Rusizi', 'Kamembe'] }] }, { name: 'Nzahaha', cells: [{ name: 'Nzahaha', villages: ['Nzahaha', 'Rusizi', 'Kamembe'] }] }, { name: 'Rwimbogo', cells: [{ name: 'Rwimbogo', villages: ['Rwimbogo', 'Rusizi', 'Kamembe'] }] }] },
      { name: 'Rutsiro', sectors: [{ name: 'Boneza', cells: [{ name: 'Boneza', villages: ['Boneza', 'Rutsiro', 'Kivumu'] }] }, { name: 'Gihango', cells: [{ name: 'Gihango', villages: ['Gihango', 'Rutsiro', 'Kivumu'] }] }, { name: 'Kigeyo', cells: [{ name: 'Kigeyo', villages: ['Kigeyo', 'Rutsiro', 'Kivumu'] }] }, { name: 'Kivumu', cells: [{ name: 'Kivumu', villages: ['Kivumu', 'Rutsiro', 'Boneza'] }] }, { name: 'Manihira', cells: [{ name: 'Manihira', villages: ['Manihira', 'Rutsiro', 'Kivumu'] }] }, { name: 'Mukura', cells: [{ name: 'Mukura', villages: ['Mukura', 'Rutsiro', 'Kivumu'] }] }, { name: 'Murunda', cells: [{ name: 'Murunda', villages: ['Murunda', 'Rutsiro', 'Kivumu'] }] }, { name: 'Musasa', cells: [{ name: 'Musasa', villages: ['Musasa', 'Rutsiro', 'Kivumu'] }] }, { name: 'Mushonyi', cells: [{ name: 'Mushonyi', villages: ['Mushonyi', 'Rutsiro', 'Kivumu'] }] }, { name: 'Mushubati', cells: [{ name: 'Mushubati', villages: ['Mushubati', 'Rutsiro', 'Kivumu'] }] }, { name: 'Nyabirasi', cells: [{ name: 'Nyabirasi', villages: ['Nyabirasi', 'Rutsiro', 'Kivumu'] }] }, { name: 'Ruhango', cells: [{ name: 'Ruhango', villages: ['Ruhango', 'Rutsiro', 'Kivumu'] }] }, { name: 'Rusebeya', cells: [{ name: 'Rusebeya', villages: ['Rusebeya', 'Rutsiro', 'Kivumu'] }] }] },
    ],
  },
];

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

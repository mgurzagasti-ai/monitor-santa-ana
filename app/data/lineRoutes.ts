export type LineRouteDefinition = {
  id: string;
  number: string;
  name: string;
  color: string;
  mapId: string;
  mapUrl: string;
  kmlUrl: string;
};

function myMapsUrl(id: string) {
  return `https://www.google.com/maps/d/viewer?mid=${id}`;
}

function myMapsKmlUrl(id: string) {
  return `https://www.google.com/maps/d/kml?mid=${id}&forcekml=1`;
}

function routeLine(id: string, number: string, name: string, mapId: string, color: string): LineRouteDefinition {
  return {
    id,
    number,
    name,
    color,
    mapId,
    mapUrl: myMapsUrl(mapId),
    kmlUrl: myMapsKmlUrl(mapId)
  };
}

export const lineRoutes = [
  routeLine("2-peron", "2", "Linea 2 x Peron", "1TSzIhaJb-72u_5PvnTbXoTm2C7LfVFc", "#0B6E4F"),
  routeLine("2-savio", "2", "Linea 2 x Savio", "1eBz-IYpmGpPjPfEjKLBd0gnXLzG3SOA", "#0E7490"),
  routeLine("3", "3", "Linea 3", "1eAPe8EHTBoj2YFOM9x-yiQl91dbaFLs", "#2563EB"),
  routeLine("4", "4", "Linea 4", "1U30Pf_5Dr19Ha_y8e2ClSI5w4FdFFDM", "#7C3AED"),
  routeLine("4-flash", "4", "Linea 4 x Flash", "1EuE9nxCbY1bVjj0btbi4VcZUQ169Zzo", "#C026D3"),
  routeLine("5", "5", "Linea 5", "1o5FlExbyvsWmPp8EFfnNBQzPw-_XkeQ", "#DC2626"),
  routeLine("6", "6", "Linea 6", "1xywBoVihBMpgOVlQn_8tv7moUgr-WvQ", "#EA580C"),
  routeLine("8-peron", "8", "Linea 8 x Peron", "1BSzriz-yQnYZZj348-fM4jlKeYDut3k", "#CA8A04"),
  routeLine("8-savio", "8", "Linea 8 x Savio", "1fOc6Ylevf-xhSz8A3bXZZNfusBM6lAk", "#65A30D"),
  routeLine("10", "10", "Linea 10", "1qOGLLOVOPpg16DGwbK8wZRioKF0P1_o", "#16A34A"),
  routeLine("11", "11", "Linea 11", "1kMYPAk36Wl80iMzEEbcaW90t3HaaL7Y", "#059669"),
  routeLine("12", "12", "Linea 12", "1BT5HXwT48y6azIXMT91xnzhf2wH0jow", "#0891B2"),
  routeLine("15", "15", "Linea 15", "11LrTz0N4r0NFbQCla6sa1XLVMgZh_k4", "#0284C7"),
  routeLine("16", "16", "Linea 16", "1IWjRlXtoyf9xDiNdL16fIqZ1GrcpfIk", "#4F46E5"),
  routeLine("17", "17", "Linea 17", "1e09DpmeMgi4NBvDVdkLA1pnt54CJquY", "#9333EA"),
  routeLine("18", "18", "Linea 18", "1I40qfVd3_DeMpDB-hrSV8LTYnEFmKf0", "#BE185D"),
  routeLine("19", "19", "Linea 19", "1gEQnmXPaDrgLPdl-9KhZeuXlR9aDWIw", "#E11D48"),
  routeLine("20", "20", "Linea 20", "10TI8P3F3sJn6cgx_pI8mEYLpE-hL7Nw", "#EF4444"),
  routeLine("21", "21", "Linea 21", "1HXvQlxQ5odxFQi00mq0onSsjVM3u0KY", "#F97316"),
  routeLine("24", "24", "Linea 24", "1wpNAJlYytiEVL17uy14fevVoXxKRU8o", "#D97706"),
  routeLine("25", "25", "Linea 25", "1cjfzaJmzSZ8PMrkcMdv6cRAzrosHg0I", "#84CC16"),
  routeLine("27", "27", "Linea 27", "19sA5C6SC-wIY9a2QyI8G1siLLmaF6Jo", "#22C55E"),
  routeLine("28", "28", "Linea 28", "1OSbFD_L4b6w_N5ae7k6xgtdXjtoy_ck", "#14B8A6"),
  routeLine("30", "30", "Linea 30", "1Lc52rSlTTqKD_Mu4bfvzTYizUi6evbY", "#06B6D4"),
  routeLine("32", "32", "Linea 32", "1rONMXtZjOzJRPwTqAd4Dy25u8JMYFzQ", "#0EA5E9"),
  routeLine("33", "33", "Linea 33", "1m8xa3YuBoA_doItTDKBrlDkjhOPAnmQ", "#3B82F6"),
  routeLine("34", "34", "Linea 34", "1p5I4xASk0aZ_vfgs31smziSJfAE46J8", "#6366F1"),
  routeLine("35", "35", "Linea 35", "15QLinAFo1blI81KbZhRklIMRhsdrNWM", "#8B5CF6"),
  routeLine("36", "36", "Linea 36", "1keytsnAj85Gdiwsv30ASySPlziSssCA", "#A855F7"),
  routeLine("38", "38", "Linea 38", "1lPlQOH5ytH2xGoIPQ8fqvtKvPKoH4nw", "#D946EF"),
  routeLine("39", "39", "Linea 39", "1wSGZ0vvcprD8OH1WqH2KJHD7pTYt0cY", "#EC4899"),
  routeLine("40", "40", "Linea 40", "1ufuRGithdt-6JfPbvvfnjn4lW3gXFcg", "#F43F5E"),
  routeLine("41", "41", "Linea 41", "1NyVkwM4qzzMrvgYus4UzSjBsfRKu2E0", "#B91C1C"),
  routeLine("44", "44", "Linea 44", "1HU4uAV3p9dih3ZOUg7rrffvJ4Cqkzlk", "#92400E"),
  routeLine("45", "45", "Linea 45", "1_EI1eD8M67_xu5bvyezHpAYzSPVBeOc", "#A16207"),
  routeLine("46", "46", "Linea 46", "1tZ6WpUrBfBDynuGwZVN8UC3sSqZ93_8", "#4D7C0F"),
  routeLine("49bis", "49", "", "1sw3akcsapXPBGsqGWWytY4OO74ZrEOg", "#F57C00"),
  routeLine("52", "52", "Linea 52", "1sk4PSH6jICp7xZQ_Yh8znBLBiginqzQ", "#15803D")
] satisfies LineRouteDefinition[];

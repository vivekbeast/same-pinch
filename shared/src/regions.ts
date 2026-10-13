// India's 28 states + 8 union territories (ISO 3166-2:IN codes, 2023 revision).
// The Sync Map, partner cards and the `regions` table are all built from this list.

export const ZONES = ["north", "south", "east", "west", "central", "northeast"] as const;
export type Zone = (typeof ZONES)[number];

export interface Region {
  code: string;
  name: string;
  kind: "state" | "ut";
  zone: Zone;
}

export const REGIONS = [
  { code: "AP", name: "Andhra Pradesh", kind: "state", zone: "south" },
  { code: "AR", name: "Arunachal Pradesh", kind: "state", zone: "northeast" },
  { code: "AS", name: "Assam", kind: "state", zone: "northeast" },
  { code: "BR", name: "Bihar", kind: "state", zone: "east" },
  { code: "CG", name: "Chhattisgarh", kind: "state", zone: "central" },
  { code: "GA", name: "Goa", kind: "state", zone: "west" },
  { code: "GJ", name: "Gujarat", kind: "state", zone: "west" },
  { code: "HR", name: "Haryana", kind: "state", zone: "north" },
  { code: "HP", name: "Himachal Pradesh", kind: "state", zone: "north" },
  { code: "JH", name: "Jharkhand", kind: "state", zone: "east" },
  { code: "KA", name: "Karnataka", kind: "state", zone: "south" },
  { code: "KL", name: "Kerala", kind: "state", zone: "south" },
  { code: "MP", name: "Madhya Pradesh", kind: "state", zone: "central" },
  { code: "MH", name: "Maharashtra", kind: "state", zone: "west" },
  { code: "MN", name: "Manipur", kind: "state", zone: "northeast" },
  { code: "ML", name: "Meghalaya", kind: "state", zone: "northeast" },
  { code: "MZ", name: "Mizoram", kind: "state", zone: "northeast" },
  { code: "NL", name: "Nagaland", kind: "state", zone: "northeast" },
  { code: "OD", name: "Odisha", kind: "state", zone: "east" },
  { code: "PB", name: "Punjab", kind: "state", zone: "north" },
  { code: "RJ", name: "Rajasthan", kind: "state", zone: "north" },
  { code: "SK", name: "Sikkim", kind: "state", zone: "northeast" },
  { code: "TN", name: "Tamil Nadu", kind: "state", zone: "south" },
  { code: "TG", name: "Telangana", kind: "state", zone: "south" },
  { code: "TR", name: "Tripura", kind: "state", zone: "northeast" },
  { code: "UP", name: "Uttar Pradesh", kind: "state", zone: "north" },
  { code: "UK", name: "Uttarakhand", kind: "state", zone: "north" },
  { code: "WB", name: "West Bengal", kind: "state", zone: "east" },
  { code: "AN", name: "Andaman and Nicobar Islands", kind: "ut", zone: "east" },
  { code: "CH", name: "Chandigarh", kind: "ut", zone: "north" },
  { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu", kind: "ut", zone: "west" },
  { code: "DL", name: "Delhi", kind: "ut", zone: "north" },
  { code: "JK", name: "Jammu and Kashmir", kind: "ut", zone: "north" },
  { code: "LA", name: "Ladakh", kind: "ut", zone: "north" },
  { code: "LD", name: "Lakshadweep", kind: "ut", zone: "south" },
  { code: "PY", name: "Puducherry", kind: "ut", zone: "south" },
] as const satisfies readonly Region[];

export type RegionCode = (typeof REGIONS)[number]["code"];
export const REGION_CODES = REGIONS.map((r) => r.code) as unknown as readonly [RegionCode, ...RegionCode[]];

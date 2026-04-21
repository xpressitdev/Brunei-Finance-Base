export type RegionCode = 'BN' | 'MY' | 'ID';

export interface RegionConfig {
  code: RegionCode;
  name: string;
  currency: string;
  locale: string;
  language: string;
  timezone: string;
}

export const REGIONS: Record<RegionCode, RegionConfig> = {
  BN: { code: 'BN', name: 'Brunei',    currency: 'BND', locale: 'en-BN', language: 'en', timezone: 'Asia/Brunei' },
  MY: { code: 'MY', name: 'Malaysia',  currency: 'MYR', locale: 'ms-MY', language: 'ms', timezone: 'Asia/Kuala_Lumpur' },
  ID: { code: 'ID', name: 'Indonesia', currency: 'IDR', locale: 'id-ID', language: 'id', timezone: 'Asia/Jakarta' },
};

export const DEFAULT_REGION: RegionCode = 'BN';

/**
 * Returns the RegionConfig for the given code, falling back to BN if unknown.
 */
export function getRegionByCode(code: string): RegionConfig {
  return REGIONS[code as RegionCode] ?? REGIONS[DEFAULT_REGION];
}

/**
 * Returns the ISO 4217 currency code for the given region.
 */
export function getCurrencyByRegion(code: RegionCode): string {
  return REGIONS[code].currency;
}

/**
 * Returns the BCP 47 locale string for the given region.
 */
export function getLocaleByRegion(code: RegionCode): string {
  return REGIONS[code].locale;
}

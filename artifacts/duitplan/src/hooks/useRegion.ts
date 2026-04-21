import { useGetProfile } from "@workspace/api-client-react";
import { getRegionByCode, DEFAULT_REGION } from "@/config/regions";
import type { RegionConfig } from "@/config/regions";
import { formatCurrency as _formatCurrency, formatDate as _formatDate, formatNumber as _formatNumber, formatMonthYear as _formatMonthYear, formatMonthShort as _formatMonthShort } from "@/utils/formatting";

export interface RegionFormatters {
  region: RegionConfig;
  formatCurrency: (amount: number | string | null | undefined) => string;
  formatDate: (date: Date | string | number | null | undefined) => string;
  formatMonthYear: (date: Date | string | number | null | undefined) => string;
  formatMonthShort: (date: Date | string | number | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  decimalStep: string;
  currencyStep: string;
}

export function useRegion(): RegionFormatters {
  const { data: profile } = useGetProfile();
  const regionCode = (profile?.region as string) ?? DEFAULT_REGION;
  const region = getRegionByCode(regionCode);

  const formatCurrency = (amount: number | string | null | undefined): string => {
    const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
    return _formatCurrency(isNaN(n) ? 0 : n, region.currency, region.locale);
  };

  const formatDate = (date: Date | string | number | null | undefined): string => {
    if (date == null) return "—";
    return _formatDate(date, region.locale);
  };

  const formatMonthYear = (date: Date | string | number | null | undefined): string => {
    if (date == null) return "—";
    return _formatMonthYear(date, region.locale);
  };

  const formatMonthShort = (date: Date | string | number | null | undefined): string => {
    if (date == null) return "—";
    return _formatMonthShort(date, region.locale);
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value == null) return "—";
    return _formatNumber(value, region.locale);
  };

  const isZeroDecimal = region.currency === "IDR";
  const decimalStep = isZeroDecimal ? "1" : "0.01";
  const currencyStep = decimalStep;

  return { region, formatCurrency, formatDate, formatMonthYear, formatMonthShort, formatNumber, decimalStep, currencyStep };
}

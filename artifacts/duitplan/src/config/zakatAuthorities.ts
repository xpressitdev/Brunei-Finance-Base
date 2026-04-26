export interface ZakatAuthority {
  name: string;
  fullName: string;
  url: string;
}

export const ZAKAT_AUTHORITIES: Record<string, ZakatAuthority> = {
  BN: {
    name: "MUIB",
    fullName: "Majlis Ugama Islam Brunei",
    url: "https://muib.gov.bn",
  },
  MY: {
    name: "Lembaga Zakat Selangor",
    fullName: "Lembaga Zakat Selangor (LZS)",
    url: "https://www.zakatselangor.com.my",
  },
  ID: {
    name: "BAZNAS",
    fullName: "Badan Amil Zakat Nasional",
    url: "https://baznas.go.id",
  },
};

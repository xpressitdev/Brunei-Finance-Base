// Approximate nisab values based on April 2026 gold/silver prices.
// 85g gold = gold-based nisab threshold (most commonly used)
// 595g silver = silver-based nisab threshold (alternative, lower threshold)
// These are REFERENCE values only. Users can override in the calculator.
// Update these monthly or quarterly to keep helper text relevant.
//
// Gold price references (April 2026):
//   BN: ~BND 195/g    |  MY: ~MYR 640/g    |  ID: ~IDR 2,650,000/g
// Silver price references (April 2026):
//   BN: ~BND 2.50/g   |  MY: ~MYR 8/g      |  ID: ~IDR 35,000/g

export const ZAKAT_NISAB_LAST_UPDATED = "April 2026";

export interface NisabRegionValues {
  gold: number;
  silver: number;
  currency: string;
  goldPricePerGram: number;
  silverPricePerGram: number;
}

export const ZAKAT_NISAB_REFERENCE: Record<string, NisabRegionValues> = {
  BN: {
    gold: 16575,
    silver: 1500,
    currency: "BND",
    goldPricePerGram: 195,
    silverPricePerGram: 2.5,
  },
  MY: {
    gold: 54400,
    silver: 4800,
    currency: "MYR",
    goldPricePerGram: 640,
    silverPricePerGram: 8,
  },
  ID: {
    gold: 225250000,
    silver: 21000000,
    currency: "IDR",
    goldPricePerGram: 2650000,
    silverPricePerGram: 35000,
  },
};

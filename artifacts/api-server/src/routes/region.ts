import { Router, type IRouter, type Request, type Response } from "express";
import { DEFAULT_REGION, type RegionCode } from "../lib/region";

const REGION_META: Record<RegionCode, { name: string; currency: string; locale: string; language: string; timezone: string }> = {
  BN: { name: "Brunei",    currency: "BND", locale: "en-BN", language: "en", timezone: "Asia/Brunei" },
  MY: { name: "Malaysia",  currency: "MYR", locale: "ms-MY", language: "ms", timezone: "Asia/Kuala_Lumpur" },
  ID: { name: "Indonesia", currency: "IDR", locale: "id-ID", language: "id", timezone: "Asia/Jakarta" },
};

const router: IRouter = Router();

router.get("/region", (req: Request, res: Response): void => {
  const region = req.region ?? DEFAULT_REGION;
  const meta = REGION_META[region];
  res.json({ region, ...meta });
});

export default router;

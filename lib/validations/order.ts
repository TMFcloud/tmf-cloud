import { z } from "zod";

// External Stratum pool validation
export const PoolDestinationSchema = z.object({
  stratum_url: z
    .string()
    .trim()
    .min(5, "Stratum URL is required"),
  worker_name: z
    .string()
    .trim()
    .min(1, "Worker name is required")
    .max(60, "Worker name too long"),
  worker_password: z.string().trim().default("x").optional(),
  account_username: z.string().trim().optional(),
  pool_provider: z.string().trim().default("ViaBTC").optional(),
});

// Authoritative Order Creation Schema
export const CreateOrderSchema = z.object({
  hashrate_th: z
    .number()
    .int("Hashrate must be a whole number")
    .min(10, "Minimum hashrate is 10 TH/s")
    .max(20000, "Maximum hashrate is 20,000 TH/s"),
  duration_days: z
    .number()
    .int("Duration must be a whole number of days")
    .min(30, "Minimum contract duration is 30 days")
    .max(365, "Maximum contract duration is 365 days"),
  payment_currency: z.enum(["USDT_TRC20", "USDT_ERC20", "BTC", "WALLET"]).default("USDT_TRC20"),
  payment_method: z.enum(["WALLET", "CRYPTO"]).default("CRYPTO").optional(),
  pool: PoolDestinationSchema,
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the hashrate terms and acknowledge variable rewards",
  }),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type PoolDestinationInput = z.infer<typeof PoolDestinationSchema>;

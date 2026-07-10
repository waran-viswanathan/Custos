import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../..');

// root .env first, then any cwd-local .env (existing vars are never overridden)
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config();

const EnvSchema = z.object({
  RPC_URL: z.string().default('http://127.0.0.1:8545'),
  CHAIN_ID: z.coerce.number().default(31337),
  // anvil default key #0 — production uses KMS-held keys, see SECURITY.md
  ATTESTER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .default('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  DEPLOYMENTS_FILE: z.string().default('./contracts/deployments/local.json'),

  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://custos:custos@localhost:5432/custos'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ADMIN_BEARER_TOKEN: z.string().min(8).default('dev-admin-token-change-me'),
  SANCTIONS_BLOCKED_JURISDICTIONS: z.string().default('KP,IR,CU,SY'),

  PERSONA_API_KEY: z.string().optional(),
  OFAC_API_KEY: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);

export const blockedJurisdictions = new Set(
  env.SANCTIONS_BLOCKED_JURISDICTIONS.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
);

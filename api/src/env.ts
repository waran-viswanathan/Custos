import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config();

const DEV_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEV_ADMIN = 'dev-admin-token-change-me';
const envBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RPC_URL: z.string().url().or(z.string().regex(/^http:\/\//)).default('http://127.0.0.1:8545'),
  CHAIN_ID: z.coerce.number().int().positive().default(31337),
  ATTESTER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/).default(DEV_KEY),
  DEPLOYMENTS_FILE: z.string().default('./contracts/deployments/local.json'),
  API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
  DATABASE_URL: z.string().default('postgresql://custos:custos@localhost:5432/custos'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ADMIN_BEARER_TOKEN: z.string().min(24).default(DEV_ADMIN),
  CUSTOS_REGISTRATION_DOMAIN: z.string().default('localhost'),
  REGISTRATION_CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  SANCTIONS_BLOCKED_JURISDICTIONS: z.string().default('KP,IR,CU,SY'),
  PERSONA_API_KEY: z.string().optional(),
  OFAC_API_KEY: z.string().optional(),
  KYB_PROVIDER_URL: z.string().url().optional(),
  SANCTIONS_PROVIDER_URL: z.string().url().optional(),
  ALLOW_MOCK_PROVIDERS: envBoolean.default(true),
  ALLOW_UNSIGNED_REGISTRATION: envBoolean.default(true),
  INDEXER_CONFIRMATIONS: z.coerce.number().int().min(0).max(1000).default(1),
  INDEXER_START_BLOCK: z.coerce.bigint().optional(),
}).superRefine((v, ctx) => {
  if (v.NODE_ENV !== 'production') return;
  const reject = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (v.ATTESTER_PRIVATE_KEY.toLowerCase() === DEV_KEY) reject('ATTESTER_PRIVATE_KEY', 'development key forbidden in production');
  if (v.ADMIN_BEARER_TOKEN === DEV_ADMIN) reject('ADMIN_BEARER_TOKEN', 'development token forbidden in production');
  if (v.CUSTOS_REGISTRATION_DOMAIN === 'localhost') reject('CUSTOS_REGISTRATION_DOMAIN', 'public domain required in production');
  if (v.ALLOW_MOCK_PROVIDERS) reject('ALLOW_MOCK_PROVIDERS', 'mock providers forbidden in production');
  if (v.ALLOW_UNSIGNED_REGISTRATION) reject('ALLOW_UNSIGNED_REGISTRATION', 'unsigned registration forbidden in production');
  if (!v.PERSONA_API_KEY || !v.OFAC_API_KEY || !v.KYB_PROVIDER_URL || !v.SANCTIONS_PROVIDER_URL) reject('PERSONA_API_KEY', 'real KYB and sanctions provider credentials and URLs are required in production');
  if (v.INDEXER_START_BLOCK === undefined) reject('INDEXER_START_BLOCK', 'deployment block required in production');
  if (v.INDEXER_CONFIRMATIONS < 2) reject('INDEXER_CONFIRMATIONS', 'at least two confirmations required in production');
});

export const env = EnvSchema.parse(process.env);
export const blockedJurisdictions = new Set(
  env.SANCTIONS_BLOCKED_JURISDICTIONS.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
);

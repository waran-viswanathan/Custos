import { PrismaClient } from '@prisma/client';
import { blockedJurisdictions, env } from './env.js';
import { createChainService, type ChainService } from './chain.js';
import { MockKybProvider, MockSanctionsProvider } from './providers/mock.js';
import { OfacSanctionsProvider, PersonaKybProvider } from './providers/real.js';
import type { KybProvider, SanctionsProvider } from './providers/types.js';

export interface AppDeps { db: PrismaClient; chain: ChainService; kyb: KybProvider; sanctions: SanctionsProvider }
let deps: AppDeps | undefined;
export function createDeps(): AppDeps {
  if (!deps) {
    const real = Boolean(env.PERSONA_API_KEY && env.OFAC_API_KEY && env.KYB_PROVIDER_URL && env.SANCTIONS_PROVIDER_URL);
    if (!real && !env.ALLOW_MOCK_PROVIDERS) throw new Error('verification providers are not configured');
    deps = {
      db: new PrismaClient(),
      chain: createChainService(),
      kyb: real ? new PersonaKybProvider(env.PERSONA_API_KEY!, env.KYB_PROVIDER_URL!) : new MockKybProvider(),
      sanctions: real ? new OfacSanctionsProvider(env.OFAC_API_KEY!, env.SANCTIONS_PROVIDER_URL!) : new MockSanctionsProvider(blockedJurisdictions),
    };
  }
  return deps;
}

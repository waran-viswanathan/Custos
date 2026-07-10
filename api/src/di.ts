import { PrismaClient } from '@prisma/client';
import { blockedJurisdictions, env } from './env.js';
import { createChainService, type ChainService } from './chain.js';
import { MockKybProvider, MockSanctionsProvider } from './providers/mock.js';
import { OfacSanctionsProvider, PersonaKybProvider } from './providers/real.js';
import type { KybProvider, SanctionsProvider } from './providers/types.js';

export interface AppDeps {
  db: PrismaClient;
  chain: ChainService;
  kyb: KybProvider;
  sanctions: SanctionsProvider;
}

let deps: AppDeps | undefined;

export function createDeps(): AppDeps {
  if (!deps) {
    deps = {
      db: new PrismaClient(),
      chain: createChainService(),
      kyb: env.PERSONA_API_KEY ? new PersonaKybProvider(env.PERSONA_API_KEY) : new MockKybProvider(),
      sanctions: env.OFAC_API_KEY
        ? new OfacSanctionsProvider(env.OFAC_API_KEY)
        : new MockSanctionsProvider(blockedJurisdictions),
    };
  }
  return deps;
}

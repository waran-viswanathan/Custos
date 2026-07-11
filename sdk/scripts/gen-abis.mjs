// Regenerates src/abis.ts from the Foundry build artifacts.
// Prereq: `forge build` (or `forge inspect`) has been run in contracts/.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractsDir = resolve(root, '../contracts');

const names = {
  CustosRegistry: 'custosRegistryAbi',
  CustosGate: 'custosGateAbi',
  MockTBill: 'mockTBillAbi',
  MockEAS: 'mockEasAbi',
  CustosActionAuthorizer: 'custosActionAuthorizerAbi',
  CustosMarketManager: 'custosMarketManagerAbi',
};

let out =
  '// GENERATED from contracts/out via forge inspect — do not edit by hand.\n// Regenerate with: pnpm --filter @custos/sdk gen:abis\n';
for (const [contract, exportName] of Object.entries(names)) {
  const abi = JSON.parse(execSync(`forge inspect ${contract} abi --json`, { cwd: contractsDir, encoding: 'utf8' }));
  out += `\nexport const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;\n`;
}
writeFileSync(resolve(root, 'src/abis.ts'), out);
console.log('wrote src/abis.ts');

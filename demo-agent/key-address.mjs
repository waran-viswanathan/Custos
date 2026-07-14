import { privateKeyToAccount } from 'viem/accounts';

const variable = process.argv[2];
if (!variable) throw new Error('private-key environment variable name is required');
const value = process.env[variable];
if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${variable} is missing or malformed`);
process.stdout.write(privateKeyToAccount(value).address);

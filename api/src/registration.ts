import { getAddress, type Address } from 'viem';

export interface RegistrationPayload {
  wallet: Address | string;
  ownerName: string;
  ownerEmail: string;
  ownerEntityType: 'INDIVIDUAL' | 'COMPANY';
  jurisdiction: string;
  erc8004TokenId?: string | null;
}

export function registrationMessage(
  input: RegistrationPayload,
  nonce: string,
  domain: string,
): string {
  return [
    'Custos agent registration',
    '',
    `Domain: ${domain}`,
    `Wallet: ${getAddress(input.wallet)}`,
    `Operator: ${input.ownerName}`,
    `Email: ${input.ownerEmail.toLowerCase()}`,
    `Entity type: ${input.ownerEntityType}`,
    `Jurisdiction: ${input.jurisdiction.toUpperCase()}`,
    `ERC-8004 token: ${input.erc8004TokenId ?? 'none'}`,
    `Nonce: ${nonce}`,
    '',
    'Signing proves this agent wallet authorizes the named operator to bind it to a Custos credential.',
  ].join('\n');
}

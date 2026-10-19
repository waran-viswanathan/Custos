// Shared with the browser. Keep session secrets and signing code out of this module.
export function loginMessage(address: string, nonce: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000';
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? '31337';
  return `Custos issuer dashboard wants you to sign in\n\nURI: ${origin}\nAddress: ${address.toLowerCase()}\nChain ID: ${chainId}\nNonce: ${nonce}`;
}

'use client';

export function Wallet({ address }: { address: string }) {
  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <button
      type="button"
      title={`${address} (click to copy)`}
      onClick={() => navigator.clipboard.writeText(address)}
      className="cursor-pointer font-mono hover:text-blue-600"
    >
      {truncated}
    </button>
  );
}

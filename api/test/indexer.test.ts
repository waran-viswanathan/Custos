import { describe, expect, it, vi } from 'vitest';
import { getLogsResilient, reorgDeleteWhere, reorgRewindBlock } from '../src/indexer.js';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;

describe('indexer resilience', () => {
  it('rewinds a bounded window when a canonical block hash changes', () => {
    expect(reorgRewindBlock(1_000n)).toBe(872n);
    expect(reorgRewindBlock(100n)).toBe(0n);
  });

  it('deletes only orphaned logs owned by the rewound deployment cursor', () => {
    expect(reorgDeleteWhere('indexer-84532-v4', 872n)).toEqual({
      chainIndexerId: 'indexer-84532-v4',
      chainBlockNumber: { gt: 872n },
    });
  });

  it('halves failed RPC ranges and recombines the successful results', async () => {
    const getLogs = vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      if (fromBlock === 1n && toBlock === 4n) throw new Error('range too large');
      return [];
    });

    await expect(getLogsResilient({ getLogs }, [ADDRESS], [], 1n, 4n)).resolves.toEqual([]);
    expect(getLogs).toHaveBeenCalledTimes(3);
    expect(getLogs.mock.calls.map(([args]) => [args.fromBlock, args.toBlock])).toEqual([
      [1n, 4n], [1n, 2n], [3n, 4n],
    ]);
  });

  it('surfaces a poisoned single block for operator alerting', async () => {
    const getLogs = vi.fn(async () => { throw new Error('bad block'); });
    await expect(getLogsResilient({ getLogs }, [ADDRESS], [], 9n, 9n)).rejects.toThrow('bad block');
  });
});

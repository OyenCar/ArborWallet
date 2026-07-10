import { ChainDefinition, ChainKey, chainDefinitionSchema } from "../schema";
import { ethereumChains } from "./ethereum";
import { arbitrumChains } from "./arbitrum";
import { bnbChains } from "./bnb";
import { solanaChains } from "./solana";
import { bitcoinChains } from "./bitcoin";

export const chainDefinitions: ChainDefinition[] = [
  ...ethereumChains,
  ...arbitrumChains,
  ...bnbChains,
  ...solanaChains,
  ...bitcoinChains,
];

export const chainMap: Map<ChainKey, ChainDefinition> = (() => {
  const map = new Map<ChainKey, ChainDefinition>();
  for (const c of chainDefinitions) {
    const parsed = chainDefinitionSchema.safeParse(c);
    if (!parsed.success) {
      throw new Error(`Invalid ChainDefinition "${c.key}": ${parsed.error.message}`);
    }
    if (map.has(c.key)) {
      throw new Error(`Duplicate chain key: ${c.key}`);
    }
    map.set(c.key, parsed.data);
  }
  return map;
})();

export function getChainDefinition(key: ChainKey): ChainDefinition {
  const c = chainMap.get(key);
  if (!c) throw new Error(`Unknown chain key: ${key}`);
  return c;
}

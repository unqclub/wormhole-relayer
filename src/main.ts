import { Logger } from "winston";
import * as relayerEngine from "relayer-engine";
import {
  UnqPluginDefinition,
  UnqRelayerPluginConfig,
} from "./plugin/unq_plugin";

import { EnvType, StoreType } from "relayer-engine";
export const main = async () => {
  const pluginConfig = (await relayerEngine.loadFileAndParseToObject(
    `./unqPluginConfig.json`
  )) as UnqRelayerPluginConfig;

  const relayerConfig = {
    logLevel: "info",
    redis: {
      port: 6379,
      host: "redis",
    },
    numGuardians: 1,
    readinessPort: 2000,
    envType: EnvType.DEVNET,
    mode: relayerEngine.Mode.BOTH,
    storeType: StoreType.Redis,
    supportedChains: Object.entries(pluginConfig.xDappConfig.networks).map(
      ([networkName, network]) => {
        return {
          chainId: network.wormholeChainId,
          chainName: networkName,
          nodeUrl: network.rpc,
          bridgeAddress: network.bridgeAddress,
        };
      }
    ),
    wormholeRpc: "https://wormhole-v2-testnet-api.certus.one",
    defaultWorkflowOptions: { maxRetries: 3 },
  };
  const plugin = new UnqPluginDefinition().init(pluginConfig);
  await relayerEngine.run({
    plugins: [plugin],
    configs: {
      executorEnv: {
        // @ts-ignore
        privateKeys: Object.fromEntries(
          Object.values(pluginConfig.xDappConfig.networks).map((network) => {
            return [network.wormholeChainId, [network.privateKey]];
          })
        ),
      },
      listenerEnv: {
        spyServiceHost: "guardiand:7073",
      },
      commonEnv: relayerConfig,
    },
    mode: relayerConfig.mode,
  });
};

main().catch((err) => {
  console.log(err);
});

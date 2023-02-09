import { Logger } from "winston";
import * as relayerEngine from "../../relayer-engine";
import {
  UnqPluginDefinition,
  UnqRelayerPluginConfig,
  XDappConfig,
} from "./plugin/unq_plugin";
import { CommonPluginEnv, EnvType, StoreType } from "../../relayer-engine";
export const main = async () => {
  const pluginConfig = (await relayerEngine.loadFileAndParseToObject(
    `./unqPluginConfig.json`
  )) as UnqRelayerPluginConfig;

  const relayerConfig = {
    logLevel: "info",
    redisHost: "localhost",
    redisPort: 6379,
    // promPort: 1340,
    readinessPort: 2000,
    envType: EnvType.LOCALHOST,
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
      listenerEnv: { spyServiceHost: "localhost:7073" },
      commonEnv: relayerConfig,
    },
    mode: relayerConfig.mode,
  });
};

main().catch((err) => {
  // console.log(err);
});

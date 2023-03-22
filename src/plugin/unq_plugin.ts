import {
  ActionExecutor,
  CommonPluginEnv,
  ContractFilter,
  EngineInitFn,
  EventSource,
  ParsedVaaWithBytes,
  Plugin,
  Providers,
  SolanaWallet,
  StagingAreaKeyLock,
  Workflow,
  WorkflowOptions,
} from "relayer-engine";
import { Logger } from "winston";
import {
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import wormholeAbi from "../abi/WormholeUnq.json";
import * as wormholeSdk from "@certusone/wormhole-sdk";
import { PluginDefinition } from "relayer-engine";
import { ethers } from "ethers";
import {
  ChainId,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  ParsedVaa,
  parseVaa,
  tryUint8ArrayToNative,
} from "@certusone/wormhole-sdk";
import { emitMessageOnSolana } from "../helpers/solana/methods";
import pluginConf from "../../unqPluginConfig.json";
import { storeVaaInDatabase } from "src/helpers/api.helpers";
import { WormholeVaaStatus } from "src/api/wormhole-vaa/wormhole-vaa";
type VAA = string;

export interface UnqRelayerPluginConfig {
  spyServiceFilters: {
    chainId: wormholeSdk.ChainId;
    emitterAddress: string;
  }[];
  xDappConfig: XDappConfig;
}

export type Network = string;

export interface XDappConfig {
  networks: Record<
    Network,
    {
      type: string;
      wormholeChainId: wormholeSdk.ChainId;
      rpc: string;
      privateKey: string;
      bridgeAddress: string;
    }
  >;
  wormhole: {
    restAddress: string;
    spyAddress: string;
  };
}

export class UnqPlugin implements Plugin<any> {
  pluginName: string = "UnqPlugin";
  pluginConfig: any;
  shouldSpy: boolean = true;
  shouldRest: boolean = false;
  demoteInProgress?: boolean = true;
  static plugin = "UnqPlugin";

  constructor(
    private readonly relayerConfig: CommonPluginEnv,
    private readonly appConfig: UnqRelayerPluginConfig,
    readonly logger: Logger
  ) {}
  maxRetries?: number | undefined;
  consumeEvent(
    vaa: ParsedVaaWithBytes,
    stagingArea: StagingAreaKeyLock,
    providers: Providers,
    extraData?: any[] | undefined
  ): Promise<
    | { workflowData: string; workflowOptions?: WorkflowOptions | undefined }
    | undefined
  > {
    this.logger.info("Consumed new event...");
    return Promise.resolve({
      workflowData: vaa.bytes.toString("base64"),
      chainID: vaa.emitterChain,
    });
  }

  afterSetup?(
    _providers: Providers,
    _listenerResources?: { eventSource: EventSource; db: StagingAreaKeyLock }
  ): Promise<void> {
    this.logger.debug("Initialized UNQ relayer....");
    return new Promise((resolve) => resolve());
  }

  getFilters(): ContractFilter[] {
    const filters = this.appConfig.spyServiceFilters;

    return filters;
  }

  async handleWorkflow(
    workflow: Workflow<any>,
    providers: Providers,
    execute: ActionExecutor
  ): Promise<void> {
    const vaa = Buffer.from(workflow.data, "base64");
    const parsedVaa = parseVaa(vaa);

    switch (parsedVaa.emitterChain) {
      case CHAIN_ID_SOLANA: {
        await submitOnEnv(
          vaa,
          pluginConf.spyServiceFilters[1].emitterAddress,
          execute,
          CHAIN_ID_POLYGON
        );
        break;
      }
      case CHAIN_ID_POLYGON: {
        await submitOnSolana(parsedVaa, execute, vaa);
        break;
      }
      default: {
        this.logger.error("CHAIN ID not supported!");
      }
    }

    return;
  }
}

export class UnqPluginDefinition
  implements PluginDefinition<UnqRelayerPluginConfig, UnqPlugin>
{
  init(pluginConfig: any): {
    fn: EngineInitFn<UnqPlugin>;
    pluginName: string;
  } {
    return {
      pluginName: UnqPlugin.plugin,
      fn: (engineConfig, logger) => {
        return new UnqPlugin(engineConfig, pluginConfig, logger);
      },
    };
  }

  pluginName: string;
}

export async function submitOnEnv(
  vaa: any,
  ethContractAddress: string,
  executor: ActionExecutor,
  chainId: ChainId
) {
  const network = new ethers.providers.JsonRpcProvider(
    pluginConf.xDappConfig.networks.evm0.rpc
  );

  const wormholeUnqContract = new ethers.Contract(
    ethContractAddress,
    wormholeAbi.abi,
    network
  );

  try {
    const tx = await executor.onEVM({
      chainId,
      f: async ({ wallet }) => {
        return wormholeUnqContract.connect(wallet).parseVM(Buffer.from(vaa), {
          gasLimit: 1000000,
        });
      },
    });
    await tx.wait();
    await storeVaaInDatabase(vaa, WormholeVaaStatus.Succeded);
  } catch (error) {
    await storeVaaInDatabase(vaa, WormholeVaaStatus.Failed);
  }
}

export const submitOnSolana = async (
  vaa: ParsedVaa,
  executor: ActionExecutor,
  rawVaa: Buffer
) => {
  try {
    await executor.onSolana(async ({ wallet }) => {
      return Promise.resolve(
        realyIxOnSolana(
          await emitMessageOnSolana(rawVaa, wallet.payer, vaa),
          wallet
        )
      );
    });
    await storeVaaInDatabase(vaa, WormholeVaaStatus.Succeded);
  } catch (error) {
    await storeVaaInDatabase(vaa, WormholeVaaStatus.Failed);
  }
};

export const realyIxOnSolana = async (
  ix: TransactionInstruction,
  wallet: SolanaWallet
) => {
  const tx = new TransactionMessage({
    instructions: [ix],
    payerKey: wallet.payer.publicKey,
    recentBlockhash: (await wallet.conn.getLatestBlockhash()).blockhash,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(tx);
  versionedTx.sign([wallet.payer]);

  try {
    const tx = await wallet.conn.sendRawTransaction(versionedTx.serialize());
  } catch (error) {
    console.log(error);
  }
};

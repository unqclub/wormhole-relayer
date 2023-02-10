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
} from "../../../relayer-engine";
import { Logger } from "winston";
import {
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import wormholeAbi from "../abi/WormholeUnq.json";
import * as wormholeSdk from "@certusone/wormhole-sdk";
import { PluginDefinition } from "../../../relayer-engine";
import { ethers } from "ethers";
import {
  ChainId,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  ParsedVaa,
  parseVaa,
} from "@certusone/wormhole-sdk";
import { emitMessageOnSolana } from "../helpers/solana/methods";
import pluginConf from "../../unqPluginConfig.json";
import treasuryAbi from "../abi/UnqTreasury.json";
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

export class UnqPlugin implements Plugin<VAA> {
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

  afterSetup?(
    _providers: Providers,
    _listenerResources?: { eventSource: EventSource; db: StagingAreaKeyLock }
  ): Promise<void> {
    return;
  }

  getFilters(): ContractFilter[] {
    const filters = this.appConfig.spyServiceFilters;

    return filters;
  }

  consumeEvent(
    vaa: ParsedVaaWithBytes,
    _stagingArea: StagingAreaKeyLock,
    _providers: Providers,
    _extraData?: any[]
  ): Promise<{ workflowData?: any; chainID: number }> {
    return Promise.resolve({
      workflowData: vaa.bytes,
      chainID: vaa.emitterChain,
    });
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
          providers,
          execute,
          CHAIN_ID_ETH
        );
        break;
      }
      case CHAIN_ID_ETH: {
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
  init(pluginConfig: any): { fn: EngineInitFn<UnqPlugin>; pluginName: string } {
    return {
      fn: (env, logger) => {
        return new UnqPlugin(env, pluginConfig, logger);
      },
      pluginName: UnqPlugin.plugin,
    };
  }
  pluginName: string;
}

async function submitOnEnv(
  vaa: any,
  ethContractAddress: string,
  providers: Providers,
  executor: ActionExecutor,
  chainId: ChainId
) {
  const network = new ethers.providers.JsonRpcProvider("HTTP://127.0.0.1:8545");

  const wormholeUnqContract = new ethers.Contract(
    ethContractAddress,
    wormholeAbi.abi,
    network
  );

  const tx = await executor.onEVM({
    chainId,
    f: async ({ wallet }) => {
      return wormholeUnqContract.connect(wallet).parseVM(Buffer.from(vaa), {
        gasLimit: 10000001,
      });
    },
  });
  await tx.wait();
}

export const submitOnSolana = async (
  vaa: ParsedVaa,
  executor: ActionExecutor,
  rawVaa: Buffer
) => {
  await executor.onSolana(async ({ wallet }) => {
    return Promise.resolve(
      realyIxOnSolana(
        await emitMessageOnSolana(rawVaa, wallet.payer, vaa),
        wallet
      )
    );
  });
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
    console.log(tx);
  } catch (error) {
    console.log(error);
  }
};

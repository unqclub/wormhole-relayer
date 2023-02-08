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
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  parseVaa,
} from "@certusone/wormhole-sdk";
import { emitMessageOnSolana } from "../helpers/solana/methods";
import pluginConf from "../../unqPluginConfig.json";
import treasuryAbi from "../abi/UnqTreasury.json";
import { wormholeProgram } from "../helpers/utilities";
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
    return Promise.resolve({
      workflowData: vaa.bytes.toString("base64"),
      chainID: vaa.emitterChain,
    });
  }

  afterSetup?(
    _providers: Providers,
    _listenerResources?: { eventSource: EventSource; db: StagingAreaKeyLock }
  ): Promise<void> {
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
          providers,
          execute,
          CHAIN_ID_ETH
        );
        break;
      }
      case CHAIN_ID_ETH: {
        await submitOnSolana(parsedVaa.payload, execute);
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

  wormholeUnqContract.on(
    "TreasuryCreatedEvent",
    async (realm, authority, parsedDenominatedCurrency, treasuryAddress) => {
      console.log("REALM:", realm);
      console.log("AUTHORITY:", authority);
      console.log("PARSED DENN:", parsedDenominatedCurrency);

      const treasuryContract = new ethers.Contract(
        treasuryAddress,
        treasuryAbi.abi,
        network
      );

      const denominatedCurrency =
        await treasuryContract.getDenominatedCurrency();
      console.log("DENOMINATED CURRENCY:", denominatedCurrency);
    }
  );
}

export const submitOnSolana = async (vaa: any, executor: ActionExecutor) => {
  await executor.onSolana(async ({ wallet }) => {
    return Promise.resolve(
      realyIxOnSolana(await emitMessageOnSolana(vaa, wallet.payer), wallet)
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

  await wallet.conn.sendRawTransaction(versionedTx.serialize());
};

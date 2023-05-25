import {
  ActionExecutor,
  SolanaWallet,
  LegacyPluginCompat,
} from "relayer-engine";
import { Logger } from "winston";
import {
  Connection,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import wormholeAbi from "../abi/WormholeUnq.json";
import * as wormholeSdk from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import {
  ChainId,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  getSignedVAA,
  ParsedVaa,
  parseVaa,
} from "@certusone/wormhole-sdk";
import { storeVaaInDatabase } from "../helpers/api.helpers";
import { emitMessageOnSolana } from "../helpers/solana/methods";
import pluginConf from "../../unqPluginConfig.json";
import {
  Chain,
  EvmToSolanaAction,
  WormholeVaaStatus,
} from "../api/wormhole-vaa/wormhole-vaa";
import { CommonPluginEnv } from "relayer-engine/lib/middleware/legacy-plugin";

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

interface WorkflowPayload {
  vaa: string; // base64
  count: number;
}

export class UnqPlugin implements LegacyPluginCompat.Plugin<WorkflowPayload> {
  pluginName: string = "UnqPlugin";
  pluginConfig: any;
  shouldSpy: boolean = true;
  shouldRest: boolean = false;
  demoteInProgress?: boolean = true;
  unqLogger: Logger;
  static plugin = "UnqPlugin";

  constructor(
    private readonly relayerConfig: CommonPluginEnv,
    private readonly appConfig: UnqRelayerPluginConfig,
    readonly logger: Logger
  ) {
    this.unqLogger = logger;
  }
  getFilters(): LegacyPluginCompat.ContractFilter[] {
    const filters = pluginConf.spyServiceFilters.map((c) => {
      return {
        chainId: c.chainId as ChainId,
        emitterAddress: c.emitterAddress,
      };
    });

    return filters;
  }
  async consumeEvent(
    vaa: LegacyPluginCompat.ParsedVaaWithBytes,
    stagingArea: LegacyPluginCompat.StagingAreaKeyLock,
    providers: LegacyPluginCompat.Providers,
    extraData?: any[] | undefined
  ): Promise<
    | {
        workflowData: WorkflowPayload;
        workflowOptions?: LegacyPluginCompat.WorkflowOptions | undefined;
      }
    | undefined
  > {
    const count = await stagingArea.withKey(
      ["counter"],
      async ({ counter }) => {
        this.logger.debug(`Original counter value ${counter}`);
        counter = (counter ? counter : 0) + 1;
        this.logger.debug(`Counter value after update ${counter}`);
        return {
          newKV: { counter },
          val: counter,
        };
      }
    );
    return {
      workflowData: {
        count,
        vaa: vaa.bytes.toString("base64"),
      },
    };
  }
  async handleWorkflow(
    workflow: LegacyPluginCompat.Workflow<WorkflowPayload>,
    providers: LegacyPluginCompat.Providers,
    execute: LegacyPluginCompat.ActionExecutor
  ): Promise<void> {
    const bytes = parseVaa(Buffer.from(workflow.data.vaa, "base64"));

    const chainId = bytes.emitterChain;
    switch (chainId) {
      case CHAIN_ID_SOLANA: {
        await submitOnEnv(
          workflow.data.vaa,
          pluginConf.spyServiceFilters[1].emitterAddress,
          execute,
          CHAIN_ID_POLYGON
        );
        break;
      }
      case CHAIN_ID_POLYGON: {
        await submitOnSolana(
          bytes,
          execute,
          Buffer.from(workflow.data.vaa, "base64")
        );
      }
    }
  }
}

export async function submitOnEnv(
  vaa: any,
  ethContractAddress: string,
  executor: LegacyPluginCompat.ActionExecutor,
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
      f: async (wallet) => {
        wallet.wallet;

        const gas = await network.getGasPrice();

        return wormholeUnqContract
          .connect(wallet.wallet)
          .parseVM(Buffer.from(vaa, "base64"));
      },
    });
    await tx.wait();
    await storeVaaInDatabase(vaa, WormholeVaaStatus.Succeded, Chain.Ethereum);
  } catch (error) {
    console.log(error);

    await storeVaaInDatabase(vaa, WormholeVaaStatus.Failed, Chain.Ethereum);
  }
}

export const submitOnSolana = async (
  vaa: ParsedVaa,
  executor: LegacyPluginCompat.ActionExecutor,
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
    await storeVaaInDatabase(rawVaa, WormholeVaaStatus.Succeded, Chain.Solana);
  } catch (error) {
    await storeVaaInDatabase(rawVaa, WormholeVaaStatus.Failed, Chain.Solana);
  }
};

export const realyIxOnSolana = async (
  ix: TransactionInstruction,
  wallet: SolanaWallet
) => {
  const connection = new Connection(
    pluginConf.xDappConfig.networks["sol0"].rpc
  );
  const tx = new TransactionMessage({
    instructions: [ix],
    payerKey: wallet.payer.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(tx);
  versionedTx.sign([wallet.payer]);

  try {
    const tx = await connection.sendRawTransaction(versionedTx.serialize());
    await connection.confirmTransaction(tx);
  } catch (error) {
    throw error;
  }
};

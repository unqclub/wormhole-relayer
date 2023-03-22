import {
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  parseVaa,
  tryUint8ArrayToNative,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import {
  IWormholeDto,
  saveVaa,
  WormholeAction,
  WormholeVaaStatus,
} from "src/api/wormhole-vaa/wormhole-vaa";
import pluginConf from "../../unqPluginConfig.json";
import treasuryAbi from "../abi/WormholeUnq.json";

import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { emitMessageOnSolana } from "./solana/methods";

export const storeVaaInDatabase = async (
  vaa: any,
  status: WormholeVaaStatus
) => {
  const deserializedVaa = parseVaa(Buffer.from(vaa, "base64"));
  const action = deserializedVaa.payload[0] as WormholeAction;

  const address = tryUint8ArrayToNative(
    deserializedVaa.payload.subarray(1, 32),
    "solana"
  );

  const dto: IWormholeDto = {
    action: action,
    address,
    status,
    vaa,
  };

  await saveVaa(dto);
};

export const retryVaa = async (req: any) => {
  try {
    console.log("REQUEST:", req);

    if (!req || !req.body) {
      throw new Error("Body not present");
    }
    const parsedRequest = JSON.parse(req.body);
    const vaa = Buffer.from(parsedRequest.vaa, "base64");
    const parsedVaa = parseVaa(vaa);

    switch (parsedVaa.emitterChain) {
      case CHAIN_ID_SOLANA: {
        const wallet = new ethers.Wallet(
          pluginConf.xDappConfig.networks.evm0.privateKey
        );
        const network = new ethers.providers.JsonRpcProvider(
          pluginConf.xDappConfig.networks.evm0.rpc
        );

        const contract = new ethers.Contract(
          pluginConf.spyServiceFilters[1].emitterAddress,
          treasuryAbi.abi,
          network
        );

        await contract.connect(wallet).parseVM(Buffer.from(vaa), {
          gasLimit: 1000000,
        });
        break;
      }
      case CHAIN_ID_POLYGON: {
        const RPC_CONNECTION = new Connection(
          pluginConf.xDappConfig.networks.sol0.rpc
        );
        const wallet = Keypair.fromSecretKey(
          new Uint8Array(
            JSON.parse(pluginConf.xDappConfig.networks.sol0.privateKey)
          )
        );

        const ix = await emitMessageOnSolana(vaa, wallet, parsedVaa);
        const tx = new Transaction({
          feePayer: wallet.publicKey,
        });

        tx.add(ix);

        tx.sign(wallet);

        await RPC_CONNECTION.sendRawTransaction(tx.serialize(), {
          preflightCommitment: "confirmed",
        });

        break;
      }
      default: {
        console.log("FAILED");
      }
    }
  } catch (error) {}
};

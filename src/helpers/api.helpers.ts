import {
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  parseVaa,
  SignedVaa,
  tryUint8ArrayToNative,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import {
  Chain,
  IWormholeDto,
  saveVaa,
  VAA,
  WormholeAction,
  WormholeVaaStatus,
  WORMHOLE_VAAS,
} from "../api/wormhole-vaa/wormhole-vaa";
import pluginConf from "../../unqPluginConfig.json";
import treasuryAbi from "../abi/WormholeUnq.json";

import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { emitMessageOnSolana } from "./solana/methods";
import { get, post } from "../api/request.api";

export const storeVaaInDatabase = async (
  vaa: any,
  status: WormholeVaaStatus,
  chain: Chain,
  failedAction?: WormholeAction
) => {
  const deserializedVaa = parseVaa(Buffer.from(vaa, "base64"));
  console.log(deserializedVaa.payload);

  let action = failedAction ?? (deserializedVaa.payload[0] as WormholeAction);

  if (chain === Chain.Solana && action === WormholeAction.CreateTreasury) {
    action = WormholeAction.Deposit;
  } else if (chain === Chain.Solana && action === WormholeAction.AddMember) {
    action = WormholeAction.SellShares;
  }

  const address = tryUint8ArrayToNative(
    deserializedVaa.payload.subarray(5, 37),
    "solana"
  );

  const memberAddress = tryUint8ArrayToNative(
    deserializedVaa.payload.subarray(33, 65),
    "solana"
  );

  console.log(memberAddress, "MEMBER");

  const dto: IWormholeDto = {
    action: action,
    address: chain === Chain.Ethereum ? address : memberAddress,
    status,
    vaa: vaa.toString("base64"),
  };

  console.log("DTO:", dto);

  try {
    await saveVaa(dto);
  } catch (error: any) {
    console.log(error);
  }
};

export const retryVaa = async (req: any) => {
  try {
    if (!req || !req.body) {
      throw new Error("Body not present");
    }

    const parsedRequest = req.body;
    console.log(parsedRequest);
    const storedVaa = await getByVaa(parsedRequest.vaa, parsedRequest.address);
    if (!storedVaa || storedVaa.status === WormholeVaaStatus.Succeded) {
      console.log("VAA processed");
      return;
    }
    const vaa = Buffer.from(parsedRequest.vaa, "base64");
    const parsedVaa = parseVaa(vaa);

    switch (parsedVaa.emitterChain) {
      case CHAIN_ID_SOLANA: {
        const network = new ethers.providers.JsonRpcProvider(
          pluginConf.xDappConfig.networks.evm0.rpc
        );
        const wallet = new ethers.Wallet(
          pluginConf.xDappConfig.networks.evm0.privateKey,
          network
        );

        const contract = new ethers.Contract(
          pluginConf.spyServiceFilters[1].emitterAddress,
          treasuryAbi.abi,
          network
        );

        await contract.connect(wallet).parseVM(Buffer.from(vaa), {
          gasLimit: 1000000,
        });

        storedVaa.status = WormholeVaaStatus.Succeded;
        console.log(storedVaa);

        await saveVaa(storedVaa);

        return JSON.stringify({ message: "Successfully stored vaa" });
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
          recentBlockhash: (await RPC_CONNECTION.getLatestBlockhash())
            .blockhash,
        });

        tx.add(ix);

        tx.sign(wallet);

        storedVaa.status = WormholeVaaStatus.Succeded;

        const retriedTx = await RPC_CONNECTION.sendRawTransaction(
          tx.serialize(),
          {
            preflightCommitment: "confirmed",
          }
        );
        await RPC_CONNECTION.confirmTransaction(retriedTx);
        await saveVaa(storedVaa);
        return JSON.stringify({ message: "Successfully stored vaa" });
      }
      default: {
        console.log("Unsupported CHAIN_ID");
      }
    }
  } catch (error) {
    console.log(error);

    return JSON.stringify({ message: "Failed to store VAA" });
  }
};

export const getByVaa = async (
  vaa: string,
  address: string
): Promise<IWormholeDto> => {
  return post(`${WORMHOLE_VAAS}${VAA}`, { vaa: vaa, address: address });
};

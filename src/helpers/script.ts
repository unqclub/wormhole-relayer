import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { ethers } from "ethers";
import {} from "bs58";
import messengerAbi from "../abi/messenger.json";
import { getEmitterAddressEth } from "@certusone/wormhole-sdk";
export async function getMessengerStat() {
  // const network = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
  // const messenger = new ethers.Contract(
  //   "0xf19A2A01B70519f67ADb309a994Ec8c69A967E8b",
  //   messengerAbi.abi,
  //   network
  // );

  // const message = await messenger.getCurrentMsg();
  // console.log(message, "MESSAGE");
  const encoded = getEmitterAddressEth(
    "0xCeCC19D949E266d63E763C70c0CfC5cbed55966C"
  );

  console.log(encoded);
}

getMessengerStat();

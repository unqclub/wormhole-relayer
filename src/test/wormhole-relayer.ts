import { AnchorProvider, Program } from "@project-serum/anchor";
import { ClubProgram, IDL } from "../idl/club_program";
import wormholeAbi from "../abi/WormholeUnq.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as ethers from "ethers";
import pluginConfig from "../../unqPluginConfig.json";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { createClub } from "./tester/solana";
import shortUUID from "short-uuid";

describe("it should create club with treasury on ethereum", async () => {
  const SOLANA_RPC_CONNECTION = new Connection("http://127.0.0.1:8899");

  const wallet = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(pluginConfig.xDappConfig.networks["sol0"].privateKey)
    )
  );

  const clubProgram = new Program<ClubProgram>(
    IDL,
    "EMssAbHYgBGgxoRNfnv7xuv7tSrKabrVowG6aKUtysWr",
    new AnchorProvider(SOLANA_RPC_CONNECTION, new NodeWallet(wallet), {})
  );

  const ETH_RPC_CONNECTION = new ethers.providers.JsonRpcProvider(
    "HTTP://127.0.0.1"
  );

  const factoryContract = new ethers.Contract(
    "0x6f84742680311CEF5ba42bc10A71a4708b4561d1",
    wormholeAbi.abi,
    ETH_RPC_CONNECTION
  );

  let clubAddress: PublicKey;

  it("should create club on solana", async () => {
    try {
      clubAddress = await createClub(
        "UNQW" + shortUUID.generate(),
        clubProgram,
        wallet,
        SOLANA_RPC_CONNECTION
      );
    } catch (error) {
      console.log(error);
    }
  });
});

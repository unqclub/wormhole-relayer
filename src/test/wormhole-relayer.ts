import { AnchorProvider, Program } from "@project-serum/anchor";
import { ClubProgram, IDL } from "../idl/club_program";
import wormholeAbi from "../abi/WormholeUnq.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as ethers from "ethers";
import pluginConfig from "../../unqPluginConfig.json";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  createClub,
  createGovernance,
  updateVoterWeightIx,
} from "./tester/solana";
import shortUUID from "short-uuid";
import { sendTransaction } from "./helpers";

describe("it should create club with treasury on ethereum", async () => {
  const SOLANA_RPC_CONNECTION = new Connection("http://127.0.0.1:8899");

  const wallet = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(pluginConfig.xDappConfig.networks["sol0"].privateKey)
    )
  );
  let clubPda: PublicKey;
  let memberPda: PublicKey;
  let tokenOwnerRecordPda: PublicKey;
  let realmPda: PublicKey;

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

  it("should create club", async () => {
    const { clubAddress, memberAddress, realmAddress, tokenOwnerRecord } =
      await createClub(
        "UNQW" + shortUUID.generate(),
        clubProgram,
        wallet,
        SOLANA_RPC_CONNECTION
      );
    clubPda = clubAddress;
    realmPda = realmAddress;
    memberPda = memberAddress;
    tokenOwnerRecordPda = tokenOwnerRecord;
  });

  it("should create treasury governance", async () => {
    const { voterWeightAddress, ix } = await updateVoterWeightIx(
      clubProgram,
      realmPda,
      memberPda,
      clubPda,
      wallet
    );
    const createGovIx = await createGovernance(
      clubProgram,
      clubPda,
      realmPda,
      wallet,
      memberPda,
      tokenOwnerRecordPda,
      voterWeightAddress
    );

    try {
      await sendTransaction(
        SOLANA_RPC_CONNECTION,
        [ix, createGovIx],
        [wallet],
        wallet
      );
    } catch (error) {
      console.log(error);
    }
  });
});

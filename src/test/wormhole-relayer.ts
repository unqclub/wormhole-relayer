import { AnchorProvider, Program } from "@project-serum/anchor";
import { ClubProgram, IDL } from "../idl/club_program";
import wormholeAbi from "../abi/WormholeUnq.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as ethers from "ethers";
import pluginConfig from "../../unqPluginConfig.json";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import * as assert from "assert";
import {
  createClub,
  createGovernance,
  emitWormholeMessage,
  updateVoterWeightIx,
} from "./tester/solana";
import shortUUID from "short-uuid";
import {
  financialRecordSeed,
  getEthereumHexFormat,
  getTreasuryContract,
  sendTransaction,
  unqClubSeed,
  zeroAddres,
} from "./helpers";
import { hexToUint8Array, tryNativeToHexString } from "@certusone/wormhole-sdk";
import unqPlugin from "../../unqPluginConfig.json";

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
  let treasuryContract: ethers.Contract;
  let treasuryData: PublicKey;

  const clubProgram = new Program<ClubProgram>(
    IDL,
    "EMssAbHYgBGgxoRNfnv7xuv7tSrKabrVowG6aKUtysWr",
    new AnchorProvider(SOLANA_RPC_CONNECTION, new NodeWallet(wallet), {})
  );

  const wormholeProgramId = new PublicKey(
    "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"
  );

  const ETH_RPC_CONNECTION = new ethers.providers.JsonRpcProvider(
    "HTTP://127.0.0.1:8545"
  );

  const ethWallet = new ethers.Wallet(
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
    ETH_RPC_CONNECTION
  );

  const factoryContract = new ethers.Contract(
    unqPlugin.spyServiceFilters[1].emitterAddress,
    wormholeAbi.abi,
    ETH_RPC_CONNECTION
  );

  it("should create club", async () => {
    const { clubAddress, memberAddress, realmAddress, tokenOwnerRecord } =
      await createClub(
        "NekiC" + shortUUID.generate(),
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
    const { createGovernanceIX, treasuryDataPda } = await createGovernance(
      clubProgram,
      clubPda,
      realmPda,
      wallet,
      memberPda,
      tokenOwnerRecordPda,
      voterWeightAddress,
      zeroAddres
    );
    treasuryData = treasuryDataPda;

    const wormholeIx = await emitWormholeMessage(
      clubProgram,
      clubPda,
      wallet,
      {
        ethAddress: Buffer.from(
          hexToUint8Array(
            tryNativeToHexString(
              "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
              "ethereum"
            )
          )
        ),
        action: { createTreasury: {} },
      },
      [{ isSigner: false, isWritable: false, pubkey: memberPda }],
      wormholeProgramId
    );

    try {
      const tx = await sendTransaction(
        SOLANA_RPC_CONNECTION,
        [ix, createGovernanceIX, wormholeIx],
        [wallet],
        wallet
      );
      await SOLANA_RPC_CONNECTION.confirmTransaction(tx);
    } catch (error) {
      console.log(error);
    }
  });

  it("should fetch created treasury from ethereum", async () => {
    const encodedClubData = getEthereumHexFormat(
      tryNativeToHexString(clubPda.toString(), "solana")
    );
    const treasury = await factoryContract.getTreasury(encodedClubData);

    treasuryContract = getTreasuryContract(treasury, ETH_RPC_CONNECTION);
    const encodedMemberData = getEthereumHexFormat(
      tryNativeToHexString(wallet.publicKey.toString(), "solana")
    );
    const memberData = await treasuryContract.getMemberData(encodedMemberData);
    assert.equal(memberData.realmAddress, encodedClubData);
    assert.equal(memberData.status, 1);
    assert.equal(memberData.solanaAddress, encodedMemberData);
  });

  it("should deposit to ethereum treasury", async () => {
    const encodedMemberData = getEthereumHexFormat(
      tryNativeToHexString(wallet.publicKey.toString(), "solana")
    );
    const depositTx = await treasuryContract
      .connect(ethWallet)
      .receiveFunds(encodedMemberData, 12, {
        value: 125,
        gasLimit: 1000000,
      });
    await depositTx.wait();
    const [financialRecord] = PublicKey.findProgramAddressSync(
      [
        unqClubSeed,
        treasuryData.toBuffer(),
        financialRecordSeed,
        wallet.publicKey.toBuffer(),
      ],
      clubProgram.programId
    );
    await new Promise((resolve) => setTimeout(resolve, 15000));
    const financialRecordAccount =
      await clubProgram.account.financialRecord.fetch(financialRecord);
    assert.equal(
      financialRecordAccount.authority.toString(),
      wallet.publicKey.toString()
    );
    assert.equal(
      financialRecordAccount.depositRecords[0].accumulatedAmount.toNumber(),
      125
    );
    assert.equal(
      await ETH_RPC_CONNECTION.getBalance(treasuryContract.address),
      125
    );
  });
});

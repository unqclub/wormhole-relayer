import { AnchorProvider, Program } from "@project-serum/anchor";
import { ClubProgram, IDL } from "../idl/club_program";
import wormholeAbi from "../abi/WormholeUnq.json";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import * as ethers from "ethers";
import pluginConfig from "../../unqPluginConfig.json";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import * as assert from "assert";
import {
  castProposalVote,
  createClub,
  createGovernance,
  createProposalMetadata,
  createTransferProposal,
  emitWormholeMessage,
  updateProposalDescription,
  updateVoterWeight,
  updateVoterWeightForGovernanceIx,
} from "./tester/solana";
import shortUUID from "short-uuid";
import {
  accountGovernanceSeed,
  financialRecordSeed,
  getEthereumHexFormat,
  getTreasuryContract,
  governanceSeed,
  proposalMetadataSeed,
  ProposalType,
  sendTransaction,
  splGovernanceProgram,
  unqClubSeed,
  zeroAddres,
} from "./helpers";
import {
  hexToUint8Array,
  tryNativeToHexString,
  tryUint8ArrayToNative,
} from "@certusone/wormhole-sdk";
import unqPlugin from "../../unqPluginConfig.json";
import { ClubAction } from "./tester/constants.solana";

describe("it should create club with treasury on ethereum", async () => {
  const SOLANA_RPC_CONNECTION = new Connection(
    "http://127.0.0.1:8899",
    "finalized"
  );
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
  let proposalAddress: PublicKey;
  let proposalMetadata: PublicKey;
  let governanceAccount: PublicKey;
  let communityMint: PublicKey;
  let treasuryAddress: PublicKey;
  let proposalInstruction: PublicKey;

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

  factoryContract.on("TransferFunds", (destination, amount) => {
    console.log(destination, amount, "DEST", "AM");
  });

  it("should create club", async () => {
    const { clubAddress, memberAddress, realmAddress, tokenOwnerRecord, mint } =
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
    communityMint = mint;
  });

  it("should create treasury governance", async () => {
    const { voterWeightAddress, ix } = await updateVoterWeightForGovernanceIx(
      clubProgram,
      realmPda,
      memberPda,
      clubPda,
      wallet
    );
    const { createGovernanceIX, treasuryDataPda, treasuryPda } =
      await createGovernance(
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
    treasuryAddress = treasuryPda;

    const wormholeIx = await emitWormholeMessage(
      clubProgram,
      clubPda,
      wallet,
      {
        ethAddress: Buffer.from(
          hexToUint8Array(tryNativeToHexString(zeroAddres, "ethereum"))
        ),
        action: { createTreasury: {} },
        creatorAddress: Buffer.from(
          hexToUint8Array(tryNativeToHexString(ethWallet.address, "ethereum"))
        ),
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
        value: ethers.utils.parseEther("2"),
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
    // await new Promise((resolve) => setTimeout(resolve, 15000));
    // const financialRecordAccount =
    //   await clubProgram.account.financialRecord.fetch(financialRecord);
    // assert.equal(
    //   financialRecordAccount.authority.toString(),
    //   wallet.publicKey.toString()
    // );
    // assert.equal(
    //   financialRecordAccount.depositRecords[0].accumulatedAmount.toNumber(),
    //   2 * LAMPORTS_PER_SOL
    // );

    // assert.equal(
    //   (
    //     await ETH_RPC_CONNECTION.getBalance(treasuryContract.address)
    //   ).toBigInt(),
    //   ethers.BigNumber.from("2000000000000000000")
    // );
  });

  it("should create transfer proposal", async () => {
    let proposalIndexBuffer = Buffer.alloc(4);
    proposalIndexBuffer.writeInt32LE(0, 0);

    [governanceAccount] = PublicKey.findProgramAddressSync(
      [accountGovernanceSeed, realmPda.toBuffer(), treasuryAddress.toBuffer()],
      splGovernanceProgram
    );

    [proposalAddress] = PublicKey.findProgramAddressSync(
      [
        governanceSeed,
        governanceAccount.toBuffer(),
        communityMint.toBuffer(),
        proposalIndexBuffer,
      ],
      splGovernanceProgram
    );
    [proposalMetadata] = await PublicKey.findProgramAddress(
      [unqClubSeed, proposalAddress.toBuffer(), proposalMetadataSeed],
      clubProgram.programId
    );

    const createProposalMetadataIx = await createProposalMetadata(
      clubProgram,
      clubPda,
      communityMint,
      memberPda,
      realmPda,
      treasuryAddress,
      treasuryData,
      wallet,
      ProposalType.TransferFunds,
      []
    );

    const updatedescription = await updateProposalDescription(
      clubProgram,
      "Wormhole Transfe funds",
      "Wormhole proposal",
      ["option YES"],
      "Testing wormhole",
      wallet,
      proposalMetadata,
      proposalAddress
    );

    try {
      const tx = await sendTransaction(
        SOLANA_RPC_CONNECTION,
        [createProposalMetadataIx.tx, updatedescription.tx],
        [wallet],
        wallet
      );

      await SOLANA_RPC_CONNECTION.confirmTransaction(tx);
    } catch (error) {
      console.log(error);
    }

    const uvwIx = await updateVoterWeight(
      clubProgram,
      clubPda,
      wallet,
      proposalAddress,
      proposalMetadata,
      memberPda,
      treasuryData,
      realmPda,
      ClubAction.CreateTransferProposal
    );
    const createTransferProposalIx = await createTransferProposal(
      clubProgram,
      1.5 * LAMPORTS_PER_SOL,
      createProposalMetadataIx.governanceAccount,
      realmPda,
      proposalAddress,
      tokenOwnerRecordPda,
      clubPda,
      treasuryAddress,
      wallet,
      proposalMetadata,
      treasuryData,
      communityMint,
      "0x7c73162E5Fd56d74c6d407d02602eAcC8B9c2BF1"
    );
    proposalInstruction = createTransferProposalIx.instructionAddress;
    try {
      const createTx = await sendTransaction(
        SOLANA_RPC_CONNECTION,
        [uvwIx.ix, createTransferProposalIx.ix],
        [wallet],
        wallet
      );

      await SOLANA_RPC_CONNECTION.confirmTransaction(createTx);
    } catch (error) {
      console.log(error);
    }
  });

  it("should cast proposal vote", async () => {
    const uvwIx = await updateVoterWeight(
      clubProgram,
      clubPda,
      wallet,
      proposalAddress,
      proposalMetadata,
      memberPda,
      treasuryData,
      realmPda,
      ClubAction.CastVote
    );

    const castVoteIx = await castProposalVote(
      clubProgram,
      clubPda,
      realmPda,
      proposalAddress,
      uvwIx.ix,
      governanceAccount,
      wallet,
      tokenOwnerRecordPda,
      communityMint
    );
  });
  it("should emit message for transfering funds", async () => {
    const emitIx = await emitWormholeMessage(
      clubProgram,
      clubPda,
      wallet,
      {
        ethAddress: Buffer.from(
          hexToUint8Array(
            tryNativeToHexString(
              "0x7c73162E5Fd56d74c6d407d02602eAcC8B9c2BF1",
              "ethereum"
            )
          )
        ),
        action: { transferFunds: {} },
        creatorAddress: null,
      },
      [
        { isSigner: false, isWritable: true, pubkey: proposalMetadata },
        { isSigner: false, isWritable: true, pubkey: proposalAddress },
        { isSigner: false, isWritable: true, pubkey: proposalInstruction },
      ],
      wormholeProgramId
    );
    try {
      const tx = await sendTransaction(
        SOLANA_RPC_CONNECTION,
        [emitIx],
        [wallet],
        wallet
      );
      console.log(tx, "TXXX");
      console.log(
        (
          await ETH_RPC_CONNECTION.getBalance(
            "0x7c73162E5Fd56d74c6d407d02602eAcC8B9c2BF1"
          )
        ).toBigInt(),
        "BALANCE"
      );

      await SOLANA_RPC_CONNECTION.confirmTransaction(tx);
    } catch (error) {
      console.log(error);
    }
  });
});

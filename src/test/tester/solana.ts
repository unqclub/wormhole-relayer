import { Program } from "@project-serum/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
  TransactionInstruction,
} from "@solana/web3.js";
import { ClubProgram } from "../../idl/club_program";
import {
  accountGovernanceSeed,
  escrowProgram,
  fundraiseCfgSeed,
  governanceSeed,
  maxVoterWeightSeed,
  offerSeed,
  ogSplGovernance,
  profitSeed,
  proposalMetadataSeed,
  ProposalType,
  realmConfigSeed,
  sendTransaction,
  splGovernanceProgram,
  treasuryDataSeed,
  treasurySeed,
  unqClubMemberSeed,
  unqClubSeed,
  voterWeightSeed,
} from "../helpers";
import * as anchor from "@project-serum/anchor";
import * as SplGovernance from "@solana/spl-governance";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ClubAction, RoleDto } from "./constants.solana";
import { getRealm, YesNoVote } from "@solana/spl-governance";
import {
  deriveEmitterSequenceKey,
  deriveFeeCollectorKey,
  deriveWormholeEmitterKey,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import {
  hexToUint8Array,
  tryNativeToHexString,
  tryNativeToUint8Array,
} from "@certusone/wormhole-sdk";
import { connection, wormholeProgram } from "../../helpers/utilities";

export const initOgRealm = async (
  name: string,
  payer: Keypair,
  mint: PublicKey,
  connection: Connection
) => {
  const createRealmIx: any[] = [];

  const realm = await SplGovernance.withCreateRealm(
    createRealmIx,
    ogSplGovernance,
    2,
    name,
    payer.publicKey,
    mint,
    payer.publicKey,
    undefined,
    new SplGovernance.MintMaxVoteWeightSource({ value: new anchor.BN(10) }),
    new anchor.BN(10)
  );

  try {
    const tx = await sendTransaction(connection, createRealmIx, [payer], payer);
    await connection.confirmTransaction(tx);
  } catch (error) {
    console.log(error);
  }

  return realm;
};

export const createClub = async (
  clubName: string,
  program: Program<ClubProgram>,
  payer: Keypair,
  connection: Connection,
  roleConfig = RoleDto.getDefaultSerializedRoleConifg()
) => {
  try {
    const communityTokenHoldingMint = await createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      5
    );
    const realm = await initOgRealm(
      clubName,
      payer,
      communityTokenHoldingMint,
      connection
    );

    const [realmAddress] = PublicKey.findProgramAddressSync(
      [governanceSeed, Buffer.from(clubName)],
      splGovernanceProgram
    );

    const [ogRealm] = PublicKey.findProgramAddressSync(
      [governanceSeed, Buffer.from(clubName)],
      ogSplGovernance
    );

    const [clubAddress] = PublicKey.findProgramAddressSync(
      [unqClubSeed, realmAddress.toBuffer()],
      program.programId
    );

    const [memberAddress] = PublicKey.findProgramAddressSync(
      [
        unqClubSeed,
        clubAddress.toBuffer(),
        unqClubMemberSeed,
        payer.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [realmConfigAddress] = PublicKey.findProgramAddressSync(
      [realmConfigSeed, realmAddress.toBuffer()],
      splGovernanceProgram
    );

    const [communityTokenHolding] = PublicKey.findProgramAddressSync(
      [
        governanceSeed,
        realmAddress.toBuffer(),
        communityTokenHoldingMint.toBuffer(),
      ],
      splGovernanceProgram
    );

    const [tokenOwnerRecord] = await PublicKey.findProgramAddress(
      [
        governanceSeed,
        realmAddress.toBuffer(),
        communityTokenHoldingMint.toBuffer(),
        payer.publicKey.toBuffer(),
      ],
      splGovernanceProgram
    );

    const buffers: Buffer[] = [];

    roleConfig.forEach((rc) => {
      buffers.push(Buffer.from(rc));
    });

    const createClubIx = await program.methods
      .createClub(clubName, 2, buffers, "Owner", "Member", null)
      .accounts({
        realm: realmAddress,
        ogRealm: realm,
        realmAuthority: payer.publicKey,
        communityTokenHoldingAddress: communityTokenHolding,
        realmConfig: realmConfigAddress,
        tokenOwnerRecord: tokenOwnerRecord,
        splGovernanceProgram: splGovernanceProgram,
        voterWeightProgram: program.programId,
        communityTokenMint: communityTokenHoldingMint,
        clubData: clubAddress,
        memberData: memberAddress,
        payer: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await sendTransaction(
      connection,
      [createClubIx],
      [payer],
      payer
    );
    await connection.confirmTransaction(tx);

    return {
      clubAddress: clubAddress,
      realmAddress: realmAddress,
      memberAddress: memberAddress,
      tokenOwnerRecord: tokenOwnerRecord,
      mint: communityTokenHoldingMint,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const updateVoterWeightForGovernanceIx = async (
  program: Program<ClubProgram>,
  realmAddress: PublicKey,
  memberData: PublicKey,
  clubData: PublicKey,
  payer: Keypair
) => {
  const [voterWeightAddress] = await PublicKey.findProgramAddress(
    [
      unqClubSeed,
      clubData.toBuffer(),
      voterWeightSeed,
      payer.publicKey.toBuffer(),
    ],
    program.programId
  );

  const ix = await program.methods
    .updateVoterWeightForGovernance()
    .accounts({
      realm: realmAddress,
      voterWeightRecord: voterWeightAddress,
      memberData: memberData,
      clubData: clubData,
      payer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  return { ix, voterWeightAddress };
};

export const createGovernance = async (
  program: Program<ClubProgram>,
  clubAddress: PublicKey,
  realmAddress: PublicKey,
  payer: Keypair,
  memberData: PublicKey,
  tokenOwnerRecord: PublicKey,
  voterWeightAddress: PublicKey,
  ethDenomCurr: string
) => {
  const [realmConfigAddress] = PublicKey.findProgramAddressSync(
    [realmConfigSeed, realmAddress.toBuffer()],
    splGovernanceProgram
  );

  const treasuryIndex = 1;
  let treasuryIndexBuffer = Buffer.alloc(4);
  treasuryIndexBuffer.writeUint8(treasuryIndex);

  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [unqClubSeed, clubAddress.toBuffer(), treasurySeed, treasuryIndexBuffer],
    program.programId
  );

  const [treasuryDataPda] = PublicKey.findProgramAddressSync(
    [unqClubSeed, treasuryPda.toBuffer(), treasuryDataSeed],
    program.programId
  );

  const [profitPda] = PublicKey.findProgramAddressSync(
    [unqClubSeed, treasuryPda.toBuffer(), profitSeed],
    program.programId
  );

  const [accountGovernancePda] = PublicKey.findProgramAddressSync(
    [accountGovernanceSeed, realmAddress.toBuffer(), treasuryPda.toBuffer()],
    splGovernanceProgram
  );

  const createGovernanceIX = await program.methods
    .createTreasuryGovernance(
      86400 * 7 + 1,
      55,
      [],
      { ethereum: {} },
      null,
      ethDenomCurr
    )
    .accounts({
      treasuryData: treasuryDataPda,
      clubData: clubAddress,
      splGovernanceProgram: splGovernanceProgram,
      realm: realmAddress,
      realmConfig: realmConfigAddress,
      realmAuthority: payer.publicKey,
      payer: payer.publicKey,
      tokenOwnerRecord: tokenOwnerRecord,
      governance: accountGovernancePda,
      voterWeightRecord: voterWeightAddress,
      treasury: treasuryPda,
      profit: profitPda,
      memberData: memberData,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  return { createGovernanceIX, treasuryDataPda, treasuryPda };
};

export const emitWormholeMessage = async (
  program: Program<ClubProgram>,
  clubAddress: PublicKey,
  payer: Keypair,
  args: any,
  remainingAccounts: AccountMeta[],
  wormholeProgramId: PublicKey
) => {
  const feeCollector = deriveFeeCollectorKey(wormholeProgramId);

  const clubDataAcc = await program.account.clubData.fetch(clubAddress);
  const emittedMessageCount = Buffer.alloc(4);
  emittedMessageCount.writeUint32LE(clubDataAcc.emittedMessageCount + 1);

  const [message] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("wormhole-message"),
      clubAddress.toBuffer(),
      emittedMessageCount,
    ],
    program.programId
  );

  const [wormholeConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("Bridge")],
    wormholeProgramId
  );

  const emitter = deriveWormholeEmitterKey(program.programId);
  const sequence = deriveEmitterSequenceKey(emitter, wormholeProgramId);

  const ix = await program.methods
    .postWormholeMessage(args, 12)
    .accounts({
      clubData: clubAddress,
      clock: SYSVAR_CLOCK_PUBKEY,
      payer: payer.publicKey,
      wormhole: wormholeProgramId,
      rent: SYSVAR_RENT_PUBKEY,
      emitterAddress: emitter,
      feeCollector,
      sequence,
      wormholeConfig,
      systemProgram: SystemProgram.programId,
      message: message,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  return ix;
};

export const createProposalMetadata = async (
  program: Program<ClubProgram>,
  clubAddress: PublicKey,
  collectionMint: PublicKey,
  memberData: PublicKey,
  realmAddress: PublicKey,
  treasuryPda: PublicKey,
  treasuryDataAddress: PublicKey,
  payer: Keypair,
  proposalType: ProposalType,
  remainingAccounts: AccountMeta[]
) => {
  let proposalIndexBuffer = Buffer.alloc(4);
  proposalIndexBuffer.writeInt32LE(0, 0);

  const [governanceAccount] = PublicKey.findProgramAddressSync(
    [accountGovernanceSeed, realmAddress.toBuffer(), treasuryPda.toBuffer()],
    splGovernanceProgram
  );

  const proposalAddress: PublicKey = PublicKey.findProgramAddressSync(
    [
      governanceSeed,
      governanceAccount.toBuffer(),
      collectionMint.toBuffer(),
      proposalIndexBuffer,
    ],
    splGovernanceProgram
  )[0];

  const [proposalMetadata] = PublicKey.findProgramAddressSync(
    [unqClubSeed, proposalAddress.toBuffer(), proposalMetadataSeed],
    program.programId
  );

  const tx = await program.methods
    .createProposalMetadata(proposalType ?? 0, null, null, null)
    .accounts({
      clubData: clubAddress,
      proposal: proposalAddress,
      proposalMetadata,
      memberData: memberData,
      governance: governanceAccount,
      realm: realmAddress,
      payer: payer.publicKey,
      treasuryData: treasuryDataAddress,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  return {
    tx,
    proposalMetadata,
    governanceAccount,
  };
};

export const updateProposalDescription = async (
  program: Program<ClubProgram>,
  descriptionBuffer: string,
  name: string,
  options: string[],
  discussionLink: string,
  payer: Keypair,
  proposalMetadata: PublicKey,
  proposalAddress: PublicKey
) => {
  const tx = await program.methods
    .updateProposalDescription(descriptionBuffer, name, options, discussionLink)
    .accounts({
      proposal: proposalAddress,
      proposalMetadata: proposalMetadata,
      payer: payer.publicKey,
    })
    .instruction();

  return {
    tx,
    proposalMetadata: proposalMetadata,
  };
};

export const updateVoterWeight = async (
  program: Program<ClubProgram>,
  clubAddress: PublicKey,
  payer: Keypair,
  proposalAddress: PublicKey,
  proposalMetadata: PublicKey,
  memberData: PublicKey,
  treasuryDataPda: PublicKey,
  realmAddress: PublicKey,
  action: ClubAction
) => {
  const [voterWeightAddress] = PublicKey.findProgramAddressSync(
    [
      unqClubSeed,
      clubAddress.toBuffer(),
      voterWeightSeed,
      payer.publicKey.toBuffer(),
    ],
    program.programId
  );

  const [maxVoterWeightPda] = PublicKey.findProgramAddressSync(
    [unqClubSeed, proposalAddress.toBuffer(), maxVoterWeightSeed],
    program.programId
  );

  const ix = await program.methods
    .updateVoterWeight(action)
    .accounts({
      proposal: proposalAddress,
      proposalMetadata,
      maxVoterWeightRecord: maxVoterWeightPda,
      clubData: clubAddress,
      memberData: memberData,
      treasuryData: treasuryDataPda,
      realm: realmAddress,
      voterWeightRecord: voterWeightAddress,
      payer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  return { ix, voterWeightAddress };
};

export const createTransferProposal = async (
  program: Program<ClubProgram>,
  transferAmount: number,
  governance: PublicKey,
  realmAddress: PublicKey,
  proposal: PublicKey,
  tokenOwnerRecord: PublicKey,
  clubAddress: PublicKey,
  treasuryPda: PublicKey,
  payer: Keypair,
  proposalMetadata: PublicKey,
  treasuryDataPda: PublicKey,
  collectionMint: PublicKey,
  destinationAddress: string
) => {
  const [realmConfigAddress] = PublicKey.findProgramAddressSync(
    [realmConfigSeed, realmAddress.toBuffer()],
    splGovernanceProgram
  );

  const [voterWeightAddress] = PublicKey.findProgramAddressSync(
    [
      unqClubSeed,
      clubAddress.toBuffer(),
      voterWeightSeed,
      payer.publicKey.toBuffer(),
    ],
    program.programId
  );

  const treasuryToken = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    NATIVE_MINT,
    treasuryPda,
    true
  );

  const optionIndex = 0;
  const transactionIndex = 0;
  let optionIndexBuffer = Buffer.alloc(1);
  optionIndexBuffer.writeUInt8(optionIndex);

  let instructionIndexBuffer = Buffer.alloc(2);
  instructionIndexBuffer.writeInt16LE(transactionIndex, 0);

  const [instructionAddress] = PublicKey.findProgramAddressSync(
    [
      governanceSeed,
      proposal.toBuffer(),
      optionIndexBuffer,
      instructionIndexBuffer,
    ],
    splGovernanceProgram
  );
  const [offer] = PublicKey.findProgramAddressSync(
    [offerSeed, proposal.toBuffer()],
    escrowProgram
  );

  const ix = await program.methods
    .createTransferProposal(
      true,
      new anchor.BN(transferAmount),
      Buffer.from(
        hexToUint8Array(tryNativeToHexString(destinationAddress, "ethereum"))
      )
    )
    .accounts({
      governance,
      realm: realmAddress,
      realmConfig: realmConfigAddress,
      proposal: proposal,
      proposalTransactionAddress: instructionAddress,
      tokenOwnerRecord: tokenOwnerRecord,
      splGovernanceProgram: splGovernanceProgram,
      communityTokenMint: collectionMint,
      payer: payer.publicKey,
      voterWeightRecord: voterWeightAddress,
      treasury: treasuryPda,
      treasuryData: treasuryDataPda,
      proposalMetadata: proposalMetadata,
      clubData: clubAddress,
      offer: offer,
      destination: payer.publicKey,
      treasuryToken: treasuryToken.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  return { ix, instructionAddress };
};

export const castProposalVote = async (
  program: Program<ClubProgram>,
  clubAddress: PublicKey,
  realm: PublicKey,
  proposal: PublicKey,
  uvwIx: TransactionInstruction,
  goverannce: PublicKey,
  payer: Keypair,
  tokenOwnerRecord: PublicKey,
  mint: PublicKey
) => {
  const [voterWeightAddress] = await PublicKey.findProgramAddress(
    [
      unqClubSeed,
      clubAddress.toBuffer(),
      voterWeightSeed,
      payer.publicKey.toBuffer(),
    ],
    program.programId
  );

  const [maxVoterWeightPda] = PublicKey.findProgramAddressSync(
    [unqClubSeed, proposal.toBuffer(), maxVoterWeightSeed],
    program.programId
  );

  const instructions = [uvwIx];
  await SplGovernance.withCastVote(
    instructions,
    splGovernanceProgram,
    2,
    realm,
    goverannce,
    proposal,
    tokenOwnerRecord,
    tokenOwnerRecord,
    payer.publicKey,
    mint,
    SplGovernance.Vote.fromYesNoVote(YesNoVote.Yes),
    payer.publicKey,
    voterWeightAddress,
    maxVoterWeightPda
  );

  try {
    const txSig = await sendTransaction(
      connection,
      instructions,
      [payer],
      payer
    );
    await connection.confirmTransaction(txSig);
  } catch (error) {
    console.log(error);
  }
};

export const createFundraise = async (
  program: Program<ClubProgram>,
  fundraiseAmount: number,
  treasury: PublicKey,
  clubAddress: PublicKey,
  treasuryData: PublicKey,
  memberData: PublicKey,
  payer: Keypair
) => {
  const fundraiseCountBuffer = Buffer.alloc(4);
  fundraiseCountBuffer.writeUint32LE(1, 0);
  const [fundraiseConfigAddress] = await PublicKey.findProgramAddress(
    [
      unqClubSeed,
      treasuryData.toBuffer(),
      fundraiseCfgSeed,
      fundraiseCountBuffer,
    ],
    program.programId
  );
  const tx = await program.methods
    .createFundraise(new anchor.BN(fundraiseAmount))
    .accounts({
      treasury: treasury,
      clubData: clubAddress,
      treasuryData: treasuryData,
      fundraiseConfig: fundraiseConfigAddress,
      memberData: memberData,
      payer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  return { tx, fundraiseConfigAddress };
};

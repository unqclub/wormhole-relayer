import { Program } from "@project-serum/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
} from "@solana/web3.js";
import { ClubProgram } from "../../idl/club_program";
import {
  accountGovernanceSeed,
  governanceSeed,
  ogSplGovernance,
  profitSeed,
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
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { RoleDto } from "./constants.solana";
import { getRealm } from "@solana/spl-governance";
import {
  deriveEmitterSequenceKey,
  deriveFeeCollectorKey,
  deriveWormholeEmitterKey,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { tryNativeToHexString } from "@certusone/wormhole-sdk";
import { wormholeProgram } from "../../helpers/utilities";

export const initOgRealm = async (
  name: string,
  payer: Keypair,
  mint: PublicKey,
  connection: Connection
) => {
  const createRealmIx = [];

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
    console.log(realm.toBase58(), "TXx");

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
    };
  } catch (error) {
    console.log(error);
  }
};

export const updateVoterWeightIx = async (
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
    .createTreasuryGovernance(86400 * 7 + 1, 55, [], null, ethDenomCurr)
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

  return { createGovernanceIX, treasuryDataPda };
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

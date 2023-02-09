import { Program } from "@project-serum/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
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

export const initOgRealm = async (
  name: string,
  payer: Keypair,
  mint: PublicKey,
  connection: Connection
) => {
  const createRealmIx = [];

  const realmData = await SplGovernance.withCreateRealm(
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

  return createRealmIx;
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
    const createRealmIx = await initOgRealm(
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
      .createClub(clubName, 1, buffers, "Owner", "Member", null)
      .accounts({
        realm: realmAddress,
        ogRealm,
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

    createRealmIx.push(createClubIx);

    await sendTransaction(connection, createRealmIx, [payer], payer);

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
    [unqClubSeed, clubData.toBuffer(), voterWeightSeed, memberData.toBuffer()],
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
  voterWeightAddress: PublicKey
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
    .createTreasuryGovernance(15, 55, [], null)
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

  return createGovernanceIX;
};

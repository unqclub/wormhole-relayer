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
  governanceSeed,
  ogSplGovernance,
  realmConfigSeed,
  sendTransaction,
  splGovernanceProgram,
  unqClubMemberSeed,
  unqClubSeed,
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

    return clubAddress;
  } catch (error) {
    console.log(error);
  }
};

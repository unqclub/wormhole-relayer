import { ParsedVaa, tryUint8ArrayToNative } from "@certusone/wormhole-sdk";
import { Program } from "@project-serum/anchor";
import { program } from "@project-serum/anchor/dist/cjs/native/system";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  AccountMeta,
} from "@solana/web3.js";
import { SolanaWallet } from "../../../../relayer-engine/relayer-engine/lib";
import { ClubProgram } from "../../idl/club_program";
import {
  financialRecordSeed,
  treasuryDataSeed,
  treasurySeed,
  unqClubMemberSeed,
  unqClubSeed,
} from "../../test/helpers";
import { WormholePayloadAction, wormholeProgram } from "../utilities";

export async function emitMessageOnSolana(
  vaa: Buffer,
  wallet: Keypair,
  parsedVaa: ParsedVaa
) {
  try {
    const wormholeSolProgram = wormholeProgram();

    const payload = parsedVaa.payload;

    const { clubData, remainingAccounts } = getInstructionRemainingAccounts(
      payload,
      wormholeSolProgram
    );

    const receiveWormholeMessageIx = await wormholeSolProgram.methods
      .receiveWormholeMessage(vaa)
      .accounts({
        clubData: clubData,
        payer: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return receiveWormholeMessageIx;
  } catch (error) {
    throw error;
  }
}

export const getInstructionRemainingAccounts = (
  payload: Buffer,
  program: Program<ClubProgram>
) => {
  const action = payload[0] as WormholePayloadAction;

  const remainingAccounts: AccountMeta[] = [];
  let clubData: PublicKey;

  switch (action) {
    case WormholePayloadAction.DepositEvent: {
      const rawClubAddress = payload.subarray(1, 33);
      clubData = new PublicKey(tryUint8ArrayToNative(rawClubAddress, "solana"));
      const rawMemberAddress = payload.subarray(33, 55);
      const memberPubkey = new PublicKey(
        tryUint8ArrayToNative(rawMemberAddress, "solana")
      );
      const depositAmount = payload
        .subarray(55, payload.length)
        .readBigInt64BE(0);
      const treasuryIndex = 1;
      let treasuryIndexBuffer = Buffer.alloc(4);
      treasuryIndexBuffer.writeUint8(treasuryIndex);
      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [unqClubSeed, clubData.toBuffer(), treasurySeed, treasuryIndexBuffer],
        program.programId
      );

      const [memberData] = PublicKey.findProgramAddressSync(
        [
          unqClubSeed,
          clubData.toBuffer(),
          unqClubMemberSeed,
          memberPubkey.toBuffer(),
        ],
        program.programId
      );
      const [treasuryDataPda] = PublicKey.findProgramAddressSync(
        [unqClubSeed, treasuryPda.toBuffer(), treasuryDataSeed],
        program.programId
      );

      const [financialRecord] = PublicKey.findProgramAddressSync(
        [
          unqClubSeed,
          treasuryDataPda.toBuffer(),
          financialRecordSeed,
          memberPubkey.toBuffer(),
        ],
        program.programId
      );

      remainingAccounts.push(
        {
          isSigner: false,
          isWritable: false,
          pubkey: memberData,
        },
        {
          isSigner: false,
          isWritable: false,
          pubkey: treasuryDataPda,
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: financialRecord,
        }
      );
    }
  }
  return { remainingAccounts, clubData };
};

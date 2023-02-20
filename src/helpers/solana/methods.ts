import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { SolanaWallet } from "relayer-engine";
import { ParsedVaa, tryUint8ArrayToNative } from "@certusone/wormhole-sdk";
import { Program } from "@project-serum/anchor";
import {

  AccountMeta,
} from "@solana/web3.js";
import { ClubProgram } from "../../idl/club_program";
import {
  financialRecordSeed,
  fundraiseCfgSeed,
  treasuryDataSeed,
  treasurySeed,
  unqClubMemberSeed,
  unqClubSeed,
} from "../../test/helpers";
import { WormholePayloadAction, wormholeProgram } from "../utilities";
import * as ethers from "ethers";

export async function emitMessageOnSolana(
  vaa: Buffer,
  wallet: Keypair,
  parsedVaa: ParsedVaa
) {
  try {
    const wormholeSolProgram = wormholeProgram();

    const payload = parsedVaa.payload;

    const { clubData, remainingAccounts } =
      await getInstructionRemainingAccounts(payload, wormholeSolProgram);

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

export const getInstructionRemainingAccounts = async (
  payload: Buffer,
  program: Program<ClubProgram>
) => {
  const action = payload[0] as WormholePayloadAction;

  const remainingAccounts: AccountMeta[] = [];
  let clubData: PublicKey;
  let financialRecord: PublicKey;

  switch (action) {
    case WormholePayloadAction.DepositEvent: {
      const rawClubAddress = payload.subarray(1, 33);
      clubData = new PublicKey(tryUint8ArrayToNative(rawClubAddress, "solana"));
      const rawMemberAddress = payload.subarray(33, 65);
      const memberPubkey = new PublicKey(
        tryUint8ArrayToNative(rawMemberAddress, "solana")
      );

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

      const treasuryDataAcc = await program.account.treasuryData.fetch(
        treasuryDataPda
      );

      const fundraiseCount = treasuryDataAcc.fundraiseCount;
      const fundraiseCountBuffer = Buffer.alloc(4);
      fundraiseCountBuffer.writeUint32LE(fundraiseCount, 0);

      const [fundraiseConfigAddress] = await PublicKey.findProgramAddress(
        [
          unqClubSeed,
          treasuryDataPda.toBuffer(),
          fundraiseCfgSeed,
          fundraiseCountBuffer,
        ],
        program.programId
      );

      [financialRecord] = PublicKey.findProgramAddressSync(
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
          isWritable: true,
          pubkey: memberData,
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: treasuryDataPda,
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: financialRecord,
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: fundraiseConfigAddress,
        }
      );
    }
  }
  return { remainingAccounts, clubData, financialRecord };
};

import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { SolanaWallet } from "relayer-engine";
import { ParsedVaa, tryUint8ArrayToNative } from "@certusone/wormhole-sdk";
import { Program } from "@project-serum/anchor";
import { AccountMeta } from "@solana/web3.js";
import { ClubProgram } from "../../idl/club_program";
import {
  financialRecordSeed,
  fundraiseCfgSeed,
  treasuryDataSeed,
  treasurySeed,
  unqClubMemberSeed,
  unqClubSeed,
} from "../../test/helpers";
import { wormholeProgram } from "../utilities";
import { EvmToSolanaAction } from "../../api/wormhole-vaa/wormhole-vaa";

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
    console.log(error);
    throw error;
  }
}

export const getInstructionRemainingAccounts = async (
  payload: Buffer,
  program: Program<ClubProgram>
) => {
  const action = payload[0] as EvmToSolanaAction;

  const remainingAccounts: AccountMeta[] = [];
  let clubData: PublicKey;
  let financialRecord: PublicKey;

  switch (action) {
    case EvmToSolanaAction.Deposit: {
      const rewTreasuryAddress = payload.subarray(1, 33);
      const treasuryDataAddress = new PublicKey(
        tryUint8ArrayToNative(rewTreasuryAddress, "solana")
      );
      const treasuryData = await program.account.treasuryData.fetch(
        treasuryDataAddress
      );

      clubData = treasuryData.clubData;
      const rawMemberAddress = payload.subarray(33, 65);
      const memberPubkey = new PublicKey(
        tryUint8ArrayToNative(rawMemberAddress, "solana")
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

      const fundraiseCount = treasuryData.fundraiseCount;
      const fundraiseCountBuffer = Buffer.alloc(4);
      fundraiseCountBuffer.writeUint32LE(fundraiseCount, 0);

      const [fundraiseConfigAddress] = await PublicKey.findProgramAddress(
        [
          unqClubSeed,
          treasuryDataAddress.toBuffer(),
          fundraiseCfgSeed,
          fundraiseCountBuffer,
        ],
        program.programId
      );

      [financialRecord] = PublicKey.findProgramAddressSync(
        [
          unqClubSeed,
          treasuryDataAddress.toBuffer(),
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
          pubkey: treasuryDataAddress,
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
      break;
    }
    case EvmToSolanaAction.SellShares: {
      const treasuryData = new PublicKey(
        tryUint8ArrayToNative(payload.subarray(1, 33), "solana")
      );

      const treasuryDataAccount = await program.account.treasuryData.fetch(
        treasuryData
      );

      clubData = treasuryDataAccount.clubData;

      const buyerPubkey = new PublicKey(
        tryUint8ArrayToNative(payload.subarray(33, 65), "solana")
      );

      const financialOffer = new PublicKey(
        tryUint8ArrayToNative(payload.subarray(65, 97), "solana")
      );

      const sellerPubkey = new PublicKey(
        tryUint8ArrayToNative(payload.subarray(97, 129), "solana")
      );

      const [sellerFinancialRecord] = PublicKey.findProgramAddressSync(
        [
          unqClubSeed,
          treasuryData.toBuffer(),
          financialRecordSeed,
          sellerPubkey.toBuffer(),
        ],
        program.programId
      );

      const [buyerFinancialRecord] = PublicKey.findProgramAddressSync(
        [
          unqClubSeed,
          treasuryData.toBuffer(),
          financialRecordSeed,
          buyerPubkey.toBuffer(),
        ],
        program.programId
      );

      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: treasuryData,
      });
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: financialOffer,
      });
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: sellerFinancialRecord,
      });
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: buyerFinancialRecord,
      });
      remainingAccounts.push({
        isSigner: false,
        isWritable: true,
        pubkey: buyerPubkey,
      });
    }
  }
  return { remainingAccounts, clubData };
};

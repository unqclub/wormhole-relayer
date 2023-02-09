import { ParsedVaa, tryUint8ArrayToNative } from "@certusone/wormhole-sdk";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  AccountMeta,
} from "@solana/web3.js";
import { SolanaWallet } from "../../../../relayer-engine/relayer-engine/lib";
import { WormholePayloadAction, wormholeProgram } from "../utilities";

export async function emitMessageOnSolana(
  vaa: Buffer,
  wallet: Keypair,
  parsedVaa: ParsedVaa
) {
  try {
    const wormholeSolProgram = wormholeProgram();

    const payload = parsedVaa.payload;

    const receiveWormholeMessageIx = await wormholeSolProgram.methods
      .receiveWormholeMessage(vaa)
      .accounts({
        payer: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return receiveWormholeMessageIx;
  } catch (error) {
    throw error;
  }
}

export const getInstructionDataAndRemainingAccounts = (payload: Buffer) => {
  const action = payload[0] as WormholePayloadAction;

  const remainingAccounts: AccountMeta[] = [];

  switch (action) {
    case WormholePayloadAction.DepositEvent: {
      const rawClubAddress = payload.subarray(1, 33);
      const clubAddress = new PublicKey(
        tryUint8ArrayToNative(rawClubAddress, "solana")
      );
      const rawMemberAddress = payload.subarray(33, 55);
      const memberPubkey = new PublicKey(
        tryUint8ArrayToNative(rawMemberAddress, "solana")
      );
      const depositAmount = payload
        .subarray(55, payload.length)
        .readBigInt64BE(0);
    }
  }
};

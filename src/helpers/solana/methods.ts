import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { SolanaWallet } from "../../../../relayer-engine/relayer-engine/lib";
import { wormholeProgram } from "../utilities";

export async function emitMessageOnSolana(payload: Buffer, wallet: Keypair) {
  try {
    const wormholeSolProgram = wormholeProgram();

    const [message] = PublicKey.findProgramAddressSync(
      [Buffer.from("message"), wallet.publicKey.toBuffer()],
      wormholeSolProgram.programId
    );

    console.log(payload.toString("utf-8"), "MESSAGE FROM ETHEREUM");

    const ix = await wormholeSolProgram.methods
      .receiveWormholeMessage(payload)
      .accounts({
        payer: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        message,
      })
      .instruction();

    return ix;
  } catch (error) {
    throw error;
  }
}

export async function fetchNewestMessage(wallet: SolanaWallet) {
  try {
    const wormholeSolProgram = wormholeProgram();

    const [message] = PublicKey.findProgramAddressSync(
      [Buffer.from("message"), wallet.payer.publicKey.toBuffer()],
      wormholeSolProgram.programId
    );
    const messageAccount = await wormholeSolProgram.account.messageData.fetch(
      message
    );
    console.log("MESSAGE", messageAccount);
  } catch (error) {
    console.log(error);
  }
}

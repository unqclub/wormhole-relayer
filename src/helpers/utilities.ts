import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { AnchorProvider, Program, Wallet } from "@project-serum/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { ClubProgram, IDL } from "../idl/club_program";
export const solanaEmitterAddress = process.env.EMITTER_ADDRESS;

export const connection = new Connection("http://127.0.0.1:8899");

export const wormholeProgram = () => {
  return new Program<ClubProgram>(
    IDL,
    "EMssAbHYgBGgxoRNfnv7xuv7tSrKabrVowG6aKUtysWr",
    new AnchorProvider(connection, new Wallet(Keypair.generate()), {
      commitment: "confirmed",
    })
  );
};

export enum WormholePayloadAction {
  DepositEvent,
}

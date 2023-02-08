import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { AnchorProvider, Program, Wallet } from "@project-serum/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { IDL, WormholeSol } from "../idl/wormhole_sol";
export const solanaEmitterAddress = process.env.EMITTER_ADDRESS;

export const getDeserializationSchema = () => {
  return new Map([
    [
      MessageDto,
      {
        kind: "struct",
        fields: [
          ["payer", "pubkey"],
          ["roleWeight", "u64"],
        ],
      },
    ],
  ]);
};

export class MessageDto {
  payer: PublicKey;
  counter: BN;
  constructor(args: { payer: PublicKey; counter: BN }) {
    this.payer = this.payer;
    this.counter = this.counter;
  }
}

export const connection = new Connection("http://127.0.0.1:8899");

export const wormholeProgram = () => {
  return new Program<WormholeSol>(
    IDL,
    "8QS89n567dJk829iueJdxFUeqFkVjRBPU3w674BGmB8m",
    new AnchorProvider(connection, new Wallet(Keypair.generate()), {
      commitment: "confirmed",
    })
  );
};

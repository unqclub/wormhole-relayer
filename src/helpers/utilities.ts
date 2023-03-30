import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { AnchorProvider, Program, Wallet } from "@project-serum/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import pluginConf from "../../unqPluginConfig.json";
import { ClubProgram, IDL } from "../idl/club_program";
export const solanaEmitterAddress = process.env.EMITTER_ADDRESS;

export const connection = new Connection(
  pluginConf.xDappConfig.networks.sol0.rpc
);

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

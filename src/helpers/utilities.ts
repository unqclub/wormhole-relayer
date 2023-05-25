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
    "8eZTZga5YrHpJKcWqJRi9mKFDNjcVxPKa6Xz8VPHuKdr",
    new AnchorProvider(connection, new Wallet(Keypair.generate()), {
      commitment: "confirmed",
    })
  );
};

export enum WormholePayloadAction {
  DepositEvent,
}

export function assertInt(x: any, fieldName?: string): number {
  if (!Number.isInteger(x)) {
    const e = new Error(`Expected field to be integer, found ${x}`) as any;
    e.fieldName = fieldName;
    throw e;
  }
  return x as number;
}

export function assertArray<T>(x: any, fieldName?: string): T[] {
  if (!Array.isArray(x)) {
    const e = new Error(`Expected field to be array, found ${x}`) as any;
    e.fieldName = fieldName;
    throw e;
  }
  return x as T[];
}

export function assertBool(x: any, fieldName?: string): boolean {
  if (x !== false && x !== true) {
    const e = new Error(`Expected field to be boolean, found ${x}`) as any;
    e.fieldName = fieldName;
    throw e;
  }
  return x as boolean;
}

export function nnull<T>(x: T | undefined | null, errMsg?: string): T {
  if (x === undefined || x === null) {
    throw new Error("Found unexpected undefined or null. " + errMsg);
  }
  return x;
}

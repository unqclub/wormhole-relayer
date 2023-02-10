import * as ethers from "ethers";
import treasuryContract from "../abi/UnqTreasury.json";
import {
  PublicKey,
  Connection,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  Keypair,
} from "@solana/web3.js";

export const governanceSeed = Buffer.from("governance");
export const unqClubSeed = Buffer.from("unq-club");
export const unqClubMemberSeed = Buffer.from("member");
export const realmConfigSeed = Buffer.from("realm-config");
export const voterWeightSeed = Buffer.from("voter-weight-record");
export const treasuryDataSeed = Buffer.from("treasury-data");
export const financialRecordSeed = Buffer.from("financial-record");
export const treasurySeed = Buffer.from("treasury");
export const profitSeed = Buffer.from("profit");
export const accountGovernanceSeed = Buffer.from("account-governance");

export const splGovernanceProgram = new PublicKey(
  "UNQgUq3jtWnEmQraenUckLda9ueYzNc2uywWVPcMC4D"
);

export const ogSplGovernance = new PublicKey(
  "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
);

export const getTreasuryContract = (
  treasuryAddress: string,
  network: ethers.providers.Provider
): ethers.ethers.Contract => {
  return new ethers.Contract(treasuryAddress, treasuryContract.abi, network);
};

export async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  feePayer: Keypair,
  partialSigner?: Keypair
) {
  const recentBlockhash = await connection.getLatestBlockhash();
  const txMessage = new TransactionMessage({
    instructions,
    payerKey: feePayer.publicKey,
    recentBlockhash: recentBlockhash.blockhash,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(txMessage);

  versionedTx.sign(signers);
  if (partialSigner) {
    versionedTx.sign([partialSigner]);
  }

  const txSignature = await connection.sendRawTransaction(
    versionedTx.serialize()
  );

  return txSignature;
}

export const getEthereumHexFormat = (address: string): string => {
  return "0x" + address;
};

export const zeroAddres = "0x0000000000000000000000000000000000000000";

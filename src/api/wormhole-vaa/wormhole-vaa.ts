import { post } from "../request.api";

export const SAVE_VAA = "/save-vaa";
export const WORMHOLE_VAAS = "/wormhole-vaas";
export const VAA = "/vaa";

export interface IWormholeDto {
  address: string;
  vaa: string;
  status: WormholeVaaStatus;
  action: WormholeAction;
}

export enum WormholeVaaStatus {
  Failed,
  Succeded,
}
export enum WormholeAction {
  CreateTreasury,
  AddMember,
  WithdrawFunds,
  TransferFunds,
  Deposit,
  SellShares,
}

export const saveVaa = (vaa: IWormholeDto) => {
  return post(WORMHOLE_VAAS + SAVE_VAA, vaa);
};

export enum EvmToSolanaAction {
  Deposit,
  SellShares,
}

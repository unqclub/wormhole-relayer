import { post } from "../request.api";

export const SAVE_VAA = "/save-vaa";

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
}

export const saveVaa = (vaa: IWormholeDto) => {
  return post(SAVE_VAA, vaa);
};

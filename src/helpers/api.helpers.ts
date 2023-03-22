import {
  parseVaa,
  SignedVaa,
  tryUint8ArrayToNative,
} from "@certusone/wormhole-sdk";
import {
  IWormholeDto,
  saveVaa,
  WormholeAction,
  WormholeVaaStatus,
} from "src/api/wormhole-vaa/wormhole-vaa";

export const storeVaaInDatabase = async (
  vaa: any,
  status: WormholeVaaStatus
) => {
  const deserializedVaa = parseVaa(Buffer.from(vaa));
  const action = deserializedVaa.payload[0] as WormholeAction;

  const address = tryUint8ArrayToNative(
    deserializedVaa.payload.subarray(1, 32),
    "solana"
  );

  const dto: IWormholeDto = {
    action: action,
    address,
    status,
    vaa,
  };

  await saveVaa(dto);
};

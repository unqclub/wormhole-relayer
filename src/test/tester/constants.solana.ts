import { serialize } from "borsh";
import * as anchor from "@project-serum/anchor";
export enum ClubAction {
  CastVote,
  CreateDiscussionProposal,
  CreateTreasuryGovernance,
  CreateWithdrawalGovernance,
  CreateTransferGovernance,
  CreateP2PProposal,
  CreateWithdrawalProposal,
  CreateTransferProposal,
  CreateMeProposal,
  SignOffProposal,
  CancelProposal,
  AllowMember,
  CancelP2POffer,
  CancelInvitation,
  Fundraise,
  Distribute,
  SupportClub,
  UpdateMember,
  InitializeStaking,
  StakeTokens,
  CreateFinancialOffer,
  AcceptFinancialOffer,
  CreateSolseaProposal,
  CreateChangeClubConfigGovernance,
  UpdateGovernanceConfig,
  UpdateRoleConfig,
  AddReservedRights,
  UpdateAllocation,
  AddReservedRightsToSelf,
}

export class RoleDto {
  name: string;
  roleWeight: anchor.BN;
  clubActions: Uint8Array;
  membersCount: number;
  constructor(
    name: string,
    roleWeight: anchor.BN,
    clubActions: ClubAction[],
    membersCount?: number
  ) {
    this.name = name;
    this.roleWeight = roleWeight;
    this.clubActions = new Uint8Array(clubActions);
    this.membersCount = membersCount;
  }

  serializeObj() {
    const schema = new Map([
      [
        RoleDto,
        {
          kind: "struct",
          fields: [
            ["name", "string"],
            ["roleWeight", "u64"],
            ["clubActions", [this.clubActions.length]],
            ["membersCount", "u32"],
          ],
        },
      ],
    ]);

    return serialize(schema, this);
  }
  static getOwnerRole(): string {
    return this.getDefaultRoleConifg()[0].name;
  }

  static getDefaultRoleConifg(): RoleDto[] {
    return [
      new RoleDto("Owner", new anchor.BN(500), this.getAllClubActions(), 0),
      new RoleDto("Curator", new anchor.BN(300), this.getAllClubActions(), 0),
      new RoleDto("Member", new anchor.BN(200), this.getAllClubActions(), 0),
    ];
  }

  static getDefaultSerializedRoleConifg(): Uint8Array[] {
    return [
      this.getDefaultRoleConifg()[0].serializeObj(),
      this.getDefaultRoleConifg()[1].serializeObj(),
      this.getDefaultRoleConifg()[2].serializeObj(),
    ];
  }

  static serializeArray(arr: RoleDto[]) {
    return arr.map((x) => x.serializeObj());
  }

  static getAllClubActions() {
    return [
      ClubAction.CastVote,
      ClubAction.CreateDiscussionProposal,
      ClubAction.CreateTreasuryGovernance,
      ClubAction.CreateWithdrawalGovernance,
      ClubAction.CreateTransferGovernance,
      ClubAction.CreateP2PProposal,
      ClubAction.CreateWithdrawalProposal,
      ClubAction.CreateTransferProposal,
      ClubAction.CreateMeProposal,
      ClubAction.SignOffProposal,
      ClubAction.CancelProposal,
      ClubAction.AllowMember,
      ClubAction.CancelP2POffer,
      ClubAction.CancelInvitation,
      ClubAction.Fundraise,
      ClubAction.Distribute,
      ClubAction.SupportClub,
      ClubAction.UpdateMember,
      ClubAction.InitializeStaking,
      ClubAction.StakeTokens,
      ClubAction.CreateFinancialOffer,
      ClubAction.AcceptFinancialOffer,
      ClubAction.CreateSolseaProposal,
      ClubAction.UpdateGovernanceConfig,
      ClubAction.UpdateRoleConfig,
      ClubAction.CreateChangeClubConfigGovernance,
      ClubAction.AddReservedRights,
      ClubAction.UpdateAllocation,
      ClubAction.AddReservedRightsToSelf,
    ];
  }
}

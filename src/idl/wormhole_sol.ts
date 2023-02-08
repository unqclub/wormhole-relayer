export type WormholeSol = {
  version: "0.1.0";
  name: "wormhole_sol";
  instructions: [
    {
      name: "emitWormholeMessage";
      accounts: [
        {
          name: "messageConifg";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "message";
          isMut: true;
          isSigner: false;
          docs: ["CHECK"];
        },
        {
          name: "wormholeConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "emitterAddress";
          isMut: false;
          isSigner: false;
          docs: ["CHECK"];
        },
        {
          name: "feeCollector";
          isMut: true;
          isSigner: false;
          docs: ["CHECK"];
        },
        {
          name: "sequence";
          isMut: true;
          isSigner: false;
          docs: ["CHECK"];
        },
        {
          name: "wormhole";
          isMut: false;
          isSigner: false;
          docs: ["CHECK"];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "payload";
          type: "bytes";
        },
        {
          name: "nonce";
          type: "u32";
        }
      ];
    },
    {
      name: "receiveWormholeMessage";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "message";
          isMut: false;
          isSigner: false;
          docs: ["CHECK"];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "payload";
          type: "bytes";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "messageConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "index";
            type: "u32";
          },
          {
            name: "payer";
            type: "publicKey";
          }
        ];
      };
    },
    {
      name: "messageData";
      type: {
        kind: "struct";
        fields: [
          {
            name: "message";
            type: "string";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "MessagePayload";
      type: {
        kind: "struct";
        fields: [
          {
            name: "payer";
            type: "publicKey";
          },
          {
            name: "counter";
            type: "u64";
          }
        ];
      };
    }
  ];
};

export const IDL: WormholeSol = {
  version: "0.1.0",
  name: "wormhole_sol",
  instructions: [
    {
      name: "emitWormholeMessage",
      accounts: [
        {
          name: "messageConifg",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "message",
          isMut: true,
          isSigner: false,
          docs: ["CHECK"],
        },
        {
          name: "wormholeConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "emitterAddress",
          isMut: false,
          isSigner: false,
          docs: ["CHECK"],
        },
        {
          name: "feeCollector",
          isMut: true,
          isSigner: false,
          docs: ["CHECK"],
        },
        {
          name: "sequence",
          isMut: true,
          isSigner: false,
          docs: ["CHECK"],
        },
        {
          name: "wormhole",
          isMut: false,
          isSigner: false,
          docs: ["CHECK"],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "payload",
          type: "bytes",
        },
        {
          name: "nonce",
          type: "u32",
        },
      ],
    },
    {
      name: "receiveWormholeMessage",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "message",
          isMut: false,
          isSigner: false,
          docs: ["CHECK"],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "payload",
          type: "bytes",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "messageConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "index",
            type: "u32",
          },
          {
            name: "payer",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "messageData",
      type: {
        kind: "struct",
        fields: [
          {
            name: "message",
            type: "string",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "MessagePayload",
      type: {
        kind: "struct",
        fields: [
          {
            name: "payer",
            type: "publicKey",
          },
          {
            name: "counter",
            type: "u64",
          },
        ],
      },
    },
  ],
};

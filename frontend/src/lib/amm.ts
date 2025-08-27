/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/amm.json`.
 */
export type Amm = {
  "address": "HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb",
  "metadata": {
    "name": "amm",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addLiquidity",
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "vaultA",
          "writable": true
        },
        {
          "name": "vaultB",
          "writable": true
        },
        {
          "name": "userAtaA",
          "writable": true
        },
        {
          "name": "userAtaB",
          "writable": true
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "userLpAta",
          "writable": true
        },
        {
          "name": "poolAuth"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amountA",
          "type": "u64"
        },
        {
          "name": "amountB",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializePool",
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mintA"
        },
        {
          "name": "mintB"
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  80,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mintA"
              },
              {
                "kind": "account",
                "path": "mintB"
              }
            ]
          }
        },
        {
          "name": "lpMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "poolAuth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "vaultA",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "vaultB",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "protoFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "removeLiquidity",
      "discriminator": [
        80,
        85,
        209,
        72,
        24,
        206,
        177,
        108
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultA",
          "writable": true
        },
        {
          "name": "vaultB",
          "writable": true
        },
        {
          "name": "userAtaA",
          "writable": true
        },
        {
          "name": "userAtaB",
          "writable": true
        },
        {
          "name": "userLpAta",
          "writable": true
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "poolAuth"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "lpAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swapToken",
      "discriminator": [
        129,
        185,
        52,
        125,
        128,
        42,
        84,
        227
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultA",
          "writable": true
        },
        {
          "name": "vaultB",
          "writable": true
        },
        {
          "name": "userAtaA",
          "writable": true
        },
        {
          "name": "userAtaB",
          "writable": true
        },
        {
          "name": "poolAuth"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minimumOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "pool",
      "discriminator": [
        1
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "noLiquidtyFound",
      "msg": "No Liquidty Found"
    },
    {
      "code": 6001,
      "name": "slippageExceeded",
      "msg": "Slippage exceeded"
    }
  ],
  "types": [
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mintA",
            "type": "pubkey"
          },
          {
            "name": "mintB",
            "type": "pubkey"
          },
          {
            "name": "vaultA",
            "type": "pubkey"
          },
          {
            "name": "vaultB",
            "type": "pubkey"
          },
          {
            "name": "lpMint",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "protoFeeBps",
            "type": "u16"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "bumpPool",
            "type": "u8"
          },
          {
            "name": "bumpAuth",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

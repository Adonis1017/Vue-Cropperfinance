import {
Account,
AccountInfo,
Connection,
PublicKey,
SystemProgram,
Transaction,
SYSVAR_RENT_PUBKEY,
TransactionInstruction
} from '@solana/web3.js'

import { Token, AccountLayout, MintLayout } from "@solana/spl-token";
import { bool, publicKey, struct, u32, u64, u8,  } from '@project-serum/borsh'
import { TOKENS } from '@/utils/tokens'
import {TOKEN_PROGRAM_ID} from '@/utils/ids'
// @ts-ignore
import { nu64, blob } from 'buffer-layout'

export const LIQUIDITY_TOKEN_PRECISION = 8
export const DEFAULT_DENOMINATOR = 10000

export function createSplAccount(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  accountRentExempt: number,
  mint: PublicKey,
  owner: PublicKey,
  space: number
) {
  const account = new Account();
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: accountRentExempt,
      space,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  instructions.push(
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      account.publicKey,
      owner
    )
  );

  return account;
}

export const TokenSwapLayoutLegacyV0 = struct([
  u8("isInitialized"),
  u8("nonce"),
  publicKey("tokenAccountA"),
  publicKey("tokenAccountB"),
  publicKey("tokenPool"),
  u64("feesNumerator"),
  u64("feesDenominator"),
]);

export const AMM_INFO_LAYOUT_V5 =  struct(
  [
    u8('version'),
    u8('isInitialized'),
    u8('nonce'),
    publicKey('ammId'),
    publicKey('dexProgramId'),
    publicKey('serumMarket'),
    publicKey('tokenProgramId'),
    publicKey('poolCoinTokenAccount'),
    publicKey('poolPcTokenAccount'),
    publicKey('lpMintAddress'),
    publicKey('coinMintAddress'),
    publicKey('pcMintAddress'),
    publicKey('feeAccount'),
    u64('swapFeeNumerator'),
    u64('swapFeeDenominator'),
    u64('ownerTradeFeeNumerator'),
    u64('ownerTradeFeeDenominator'),
    u64('ownerWithdrawFeeNumerator'),
    u64('ownerWithdrawFeeDenominator'),
    u64('hostFeeNumerator'),
    u64('hostFeeDenominator'),
    u8('curveType'),
    blob(32, 'curveParameters'),
  ]
);

export const createLiquidityPool = (
  tokenSwapAccount: Account,
  authority: PublicKey,
  ammId:PublicKey,
  tokenAccountA: PublicKey,
  tokenAccountB: PublicKey,
  tokenPool: PublicKey,
  feeAccount: PublicKey,
  tokenAccountPool: PublicKey,
  tokenProgramId: PublicKey,
  swapProgramId: PublicKey,
  dexProgramId: PublicKey,
  marketId:PublicKey,
  nonce: number,
  curveType: number,
  tradeFeeNumerator: number,
  tradeFeeDenominator: number,
  ownerTradeFeeNumerator: number,
  ownerTradeFeeDenominator: number,
  ownerWithdrawFeeNumerator: number,
  ownerWithdrawFeeDenominator: number,
  hostFeeNumerator: number,
  hostFeeDenominator: number
): TransactionInstruction => {
  const keys = [
    { pubkey: tokenSwapAccount.publicKey, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: ammId, isSigner: false, isWritable: false },
    { pubkey: tokenAccountA, isSigner: false, isWritable: false },
    { pubkey: tokenAccountB, isSigner: false, isWritable: false },
    { pubkey: tokenPool, isSigner: false, isWritable: true },
    { pubkey: feeAccount, isSigner: false, isWritable: false },
    { pubkey: tokenAccountPool, isSigner: false, isWritable: true },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    
    { pubkey: dexProgramId, isSigner: false, isWritable: true },
    { pubkey: marketId, isSigner: false, isWritable: false },
  ];

  const commandDataLayout = struct([
    u8("instruction"),
    u8("nonce"),
    nu64("tradeFeeNumerator"),
    nu64("tradeFeeDenominator"),
    nu64("ownerTradeFeeNumerator"),
    nu64("ownerTradeFeeDenominator"),
    nu64("ownerWithdrawFeeNumerator"),
    nu64("ownerWithdrawFeeDenominator"),
    nu64('hostFeeNumerator'),
    nu64('hostFeeDenominator'),
    u8("curveType"),
    blob(32, 'curveParameters'),
  ]);
  let data = Buffer.alloc(1024);
  {
    const encodeLength = commandDataLayout.encode(
      {
        instruction: 0, // InitializeSwap instruction
        nonce,
        tradeFeeNumerator,
        tradeFeeDenominator,
        ownerTradeFeeNumerator,
        ownerTradeFeeDenominator,
        ownerWithdrawFeeNumerator,
        ownerWithdrawFeeDenominator,
        hostFeeNumerator,
        hostFeeDenominator,
        curveType,
      },
      data
    );
    data = data.slice(0, encodeLength);
  }
  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  });
};

export const depositInstruction = (
  tokenSwap: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  sourceA: PublicKey,
  sourceB: PublicKey,
  intoA: PublicKey,
  intoB: PublicKey,
  poolToken: PublicKey,
  poolAccount: PublicKey,
  swapProgramId: PublicKey,
  tokenProgramId: PublicKey,
  poolTokenAmount: number,
  maximumTokenA: number,
  maximumTokenB: number
): TransactionInstruction => {
  const dataLayout = struct([
    u8("instruction"),
    nu64("poolTokenAmount"),
    nu64("maximumTokenA"),
    nu64("maximumTokenB"),
  ]);
  let data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 2, // Deposit instruction
      poolTokenAmount,
      maximumTokenA,
      maximumTokenB

    },
    data
  );

  const keys = [
    { pubkey: tokenSwap, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: sourceA, isSigner: false, isWritable: true },
    { pubkey: sourceB, isSigner: false, isWritable: true },
    { pubkey: intoA, isSigner: false, isWritable: true },
    { pubkey: intoB, isSigner: false, isWritable: true },
    { pubkey: poolToken, isSigner: false, isWritable: true },
    { pubkey: poolAccount, isSigner: false, isWritable: true },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  });
};

export const withdrawInstruction = (
  tokenSwap: PublicKey,
  authority: PublicKey,
  poolMint: PublicKey,
  feeAccount: PublicKey | undefined,
  sourcePoolAccount: PublicKey,
  fromA: PublicKey,
  fromB: PublicKey,
  userAccountA: PublicKey,
  userAccountB: PublicKey,
  swapProgramId: PublicKey,
  tokenProgramId: PublicKey,
  poolTokenAmount: number | nu64,
  minimumTokenA: number | nu64,
  minimumTokenB: number | nu64
): TransactionInstruction => {
  const dataLayout = struct([
    u8("instruction"),
    u64("poolTokenAmount"),
    u64("minimumTokenA"),
    u64("minimumTokenB"),
  ]);

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 3, // Withdraw instruction
      poolTokenAmount: new nu64(poolTokenAmount).toBuffer(),
      minimumTokenA: new nu64(minimumTokenA).toBuffer(),
      minimumTokenB: new nu64(minimumTokenB).toBuffer(),
    },
    data
  );

  const keys = [
    { pubkey: tokenSwap, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: poolMint, isSigner: false, isWritable: true },
    { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
    { pubkey: fromA, isSigner: false, isWritable: true },
    { pubkey: fromB, isSigner: false, isWritable: true },
    { pubkey: userAccountA, isSigner: false, isWritable: true },
    { pubkey: userAccountB, isSigner: false, isWritable: true },
  ];

  if (feeAccount) {
    keys.push({ pubkey: feeAccount, isSigner: false, isWritable: true });
  }
  keys.push({ pubkey: tokenProgramId, isSigner: false, isWritable: false });

  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  });
};

export const swapInstruction = (
  tokenSwap: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  userSource: PublicKey,
  poolSource: PublicKey,
  poolDestination: PublicKey,
  userDestination: PublicKey,
  poolMint: PublicKey,
  feeAccount: PublicKey,
  swapProgramId: PublicKey,
  tokenProgramId: PublicKey,
  amountIn: number | nu64,
  minimumAmountOut: number | nu64,
  programOwner?: PublicKey
): TransactionInstruction => {
  const dataLayout = struct([
    u8("instruction"),
    u64("amountIn"),
    u64("minimumAmountOut"),
  ]);

  const keys = [
    { pubkey: tokenSwap, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: userSource, isSigner: false, isWritable: true },
    { pubkey: poolSource, isSigner: false, isWritable: true },
    { pubkey: poolDestination, isSigner: false, isWritable: true },
    { pubkey: userDestination, isSigner: false, isWritable: true },
    { pubkey: poolMint, isSigner: false, isWritable: true },
    { pubkey: feeAccount, isSigner: false, isWritable: true },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
  ];

  // optional depending on the build of token-swap program
  if (programOwner) {
    keys.push({ pubkey: programOwner, isSigner: false, isWritable: true });
  }

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 1, // Swap instruction
      amountIn: new nu64(amountIn).toBuffer(),
      minimumAmountOut: new nu64(minimumAmountOut).toBuffer(),
    },
    data
  );

  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  });
};
  
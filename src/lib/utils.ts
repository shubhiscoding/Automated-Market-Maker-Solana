import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { AccountRole, IInstruction } from '@solana/instructions';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { Address } from '@solana/addresses';

export function fromLegacyPublicKey<TAddress extends string>(publicKey: PublicKey): Address<TAddress> {
    return publicKey.toBase58() as Address<TAddress>;
}
export function fromLegacyTransactionInstruction(legacyInstruction: TransactionInstruction): IInstruction {
    const data = legacyInstruction.data?.byteLength > 0 ? Uint8Array.from(legacyInstruction.data) : undefined;
    const accounts = legacyInstruction.keys.map(accountMeta =>
        Object.freeze({
            address: fromLegacyPublicKey(accountMeta.pubkey),
            role: determineRole(accountMeta.isSigner, accountMeta.isWritable),
        }),
    );
    const programAddress = fromLegacyPublicKey(legacyInstruction.programId);
    return Object.freeze({
        ...(accounts.length ? { accounts: Object.freeze(accounts) } : null),
        ...(data ? { data } : null),
        programAddress,
    });
}

function determineRole(isSigner: boolean, isWritable: boolean): AccountRole {
    if (isSigner && isWritable) return AccountRole.WRITABLE_SIGNER;
    if (isSigner) return AccountRole.READONLY_SIGNER;
    if (isWritable) return AccountRole.WRITABLE;
    return AccountRole.READONLY;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ellipsify(str = '', len = 4, delimiter = '..') {
  const strLen = str.length
  const limit = len * 2 + delimiter.length

  return strLen >= limit ? str.substring(0, len) + delimiter + str.substring(strLen - len, strLen) : str
}

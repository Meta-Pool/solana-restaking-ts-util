import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
    TransactionInstruction,
} from "@solana/web3.js";
///import { ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import { BN, Provider } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "./associated-token-helper";
import { SPL_TOKEN_PROGRAM_ID, splTokenProgram } from "@coral-xyz/spl-token";

// Function to mint tokens
export async function createAta(provider: Provider, wallet: any, mint: PublicKey, recipient: PublicKey)
    : Promise<PublicKey> {

    const connection: Connection = provider.connection

    const instructions: TransactionInstruction[] = [];

    // 1. Get the associated token account address for the recipient
    const associatedTokenAddress = await getAssociatedTokenAddressSync(mint, recipient);
    console.log("associatedTokenAddress", associatedTokenAddress.toBase58())

    instructions.push(createAssociatedTokenAccountIdempotentInstruction(
        wallet.payer.publicKey,
        associatedTokenAddress,
        recipient,
        mint,
        SPL_TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    ));

    const tx = new Transaction(await connection.getLatestBlockhash());
    tx.feePayer = wallet.payer.publicKey
    tx.add(...instructions);

    // simulate
    try {
        await provider.simulate(tx)
    } catch (ex) {
        console.log(ex)
        throw (ex)
    }

    // Sign the transaction
    tx.partialSign(wallet.payer);

    // Send and confirm the transaction
    //const signature = await sendAndConfirmTransaction(connection, tx);
    //console.log("send and confirm mint-to");
    const signature = await provider.sendAndConfirm(tx);
    //console.log("Transaction signature:", signature);

    return associatedTokenAddress
}

// Function to send transaction with local nodejs wallet
export async function sendTx(provider: Provider, wallet: any, instructions: TransactionInstruction[])
    : Promise<string> {
    const connection: Connection = provider.connection
    const tx = new Transaction(await connection.getLatestBlockhash());
    tx.feePayer = wallet.payer.publicKey
    tx.add(...instructions);
    tx.partialSign(wallet.payer);
    // try {
    //     await provider.simulate(tx)
    // } catch (ex) {
    //     console.log(ex)
    // }
    try {
        await provider.simulate(tx);
    }
    catch (ex) {
        console.log("sendTx err", ex)
    }
    const txHash = await provider.sendAndConfirm(tx);
    //console.log("Transaction signature:", signature);
    return txHash
}

// Function to mint tokens
export async function mintTokens(provider: Provider, 
    wallet: any, 
    mint: PublicKey, 
    recipient: PublicKey, 
    amountBN: BN)
    : Promise<PublicKey> {

    const connection: Connection = provider.connection

    const instructions: TransactionInstruction[] = [];

    // 1. Get the associated token account address for the recipient
    const associatedTokenAddress = await getAssociatedTokenAddressSync(mint, recipient);

    instructions.push(createAssociatedTokenAccountIdempotentInstruction(
        wallet.payer.publicKey,
        associatedTokenAddress,
        recipient,
        mint,
        SPL_TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    ));

    // 3. Mint tokens to the associated token account
    let splToken = splTokenProgram()
    instructions.push(
        await
            splToken.methods.mintTo(amountBN)
            .accounts({
                mint, owner: wallet.pubkey,
            })
            .instruction()
    );
    //    createMintToInstruction(mint, associatedTokenAddress, wallet.publicKey, amount)

    console.log("send and confirm mint-to");
    // simulate, send and confirm the transaction
    await sendTx(provider, wallet, instructions)

    console.log(`Minted ${amountBN} tokens to ${recipient}`);

    return associatedTokenAddress
}

export async function getTokenAccountBalance(provider: Provider, tokenAccount: PublicKey): Promise<string> {
    let result = await provider.connection.getTokenAccountBalance(tokenAccount)
    return result.value.amount
}

export async function getTokenMintSupply(provider: Provider, mintAccount: PublicKey): Promise<string> {
    let result = await provider.connection.getTokenSupply(mintAccount)
    return result.value.amount
}
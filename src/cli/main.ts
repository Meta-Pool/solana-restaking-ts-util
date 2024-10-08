import * as anchor from "@coral-xyz/anchor";
import { Program, Idl, AnchorProvider, setProvider } from "@coral-xyz/anchor";
import { MpSolRestaking } from "../res/mp_sol_restaking";
import mpSolRestakingIdl from "../res/mp_sol_restaking.json";

import * as util from "../util/util";
import { SPL_TOKEN_PROGRAM_ID, splTokenProgram } from "@coral-xyz/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "../util/associated-token-helper";
import { formatLamports, formatTokens } from "../util/format";
import { BN } from "bn.js";
import { show, showVaults } from "./show";
import { readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

console.log(process.argv)

// MARINADE DEVNET also MAINNET
export const MARINADE_MSOL_MINT = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
export const MARINADE_POOL_PROGRAM = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
export const MARINADE_STATE_ADDRESS = "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC";

export const SPL_STAKE_POOL_PROGRAM = "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy"
// B-SOL DEVNET also MAINNET
export const B_SOL_TOKEN_MINT = "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1"
// JITO-SOL DEVNET also MAINNET
export const JITO_SOL_TOKEN_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"

export type NetworkConfig = {
    rpcUrl: string,
    waitHs: number,
    adminPubkey: string;
    mainStateAddress: string,
    mSolState: string,
    bSolState: string,
    jitoSolState: string | undefined
}

export function getNetworkConfig(network: "mainnet" | "devnet"): NetworkConfig {
    if (network == "mainnet") {
        const rpcUrl = readFileSync(path.join(homedir(), ".config", "solana", "be-rpcpool-token-url")).toString()
        return {
            rpcUrl: rpcUrl||"https://api.mainnet-beta.solana.com",
            waitHs: 10,
            adminPubkey: "MP5o14fjGUU6G562tivBsvUBohqFxiczbWGHrwXDEyQ",
            mainStateAddress: "mpsoLeuCF3LwrJWbzxNd81xRafePFfPhsNvGsAMhUAA",
            mSolState: "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC",
            bSolState: "stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi",
            jitoSolState: "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"
        }
    }
    else //Devnet
    {
        return {
            rpcUrl: "https://api.devnet.solana.com",
            waitHs: 0,
            adminPubkey: "DEVYT7nSvD4gzP6BH2N1ubUamErS4TXtBYwdVrFBBVr",
            mainStateAddress: "mpsoLeuCF3LwrJWbzxNd81xRafePFfPhsNvGsAMhUAA",
            mSolState: "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC",
            bSolState: "azFVdHtAJN8BX3sbGAYkXvtdjdrT5U6rj9rovvUFos9",
            jitoSolState: undefined
        }

    }
}

export type Context = {
    program: anchor.Program<MpSolRestaking>,
    wallet: anchor.Wallet,
    operatorAuthKeyPair: anchor.Wallet; strategyRebalancerAuthKeyPair: anchor.Wallet;
    mainStateWalletProvider: anchor.AnchorProvider, mpSolMintWalletProvider: anchor.AnchorProvider
}

export function getContext(networkConfig: NetworkConfig): Context {

    const provider = util.getNodeFileWalletProvider(
        networkConfig.adminPubkey,
        networkConfig.rpcUrl)
    const wallet = provider.wallet;
    anchor.setProvider(provider)

    const operatorAuthKeyPair = provider.wallet;
    const strategyRebalancerAuthKeyPair = provider.wallet;

    const program: Program<MpSolRestaking> = new Program<MpSolRestaking>(mpSolRestakingIdl as MpSolRestaking, provider)

    const mainStateWalletProvider = util.getNodeFileWalletProvider("mpsoLeuCF3LwrJWbzxNd81xRafePFfPhsNvGsAMhUAA")
    const mpSolMintWalletProvider = util.getNodeFileWalletProvider("mPsoLV53uAGXnPJw63W91t2VDqCVZcU5rTh3PWzxnLr")
    console.log("main state address", mainStateWalletProvider.wallet.publicKey.toBase58())

    return {
        program,
        wallet: wallet as unknown as anchor.Wallet,
        operatorAuthKeyPair: operatorAuthKeyPair as unknown as anchor.Wallet,
        strategyRebalancerAuthKeyPair: strategyRebalancerAuthKeyPair as unknown as anchor.Wallet,
        mainStateWalletProvider, mpSolMintWalletProvider
    }
}


asyncMain()

async function asyncMain() {

    let network;
    if (process.argv.includes("mainnet")) {
        network = "mainnet"
    } else if (process.argv.includes("devnet")) {
        network = "devnet"
    } else {
        throw new Error("missing arg mainnet|devnet to select network")
    }
    console.log("network", network)
    const networkConfig = getNetworkConfig(network)
    console.log("rpc", networkConfig.rpcUrl)
    const ctx = getContext(networkConfig)

    if (process.argv.includes("init-state")) {
        await createMainState(ctx)
    }
    else if (process.argv.includes("show")) {
        await show(networkConfig, ctx)
    }
    else if (process.argv.includes("show-vaults")) {
        await showVaults(networkConfig, ctx)
    }
    else if (process.argv.includes("init-metadata")) {
        await initMetadata(ctx)
    }
    else if (process.argv.includes("create-treasury")) {
        await createMpSolTreasuryAccount(ctx)
    }
    else if (process.argv.includes("create-temp-accounts")) {
        await createMpSolTempTransferAccounts(ctx)
    }
    else if (process.argv.includes("set-treasury")) {
        const index = process.argv.findIndex(x => x == "set-treasury")
        const pubkeyString = process.argv[index + 1]
        await configMpSolTreasuryAccount(ctx, pubkeyString)
    }
    else if (process.argv.includes("create-msol-vault")) {
        await createSecondaryVault(
            ctx,
            ctx.mainStateWalletProvider.wallet.publicKey,
            "mSOL",
            MARINADE_MSOL_MINT
        )
    }
    else if (process.argv.includes("config-msol")) {
        await configVaultOnMainnet(ctx, MARINADE_MSOL_MINT)
    }
    else if (process.argv.includes("create-bsol-vault")) {
        await createSecondaryVault(
            ctx,
            ctx.mainStateWalletProvider.wallet.publicKey,
            "bSOL",
            B_SOL_TOKEN_MINT
        )
    }
    else if (process.argv.includes("config-bsol")) {
        await configVaultOnMainnet(ctx, B_SOL_TOKEN_MINT)
    }
    else if (process.argv.includes("crate-jitosol-vault")) {
        await createSecondaryVault(
            ctx,
            ctx.mainStateWalletProvider.wallet.publicKey,
            "JitoSOL",
            JITO_SOL_TOKEN_MINT
        )
        await configVaultOnMainnet(ctx, JITO_SOL_TOKEN_MINT)
        await updateLSTPrices(ctx, networkConfig)
    }
    else if (process.argv.includes("config-jitosol")) {
        await configVaultOnMainnet(ctx, JITO_SOL_TOKEN_MINT)
        await updateLSTPrices(ctx, networkConfig)
    }
    else if (process.argv.includes("update-prices")) {
        await updateLSTPrices(ctx, networkConfig)
    }

    else if (process.argv.includes("config")) {
        await configProtocol(ctx, networkConfig.waitHs)
    }
    else if (process.argv.includes("remove-freeze-auth")) {
        await removeFreezeAuth(ctx)
    }

    else {
        console.error("----")
        console.error("ERR: invalid arguments")
        console.error("----")
        process.exit(1)
    }
}

export type MainStateAccount = anchor.IdlAccounts<MpSolRestaking>["mainVaultState"]


async function createMainState(ctx: Context) {

    // ----------------------
    // initialize main state
    // ----------------------
    let tx = await ctx.program.methods.initialize(
        ctx.operatorAuthKeyPair.publicKey
    )
        .accounts({
            admin: ctx.wallet.publicKey,
            mainState: ctx.mainStateWalletProvider.publicKey,
            mpsolTokenMint: ctx.mpSolMintWalletProvider.publicKey,
        })
        .transaction()

    // simulate
    try {
        const result = await ctx.program.provider.simulate(tx);
        //console.log(result)
    }
    catch (ex) {
        console.log(ex)
        throw (ex)
    }
    await ctx.wallet.signTransaction(tx)
    await ctx.mainStateWalletProvider.wallet.signTransaction(tx)
    await ctx.mpSolMintWalletProvider.wallet.signTransaction(tx)

    const txHash = await
        ctx.program.provider.sendAndConfirm(tx)

    console.log("init main state tx hash", txHash)
    // check main state
    //const mainState = await program.account.mainVaultState.fetch(mainStateWalletProvider.wallet.publicKey);
}

async function initMetadata(ctx: Context) {
    // ----------------------
    // initialize token metadata
    // ----------------------

    const METADATA_SEED = "metadata";
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(METADATA_SEED),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            ctx.mpSolMintWalletProvider.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
    );
    console.log("metadata address", metadataAddress.toBase58())
    const prog = ctx.program
    let tx = await prog.methods
        .initMetadata()
        .accountsPartial({
            admin: ctx.wallet.publicKey,
            mainState: ctx.mainStateWalletProvider.publicKey,
            mpsolMint: ctx.mpSolMintWalletProvider.publicKey,
            metadata: metadataAddress,
        })
        .transaction()

    // simulate
    try {
        const result = await ctx.program.provider.simulate(tx);
        //console.log(result)
    }
    catch (ex) {
        console.log("SIMULATION FAILURE")
        console.log(ex)
        throw ex
    }
    await ctx.wallet.signTransaction(tx)

    console.log("sendAndConfirm...")
    const txHash = await
        ctx.program.provider.sendAndConfirm(tx)

    console.log("init metadata tx hash", txHash)
    // check main state
    //const mainState = await program.account.mainVaultState.fetch(mainStateWalletProvider.wallet.publicKey);
}

//-------------------------------
/// returns vault state address
async function createSecondaryVault(
    ctx: Context,
    mainStatePubKey: PublicKey,
    tokenName: string,
    lstMint: string): Promise<PublicKey> {
    // creating a secondary vault
    console.log(`creating ${tokenName} secondary vault, lstMint:${lstMint}`)
    let lstMintPublickey = new PublicKey(lstMint);
    const [vaultSecondaryStateAddress, wSolSecondaryStateBump] =
        PublicKey.findProgramAddressSync(
            [
                mainStatePubKey.toBuffer(),
                lstMintPublickey.toBuffer(),
            ],
            ctx.program.programId
        )

    console.log(`vaultSecondaryStateAddress ${vaultSecondaryStateAddress.toBase58()}`)

    const [vaultsTokenAtaPdaAuth, vaultsTokenAtaPdaBump] =
        PublicKey.findProgramAddressSync(
            [
                mainStatePubKey.toBuffer(),
                util.idlConstant(ctx.program.idl, "vaultsAtaAuthSeed")
            ],
            ctx.program.programId
        )

    const vaultTokenAccountAddress =
        getAssociatedTokenAddressSync(lstMintPublickey, vaultsTokenAtaPdaAuth, true);

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        ctx.program.provider.publicKey,
        vaultTokenAccountAddress,
        vaultsTokenAtaPdaAuth,
        lstMintPublickey,
        SPL_TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx2 = await ctx.program.methods.createSecondaryVault()
        .accountsPartial({
            admin: ctx.program.provider.publicKey,
            mainState: mainStatePubKey,
            lstMint: lstMintPublickey,
            vaultState: vaultSecondaryStateAddress,
            vaultLstAccount: vaultTokenAccountAddress
        })
        .preInstructions([createAtaIx])
        .rpc();

    return vaultSecondaryStateAddress
}

//-------------------------------
async function createMpSolTreasuryAccount(ctx: Context): Promise<PublicKey> {

    console.log(`creating ATA for owner ${ctx.program.provider.publicKey.toBase58()}, mint ${ctx.mpSolMintWalletProvider.publicKey.toBase58()} to use as MpSolTreasuryAccount`)

    const mpsolAta =
        getAssociatedTokenAddressSync(ctx.mpSolMintWalletProvider.publicKey, ctx.program.provider.publicKey, true);

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        ctx.program.provider.publicKey,
        mpsolAta,
        ctx.program.provider.publicKey,
        ctx.mpSolMintWalletProvider.publicKey,
        SPL_TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const tx = new anchor.web3.Transaction()
    tx.add(createAtaIx)
    const txHash = await ctx.program.provider.sendAndConfirm(tx)
    console.log("tx hash", txHash)

    console.log("MpSolTreasuryAccount", mpsolAta.toBase58())

    return mpsolAta
}

//-------------------------------
async function createMpSolTempTransferAccounts(ctx: Context): Promise<void> {

    const vaultStratWithdrawAtaAuthSeed = util.idlConstant(ctx.program.idl, "vaultStratWithdrawAtaAuthSeed")
    console.log(typeof vaultStratWithdrawAtaAuthSeed)
    let decoder = new TextDecoder()
    console.log(`vaultStratWithdrawAtaAuthSeed: ${decoder.decode(vaultStratWithdrawAtaAuthSeed)}`)
    // get all vault-strategy relations
    const vaultStrategyRelations = await ctx.program.account.vaultStrategyRelationEntry.all()
    let strategiesStates: PublicKey[] = []
    // get unique strategiesStates
    for (const [index, vsr] of vaultStrategyRelations.entries()) {
        let stratCommonState = vsr.account.commonStrategyState
        if (!strategiesStates.find(x => x.equals(stratCommonState))) {
            strategiesStates.push(stratCommonState)
        }
    }
    // -----
    const tx = new anchor.web3.Transaction()
    // for each unique strategy state
    for (let strategyState of strategiesStates) {
        console.log(`strat state: ${strategyState.toBase58()}`)
        /// CHECK: get vault Auth PDA
        /// for temp-ATA to move lst from strat back to the vault
        // #[account(
        //     seeds = [
        //         crate::VAULT_STRAT_WITHDRAW_ATA_AUTH_SEED,
        //         &common_strategy_state.key().to_bytes(),
        //     ],
        //     bump
        // )]
        // pub vault_strat_withdraw_auth: UncheckedAccount<'info>,


        const [vaultStratWithdrawAuth, bump] =
            PublicKey.findProgramAddressSync(
                [
                    vaultStratWithdrawAtaAuthSeed,
                    strategyState.toBuffer(),
                ],
                ctx.program.programId
            )

        console.log(`creating ATA for temp transfer, owner is program-PDA, owner vaultStratWithdrawAuth ${vaultStratWithdrawAuth.toBase58()}, mint ${ctx.mpSolMintWalletProvider.publicKey.toBase58()} to use as temp-transfer`)

        const mpsolAta =
            getAssociatedTokenAddressSync(ctx.mpSolMintWalletProvider.publicKey, vaultStratWithdrawAuth, true);
        console.log("PDA owned ATA for temp transfer", mpsolAta.toBase58())

        const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
            ctx.program.provider.publicKey, // payer
            mpsolAta,
            vaultStratWithdrawAuth, // owner
            ctx.mpSolMintWalletProvider.publicKey, // mint
            SPL_TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        tx.add(createAtaIx)
    }
    console.log("sending transaction")
    const txHash = await ctx.program.provider.sendAndConfirm(tx)
    console.log("tx hash", txHash)
}

async function configMpSolTreasuryAccount(ctx: Context, treasuryAccount: string) {

    const mainStatePubKey = ctx.mainStateWalletProvider.wallet.publicKey
    console.log("config, setTreasury, treasuryMpsolAccount", treasuryAccount)
    let configTx = await ctx.program.methods.configureTreasuryAccount()
        .accountsPartial({
            admin: ctx.wallet.publicKey,
            mainState: mainStatePubKey,
            treasuryMpsolAccount: treasuryAccount,
        })

    // // uncomment to show tx simulation program log
    {
        console.log("configureMainVault.simulate()")
        try {
            let result = await configTx.simulate()
            console.log(result)
        }
        catch (ex) {
            console.log(ex)
        }
    }

    // execute
    const configTxHash = await configTx.rpc()
    console.log("tx hash", configTxHash)
}

async function configVaultOnMainnet(ctx: Context, mint: string) {

    const cap = BigInt(`10000${"0".repeat(9)}`)
    console.log("config, enable deposits for", mint)
    console.log("deposit cap:", formatTokens(cap, 9, 2))
    let configTx = await ctx.program.methods.configureSecondaryVault({
        depositsDisabled: false,
        tokenDepositCap: new BN(cap.toString())
    })
        .accountsPartial({
            admin: ctx.wallet.publicKey,
            mainState: ctx.mainStateWalletProvider.wallet.publicKey,
            lstMint: mint,
        })
        .rpc()
    console.log("tx hash", configTx)
}

// config for main params
async function configMainParams(ctx: Context, hs: number, withdrawFeeBp: number) {
    const mainStatePubKey = ctx.mainStateWalletProvider.wallet.publicKey
    console.log("config,", hs, "hs wait time", withdrawFeeBp, "withdraw_fee_bp")
    let configTx = await ctx.program.methods.configureMainVault({
        unstakeTicketWaitingHours: hs,
        withdrawFeeBp,
        performanceFeeBp: null, // null => None => No change
        newAdminPubkey: null, // null => None => No change
    }
    ).accounts({
        mainState: mainStatePubKey,
    })

    // // uncomment to show tx simulation program log
    {
        console.log("configureMainVault.simulate()")
        try {
            let result = await configTx.simulate()
            console.log(result)
        }
        catch (ex) {
            console.log(ex)
            return
        }
    }

    // execute
    let txHash = await configTx.rpc()
    console.log("txHash", txHash)
}

async function configProtocol(ctx: Context, waitHs: number) {

    await configMainParams(ctx, waitHs, 10);

}

async function updateLSTPrices(ctx: Context, networkConfig: NetworkConfig) {

    console.log("update prices msol, bsol, jitosol")
    let postInstructions = []
    if (networkConfig.bSolState) {
        postInstructions.push(
            await updatePriceBuilder(ctx, B_SOL_TOKEN_MINT, networkConfig.bSolState).instruction()
        );
    }
    if (networkConfig.jitoSolState) {
        postInstructions.push(
            await updatePriceBuilder(ctx, JITO_SOL_TOKEN_MINT, networkConfig.jitoSolState).instruction()
        );
    }
    await updatePriceBuilder(ctx, MARINADE_MSOL_MINT, MARINADE_STATE_ADDRESS)
        .postInstructions(postInstructions)
        .rpc()

}

function updatePriceBuilder(ctx: Context, lstMint: string, stateAccount: string) {
    return ctx.program.methods.updateVaultTokenSolPrice()
        .accountsPartial({
            mainState: ctx.mainStateWalletProvider.wallet.publicKey,
            lstMint: lstMint,
        })
        .remainingAccounts([{
            pubkey: new PublicKey(stateAccount), isSigner: false, isWritable: false
        }])
}

// config for main params
async function removeFreezeAuth(ctx: Context) {
    const mainStatePubKey = ctx.mainStateWalletProvider.wallet.publicKey
    console.log("removeFreezeAuth")
    let txBuilder = await ctx.program.methods.removeFreezeAuth()
        .accounts({
            mainState: mainStatePubKey,
        })

    // // uncomment to show tx simulation program log
    {
        console.log("removeFreezeAuth.simulate()")
        try {
            let result = await txBuilder.simulate()
            console.log(result)
        }
        catch (ex) {
            console.log(ex)
            return
        }
    }

    // execute
    await txBuilder.rpc()
}

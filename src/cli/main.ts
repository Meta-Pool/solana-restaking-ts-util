import * as anchor from "@coral-xyz/anchor";
import { MpSolRestaking } from "../res/mp_sol_restaking";
import mpSolRestakingIdl from "../res/mp_sol_restaking.json";

import * as util from "../util/util";
import { SPL_TOKEN_PROGRAM_ID, splTokenProgram } from "@coral-xyz/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "../util/associated-token-helper";
import { formatLamports, formatTokens } from "../util/format";
import { BN } from "bn.js";

console.log(process.argv)

// MARINADE DEVNET also MAINNET
const MARINADE_MSOL_MINT = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
const MARINADE_POOL_PROGRAM = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
const MARINADE_STATE_ADDRESS = "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC";

const SPL_STAKE_POOL_PROGRAM = "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy"
// B-SOL DEVNET also MAINNET
const B_SOL_TOKEN_MINT = "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1"
// JITO-SOL DEVNET also MAINNET
const JITO_SOL_TOKEN_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"

type NetworkConfig = {
    rpcUrl: string,
    adminPubkey: string;
    mainStateAddress: string,
    mSolState: string,
    bSolState: string,
    jitoSolState: string | undefined
}

function getNetworkConfig(network: "mainnet" | "devnet"): NetworkConfig {
    if (network == "mainnet") {
        return {
            rpcUrl: "https://api.mainnet-beta.solana.com",
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
            adminPubkey: "DEVYT7nSvD4gzP6BH2N1ubUamErS4TXtBYwdVrFBBVr",
            mainStateAddress: "mpsoLeuCF3LwrJWbzxNd81xRafePFfPhsNvGsAMhUAA",
            mSolState: "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC",
            bSolState: "azFVdHtAJN8BX3sbGAYkXvtdjdrT5U6rj9rovvUFos9",
            jitoSolState: undefined
        }

    }
}

type Context = {
    program: anchor.Program<anchor.Idl>,
    wallet: anchor.Wallet,
    operatorAuthKeyPair: anchor.Wallet; strategyRebalancerAuthKeyPair: anchor.Wallet;
    mainStateWalletProvider: anchor.AnchorProvider, mpSolMintWalletProvider: anchor.AnchorProvider
}

function getContext(networkConfig: NetworkConfig): Context {

    const provider = util.getNodeFileWalletProvider(
        networkConfig.adminPubkey,
        networkConfig.rpcUrl)
    const wallet = provider.wallet;
    anchor.setProvider(provider)

    const operatorAuthKeyPair = provider.wallet;
    const strategyRebalancerAuthKeyPair = provider.wallet;

    const program = new anchor.Program(mpSolRestakingIdl as anchor.Idl, provider)

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
    else if (process.argv.includes("init-metadata")) {
        await initMetadata(ctx)
    }
    else if (process.argv.includes("create-treasury")) {
        await createMpSolTreasuryAccount(ctx)
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
        await configProtocol(ctx)
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

type MainStateAccount = anchor.IdlAccounts<MpSolRestaking>["mainVaultState"]

export async function show(networkConfig: NetworkConfig, ctx: Context) {

    const MP_SOL_MAIN_STATE = networkConfig.mainStateAddress
    console.log("main", MP_SOL_MAIN_STATE)

    let globalMainState: MainStateAccount
    globalMainState = await ctx.program.account["mainVaultState"].fetch(MP_SOL_MAIN_STATE)

    console.log("admin", globalMainState.admin.toBase58())
    console.log("unstakeTicketWaitingHours", globalMainState.unstakeTicketWaitingHours)
    console.log("performanceFeeBp", globalMainState.performanceFeeBp)
    console.log("withdrawFeeBp", globalMainState.withdrawFeeBp)
    console.log("mpSOL mint", globalMainState.mpsolMint.toBase58())
    console.log("treasuryMpsolAccount", globalMainState.treasuryMpsolAccount?.toBase58())
    console.log("operatorAuth", globalMainState.operatorAuth.toBase58())
    console.log("outstandingTicketsSolValue", formatLamports(globalMainState.outstandingTicketsSolValue))

}

async function createMainState(ctx: Context) {

    // ----------------------
    // initialize main state
    // ----------------------
    let tx = await ctx.program.methods.initialize(
        ctx.operatorAuthKeyPair.publicKey, ctx.strategyRebalancerAuthKeyPair.publicKey
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
    let tx = await ctx.program.methods.initMetadata()
        .accounts({
            admin: ctx.wallet.publicKey,
            mainState: ctx.mainStateWalletProvider.publicKey,
            mpsolTokenMint: ctx.mpSolMintWalletProvider.publicKey,
            metadata: metadataAddress
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
        .accounts({
            // @ts-ignore
            admin: wallet.publicKey,
            mainState: mainStatePubKey,
            lstMint: lstMintPublickey,
            secondaryState: vaultSecondaryStateAddress,
            vaultLstAccount: vaultTokenAccountAddress
        })
        .preInstructions([createAtaIx])
        .rpc();

    return vaultSecondaryStateAddress
}

//-------------------------------
/// returns vault state address
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

async function configMpSolTreasuryAccount(ctx: Context, treasuryAccount: string) {

    const mainStatePubKey = ctx.mainStateWalletProvider.wallet.publicKey
    console.log("config, setTreasury, treasuryMpsolAccount", treasuryAccount)
    let configTx = await ctx.program.methods.configureTreasuryAccount()
    .accounts({
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
        .accounts({
            admin: ctx.wallet.publicKey,
            mainState: ctx.mainStateWalletProvider.wallet.publicKey,
            lstMint: new PublicKey(mint),
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
        treasuryMpsolAccount: null, // null => None => No change
        withdrawFeeBp,
        performanceFeeBp: null, // null => None => No change
        newAdminPubkey: null, // null => None => No change
    }
    ).accounts({
        admin: ctx.wallet.publicKey,
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
    await configTx.rpc()
}

async function configProtocol(ctx: Context) {

    await configMainParams(ctx, 0, 10);

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
        .accounts({
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
            admin: ctx.wallet.publicKey,
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

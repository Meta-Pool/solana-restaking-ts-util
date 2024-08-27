import * as anchor from "@coral-xyz/anchor";
import { MpSolRestaking } from "../types/mp_sol_restaking";
import mpSolRestakingIdl from "../idl/mp_sol_restaking.json";

import * as util from "../util/util";
import { SPL_TOKEN_PROGRAM_ID, splTokenProgram } from "@coral-xyz/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "../util/associated-token-helper";
import { formatTokens } from "../util/format";
import { BN } from "bn.js";

process.env.ANCHOR_WALLET
const provider = util.getNodeFileWalletProvider(
    "MP5o14fjGUU6G562tivBsvUBohqFxiczbWGHrwXDEyQ",
    "https://api.mainnet-beta.solana.com")
const wallet = provider.wallet;
anchor.setProvider(provider)

const operatorAuthKeyPair = provider.wallet;
const strategyRebalancerAuthKeyPair = provider.wallet;

const program = new anchor.Program(mpSolRestakingIdl as anchor.Idl, provider)

const mainStateWalletProvider = util.getNodeFileWalletProvider("mpsoLeuCF3LwrJWbzxNd81xRafePFfPhsNvGsAMhUAA")
const mpSolMintWalletProvider = util.getNodeFileWalletProvider("mPsoLV53uAGXnPJw63W91t2VDqCVZcU5rTh3PWzxnLr")
console.log(process.argv)
console.log("main state address", mainStateWalletProvider.wallet.publicKey.toBase58())

// MARINADE DEVNET also MAINNET
const MARINADE_MSOL_MINT = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
const MARINADE_POOL_PROGRAM = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
const MARINADE_STATE_ADDRESS = "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC";

// B-SOL DEVNET also MAINNET
const SPL_STAKE_POOL_PROGRAM = "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy"
const B_SOL_TOKEN_MINT = "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1"
// B-SOL MAINNET
const B_SOL_SPL_STAKE_POOL_STATE_ADDRESS = "stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi"

asyncMain()

async function asyncMain() {
    if (process.argv.includes("main")) {
        await createMainState()
    }
    else if (process.argv.includes("create-treasury")) {
        await createMpSolTreasuryAccount()
    }
    else if (process.argv.includes("set-treasury")) {
        const index = process.argv.findIndex(x=>x=="set-treasury")
        const pubkeyString = process.argv[index+1]
        await configMpSolTreasuryAccount(pubkeyString)
    }
    else if (process.argv.includes("msol")) {
        await createSecondaryVault(
            mainStateWalletProvider.wallet.publicKey,
            "mSOL",
            MARINADE_MSOL_MINT
        )
    }
    else if (process.argv.includes("config-msol")) {
        await configMainnetVault(MARINADE_MSOL_MINT)
    }
    else if (process.argv.includes("update-msol")) {
        await updatePrice(MARINADE_MSOL_MINT, MARINADE_STATE_ADDRESS)
    }
    else if (process.argv.includes("bsol")) {
        await createSecondaryVault(
            mainStateWalletProvider.wallet.publicKey,
            "bSOL",
            B_SOL_TOKEN_MINT
        )
    }
    else if (process.argv.includes("config-mainnet")) {
        await configMainnet()
    }
    else if (process.argv.includes("update-prices")) {
        await updateLSTPrices()
    }
    else {
        console.error("----")
        console.error("ERR: expected argument: main|msol|bsol")
        console.error("----")
    }
}

async function createMainState() {

    // ----------------------
    // initialize main state
    // ----------------------
    let tx = await program.methods.initialize(
        operatorAuthKeyPair.publicKey, strategyRebalancerAuthKeyPair.publicKey
    )
        .accounts({
            admin: wallet.publicKey,
            mainState: mainStateWalletProvider.publicKey,
            mpsolTokenMint: mpSolMintWalletProvider.publicKey,
        })
        .transaction()

    // simulate
    try {
        const result = await provider.simulate(tx);
        //console.log(result)
    }
    catch (ex) {
        console.log(ex)
        throw (ex)
    }
    await wallet.signTransaction(tx)
    await mainStateWalletProvider.wallet.signTransaction(tx)
    await mpSolMintWalletProvider.wallet.signTransaction(tx)

    const txHash = await
        provider.sendAndConfirm(tx)

    console.log("init main state tx hash", txHash)
    // check main state
    //const mainState = await program.account.mainVaultState.fetch(mainStateWalletProvider.wallet.publicKey);
}


//-------------------------------
/// returns vault state address
async function createSecondaryVault(
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
            program.programId
        )

    console.log(`vaultSecondaryStateAddress ${vaultSecondaryStateAddress.toBase58()}`)

    const [vaultsTokenAtaPdaAuth, vaultsTokenAtaPdaBump] =
        PublicKey.findProgramAddressSync(
            [
                mainStatePubKey.toBuffer(),
                util.idlConstant(program.idl, "vaultsAtaAuthSeed")
            ],
            program.programId
        )

    const vaultTokenAccountAddress =
        getAssociatedTokenAddressSync(lstMintPublickey, vaultsTokenAtaPdaAuth, true);

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        program.provider.publicKey,
        vaultTokenAccountAddress,
        vaultsTokenAtaPdaAuth,
        lstMintPublickey,
        SPL_TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx2 = await program.methods.createSecondaryVault()
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
async function createMpSolTreasuryAccount() {

    console.log(`creating ATA for owner ${provider.publicKey.toBase58()}, mint ${mpSolMintWalletProvider.publicKey.toBase58()} to use as MpSolTreasuryAccount`)

    const mpsolAta =
        getAssociatedTokenAddressSync(mpSolMintWalletProvider.publicKey, provider.publicKey, true);

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        program.provider.publicKey,
        mpsolAta,
        provider.publicKey,
        mpSolMintWalletProvider.publicKey,
        SPL_TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const tx = new anchor.web3.Transaction()
    tx.add(createAtaIx)
    const txHash = await provider.sendAndConfirm(tx)
    console.log("tx hash", txHash)

    console.log("MpSolTreasuryAccount", mpsolAta.toBase58())
}

async function configMpSolTreasuryAccount(treasuryAccount: string) {

    const mainStatePubKey = mainStateWalletProvider.wallet.publicKey
    console.log("config, setTreasury, treasuryMpsolAccount", treasuryAccount)
    let configTx = await program.methods.configureMainVault({
        unstakeTicketWaitingHours: null, // null => None => No change
        treasuryMpsolAccount: new anchor.web3.PublicKey(treasuryAccount),
        performanceFeeBp: null, // null => None => No change
        newAdminPubkey: null, // null => None => No change
    }
    ).accounts({
        admin: wallet.publicKey,
        mainState: mainStatePubKey,
    })

    // // uncomment to show tx simulation program log
    // {
    //   console.log("configureMainVault.simulate()")
    //   try {
    //     let result = await configTx.simulate()
    //     console.log(result)
    //   }
    //   catch (ex) {
    //     console.log(ex)
    //   }
    // }

    // execute
    const configTxHash = await configTx.rpc()
    console.log("tx hash", configTxHash)
}

async function configMainnetVault(mint: string) {

    const cap = BigInt(`10000${"0".repeat(9)}`)
    console.log("config, enable deposits for", mint)
    console.log("deposit cap:", formatTokens(cap, 9, 2))
    let configTx = await program.methods.configureSecondaryVault({
        depositsDisabled: false,
        tokenDepositCap: new BN(cap.toString())
    })
        .accounts({
            admin: wallet.publicKey,
            mainState: mainStateWalletProvider.wallet.publicKey,
            lstMint: new PublicKey(mint),
        })
        .rpc()
    console.log("tx hash", configTx)
}

// config for 0hs waiting time
async function configWaitTimeHours(hs: number) {
    const mainStatePubKey = mainStateWalletProvider.wallet.publicKey
    console.log("config,", hs, "hs wait time")
    let configTx = await program.methods.configureMainVault({
        unstakeTicketWaitingHours: hs,
        treasuryMpsolAccount: null, // null => None => No change
        performanceFeeBp: null, // null => None => No change
        newAdminPubkey: null, // null => None => No change
    }
    ).accounts({
        admin: wallet.publicKey,
        mainState: mainStatePubKey,
    })

    // // uncomment to show tx simulation program log
    // {
    //   console.log("configureMainVault.simulate()")
    //   try {
    //     let result = await configTx.simulate()
    //     console.log(result)
    //   }
    //   catch (ex) {
    //     console.log(ex)
    //   }
    // }

    // execute
    await configTx.rpc()
}

async function configMainnet() {

    await configWaitTimeHours(24 * 3);
    await updateLSTPrices()

}

async function updateLSTPrices() {

    await updatePrice(MARINADE_MSOL_MINT, MARINADE_STATE_ADDRESS)
    await updatePrice(B_SOL_TOKEN_MINT, B_SOL_SPL_STAKE_POOL_STATE_ADDRESS)

}

async function updatePrice(lstMint: string, stateAccount: string) {
    return program.methods.updateVaultTokenSolPrice()
        .accounts({
            mainState: mainStateWalletProvider.wallet.publicKey,
            lstMint: lstMint,
        })
        .remainingAccounts([{
            pubkey: new PublicKey(stateAccount), isSigner: false, isWritable: false
        }])
        .rpc()
}

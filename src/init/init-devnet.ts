import * as anchor from "@coral-xyz/anchor";
import { MpSolRestaking } from "../types/mp_sol_restaking";
import mpSolRestakingIdl from "../idl/mp_sol_restaking.json";

import * as util from "../util/util";
import { SPL_TOKEN_PROGRAM_ID, splTokenProgram } from "@coral-xyz/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "../util/associated-token-helper";

const provider = util.getNodeFileWalletProvider("DEVYT7nSvD4gzP6BH2N1ubUamErS4TXtBYwdVrFBBVr")
const wallet = provider.wallet;
anchor.setProvider(provider)

const operatorAuthKeyPair = provider.wallet;
const strategyRebalancerAuthKeyPair = operatorAuthKeyPair
const depositorUserKeyPair = operatorAuthKeyPair

const program = new anchor.Program(mpSolRestakingIdl as anchor.Idl, provider)

const mpSolMintWalletProvider = util.getNodeFileWalletProvider("mPsoLV53uAGXnPJw63W91t2VDqCVZcU5rTh3PWzxnLr")
const mainStateWalletProvider = util.getNodeFileWalletProvider("mpsoLeuCF3LwrJWbzxNd81xRafePFfPhsNvGsAMhUAA")
console.log("main state address", mainStateWalletProvider.wallet.publicKey.toBase58())

// MARINADE DEVNET also MAINNET
const MARINADE_MSOL_MINT = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
const MARINADE_POOL_PROGRAM = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
const MARINADE_STATE_ADDRESS = "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC";

// B-SOL DEVNET
const SPL_STAKE_POOL_PROGRAM = "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy"
const B_SOL_TOKEN_MINT = "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1"
const B_SOL_SPL_STAKE_POOL_STATE_ADDRESS = "azFVdHtAJN8BX3sbGAYkXvtdjdrT5U6rj9rovvUFos9"

if (process.argv.includes("main")) {
    createMainState()
}
else if (process.argv.includes("msol")) {
    createSecondaryVault(
        mainStateWalletProvider.wallet.publicKey,
        "mSOL",
        MARINADE_MSOL_MINT
    )
}
else if (process.argv.includes("bsol")) {
    createSecondaryVault(
        mainStateWalletProvider.wallet.publicKey,
        "bSOL",
        B_SOL_TOKEN_MINT
    )
}
else {
    console.error("expected arg: main|msol|bsol")
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

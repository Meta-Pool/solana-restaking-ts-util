import { web3 } from "@coral-xyz/anchor"
import { solToLstValue } from "../util/conversion"
import { formatLamports, formatPrice32p } from "../util/format"
import { Context, MainStateAccount, NetworkConfig } from "./main"

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

export async function showVaults(networkConfig: NetworkConfig, ctx: Context) {

    const MP_SOL_MAIN_STATE = networkConfig.mainStateAddress
    console.log("main", MP_SOL_MAIN_STATE)

    let globalMainState: MainStateAccount
    globalMainState = await ctx.program.account["mainVaultState"].fetch(MP_SOL_MAIN_STATE)

    // get all vault-strategy relations
    const vaultStrategyRelations = await ctx.program.account.vaultStrategyRelationEntry.all()
    // get all vaults
    const vaults = await ctx.program.account.secondaryVaultState.all()
    for (let vault of vaults) {
        vault.account.lstMint.toBase58()
        console.log("--------")
        console.log("vault", vault.publicKey.toBase58())
        console.log("LST mint", vault.account.lstMint.toBase58())
        console.log("depositsDisabled", vault.account.depositsDisabled)
        console.log("tokenDepositCap", formatLamports(vault.account.tokenDepositCap))
        console.log("vaultTotalLstAmount", formatLamports(vault.account.vaultTotalLstAmount))
        console.log("locallyStoredAmount", formatLamports(vault.account.locallyStoredAmount))
        console.log(`ticketsTargetSolAmount:${formatLamports(vault.account.ticketsTargetSolAmount)}, in lst:${formatLamports(solToLstValue(vault.account.ticketsTargetSolAmount, vault.account.lstSolPriceP32))}`)
        console.log("inStrategiesAmount", formatLamports(vault.account.inStrategiesAmount))
        console.log("LST price", formatPrice32p(vault.account.lstSolPriceP32))
        console.log("LST price timestamp", new Date(vault.account.lstSolPriceTimestamp.toNumber()*1000))
        for (const [index, vsr] of vaultStrategyRelations.entries()) {
            if (vsr.account.lstMint.equals(vault.account.lstMint)) {
                console.log(`\t---- `)
                console.log(`\t vault-strat-rel ${vsr.publicKey}`)
                console.log(`\t strategyProgramCode ${getStratName(vsr.account.strategyProgramCode)} ${vsr.account.strategyProgramCode.toBase58()}`)
                console.log(`\t commonStrategyState ${vsr.account.commonStrategyState.toBase58()}`)
                console.log(`\t lastReadStratLstAmount ${formatLamports(vsr.account.lastReadStratLstAmount)}`)
                console.log(`\t lastReadStratLstTimestamp`,new Date(vsr.account.lastReadStratLstTimestamp.toNumber()*1000))
                // deprecated console.log(`\t ticketsTargetSolAmount ${formatLamports(vsr.account.ticketsTargetSolAmount)}`)
                console.log(`\t nextWithdrawLstAmount ${formatLamports(vsr.account.nextWithdrawLstAmount)}`)

            }
        }
    }
}

function getStratName(programAddress:web3.PublicKey) {
    return [
        {address:"DRSs7XUjPMeY716VXxNMP7Jds9DRpDrvY6Kyy9CFwbf9",name:"drift-strat"},
        {address:"sLsShdeS3jNsLnHtVvgDgCjoivzUuBXHRwtvj25mc1D",name:"solend-strat"},
        //{address:" ",name:"kamino-strat"},
    ].find(x=>x.address==programAddress.toBase58())?.name
}
import BN from "bn.js"
import { TWO_POW_32 } from "./constants"

export function lstToSolValue(lstAmount:BN , price32p: BN): BN {
    return lstAmount.mul(price32p).div(new BN(TWO_POW_32))
}
export function solToLstValue(solAmount:BN , price32p: BN): BN {
  return solAmount.mul(new BN(TWO_POW_32)).div(price32p)
}


//-------
// keep all decimals
export function amountStringAddDecPoint(amountString: string | bigint, decimals: number): string {
    if (amountString == undefined || amountString == null || amountString == "" || amountString == "0") return "";
    amountString = BigInt(amountString).toString()
    if (amountString.length < decimals+1) amountString = amountString.padStart(decimals+1, '0')
    return amountString.slice(0, -decimals) + "." + amountString.slice(-decimals)
  }
  export function amountStringToNum(amountString: string | bigint, decimals=24): number {
    return Number(amountStringAddDecPoint(amountString, decimals))
  }

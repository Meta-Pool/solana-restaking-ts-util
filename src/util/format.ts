import BN from "bn.js";
import { ONE_E9, TWO_POW_32 } from "./constants";

// format a price string with 32-bit precision to a 9 decimal places decimal number
export function formatPrice32p(priceString32p: string|BN|BigInt): string {
    let with9DecimalPlaces = (BigInt(priceString32p.toString()) * BigInt(ONE_E9) / BigInt(TWO_POW_32)).toString()
    return `${with9DecimalPlaces.slice(0, -9)}.${with9DecimalPlaces.slice(-9)}`
}

export function addCommas(str: string) {
    let pre;
    if (str.startsWith("-")) {
        str = str.slice(1);
        pre = "-";
    }
    else {
        pre = "";
    }
    const decPointPosition = str.indexOf(".")
    let n = (decPointPosition == -1 ? str.length : decPointPosition) - 4
    while (n >= 0) {
        str = str.slice(0, n + 1) + "," + str.slice(n + 1)
        n = n - 3
    }
    return pre + str;
}

export function addDecPoint(units: string | bigint, tokenDecimals: number): string {
    if (units == undefined || units == null || units == "") units = "0";
    units = BigInt(units).toString()
    let prefix=""
    if (units.startsWith("-")) {
        prefix="-"
        units = units.slice(1)
    } 
    if (units.length <= tokenDecimals) units = units.padStart(tokenDecimals + 1, '0')
    return `${prefix}${units.slice(0, -tokenDecimals)}.${units.slice(-tokenDecimals)}`
}

export function formatTokens(units: string | bigint, tokenDecimals: number, decimalPlaces: number): string {
    let withDecPoint = addDecPoint(units, tokenDecimals)
    if (decimalPlaces < tokenDecimals) {
        withDecPoint = withDecPoint.slice(0, -(tokenDecimals - decimalPlaces))
    }
    return addCommas(withDecPoint)
}

export function formatLamports(lamports:number|BN|BigInt) {
    return formatTokens(lamports.toString(),9,9)
}

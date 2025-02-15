import { BN } from "bn.js"
import * as path from 'path'
import { homedir } from 'os'
import { Idl, AnchorProvider } from "@coral-xyz/anchor";
import { ONE_E9, TWO_POW_32 } from "./constants";

// monkey-patch BN so it shows decimal numbers on JSON stringify
BN.prototype.toJSON = function () { return this.toString() }

export function idlConstant(idl: Idl, name: string) {
    try {
        return JSON.parse(idl.constants.find(c => c.name == name).value)
    } catch (ex) {
        throw new Error(`idlConstant("${name}"): ${ex}`)
    }
}

export function getNodeFileWalletProvider(pubKeyString: string, rpcUrl: string = "https://api.devnet.solana.com") {
    // set env.ANCHOR_WALLET
    process.env.ANCHOR_WALLET = path.join(homedir(), ".config", "solana", pubKeyString + ".json")
    // reads keypair from process.env.ANCHOR_WALLET
    return AnchorProvider.local(rpcUrl,{commitment:"processed"})
}

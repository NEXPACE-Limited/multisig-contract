import { ContractTransaction } from "ethers";

export interface SafeSignature {
  signer: string;
  data: string;
}

export async function getSequence(transaction: ContractTransaction) {
  const receipt = await transaction.wait();
  return receipt.events![0].args!.sequence.toNumber();
}

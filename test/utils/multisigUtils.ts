import { Contract, utils, BigNumberish, Signer, BigNumber } from "ethers";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { Multisig } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const valueZero = 0;
const saltZero = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface SafeSignature {
  signer: string;
  data: string;
}

export const EIP712_MULTISIG_TX_TYPE = {
  // "MultisigTx(address to,uint256 value,uint256 gas,bytes32 salt,bytes data)"
  MultisigTx: [
    { type: "address", name: "requester" },
    { type: "address", name: "to" },
    { type: "uint256", name: "value" },
    { type: "uint256", name: "gas" },
    { type: "bytes32", name: "salt" },
    { type: "bytes", name: "data" },
  ],
};

export const generateTransactionHash = async (verifyingContract: any, tx: any) => {
  const EIP712_DOMAIN = {
    name: "Multisig",
    version: "0.0.1",
    verifyingContract: verifyingContract.address,
    chainId: await verifyingContract.signer.getChainId(),
  };

  return utils._TypedDataEncoder.hash(EIP712_DOMAIN, EIP712_MULTISIG_TX_TYPE, tx);
};

// generate transaction calldata
export const generateContractCall = (contract: Contract, method: string, params: any) => {
  const data = contract.interface.encodeFunctionData(method, params);

  return { to: contract.address, value: valueZero, gas: 85000, salt: saltZero, data };
};

export const sendNativeTokenWithSigners = async (
  to: string,
  value: number,
  multisig: Multisig,
  requester: Signer,
  signers: Signer[] & TypedDataSigner[]
) => {
  await requester.sendTransaction({ to: multisig.address, value });

  const multisigTx = {
    requester: await requester.getAddress(),
    to,
    value,
    gas: 85000,
    salt: saltZero,
    data: "0x",
  };
  const { gas, salt, data } = multisigTx;

  await multisig.connect(requester).generateTransaction(to, value, gas, salt, data);

  const signatures = [];
  for (const signer of signers) {
    const { data } = await safeSignTypedData(signer, multisig, multisigTx);
    signatures.push(data);
  }

  return multisig.connect(requester).executeTransaction(to, value, gas, salt, data, signatures);
};

// generate and execute multisig transaction
export const executeTransactionWithSigners = async (
  contract: Contract,
  method: string,
  params: any,
  multisig: Multisig,
  requester: Signer,
  signers: Signer[] & TypedDataSigner[]
) => {
  const multisigTx = {
    requester: await requester.getAddress(),
    ...generateContractCall(contract, method, params),
  };
  const { to, value, gas, salt, data } = multisigTx;

  await multisig.connect(requester).generateTransaction(to, value, gas, salt, data);

  const signatures = [];
  for (const signer of signers) {
    const { data } = await safeSignTypedData(signer, multisig, multisigTx);
    signatures.push(data);
  }

  return multisig.connect(requester).executeTransaction(to, value, gas, salt, data, signatures);
};

// generate and cancel multisig transactio
export const cancelTransaction = async (
  contract: Contract,
  method: string,
  params: any,
  multisig: Multisig,
  requester: Signer & TypedDataSigner
) => {
  const { to, value, gas, salt, data } = generateContractCall(contract, method, params);

  await multisig.connect(requester).generateTransaction(to, value, gas, salt, data);

  return multisig.connect(requester).cancelTransaction(to, value, gas, salt, data);
};

export const safeSignTypedData = async (
  signer: Signer & TypedDataSigner,
  safe: Contract,
  safeTx: any,
  chainId?: BigNumberish
): Promise<SafeSignature> => {
  if (!chainId && !signer.provider) throw Error("Provider required to retrieve chainId");
  const cid = chainId || (await signer.provider!.getNetwork()).chainId;
  const signerAddress = await signer.getAddress();

  return {
    signer: signerAddress,
    data: await signer._signTypedData(
      { name: "Multisig", version: "0.0.1", verifyingContract: safe.address, chainId: cid },
      EIP712_MULTISIG_TX_TYPE,
      safeTx
    ),
  };
};

export const compareAddress = (a: SignerWithAddress, b: SignerWithAddress) => {
  const [A, B] = [BigNumber.from(a.address), BigNumber.from(b.address)];

  return A.lt(B) ? -1 : 1;
};

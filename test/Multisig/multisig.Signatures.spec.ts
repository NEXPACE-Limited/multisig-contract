import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { generateContractCall, generateTransactionHash } from "../utils/multisigUtils";
import nxErrors from "../utils/nx-errors";

describe("Multisig Signatures", function () {
  async function setupFixture() {
    const [owner1, executor] = await ethers.getSigners();

    const Multisig = await ethers.getContractFactory("Multisig");
    const multisig = await Multisig.connect(executor).deploy([await owner1.getAddress()], 1);

    const multisigTx = {
      requester: await executor.getAddress(),
      ...generateContractCall(multisig, "addOwner", [await owner1.getAddress()]),
    };

    return { multisig, owner1, executor, multisigTx };
  }

  describe("validateSignatures", function () {
    it("should revert if signature's length must 65bytes", async function () {
      const { multisig } = await loadFixture(setupFixture);
      const mockHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const signature = "0x";

      await expect(multisig.validateSignatures(mockHash, [signature])).to.be.revertedWith(
        nxErrors.ECDSA.invalidSignature
      );
    });
  });

  describe("hashTransaction", function () {
    it("should generate transaction hash", async function () {
      const { multisig, multisigTx } = await loadFixture(setupFixture);
      const { requester, to, value, gas, salt, data } = multisigTx;

      const txId = await generateTransactionHash(multisig, multisigTx);
      expect(await multisig.hashTransaction(requester, to, value, gas, salt, data)).to.be.equal(txId);
    });
  });
});

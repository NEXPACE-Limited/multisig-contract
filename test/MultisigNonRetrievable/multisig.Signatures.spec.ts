import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { generateContractCall, generateTransactionHash } from "../utils/multisigUtils";
import nxErrors from "../utils/nx-errors";

describe("MultisigNonRetrievable Signatures", function () {
  async function setupFixture() {
    const [owner1, executor] = await ethers.getSigners();

    const MultisigNonRetrievable = await ethers.getContractFactory("MultisigNonRetrievable");
    const multisigNonRetrievable = await MultisigNonRetrievable.connect(executor).deploy(
      [await owner1.getAddress()],
      1
    );

    const multisigNonRetrievableTx = {
      requester: await executor.getAddress(),
      ...generateContractCall(multisigNonRetrievable, "addOwner", [await owner1.getAddress()]),
    };

    return { multisigNonRetrievable, owner1, executor, multisigNonRetrievableTx };
  }

  describe("validateSignatures", function () {
    it("should revert if signature's length must 65bytes", async function () {
      const { multisigNonRetrievable } = await loadFixture(setupFixture);
      const mockHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const signature = "0x";

      await expect(multisigNonRetrievable.validateSignatures(mockHash, [signature])).to.be.revertedWith(
        nxErrors.ECDSA.invalidSignature
      );
    });
  });

  describe("hashTransaction", function () {
    it("should generate transaction hash", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx } = await loadFixture(setupFixture);
      const { requester, to, value, gas, salt, data } = multisigNonRetrievableTx;

      const txId = await generateTransactionHash(multisigNonRetrievable, multisigNonRetrievableTx);
      expect(await multisigNonRetrievable.hashTransaction(requester, to, value, gas, salt, data)).to.be.equal(txId);
    });
  });
});

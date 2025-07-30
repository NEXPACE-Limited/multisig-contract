import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  cancelTransaction,
  compareAddress,
  executeTransactionWithSigners,
  generateContractCall,
  safeSignTypedData,
} from "../utils/multisigUtils";
import { AddressZero } from "@ethersproject/constants";
import nxErrors from "../utils/nx-errors";

describe("MultisigNonRetrievable Transcation", function () {
  async function setupFixture() {
    const [owner1, owner2, owner3, owner4, executor] = (await ethers.getSigners()).sort(compareAddress);
    const [MultisigNonRetrievable, MockContract] = await Promise.all([
      ethers.getContractFactory("MultisigNonRetrievable"),
      ethers.getContractFactory("MockContract"),
    ]);
    const [multisigNonRetrievable, mockContract] = await Promise.all([
      await MultisigNonRetrievable.connect(executor).deploy(
        [await owner1.getAddress(), await owner2.getAddress(), await owner3.getAddress()],
        2
      ),
      await MockContract.deploy(),
    ]);

    const multisigNonRetrievableTx = {
      requester: await executor.getAddress(),
      ...generateContractCall(mockContract, "setData", ["1"]),
    };

    return { multisigNonRetrievable, mockContract, multisigNonRetrievableTx, owner1, owner2, owner3, owner4, executor };
  }

  describe("txStatus", function () {
    it("should return 1(GENERATED) when transaction is generated", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;
      await multisigNonRetrievable.generateTransaction(to, value, gas, salt, data);

      const txId = await multisigNonRetrievable.hashTransaction(
        await executor.getAddress(),
        to,
        value,
        gas,
        salt,
        data
      );
      expect(await multisigNonRetrievable.txStatus(txId)).to.equal(1);
    });
  });

  describe("generateTransaction", function () {
    it("should revert if requester is nor owner or executor", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, owner4 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;

      await expect(
        multisigNonRetrievable.connect(owner4).generateTransaction(to, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.executorForbidden);
    });

    it("should generate transaction", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;
      const txId = await multisigNonRetrievable.hashTransaction(
        await executor.getAddress(),
        to,
        value,
        gas,
        salt,
        data
      );

      await expect(multisigNonRetrievable.generateTransaction(to, value, gas, salt, data))
        .emit(multisigNonRetrievable, "GenerateTransaction")
        .withArgs(await executor.getAddress(), to, value, gas, salt, data, txId);
    });

    it("should generate transaction by owner", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, owner1 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;
      const txId = await multisigNonRetrievable.hashTransaction(await owner1.getAddress(), to, value, gas, salt, data);

      await expect(multisigNonRetrievable.connect(owner1).generateTransaction(to, value, gas, salt, data))
        .emit(multisigNonRetrievable, "GenerateTransaction")
        .withArgs(await owner1.getAddress(), to, value, gas, salt, data, txId);
    });

    it("should revert if to address of transaction is zero address", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, executor } = await loadFixture(setupFixture);
      const { value, gas, salt, data } = multisigNonRetrievableTx;

      await expect(
        multisigNonRetrievable.connect(executor).generateTransaction(AddressZero, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.invalidAddress);
    });
  });

  describe("cancelTransaction", function () {
    it("should revert if msg sender is not transaction requester", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, owner4 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;

      await expect(
        multisigNonRetrievable.connect(owner4).cancelTransaction(to, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.invalidRequest);
    });

    it("should cancel transaction", async function () {
      const { multisigNonRetrievable, mockContract, executor } = await loadFixture(setupFixture);

      await expect(cancelTransaction(mockContract, "setData", ["1"], multisigNonRetrievable, executor)).to.emit(
        multisigNonRetrievable,
        "CancelTransaction"
      );
    });

    it("should revert if transaction has not been generated", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;

      await expect(
        multisigNonRetrievable.connect(executor).cancelTransaction(to, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.invalidRequest);
    });

    it("should revert if transaction is already canceled or executed", async function () {
      const { multisigNonRetrievable, mockContract, executor } = await loadFixture(setupFixture);

      await cancelTransaction(mockContract, "setData", ["1"], multisigNonRetrievable, executor);

      await expect(
        cancelTransaction(mockContract, "setData", ["1"], multisigNonRetrievable, executor)
      ).to.be.revertedWith(nxErrors.Multisig.invalidRequest);
    });
  });

  describe("executeTransaction", function () {
    it("should revert if msg sender is not owner or executor", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, owner4 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;

      await expect(
        multisigNonRetrievable.connect(owner4).executeTransaction(to, value, gas, salt, data, [])
      ).to.be.revertedWith(nxErrors.Multisig.executorForbidden);
    });

    it("should revert if msg sender is not transaction requester", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, owner3 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;

      await expect(
        multisigNonRetrievable.connect(owner3).executeTransaction(to, value, gas, salt, data, [])
      ).to.be.revertedWith(nxErrors.Multisig.invalidRequest);
    });

    it("mockContract test", async function () {
      const { mockContract } = await loadFixture(setupFixture);
      await mockContract.setData(1);

      expect(await mockContract.data()).to.be.equal(1);
    });

    it("should revert if transaction has not been generated", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigNonRetrievableTx;

      await expect(
        multisigNonRetrievable.connect(executor).executeTransaction(to, value, gas, salt, data, [])
      ).to.be.revertedWith(nxErrors.Multisig.invalidRequest);
    });

    it("should execute transaction", async function () {
      const { multisigNonRetrievable, mockContract, owner1, owner2, owner3, executor } = await loadFixture(
        setupFixture
      );

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisigNonRetrievable, executor, [
          owner1,
          owner2,
          owner3,
        ])
      ).to.emit(multisigNonRetrievable, "ExecuteTransaction");
    });

    it("should revert if transaction is already canceled or executed", async function () {
      const { multisigNonRetrievable, mockContract, owner1, owner2, owner3, executor } = await loadFixture(
        setupFixture
      );

      await executeTransactionWithSigners(mockContract, "setData", ["1"], multisigNonRetrievable, executor, [
        owner1,
        owner2,
        owner3,
      ]);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisigNonRetrievable, executor, [
          owner1,
          owner2,
          owner3,
        ])
      ).to.be.revertedWith(nxErrors.Multisig.invalidRequest);
    });

    it("should revert if signature are same", async function () {
      const { multisigNonRetrievable, mockContract, owner1, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisigNonRetrievable, executor, [
          owner1,
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if signer of signatures are not sorted", async function () {
      const { multisigNonRetrievable, mockContract, owner1, owner2, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisigNonRetrievable, executor, [
          owner2,
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if signer is not owner", async function () {
      const { multisigNonRetrievable, mockContract, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisigNonRetrievable, executor, [executor])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if the length of signatures is lower than threshold", async function () {
      const { multisigNonRetrievable, mockContract, owner1, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisigNonRetrievable, executor, [owner1])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if gas limit is too low", async function () {
      const { multisigNonRetrievable, multisigNonRetrievableTx, owner1, owner2, owner3, executor } = await loadFixture(
        setupFixture
      );
      multisigNonRetrievableTx.gas = 1_000_000_000;

      const { to, value, gas, salt, data } = multisigNonRetrievableTx;

      const signatures = await Promise.all([
        await safeSignTypedData(owner1, multisigNonRetrievable, multisigNonRetrievableTx),
        await safeSignTypedData(owner2, multisigNonRetrievable, multisigNonRetrievableTx),
        await safeSignTypedData(owner3, multisigNonRetrievable, multisigNonRetrievableTx),
      ]);

      await multisigNonRetrievable.connect(executor).generateTransaction(to, value, gas, salt, data);

      await expect(
        multisigNonRetrievable.connect(executor).executeTransaction(
          to,
          value,
          gas,
          salt,
          data,
          signatures.map((sig) => sig.data),
          { gasLimit: 200_000 }
        )
      ).to.be.reverted;
    });
  });
});

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

describe("Multisig Transcation", function () {
  async function setupFixture() {
    const [owner1, owner2, owner3, owner4, executor] = (await ethers.getSigners()).sort(compareAddress);
    const [Multisig, MockContract] = await Promise.all([
      ethers.getContractFactory("Multisig"),
      ethers.getContractFactory("MockContract"),
    ]);
    const [multisig, mockContract] = await Promise.all([
      await Multisig.connect(executor).deploy(
        [await owner1.getAddress(), await owner2.getAddress(), await owner3.getAddress()],
        2
      ),
      await MockContract.deploy(),
    ]);

    const multisigTx = {
      requester: await executor.getAddress(),
      ...generateContractCall(mockContract, "setData", ["1"]),
    };

    return { multisig, mockContract, multisigTx, owner1, owner2, owner3, owner4, executor };
  }

  describe("txStatus", function () {
    it("should return 1(GENERATED) when transaction is generated", async function () {
      const { multisig, multisigTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;
      await multisig.generateTransaction(to, value, gas, salt, data);

      const txId = await multisig.hashTransaction(await executor.getAddress(), to, value, gas, salt, data);
      expect(await multisig.txStatus(txId)).to.equal(1);
    });
  });

  describe("generateTransaction", function () {
    it("should revert if requester is nor owner or executor", async function () {
      const { multisig, multisigTx, owner4 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;

      await expect(multisig.connect(owner4).generateTransaction(to, value, gas, salt, data)).to.be.revertedWith(
        nxErrors.Multisig.executorForbidden
      );
    });

    it("should generate transaction", async function () {
      const { multisig, multisigTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;
      const txId = await multisig.hashTransaction(await executor.getAddress(), to, value, gas, salt, data);

      await expect(multisig.generateTransaction(to, value, gas, salt, data))
        .emit(multisig, "GenerateTransaction")
        .withArgs(await executor.getAddress(), to, value, gas, salt, data, txId);
    });

    it("should generate transaction by owner", async function () {
      const { multisig, multisigTx, owner1 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;
      const txId = await multisig.hashTransaction(await owner1.getAddress(), to, value, gas, salt, data);

      await expect(multisig.connect(owner1).generateTransaction(to, value, gas, salt, data))
        .emit(multisig, "GenerateTransaction")
        .withArgs(await owner1.getAddress(), to, value, gas, salt, data, txId);
    });

    it("should revert if to address of transaction is zero address", async function () {
      const { multisig, multisigTx, executor } = await loadFixture(setupFixture);
      const { value, gas, salt, data } = multisigTx;

      await expect(
        multisig.connect(executor).generateTransaction(AddressZero, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.invalidAddress);
    });
  });

  describe("cancelTransaction", function () {
    it("should revert if msg sender is not transaction requester", async function () {
      const { multisig, multisigTx, owner4 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;

      await expect(multisig.connect(owner4).cancelTransaction(to, value, gas, salt, data)).to.be.revertedWith(
        nxErrors.Multisig.invalidRequest
      );
    });

    it("should cancel transaction", async function () {
      const { multisig, mockContract, executor } = await loadFixture(setupFixture);

      await expect(cancelTransaction(mockContract, "setData", ["1"], multisig, executor)).to.emit(
        multisig,
        "CancelTransaction"
      );
    });

    it("should revert if transaction has not been generated", async function () {
      const { multisig, multisigTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;

      await expect(multisig.connect(executor).cancelTransaction(to, value, gas, salt, data)).to.be.revertedWith(
        nxErrors.Multisig.invalidRequest
      );
    });

    it("should revert if transaction is already canceled or executed", async function () {
      const { multisig, mockContract, executor } = await loadFixture(setupFixture);

      await cancelTransaction(mockContract, "setData", ["1"], multisig, executor);

      await expect(cancelTransaction(mockContract, "setData", ["1"], multisig, executor)).to.be.revertedWith(
        nxErrors.Multisig.invalidRequest
      );
    });
  });

  describe("executeTransaction", function () {
    it("should revert if msg sender is not owner or executor", async function () {
      const { multisig, multisigTx, owner4 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;

      await expect(multisig.connect(owner4).executeTransaction(to, value, gas, salt, data, [])).to.be.revertedWith(
        nxErrors.Multisig.executorForbidden
      );
    });

    it("should revert if msg sender is not transaction requester", async function () {
      const { multisig, multisigTx, owner3 } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;

      await expect(multisig.connect(owner3).executeTransaction(to, value, gas, salt, data, [])).to.be.revertedWith(
        nxErrors.Multisig.invalidRequest
      );
    });

    it("mockContract test", async function () {
      const { mockContract } = await loadFixture(setupFixture);
      await mockContract.setData(1);

      expect(await mockContract.data()).to.be.equal(1);
    });

    it("should revert if transaction has not been generated", async function () {
      const { multisig, multisigTx, executor } = await loadFixture(setupFixture);
      const { to, value, gas, salt, data } = multisigTx;

      await expect(multisig.connect(executor).executeTransaction(to, value, gas, salt, data, [])).to.be.revertedWith(
        nxErrors.Multisig.invalidRequest
      );
    });

    it("should execute transaction", async function () {
      const { multisig, mockContract, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisig, executor, [owner1, owner2, owner3])
      ).to.emit(multisig, "ExecuteTransaction");
    });

    it("should revert if transaction is already canceled or executed", async function () {
      const { multisig, mockContract, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);

      await executeTransactionWithSigners(mockContract, "setData", ["1"], multisig, executor, [owner1, owner2, owner3]);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisig, executor, [owner1, owner2, owner3])
      ).to.be.revertedWith(nxErrors.Multisig.invalidRequest);
    });

    it("should revert if signature are same", async function () {
      const { multisig, mockContract, owner1, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisig, executor, [owner1, owner1])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if signer of signatures are not sorted", async function () {
      const { multisig, mockContract, owner1, owner2, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisig, executor, [owner2, owner1])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if signer is not owner", async function () {
      const { multisig, mockContract, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisig, executor, [executor])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if the length of signatures is lower than threshold", async function () {
      const { multisig, mockContract, owner1, executor } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(mockContract, "setData", ["1"], multisig, executor, [owner1])
      ).to.be.revertedWith(nxErrors.Multisig.invalidSignature);
    });

    it("should revert if gas limit is too low", async function () {
      const { multisig, multisigTx, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);
      multisigTx.gas = 1_000_000_000;

      const { to, value, gas, salt, data } = multisigTx;

      const signatures = await Promise.all([
        await safeSignTypedData(owner1, multisig, multisigTx),
        await safeSignTypedData(owner2, multisig, multisigTx),
        await safeSignTypedData(owner3, multisig, multisigTx),
      ]);

      await multisig.connect(executor).generateTransaction(to, value, gas, salt, data);

      await expect(
        multisig.connect(executor).executeTransaction(
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

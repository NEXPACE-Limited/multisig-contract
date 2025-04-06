import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { getSequence } from "../utils/multisigUpgradeableUtils";
import nxErrors from "../utils/nx-errors";

describe("MultisigUpgradeable OwnerManager", function () {
  async function setupFixture() {
    const [owner1, owner2, owner3, executor1, executor2, executor3] = await ethers.getSigners();

    const MultisigLogic = await ethers.getContractFactory("MockMultisigUpgradeable");
    const multisigLogic = await MultisigLogic.deploy();

    const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
    const beacon = await Beacon.deploy(multisigLogic.address);

    const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
    const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
    await multisig.connect(executor1).initialize([owner1.getAddress()], 1);

    return { MultisigLogic, BeaconProxy, multisig, beacon, owner1, owner2, owner3, executor1, executor2, executor3 };
  }

  async function ownerAddedFixture() {
    const { multisig, owner1, owner2, ...rest } = await loadFixture(setupFixture);
    const txnData = multisig.interface.encodeFunctionData("addOwner", [await owner2.getAddress()]);
    const sequence = getSequence(
      await multisig.connect(owner1).generateTransaction(multisig.address, 0, 200000, txnData)
    );
    await multisig.connect(owner1).signTransaction(sequence);
    await multisig.connect(owner1).executeTransaction(sequence);

    return { multisig, owner1, owner2, ...rest };
  }

  describe("initialize", function () {
    it("should set at least 1 owner", async function () {
      const { BeaconProxy, MultisigLogic, beacon, executor1 } = await loadFixture(setupFixture);

      const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);

      await expect(multisig.connect(executor1).initialize([], 0)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidRequest
      );
    });

    it("should set threshold to be less than or equal to the length of owner", async function () {
      const { BeaconProxy, MultisigLogic, beacon, executor1, owner1 } = await loadFixture(setupFixture);

      const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);

      await expect(multisig.connect(executor1).initialize([await owner1.getAddress()], 2)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidThreshold
      );
    });
  });

  describe("getOwnerCount", function () {
    it("should return cuurent owner length", async function () {
      const { multisig } = await loadFixture(setupFixture);

      expect(await multisig.getOwnerCount()).to.be.equal(1);
    });
  });

  describe("grantExecutor", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).grantExecutor(owner1.getAddress())).to.be.revertedWith(
        nxErrors.SelfCallUpgradeable.forbidden
      );
    });

    it("should set new executor", async function () {
      const { multisig, owner1, executor1, executor2 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("grantExecutor", [await executor2.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.isExecutor(await executor2.getAddress())).to.be.equal(true);
    });

    it("should revert if new executor is owner", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("grantExecutor", [await owner1.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidAddress
      );
    });

    it("should revert if new executor is already executor", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("grantExecutor", [await executor1.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.ExecutorManagerUpgradeable.grantExecutorConflict
      );
    });

    it("Success - multiple", async function () {
      const { multisig, owner1, executor1, executor2, executor3 } = await loadFixture(setupFixture);

      const data2 = multisig.interface.encodeFunctionData("grantExecutor", [await executor2.getAddress()]);
      const data1 = multisig.interface.encodeFunctionData("grantExecutor", [await executor3.getAddress()]);
      const transactions = [];
      transactions.push({ to: multisig.address, value: 0, gas: 200000, data: data1 });
      transactions.push({ to: multisig.address, value: 0, gas: 200000, data: data2 });
      const sequence = getSequence(await multisig.connect(executor1).generateTransactions(transactions));
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);
      expect(await multisig.isExecutor(await executor2.getAddress())).to.be.equal(true);
      expect(await multisig.isExecutor(await executor3.getAddress())).to.be.equal(true);
    });

    it("should revert if new executor is owner", async function () {
      const { multisig, executor2, executor3 } = await loadFixture(setupFixture);

      const data2 = multisig.interface.encodeFunctionData("grantExecutor", [await executor2.getAddress()]);
      const data1 = multisig.interface.encodeFunctionData("grantExecutor", [await executor3.getAddress()]);
      const transactions = [];
      transactions.push({ to: multisig.address, value: 0, gas: 200000, data: data1 });
      transactions.push({ to: multisig.address, value: 0, gas: 200000, data: data2 });
      await expect(multisig.connect(executor2).generateTransactions(transactions)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.executorForbidden
      );
    });
  });

  describe("revokeExecutor", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).revokeExecutor(await executor1.getAddress())).to.be.revertedWith(
        nxErrors.SelfCallUpgradeable.forbidden
      );
    });

    it("should unset executor", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("revokeExecutor", [await executor1.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.isExecutor(await executor1.getAddress())).to.be.equal(false);
    });

    it("should revert if address to revoke is not executor", async function () {
      const { multisig, owner1, executor1, executor2 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("revokeExecutor", [await executor2.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.ExecutorManagerUpgradeable.revokeExecutorConflict
      );
    });
  });

  describe("getOwner", function () {
    it("should get owner's address", async function () {
      const { multisig, owner1 } = await loadFixture(setupFixture);

      expect(await multisig.getOwner(0)).to.be.equal(await owner1.getAddress());
    });
  });

  describe("addOwner", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1, owner2 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).addOwner(await owner2.getAddress())).to.be.revertedWith(
        nxErrors.SelfCallUpgradeable.forbidden
      );
    });

    it("should add owner", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("addOwner", [await owner2.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner2.getAddress()]);
    });

    it("should revert if newOwner is zero address", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("addOwner", [ethers.constants.AddressZero]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidAddress
      );
    });

    it("should revert if newOwner is already owner", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("addOwner", [await owner1.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidOwner
      );
    });

    it("should revert if newOwner is executor", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("addOwner", [await executor1.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidAddress
      );
    });
  });

  describe("addOwnerWithNewThreshold", function () {
    it("should revert if msg sender is not multisig contract", async function () {
      const { multisig, owner1, owner2 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).addOwnerWithNewThreshold(await owner2.getAddress(), 1)).to.be.revertedWith(
        nxErrors.SelfCallUpgradeable.forbidden
      );
    });

    it("should add owner and set new threshold", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("addOwnerWithNewThreshold", [await owner2.getAddress(), 2]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner2.getAddress()]);
    });
  });

  describe("removeOwner", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).removeOwner(await owner1.getAddress())).to.be.revertedWith(
        nxErrors.SelfCallUpgradeable.forbidden
      );
    });

    it("should remove owner", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("removeOwner", [await owner2.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress()]);
    });

    it("should revert if owners length - 1 is less than threshold", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("removeOwner", [await owner1.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidThreshold
      );
    });

    it("should revert if owner to remove is not owner", async function () {
      const { multisig, owner1, owner3, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("removeOwner", [await owner3.getAddress()]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidOwner
      );
    });
  });

  describe("removeOwnerWithNewThreshold", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1, owner2 } = await loadFixture(setupFixture);

      await expect(
        multisig.connect(owner1).removeOwnerWithNewThreshold(await owner2.getAddress(), 1)
      ).to.be.revertedWith(nxErrors.SelfCallUpgradeable.forbidden);
    });

    it("should remove owner and set new threshold", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("removeOwnerWithNewThreshold", [await owner2.getAddress(), 1]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress()]);
      expect(await multisig.threshold()).to.be.equal(1);
    });

    it("should revert if the length of owner - 1 is less than newThreshold", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("removeOwnerWithNewThreshold", [await owner2.getAddress(), 2]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(owner2).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidThreshold
      );
    });
  });

  describe("changeOwner", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1, owner2 } = await loadFixture(setupFixture);
      await expect(
        multisig.connect(owner1).changeOwner(await owner1.getAddress(), await owner2.getAddress())
      ).to.be.revertedWith(nxErrors.SelfCallUpgradeable.forbidden);
    });

    it("should changed owner", async function () {
      const { multisig, owner1, owner2, owner3, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("changeOwner", [
        await owner2.getAddress(),
        await owner3.getAddress(),
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(owner2).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner3.getAddress()]);
    });

    it("should revert if newOwner is already owner", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("changeOwner", [
        await owner1.getAddress(),
        await owner2.getAddress(),
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(owner2).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidOwner
      );
    });

    it("should revert if prevOwner and newOwner is same", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("changeOwner", [
        await owner1.getAddress(),
        await owner1.getAddress(),
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidOwner
      );
    });

    it("should revert if prevOwner is not owner", async function () {
      const { multisig, owner1, owner2, owner3, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("changeOwner", [
        await owner3.getAddress(),
        await owner2.getAddress(),
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidOwner
      );
    });
  });

  describe("changeOwnerWithNewThreshold", function () {
    it("should revert if is is not be called by the contract itself", async function () {
      const { multisig, owner1, owner2, owner3 } = await loadFixture(setupFixture);

      await expect(
        multisig.connect(owner1).changeOwnerWithNewThreshold(await owner2.getAddress(), await owner3.getAddress(), 1)
      ).to.be.revertedWith(nxErrors.SelfCallUpgradeable.forbidden);
    });

    it("should change owner and set new threhold", async function () {
      const { multisig, owner1, owner2, owner3, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("changeOwnerWithNewThreshold", [
        await owner2.getAddress(),
        await owner3.getAddress(),
        1,
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(owner2).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner3.getAddress()]);
      expect(await multisig.threshold()).to.be.equal(1);
    });

    it("should revert if prevOwner and newOwner is same", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("changeOwnerWithNewThreshold", [
        await owner2.getAddress(),
        await owner2.getAddress(),
        1,
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidOwner
      );
    });
  });

  describe("changeThreshold", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).changeThreshold(1)).to.be.revertedWith(
        nxErrors.SelfCallUpgradeable.forbidden
      );
    });

    it("should revert if newThreshold is 0", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("changeThreshold", [0]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidThreshold
      );
    });

    it("should revert if newThreshold is greater than the length of owner", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const data = multisig.interface.encodeFunctionData("changeThreshold", [3]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);

      await expect(multisig.connect(executor1).executeTransaction(sequence)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.invalidThreshold
      );
    });

    it("should change the threshold", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(ownerAddedFixture);

      const data = multisig.interface.encodeFunctionData("changeThreshold", [2]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(multisig.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await multisig.threshold()).to.be.equal(2);
    });
  });
});

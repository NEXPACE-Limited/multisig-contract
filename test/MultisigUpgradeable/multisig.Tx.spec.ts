import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import nxErrors from "../utils/nx-errors";

describe("MultisigUpgradeable Transcation", function () {
  async function setupFixture() {
    const [owner1, owner2, owner3, owner4, executor, executor2] = await ethers.getSigners();

    const MockContract = await ethers.getContractFactory("MockContract");
    const mockContract = await MockContract.deploy();

    const MultisigLogic = await ethers.getContractFactory("MockMultisigUpgradeable");
    const multisigLogic = await MultisigLogic.deploy();

    const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
    const beacon = await Beacon.deploy(multisigLogic.address);

    const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
    const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
    await multisig
      .connect(executor)
      .initialize([await owner1.getAddress(), await owner2.getAddress(), await owner3.getAddress()], 2);

    const data = mockContract.interface.encodeFunctionData("setData", [1]);

    return { multisig, mockContract, owner1, owner2, owner3, owner4, executor, executor2, data };
  }

  describe("txStatus", function () {
    it("success", async function () {
      const { multisig, executor, mockContract, data } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);

      expect(await multisig.txStatus(0)).to.equal(1);
    });
    it("should revert if called non-exist sequence", async function () {
      const { multisig } = await loadFixture(setupFixture);

      await expect(multisig.txStatus(0)).to.be.revertedWith(nxErrors.MultisigUpgradeable.invalidSequence);
    });
  });

  describe("generateTransaction", function () {
    it("should revert if requester is nor owner or executor", async function () {
      const { multisig, owner4, mockContract, data } = await loadFixture(setupFixture);

      await expect(
        multisig.connect(owner4).generateTransaction(mockContract.address, 0, 200000, data)
      ).to.be.revertedWith(nxErrors.MultisigUpgradeable.executorForbidden);
    });

    it("should generate transaction", async function () {
      const { multisig, mockContract, data, executor } = await loadFixture(setupFixture);

      const ev = (
        await (await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data)).wait()
      ).events![0].args!;
      expect(ev.sequence).to.equal(0);
      expect(ev.requester).to.equal(await executor.getAddress());
      expect(ev.transactions[0].to).to.equal(mockContract.address);
      expect(ev.transactions[0].value).to.equal(0);
      expect(ev.transactions[0].gas).to.equal(200000);
      expect(ev.transactions[0].data).to.equal(data);
    });

    it("should generate transaction by owner", async function () {
      const { multisig, mockContract, data, owner1 } = await loadFixture(setupFixture);

      const ev = (
        await (await multisig.connect(owner1).generateTransaction(mockContract.address, 0, 200000, data)).wait()
      ).events![0].args!;
      expect(ev.sequence).to.equal(0);
      expect(ev.requester).to.equal(await owner1.getAddress());
      expect(ev.transactions[0].to).to.equal(mockContract.address);
      expect(ev.transactions[0].value).to.equal(0);
      expect(ev.transactions[0].gas).to.equal(200000);
      expect(ev.transactions[0].data).to.equal(data);
    });

    it("should revert if to address of transaction is zero address", async function () {
      const { multisig, data, executor } = await loadFixture(setupFixture);

      await expect(
        multisig.connect(executor).generateTransaction(ethers.constants.AddressZero, 0, 200000, data)
      ).to.be.revertedWith(nxErrors.MultisigUpgradeable.invalidAddress);
    });
  });

  describe("signTransaction", function () {
    it("should revert if msg.sender is not owner", async function () {
      const { multisig, executor, mockContract, data } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await expect(multisig.connect(executor).signTransaction(0)).to.be.revertedWith(
        nxErrors.OwnerManagerUpgradeable.ownerForbidden
      );
    });

    it("should revert if transaction is already canceled or executed", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);
      await multisig.connect(owner3).signTransaction(0);
      multisig.connect(executor).executeTransaction(0);
      await expect(multisig.connect(owner3).signTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called non-exist sequence", async function () {
      const { multisig, mockContract, data, executor, owner1 } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await expect(multisig.connect(owner1).signTransaction(1)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called after an owner update(addOwner)", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner4, executor } = await loadFixture(setupFixture);
      const addOwnerData = multisig.interface.encodeFunctionData("addOwner", [await owner4.getAddress()]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(owner1).signTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called after an owner update(removeOwner)", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);
      const addOwnerData = multisig.interface.encodeFunctionData("removeOwner", [await owner3.getAddress()]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(owner1).signTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called after an owner update(changeOwner)", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner3, owner4, executor } = await loadFixture(
        setupFixture
      );
      const addOwnerData = multisig.interface.encodeFunctionData("changeOwner", [
        await owner3.getAddress(),
        await owner4.getAddress(),
      ]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(owner1).signTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called after an owner update(changeThreshold)", async function () {
      const { multisig, mockContract, data, owner1, owner2, executor } = await loadFixture(setupFixture);
      const addOwnerData = multisig.interface.encodeFunctionData("changeThreshold", [1]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(owner1).signTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });
  });

  describe("cancelTransaction", function () {
    it("should revert if msg sender is not transaction requester", async function () {
      const { multisig, executor, owner4, mockContract, data } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await expect(multisig.connect(owner4).cancelTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.requesterForbidden
      );
    });

    it("should cancel transaction", async function () {
      const { multisig, mockContract, executor, data } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await expect(multisig.connect(executor).cancelTransaction(0)).to.emit(multisig, "CancelTransaction");
    });

    it("should revert if transaction has not been generated", async function () {
      const { multisig, executor } = await loadFixture(setupFixture);

      await expect(multisig.connect(executor).cancelTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if transaction is already canceled or executed", async function () {
      const { multisig, mockContract, executor, data } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(executor).cancelTransaction(0);

      await expect(multisig.connect(executor).cancelTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });
  });

  describe("executeTransaction", function () {
    it("should revert if msg sender is not transaction requester", async function () {
      const { multisig, owner4, executor, owner1, owner2, mockContract, data } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);
      await expect(multisig.connect(owner4).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.requesterForbidden
      );
    });

    it("mockContract test", async function () {
      const { mockContract } = await loadFixture(setupFixture);
      await mockContract.setData(1);

      expect(await mockContract.data()).to.be.equal(1);
    });

    it("should revert if transaction has not been generated", async function () {
      const { multisig, executor } = await loadFixture(setupFixture);

      await expect(multisig.connect(executor).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should execute transaction", async function () {
      const { multisig, mockContract, owner1, owner2, owner3, executor, data } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);
      await multisig.connect(owner3).signTransaction(0);

      await expect(multisig.connect(executor).executeTransaction(0))
        .to.emit(multisig, "ExecuteTransaction")
        .withArgs(0);
    });

    it("should revert if transaction is already canceled or executed", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);
      await multisig.connect(owner3).signTransaction(0);

      await multisig.connect(executor).executeTransaction(0);

      await expect(multisig.connect(executor).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if already signed", async function () {
      const { multisig, mockContract, data, owner1, executor } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);

      await expect(multisig.connect(owner1).signTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidRequest
      );
    });

    it("should revert if the length of signatures is lower than threshold", async function () {
      const { multisig, mockContract, data, owner1, executor } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);

      await expect(multisig.connect(executor).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.executeForbidden
      );
    });

    it("should revert if gas limit is too low", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 1_000_000_000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);
      await multisig.connect(owner3).signTransaction(0);

      await expect(multisig.connect(executor).executeTransaction(0, { gasLimit: 200_000 })).to.be.reverted;
    });

    it("should revert if called after an owner update(addOwner)", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner4, executor } = await loadFixture(setupFixture);
      const addOwnerData = multisig.interface.encodeFunctionData("addOwner", [await owner4.getAddress()]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(executor).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called after an owner update(removeOwner)", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner3, executor } = await loadFixture(setupFixture);
      const addOwnerData = multisig.interface.encodeFunctionData("removeOwner", [await owner3.getAddress()]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(executor).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called after an owner update(changeOwner)", async function () {
      const { multisig, mockContract, data, owner1, owner2, owner3, owner4, executor } = await loadFixture(
        setupFixture
      );
      const addOwnerData = multisig.interface.encodeFunctionData("changeOwner", [
        await owner3.getAddress(),
        await owner4.getAddress(),
      ]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(executor).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });

    it("should revert if called after an owner update(changeThreshold)", async function () {
      const { multisig, mockContract, data, owner1, owner2, executor } = await loadFixture(setupFixture);
      const addOwnerData = multisig.interface.encodeFunctionData("changeThreshold", [1]);

      await multisig.connect(executor).generateTransaction(mockContract.address, 0, 200000, data);
      await multisig.connect(owner1).signTransaction(0);
      await multisig.connect(owner2).signTransaction(0);

      await multisig.connect(executor).generateTransaction(multisig.address, 0, 200000, addOwnerData);
      await multisig.connect(owner1).signTransaction(1);
      await multisig.connect(owner2).signTransaction(1);
      await multisig.connect(executor).executeTransaction(1);

      await expect(multisig.connect(executor).executeTransaction(0)).to.be.revertedWith(
        nxErrors.MultisigUpgradeable.invalidSequence
      );
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";

describe("Multisig Transcation", function () {
  describe("Initilize", function () {
    it("MockMultisigUpgradeable", async function () {
      const [owner1, executor] = await ethers.getSigners();

      const MultisigLogic = await ethers.getContractFactory("MockMultisigUpgradeable");
      const multisigLogic = await MultisigLogic.deploy();

      const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
      const beacon = await Beacon.deploy(multisigLogic.address);

      const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
      const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
      await multisig.connect(executor).initialize([await owner1.getAddress()], 1);

      await expect(multisig.f()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.g()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.initialize([], 0)).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("MockExecutorManagerUpgradeable", async function () {
      const [executor] = await ethers.getSigners();

      const MultisigLogic = await ethers.getContractFactory("MockExecutorManagerUpgradeable");
      const multisigLogic = await MultisigLogic.deploy();

      const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
      const beacon = await Beacon.deploy(multisigLogic.address);

      const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
      const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
      await multisig.connect(executor).initialize();

      await expect(multisig.f()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.g()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });
    it("MockOwnerManagerUpgradeable", async function () {
      const [executor, owner1] = await ethers.getSigners();

      const MultisigLogic = await ethers.getContractFactory("MockOwnerManagerUpgradeable");
      const multisigLogic = await MultisigLogic.deploy();

      const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
      const beacon = await Beacon.deploy(multisigLogic.address);

      const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
      const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
      await multisig.connect(executor).initialize([await owner1.getAddress()], 1);

      await expect(multisig.f([await owner1.getAddress()], 1)).to.be.revertedWith(
        "Initializable: contract is not initializing"
      );
      await expect(multisig.g([await owner1.getAddress()], 1)).to.be.revertedWith(
        "Initializable: contract is not initializing"
      );
      await expect(multisig.initialize([await owner1.getAddress()], 1)).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
      await multisig.beforeUpdateOwner();
    });
    it("MockSelfCallUpgradeable", async function () {
      const [executor] = await ethers.getSigners();

      const MultisigLogic = await ethers.getContractFactory("MockSelfCallUpgradeable");
      const multisigLogic = await MultisigLogic.deploy();

      const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
      const beacon = await Beacon.deploy(multisigLogic.address);

      const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
      const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
      await multisig.connect(executor).initialize();

      await expect(multisig.f()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.g()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });
    it("MockTokenHolderUpgradeable", async function () {
      const [executor] = await ethers.getSigners();

      const MultisigLogic = await ethers.getContractFactory("MockTokenHolderUpgradeable");
      const multisigLogic = await MultisigLogic.deploy();

      const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
      const beacon = await Beacon.deploy(multisigLogic.address);

      const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
      const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
      await multisig.connect(executor).initialize();

      await expect(multisig.f()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.g()).to.be.revertedWith("Initializable: contract is not initializing");
      await expect(multisig.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });
});

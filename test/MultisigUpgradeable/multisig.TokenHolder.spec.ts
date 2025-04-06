import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { getSequence } from "../utils/multisigUpgradeableUtils";
import { expect } from "chai";

describe("Multisig TokenHolder", function () {
  async function setupFixture() {
    const [owner1, executor1, executor2] = await ethers.getSigners();

    const [ERC20, ERC721, ERC1155] = await Promise.all([
      ethers.getContractFactory("ERC20PresetMinterPauser"),
      ethers.getContractFactory("ERC721PresetMinterPauserAutoId"),
      ethers.getContractFactory("ERC1155PresetMinterPauser"),
    ]);

    const [erc20, erc721, erc1155] = await Promise.all([
      ERC20.connect(executor1).deploy("", ""),
      ERC721.connect(executor1).deploy("", "", ""),
      ERC1155.connect(executor1).deploy(""),
    ]);

    const MultisigLogic = await ethers.getContractFactory("MockMultisigUpgradeable");
    const multisigLogic = await MultisigLogic.deploy();

    const Beacon = await ethers.getContractFactory("UpgradeableBeacon");
    const beacon = await Beacon.deploy(multisigLogic.address);

    const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
    const multisig = MultisigLogic.attach((await BeaconProxy.deploy(beacon.address, "0x")).address);
    await multisig.connect(executor1).initialize([owner1.getAddress()], 1);

    return { multisig, erc20, erc721, erc1155, owner1, executor1, executor2 };
  }

  describe("fallback", function () {
    it("should be able to receive native token", async () => {
      const { multisig, owner1 } = await loadFixture(setupFixture);

      const value = 1000000000;
      await owner1.sendTransaction({ to: multisig.address, value });
      expect(await multisig.provider.getBalance(multisig.address)).to.be.equal(value);
    });

    it("should be able to receive ERC20 token", async () => {
      const { multisig, erc20, owner1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      await erc20.mint(await owner1.getAddress(), amount);
      await erc20.connect(owner1).transfer(multisig.address, amount);
      expect(await erc20.balanceOf(multisig.address)).to.be.equal(amount);
    });

    it("should be able to receive ERC721 token", async () => {
      const { multisig, erc721, owner1 } = await loadFixture(setupFixture);

      await erc721.mint(await owner1.getAddress());
      await erc721.connect(owner1).transferFrom(await owner1.getAddress(), multisig.address, "0");
      expect(await erc721.balanceOf(multisig.address)).to.be.equal(1);
    });

    it("should be able to receive ERC1155 token", async () => {
      const { multisig, erc1155, owner1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      const tokenId = 1;
      await erc1155.mint(await owner1.getAddress(), tokenId, amount, "0x");
      await erc1155
        .connect(owner1)
        .safeTransferFrom(await owner1.getAddress(), multisig.address, tokenId, amount, "0x");
      expect(await erc1155.balanceOf(multisig.address, tokenId)).to.be.equal(amount);
    });
  });

  describe("send Token", function () {
    it("should be able to send native token", async () => {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      const value = 100000000;
      await owner1.sendTransaction({ to: multisig.address, value });

      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(owner1.getAddress(), value, 200000, "0x")
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await expect(multisig.connect(executor1).executeTransaction(sequence)).changeEtherBalance(
        await owner1.getAddress(),
        value
      );
    });

    it("should be able to send ERC20 token", async () => {
      const { multisig, erc20, owner1, executor1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      await erc20.mint(multisig.address, amount);

      const data = erc20.interface.encodeFunctionData("transfer", [await owner1.getAddress(), amount]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(erc20.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await expect(multisig.connect(executor1).executeTransaction(sequence)).changeTokenBalances(
        erc20,
        [multisig.address, await owner1.getAddress()],
        [-amount, amount]
      );
    });

    it("should be able to send ERC721 token", async () => {
      const { multisig, erc721, owner1, executor1 } = await loadFixture(setupFixture);

      await erc721.mint(multisig.address);

      const data = erc721.interface.encodeFunctionData("transferFrom", [
        multisig.address,
        await owner1.getAddress(),
        0,
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(erc721.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await erc721.balanceOf(await owner1.getAddress())).to.be.equal(1);
    });

    it("should be able to send ERC1155 token", async () => {
      const { multisig, erc1155, owner1, executor1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      const tokenId = 1;
      await erc1155.mint(multisig.address, tokenId, amount, "0x");

      const data = erc1155.interface.encodeFunctionData("safeTransferFrom", [
        multisig.address,
        await owner1.getAddress(),
        tokenId,
        amount,
        "0x",
      ]);
      const sequence = getSequence(
        await multisig.connect(executor1).generateTransaction(erc1155.address, 0, 200000, data)
      );
      await multisig.connect(owner1).signTransaction(sequence);
      await multisig.connect(executor1).executeTransaction(sequence);

      expect(await erc1155.balanceOf(await owner1.getAddress(), tokenId)).to.be.equal(amount);
    });
  });
  describe("multiple", function () {
    it("send native, erc20, erc721", async () => {
      const { multisig, owner1, executor1, erc20, erc721 } = await loadFixture(setupFixture);

      const value = 100000000;
      await owner1.sendTransaction({ to: multisig.address, value });
      const amount = 10000000000000;
      await erc20.mint(multisig.address, amount);

      await erc721.mint(multisig.address);

      const dataERC20 = erc20.interface.encodeFunctionData("transfer", [await owner1.getAddress(), amount]);
      const dataERC721 = erc721.interface.encodeFunctionData("transferFrom", [
        multisig.address,
        await owner1.getAddress(),
        0,
      ]);

      const transactions = [];
      transactions.push({ to: await owner1.getAddress(), value: value, gas: 200000, data: "0x" });
      transactions.push({ to: erc20.address, value: 0, gas: 200000, data: dataERC20 });
      transactions.push({ to: erc721.address, value: 0, gas: 200000, data: dataERC721 });

      const sequence = getSequence(await multisig.connect(executor1).generateTransactions(transactions));
      await multisig.connect(owner1).signTransaction(sequence);
      await expect(multisig.connect(executor1).executeTransaction(sequence))
        .changeEtherBalance(await owner1.getAddress(), value)
        .changeTokenBalances(erc20, [multisig.address, await owner1.getAddress()], [-amount, amount]);
      expect(await erc721.balanceOf(await owner1.getAddress())).to.be.equal(1);
    });
  });
});

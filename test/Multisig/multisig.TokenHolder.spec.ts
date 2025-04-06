import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { executeTransactionWithSigners, sendNativeTokenWithSigners } from "../utils/multisigUtils";
import { expect } from "chai";

describe("Multisig TokenHolder", function () {
  async function setupFixture() {
    const [owner1, executor1] = await ethers.getSigners();

    const [Multisig, ERC20, ERC721, ERC1155] = await Promise.all([
      ethers.getContractFactory("Multisig"),
      ethers.getContractFactory("ERC20PresetMinterPauser"),
      ethers.getContractFactory("ERC721PresetMinterPauserAutoId"),
      ethers.getContractFactory("ERC1155PresetMinterPauser"),
    ]);

    const [multisig, erc20, erc721, erc1155] = await Promise.all([
      Multisig.connect(executor1).deploy([await owner1.getAddress()], 1),
      ERC20.connect(executor1).deploy("", ""),
      ERC721.connect(executor1).deploy("", "", ""),
      ERC1155.connect(executor1).deploy(""),
    ]);

    return { multisig, erc20, erc721, erc1155, owner1, executor1 };
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
      const balance = await owner1.getBalance();
      await sendNativeTokenWithSigners(await owner1.getAddress(), value, multisig, executor1, [owner1]);
      expect(await owner1.getBalance()).to.be.equal(balance.add(value));
    });

    it("should be able to send ERC20 token", async () => {
      const { multisig, erc20, owner1, executor1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      await erc20.mint(multisig.address, amount);
      await executeTransactionWithSigners(erc20, "transfer", [await owner1.getAddress(), amount], multisig, executor1, [
        owner1,
      ]);
      expect(await erc20.balanceOf(await owner1.getAddress())).to.be.equal(amount);
    });

    it("should be able to send ERC721 token", async () => {
      const { multisig, erc721, owner1, executor1 } = await loadFixture(setupFixture);

      await erc721.mint(multisig.address);
      await executeTransactionWithSigners(
        erc721,
        "transferFrom",
        [multisig.address, await owner1.getAddress(), 0],
        multisig,
        executor1,
        [owner1]
      );
      expect(await erc721.balanceOf(await owner1.getAddress())).to.be.equal(1);
    });

    it("should be able to send ERC1155 token", async () => {
      const { multisig, erc1155, owner1, executor1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      const tokenId = 1;
      await erc1155.mint(multisig.address, tokenId, amount, "0x");
      await executeTransactionWithSigners(
        erc1155,
        "safeTransferFrom",
        [multisig.address, await owner1.getAddress(), tokenId, amount, "0x"],
        multisig,
        executor1,
        [owner1]
      );
      expect(await erc1155.balanceOf(await owner1.getAddress(), tokenId)).to.be.equal(amount);
    });
  });
});

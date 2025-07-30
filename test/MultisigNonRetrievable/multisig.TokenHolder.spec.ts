import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { executeTransactionWithSigners, sendNativeTokenWithSigners } from "../utils/multisigUtils";
import { expect } from "chai";

describe("MultisigNonRetrievable TokenHolder", function () {
  async function setupFixture() {
    const [owner1, executor1] = await ethers.getSigners();

    const [MultisigNonRetrievable, ERC20, ERC721, ERC1155] = await Promise.all([
      ethers.getContractFactory("MultisigNonRetrievable"),
      ethers.getContractFactory("ERC20PresetMinterPauser"),
      ethers.getContractFactory("ERC721PresetMinterPauserAutoId"),
      ethers.getContractFactory("ERC1155PresetMinterPauser"),
    ]);

    const [multisigNonRetrievable, erc20, erc721, erc1155] = await Promise.all([
      MultisigNonRetrievable.connect(executor1).deploy([await owner1.getAddress()], 1),
      ERC20.connect(executor1).deploy("", ""),
      ERC721.connect(executor1).deploy("", "", ""),
      ERC1155.connect(executor1).deploy(""),
    ]);

    return { multisigNonRetrievable, erc20, erc721, erc1155, owner1, executor1 };
  }

  describe("fallback", function () {
    it("should be able to receive native token", async () => {
      const { multisigNonRetrievable, owner1 } = await loadFixture(setupFixture);

      const value = 1000000000;
      await owner1.sendTransaction({ to: multisigNonRetrievable.address, value });
      expect(await multisigNonRetrievable.provider.getBalance(multisigNonRetrievable.address)).to.be.equal(value);
    });

    it("should be able to receive ERC20 token", async () => {
      const { multisigNonRetrievable, erc20, owner1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      await erc20.mint(await owner1.getAddress(), amount);
      await erc20.connect(owner1).transfer(multisigNonRetrievable.address, amount);
      expect(await erc20.balanceOf(multisigNonRetrievable.address)).to.be.equal(amount);
    });

    it("should be able to receive ERC721 token", async () => {
      const { multisigNonRetrievable, erc721, owner1 } = await loadFixture(setupFixture);

      await erc721.mint(await owner1.getAddress());
      await erc721.connect(owner1).transferFrom(await owner1.getAddress(), multisigNonRetrievable.address, "0");
      expect(await erc721.balanceOf(multisigNonRetrievable.address)).to.be.equal(1);
    });

    it("should be able to receive ERC1155 token", async () => {
      const { multisigNonRetrievable, erc1155, owner1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      const tokenId = 1;
      await erc1155.mint(await owner1.getAddress(), tokenId, amount, "0x");
      await erc1155
        .connect(owner1)
        .safeTransferFrom(await owner1.getAddress(), multisigNonRetrievable.address, tokenId, amount, "0x");
      expect(await erc1155.balanceOf(multisigNonRetrievable.address, tokenId)).to.be.equal(amount);
    });
  });

  describe("send Token", function () {
    it("should be able to send native token", async () => {
      const { multisigNonRetrievable, owner1, executor1 } = await loadFixture(setupFixture);

      const value = 100000000;
      const balance = await owner1.getBalance();
      await sendNativeTokenWithSigners(await owner1.getAddress(), value, multisigNonRetrievable, executor1, [owner1]);
      expect(await owner1.getBalance()).to.be.equal(balance.add(value));
    });

    it("should be able to send ERC20 token", async () => {
      const { multisigNonRetrievable, erc20, owner1, executor1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      await erc20.mint(multisigNonRetrievable.address, amount);
      await executeTransactionWithSigners(
        erc20,
        "transfer",
        [await owner1.getAddress(), amount],
        multisigNonRetrievable,
        executor1,
        [owner1]
      );
      expect(await erc20.balanceOf(await owner1.getAddress())).to.be.equal(amount);
    });

    it("should be able to send ERC721 token", async () => {
      const { multisigNonRetrievable, erc721, owner1, executor1 } = await loadFixture(setupFixture);

      await erc721.mint(multisigNonRetrievable.address);
      await executeTransactionWithSigners(
        erc721,
        "transferFrom",
        [multisigNonRetrievable.address, await owner1.getAddress(), 0],
        multisigNonRetrievable,
        executor1,
        [owner1]
      );
      expect(await erc721.balanceOf(await owner1.getAddress())).to.be.equal(1);
    });

    it("should be able to send ERC1155 token", async () => {
      const { multisigNonRetrievable, erc1155, owner1, executor1 } = await loadFixture(setupFixture);

      const amount = 10000000000000;
      const tokenId = 1;
      await erc1155.mint(multisigNonRetrievable.address, tokenId, amount, "0x");
      await executeTransactionWithSigners(
        erc1155,
        "safeTransferFrom",
        [multisigNonRetrievable.address, await owner1.getAddress(), tokenId, amount, "0x"],
        multisigNonRetrievable,
        executor1,
        [owner1]
      );
      expect(await erc1155.balanceOf(await owner1.getAddress(), tokenId)).to.be.equal(amount);
    });
  });
});

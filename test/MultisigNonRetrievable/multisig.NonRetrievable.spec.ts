import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { compareAddress, generateContractCall } from "../utils/multisigUtils";
import { AddressZero } from "@ethersproject/constants";
import nxErrors from "../utils/nx-errors";

describe("MultisigNonRetrievable Transcation", function () {
  async function setupFixture() {
    const [owner1, owner2, owner3, executor] = (await ethers.getSigners()).sort(compareAddress);
    const [MultisigNonRetrievable, MockERC20BridgeToken, MockERC1155BridgeToken] = await Promise.all([
      ethers.getContractFactory("MultisigNonRetrievable"),
      ethers.getContractFactory("MockERC20BridgeToken"),
      ethers.getContractFactory("MockERC1155BridgeToken"),
    ]);
    const [multisigNonRetrievable, mockERC20BridgeToken, mockERC1155BridgeToken] = await Promise.all([
      await MultisigNonRetrievable.connect(executor).deploy(
        [await owner1.getAddress(), await owner2.getAddress(), await owner3.getAddress()],
        2
      ),
      await MockERC20BridgeToken.deploy(AddressZero, owner1.address),
      await MockERC1155BridgeToken.deploy(AddressZero, owner1.address),
    ]);

    await mockERC20BridgeToken.connect(owner1).transferOwnership(multisigNonRetrievable.address);
    await mockERC1155BridgeToken.connect(owner1).transferOwnership(multisigNonRetrievable.address);

    return { multisigNonRetrievable, mockERC20BridgeToken, mockERC1155BridgeToken, owner1, owner2, owner3, executor };
  }

  describe("NonRetrievable", function () {
    it("should revert if request data is transferOwnership", async function () {
      const { multisigNonRetrievable, mockERC20BridgeToken, owner1, executor } = await loadFixture(setupFixture);

      const multisigTransferOwnershipTx = {
        requester: await executor.getAddress(),
        ...generateContractCall(mockERC20BridgeToken, "transferOwnership", [executor.address]),
      };

      const { to, value, gas, salt, data } = multisigTransferOwnershipTx;

      await expect(
        multisigNonRetrievable.connect(owner1).generateTransaction(to, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.nonRetrievable);
    });

    it("should revert if request data is retrieve ERC20/ERC721", async function () {
      const { multisigNonRetrievable, mockERC20BridgeToken, owner1, executor } = await loadFixture(setupFixture);

      const multisigRetrieveTx = {
        requester: await executor.getAddress(),
        ...generateContractCall(mockERC20BridgeToken, "retrieve", [executor.address, owner1.address, 1, "retrieve"]),
      };

      const { to, value, gas, salt, data } = multisigRetrieveTx;

      await expect(
        multisigNonRetrievable.connect(owner1).generateTransaction(to, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.nonRetrievable);
    });

    it("should revert if request data is retrieve ERC20/ERC721", async function () {
      const { multisigNonRetrievable, mockERC1155BridgeToken, owner1, executor } = await loadFixture(setupFixture);

      const multisigRetrieveTx = {
        requester: await executor.getAddress(),
        ...generateContractCall(mockERC1155BridgeToken, "retrieve", [
          executor.address,
          owner1.address,
          1,
          1,
          "retrieve",
        ]),
      };

      const { to, value, gas, salt, data } = multisigRetrieveTx;

      await expect(
        multisigNonRetrievable.connect(owner1).generateTransaction(to, value, gas, salt, data)
      ).to.be.revertedWith(nxErrors.Multisig.nonRetrievable);
    });
  });
});

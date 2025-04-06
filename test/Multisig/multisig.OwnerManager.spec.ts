import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { compareAddress, executeTransactionWithSigners } from "../utils/multisigUtils";
import { AddressZero } from "@ethersproject/constants";
import nxErrors from "../utils/nx-errors";

describe("Multisig OwnerManager", function () {
  async function setupFixture() {
    const [owner1, owner2, owner3, executor1, executor2] = (await ethers.getSigners()).sort(compareAddress);

    const Multisig = await ethers.getContractFactory("Multisig");
    const multisig = await Multisig.connect(executor1).deploy([await owner1.getAddress()], 1);

    return { Multisig, multisig, owner1, owner2, owner3, executor1, executor2 };
  }

  async function ownerAddedFixture() {
    const { multisig, owner1, owner2, executor1, ...rest } = await loadFixture(setupFixture);
    await executeTransactionWithSigners(multisig, "addOwner", [await owner2.getAddress()], multisig, executor1, [
      owner1,
    ]);

    return { multisig, owner1, owner2, executor1, ...rest };
  }

  describe("constructor", function () {
    it("should set at least 1 owner", async function () {
      const { Multisig } = await loadFixture(setupFixture);

      await expect(Multisig.deploy([], 0)).to.be.revertedWith(nxErrors.OwnerManager.invalidRequest);
    });

    it("should set threshold to be less than or equal to the length of owner", async function () {
      const { Multisig, owner1 } = await loadFixture(setupFixture);
      const owners = [await owner1.getAddress()];
      await expect(Multisig.deploy(owners, owners.length + 1)).to.be.revertedWith(
        nxErrors.OwnerManager.invalidThreshold
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

      await expect(multisig.connect(owner1).grantExecutor(await owner1.getAddress())).to.be.revertedWith(
        nxErrors.SelfCall.forbidden
      );
    });

    it("should set new executor", async function () {
      const { multisig, owner1, executor1, executor2 } = await loadFixture(setupFixture);

      await executeTransactionWithSigners(
        multisig,
        "grantExecutor",
        [await executor2.getAddress()],
        multisig,
        executor1,
        [owner1]
      );

      expect(await multisig.isExecutor(await executor2.getAddress())).to.be.equal(true);
    });

    it("should revert if new executor is owner", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "grantExecutor", [await owner1.getAddress()], multisig, executor1, [
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.Multisig.invalidAddress);
    });

    it("should revert if new executor is already executor", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "grantExecutor", [await executor1.getAddress()], multisig, executor1, [
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.ExecutorManager.grantExecutorConflict);
    });
  });

  describe("revokeExecutor", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).revokeExecutor(await executor1.getAddress())).to.be.revertedWith(
        nxErrors.SelfCall.forbidden
      );
    });

    it("should unset executor", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await executeTransactionWithSigners(
        multisig,
        "revokeExecutor",
        [await executor1.getAddress()],
        multisig,
        executor1,
        [owner1]
      );
      expect(await multisig.isExecutor(await executor1.getAddress())).to.be.equal(false);
    });

    it("should revert if address to revoke is not executor", async function () {
      const { multisig, owner1, executor1, executor2 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "revokeExecutor", [await executor2.getAddress()], multisig, executor1, [
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.ExecutorManager.revokeExecutorConflict);
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
        nxErrors.SelfCall.forbidden
      );
    });

    it("should add owner", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(setupFixture);

      await executeTransactionWithSigners(multisig, "addOwner", [await owner2.getAddress()], multisig, executor1, [
        owner1,
      ]);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner2.getAddress()]);
    });

    it("should revert if newOwner is zero address", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "addOwner", [AddressZero], multisig, executor1, [owner1])
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidAddress);
    });

    it("should revert if newOwner is already owner", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "addOwner", [await owner1.getAddress()], multisig, executor1, [owner1])
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidOwner);
    });

    it("should revert if newOwner is executor", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "addOwner", [await executor1.getAddress()], multisig, executor1, [
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.Multisig.invalidAddress);
    });
  });

  describe("addOwnerWithNewThreshold", function () {
    it("should revert if msg sender is not multisig contract", async function () {
      const { multisig, owner1, owner2 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).addOwnerWithNewThreshold(await owner2.getAddress(), 1)).to.be.revertedWith(
        nxErrors.SelfCall.forbidden
      );
    });

    it("should add owner and set new threshold", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(setupFixture);

      await executeTransactionWithSigners(
        multisig,
        "addOwnerWithNewThreshold",
        [await owner2.getAddress(), 2],
        multisig,
        executor1,
        [owner1]
      );

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner2.getAddress()]);
    });
  });

  describe("removeOwner", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).removeOwner(await owner1.getAddress())).to.be.revertedWith(
        nxErrors.SelfCall.forbidden
      );
    });

    it("should remove owner", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      await executeTransactionWithSigners(multisig, "removeOwner", [await owner2.getAddress()], multisig, executor1, [
        owner1,
      ]);

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress()]);
    });

    it("should revert if owners length - 1 is less than threshold", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "removeOwner", [await owner1.getAddress()], multisig, executor1, [
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidThreshold);
    });

    it("should revert if owner to remove is not owner", async function () {
      const { multisig, owner1, owner3, executor1 } = await loadFixture(ownerAddedFixture);

      await expect(
        executeTransactionWithSigners(multisig, "removeOwner", [await owner3.getAddress()], multisig, executor1, [
          owner1,
        ])
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidOwner);
    });
  });

  describe("removeOwnerWithNewThreshold", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1, owner2 } = await loadFixture(setupFixture);

      await expect(
        multisig.connect(owner1).removeOwnerWithNewThreshold(await owner2.getAddress(), 1)
      ).to.be.revertedWith(nxErrors.SelfCall.forbidden);
    });

    it("should remove owner and set new threshold", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      await executeTransactionWithSigners(
        multisig,
        "removeOwnerWithNewThreshold",
        [await owner2.getAddress(), 1],
        multisig,
        executor1,
        [owner1]
      );

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress()]);
      expect(await multisig.threshold()).to.be.equal(1);
    });

    it("should revert if the length of owner - 1 is less than newThreshold", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      await expect(
        executeTransactionWithSigners(
          multisig,
          "removeOwnerWithNewThreshold",
          [await owner2.getAddress(), 2],
          multisig,
          executor1,
          [owner1, owner2]
        )
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidThreshold);
    });
  });

  describe("changeOwner", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1, owner2 } = await loadFixture(setupFixture);
      await expect(
        multisig.connect(owner1).changeOwner(await owner1.getAddress(), await owner2.getAddress())
      ).to.be.revertedWith(nxErrors.SelfCall.forbidden);
    });

    it("should changed owner", async function () {
      const { multisig, owner1, owner2, owner3, executor1 } = await loadFixture(ownerAddedFixture);

      await executeTransactionWithSigners(
        multisig,
        "changeOwner",
        [await owner2.getAddress(), await owner3.getAddress()],
        multisig,
        executor1,
        [owner1, owner2]
      );

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner3.getAddress()]);
    });

    it("should revert if newOwner is already owner", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      await expect(
        executeTransactionWithSigners(
          multisig,
          "changeOwner",
          [await owner1.getAddress(), await owner2.getAddress()],
          multisig,
          executor1,
          [owner1, owner2]
        )
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidOwner);
    });

    it("should revert if prevOwner and newOwner is same", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(
          multisig,
          "changeOwner",
          [await owner1.getAddress(), await owner1.getAddress()],
          multisig,
          executor1,
          [owner1]
        )
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidOwner);
    });

    it("should revert if prevOwner is not owner", async function () {
      const { multisig, owner1, owner2, owner3, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(
          multisig,
          "changeOwner",
          [await owner3.getAddress(), await owner2.getAddress()],
          multisig,
          executor1,
          [owner1]
        )
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidOwner);
    });
  });

  describe("changeOwnerWithNewThreshold", function () {
    it("should revert if is is not be called by the contract itself", async function () {
      const { multisig, owner1, owner2, owner3 } = await loadFixture(setupFixture);

      await expect(
        multisig.connect(owner1).changeOwnerWithNewThreshold(await owner2.getAddress(), await owner3.getAddress(), 1)
      ).to.be.revertedWith(nxErrors.SelfCall.forbidden);
    });

    it("should change owner and set new threhold", async function () {
      const { multisig, owner1, owner2, owner3, executor1 } = await loadFixture(ownerAddedFixture);

      await executeTransactionWithSigners(
        multisig,
        "changeOwnerWithNewThreshold",
        [await owner2.getAddress(), await owner3.getAddress(), 1],
        multisig,
        executor1,
        [owner1, owner2]
      );

      expect(await multisig.getAllOwners()).to.be.deep.equal([await owner1.getAddress(), await owner3.getAddress()]);
      expect(await multisig.threshold()).to.be.equal(1);
    });

    it("should revert if prevOwner and newOwner is same", async function () {
      const { multisig, owner1, owner2, executor1 } = await loadFixture(ownerAddedFixture);

      await expect(
        executeTransactionWithSigners(
          multisig,
          "changeOwnerWithNewThreshold",
          [await owner2.getAddress(), await owner2.getAddress(), 1],
          multisig,
          executor1,
          [owner1]
        )
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidOwner);
    });
  });

  describe("changeThreshold", function () {
    it("should revert if it is not called by the contract itself", async function () {
      const { multisig, owner1 } = await loadFixture(setupFixture);

      await expect(multisig.connect(owner1).changeThreshold(1)).to.be.revertedWith(nxErrors.SelfCall.forbidden);
    });

    it("should revert if newThreshold is 0", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "changeThreshold", [0], multisig, executor1, [owner1])
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidThreshold);
    });

    it("should revert if newThreshold is greater than the length of owner", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(setupFixture);

      await expect(
        executeTransactionWithSigners(multisig, "changeThreshold", [3], multisig, executor1, [owner1])
      ).to.be.revertedWith(nxErrors.OwnerManager.invalidThreshold);
    });

    it("should change the threshold", async function () {
      const { multisig, owner1, executor1 } = await loadFixture(ownerAddedFixture);
      await executeTransactionWithSigners(multisig, "changeThreshold", [2], multisig, executor1, [owner1]);

      expect(await multisig.threshold()).to.be.equal(2);
    });
  });
});

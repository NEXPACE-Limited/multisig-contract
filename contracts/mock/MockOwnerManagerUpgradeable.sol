// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnerManagerUpgradeable } from "../access/OwnerManagerUpgradeable.sol";

contract MockOwnerManagerUpgradeable is OwnerManagerUpgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] memory owners_, uint256 threshold_) public initializer {
        __OwnerManager_init(owners_, threshold_);
    }

    function f(address[] memory owners_, uint256 threshold_) public {
        __OwnerManager_init(owners_, threshold_);
    }

    function g(address[] memory owners_, uint256 threshold_) public {
        __OwnerManager_init_unchained(owners_, threshold_);
    }

    function beforeUpdateOwner() public {
        _beforeUpdateOwner();
    }
}

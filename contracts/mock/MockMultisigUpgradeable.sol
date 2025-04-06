// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MultisigUpgradeable } from "../MultisigUpgradeable.sol";

contract MockMultisigUpgradeable is MultisigUpgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] memory owners_, uint256 threshold_) public initializer {
        __Multisig_init(owners_, threshold_);
    }

    function f() public {
        __Multisig_init(new address[](0), 1);
    }

    function g() public {
        __Multisig_init_unchained();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { TokenHolderUpgradeable } from "../common/TokenHolderUpgradeable.sol";

contract MockTokenHolderUpgradeable is TokenHolderUpgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __TokenHolder_init();
    }

    function f() public {
        __TokenHolder_init();
    }

    function g() public {
        __TokenHolder_init_unchained();
    }
}

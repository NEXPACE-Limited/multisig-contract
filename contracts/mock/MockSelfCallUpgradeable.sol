// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { SelfCallUpgradeable } from "../common/SelfCallUpgradeable.sol";

contract MockSelfCallUpgradeable is SelfCallUpgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __SelfCall_init();
    }

    function f() public {
        __SelfCall_init();
    }

    function g() public {
        __SelfCall_init_unchained();
    }
}

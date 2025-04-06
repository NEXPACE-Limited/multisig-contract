// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ExecutorManagerUpgradeable } from "../access/ExecutorManagerUpgradeable.sol";

contract MockExecutorManagerUpgradeable is ExecutorManagerUpgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ExecutorManager_init();
    }

    function f() public {
        __ExecutorManager_init();
    }

    function g() public {
        __ExecutorManager_init_unchained();
    }
}

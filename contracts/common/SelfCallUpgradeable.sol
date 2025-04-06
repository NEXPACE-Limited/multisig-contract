// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title SelfCallUpgradeable -  Validates the sender address during self-calls of the contract.
 */
contract SelfCallUpgradeable is Context, Initializable {
    /* solhint-disable-next-line func-name-mixedcase */
    function __SelfCall_init() internal onlyInitializing {
        __SelfCall_init_unchained();
    }

    /* solhint-disable-next-line func-name-mixedcase */
    function __SelfCall_init_unchained() internal onlyInitializing {}

    modifier isSelfCall() {
        require(_msgSender() == address(this), "SelfCallUpgradeable/forbidden: caller is not this contract");
        _;
    }

    uint256[50] private __gap;
}

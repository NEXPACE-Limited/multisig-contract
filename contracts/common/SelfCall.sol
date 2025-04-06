// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Context } from "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title SelfCall -  Validates the sender address during self-calls of the contract.
 */
contract SelfCall is Context {
    modifier isSelfCall() {
        require(_msgSender() == address(this), "SelfCall/forbidden: caller is not this contract");
        _;
    }
}

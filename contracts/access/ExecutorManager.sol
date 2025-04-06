// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { SelfCall } from "../common/SelfCall.sol";

/**
 * @title ExecutorManager - Manages executors for a multisig contract.
 * @notice This contract provides functionalities for managing the list of executor
 *         who can generate or execute(cancel) transaction in multisig contract.
 */
contract ExecutorManager is Context, SelfCall {
    mapping(address => bool) private _isExecutor;

    event ExecutorGranted(address indexed account);
    event ExecutorRevoked(address indexed account);

    constructor() {
        _isExecutor[_msgSender()] = true;
    }

    /**
     * @notice Grants executor privilege to `account`.
     * @dev Callable only via self call.
     * @param account Address to be granted executor privilege.
     */
    function grantExecutor(address account) external virtual isSelfCall {
        _grantExecutor(account);
    }

    /**
     * @notice Revokes executor privilege from `account`.
     * @dev Callable only via self call.
     * @param account Address to be revoked executor privilege.
     */
    function revokeExecutor(address account) external isSelfCall {
        require(isExecutor(account), "ExecutorManager/revokeExecutorConflict: account is already a non-executor");
        _isExecutor[account] = false;

        emit ExecutorRevoked(account);
    }

    /**
     * @notice Returns if `account` is an executor.
     * @return Boolean if `account` is an executor.
     */
    function isExecutor(address account) public view returns (bool) {
        return _isExecutor[account];
    }

    /**
     * @notice Grants executor privilege to `account`.
     * @dev Can specify conditions for the `account` by override this function.
     * @param account Address to be granted executor privilege.
     */
    function _grantExecutor(address account) internal virtual {
        require(!isExecutor(account), "ExecutorManager/grantExecutorConflict: account is already an executor");
        _isExecutor[account] = true;

        emit ExecutorGranted(account);
    }
}

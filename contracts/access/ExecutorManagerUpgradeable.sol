// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ExecutorManagerUpgradeable - Manages executors for a multisig contract.
 * @notice This contract provides functionalities for managing the list of executor
 *         who can generate or execute(cancel) transaction in multisig contract.
 */
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { SelfCallUpgradeable } from "../common/SelfCallUpgradeable.sol";

contract ExecutorManagerUpgradeable is Context, Initializable, SelfCallUpgradeable {
    mapping(address => bool) private _isExecutor;

    event ExecutorGranted(address indexed account);
    event ExecutorRevoked(address indexed account);

    /* solhint-disable-next-line func-name-mixedcase */
    function __ExecutorManager_init() internal onlyInitializing {
        __ExecutorManager_init_unchained();
    }

    /* solhint-disable-next-line func-name-mixedcase */
    function __ExecutorManager_init_unchained() internal onlyInitializing {
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
        require(
            isExecutor(account),
            "ExecutorManagerUpgradeable/revokeExecutorConflict: account is already a non-executor"
        );
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
        require(
            !isExecutor(account),
            "ExecutorManagerUpgradeable/grantExecutorConflict: account is already an executor"
        );
        _isExecutor[account] = true;

        emit ExecutorGranted(account);
    }

    uint256[49] private __gap;
}

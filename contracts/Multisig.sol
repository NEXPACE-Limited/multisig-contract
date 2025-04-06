// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { OwnerManager } from "./access/OwnerManager.sol";
import { ExecutorManager } from "./access/ExecutorManager.sol";
import { TokenHolder } from "./common/TokenHolder.sol";

/**
 * @title Multisig - A multisignature contract based on EIP-712.
 * @dev Main features:
 *      - Executors: List of addresses that can create, execute, or cancel transaction requests.
 *      - Owners: List of addresses that can sign transactions, including those with executor privileges.
 *      - Threshold: Number of required confirmations to execute a transaction.
 *      - Transaction Status: Transaction requests are managed step by step on-chain.
 *      - Salt: A unique identifier for distinguishing identical requests.
 *      - Signature: Value signed by the owner address for a transaction request.
 *      - TokenHolder: Includes functions related to token transfers.
 */
contract Multisig is Context, EIP712("Multisig", "0.0.1"), OwnerManager, ExecutorManager, TokenHolder {
    using ECDSA for bytes32;

    enum Status {
        UNDEFINED,
        GENERATED,
        CANCELLED,
        EXECUTED
    }

    bytes32 private constant TX_TYPE_HASH =
        keccak256("MultisigTx(address requester,address to,uint256 value,uint256 gas,bytes32 salt,bytes data)");

    mapping(bytes32 => Status) private _txStatus;

    event CancelTransaction(
        address indexed requester,
        address indexed to,
        uint256 value,
        uint256 gas,
        bytes32 salt,
        bytes data,
        bytes32 indexed txId
    );
    event ExecuteTransaction(
        address indexed requester,
        address indexed to,
        uint256 value,
        uint256 gas,
        bytes32 salt,
        bytes data,
        bytes32 indexed txId
    );
    event GenerateTransaction(
        address indexed requester,
        address indexed to,
        uint256 value,
        uint256 gas,
        bytes32 salt,
        bytes data,
        bytes32 indexed txId
    );

    constructor(address[] memory _owners, uint256 threshold) OwnerManager(_owners, threshold) {}

    modifier onlyExecutorOrOwner() {
        require(
            isExecutor(_msgSender()) || isOwner(_msgSender()),
            "Multisig/executorForbidden: caller is neither the owner nor an executor"
        );
        _;
    }

    /**
     * @notice Generate a transaction.
     * @param to The target address where the transaction will be sent.
     * @param value The amount of native tokens to be sent in the transaction.
     * @param gas The maximum amount of gas to be used for the transaction.
     * @param salt A unique identifier for the transaction.
     * @param data The data payload of the transaction.
     * @return txId The hash value of transaction request
     */
    function generateTransaction(
        address to,
        uint256 value,
        uint256 gas,
        bytes32 salt,
        bytes calldata data
    ) external onlyExecutorOrOwner returns (bytes32 txId) {
        require(to != address(0), "Multisig/invalidAddress: transaction to zero address");

        txId = hashTransaction(_msgSender(), to, value, gas, salt, data);
        require(
            _txStatus[txId] == Status.UNDEFINED,
            "Multisig/invalidRequest: transaction has already been generated, cancelled, or executed"
        );

        _txStatus[txId] = Status.GENERATED;

        emit GenerateTransaction(_msgSender(), to, value, gas, salt, data, txId);
    }

    function cancelTransaction(address to, uint256 value, uint256 gas, bytes32 salt, bytes calldata data) external {
        bytes32 txId = hashTransaction(_msgSender(), to, value, gas, salt, data);
        require(
            _txStatus[txId] == Status.GENERATED,
            "Multisig/invalidRequest: transaction has not been generated or msg sender is not requester"
        );

        _txStatus[txId] = Status.CANCELLED;

        emit CancelTransaction(_msgSender(), to, value, gas, salt, data, txId);
    }

    /**
     * @notice Execute a transaction with signatures.
     * @param to The target address where the transaction will be sent.
     * @param value The amount of native tokens to be sent in the transaction.
     * @param gas The maximum amount of gas to be used for the transaction.
     * @param salt A unique identifier for the transaction.
     * @param data The data payload of the transaction.
     * @param signatures An array of signatures, each generated using EIP-712, authorizing the transaction
     */
    function executeTransaction(
        address to,
        uint256 value,
        uint256 gas,
        bytes32 salt,
        bytes calldata data,
        bytes[] calldata signatures
    ) external onlyExecutorOrOwner {
        bytes32 txId = hashTransaction(_msgSender(), to, value, gas, salt, data);
        require(
            _txStatus[txId] == Status.GENERATED,
            "Multisig/invalidRequest: transaction has not been generated or msg sender is not requester"
        );
        require(
            validateSignatures(txId, signatures),
            "Multisig/invalidSignature: not enough confirmations to execute transaction"
        );
        _txStatus[txId] = Status.EXECUTED;

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returnData) = to.call{ gas: gas, value: value }(data);
        Address.verifyCallResult(success, returnData, "Multisig/revert: transaction failed");

        if (gasleft() <= gas / 63) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                invalid()
            }
        }

        emit ExecuteTransaction(_msgSender(), to, value, gas, salt, data, txId);
    }

    /**
     * @notice Retrieve the current status of a transaction request.
     * @dev Transaction requests have different states:
     *      - UNDEFINED: Default value when the request is not created.
     *      - GENERATED: Value when the request is created.
     *      - EXECUTED or CANCELLED: Value when the request is executed(canceled).
     * @param txId The ID of the transaction request
     * @return current status of transaction request as a Status enum.
     */
    function txStatus(bytes32 txId) external view returns (Status) {
        return _txStatus[txId];
    }

    /**
     * @notice Validates the signatures for a given txId.
     * @param txId The ID of the transaction request
     * @param signatures An array of signatures, each generated using EIP-712, authorizing the transaction
     * @return Boolean if signature of txId is valid
     */
    function validateSignatures(bytes32 txId, bytes[] calldata signatures) public view returns (bool) {
        uint256 confirmCount = 0;
        address old;

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = txId.recover(signatures[i]);
            require(uint160(old) < uint160(signer), "Multisig/invalidSignature: signature is not valid");
            require(isOwner(signer), "Multisig/invalidSignature: signer is not owner");
            old = signer;
            confirmCount += 1;
        }

        return confirmCount >= threshold();
    }

    /**
     * @notice Calculate the hash value of a transaction request using _hashTypedDataV4.
     * @param requester The address of the requester
     * @param to The target address where the transaction will be sent.
     * @param value The amount of native tokens to be sent in the transaction.
     * @param gas The maximum amount of gas to be used for the transaction.
     * @param salt A unique identifier for the transaction.
     * @param data The data payload of the transaction.
     * @return The hash value of transaction request
     */
    function hashTransaction(
        address requester,
        address to,
        uint256 value,
        uint256 gas,
        bytes32 salt,
        bytes calldata data
    ) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(TX_TYPE_HASH, requester, to, value, gas, salt, keccak256(data))));
    }

    /**
     * @notice See {OwnerManager-_addOwner}.
     * @dev Overriden {OwnerManager-_addOwner} to prevent adding executor address as owner.
     */
    function _addOwner(address newOwner) internal override {
        require(!isExecutor(newOwner), "Multisig/invalidAddress: newOwner is Executor");
        super._addOwner(newOwner);
    }

    /**
     * @notice See {ExecutorManager-_grantExecutor}.
     * @dev Overriden {ExecutorManager-_grantExecutor} to prevent adding owner address as executor.
     */
    function _grantExecutor(address account) internal override {
        require(!isOwner(account), "Multisig/invalidAddress: new executor is owner");
        super._grantExecutor(account);
    }
}

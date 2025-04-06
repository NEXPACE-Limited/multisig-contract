// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { OwnerManagerUpgradeable } from "./access/OwnerManagerUpgradeable.sol";
import { ExecutorManagerUpgradeable } from "./access/ExecutorManagerUpgradeable.sol";
import { TokenHolderUpgradeable } from "./common/TokenHolderUpgradeable.sol";

/**
 * @title MultisigUpgradeable - A multisignature contract that using on-chain signature.
 * @dev Main features:
 *      - Executors: List of addresses that can create, execute, or cancel transaction requests.
 *      - Owners: List of addresses that can sign transactions, including those with executor privileges.
 *        Owners can sign transactions directly by calling {signTransaction}.
 *      - Threshold: Number of required confirmations to execute a transaction.
 *      - Transaction Status: Transaction requests are managed step by step on-chain.
 *      - Transaction Request : Manages transactions with TransactionRequest struct.
 *        It allows signing multiple transactions at once.
 *      - Sequence : Id of the transaction request.
 *      - TokenHolder: Includes functions related to token transfers.
 */
contract MultisigUpgradeable is Context, OwnerManagerUpgradeable, ExecutorManagerUpgradeable, TokenHolderUpgradeable {
    enum Status {
        UNDEFINED,
        GENERATED,
        CANCELLED,
        EXECUTED
    }

    struct Transaction {
        address to;
        uint256 value;
        uint256 gas;
        bytes data;
    }

    struct TransactionRequest {
        address requester;
        uint16 signedCount;
        Status txStatus;
        Transaction[] transactions;
    }

    TransactionRequest[] private _transactionRequests;
    mapping(uint256 => mapping(address => bool)) private _isSigned;
    uint256 private _ownerUpdatedSequence;

    event GenerateTransaction(uint256 indexed sequence, address indexed requester, Transaction[] transactions);
    event SignTransaction(uint256 indexed sequence, address indexed account);
    event CancelTransaction(uint256 indexed sequence);
    event ExecuteTransaction(uint256 indexed sequence);

    /* solhint-disable-next-line func-name-mixedcase */
    function __Multisig_init(address[] memory owners_, uint256 threshold_) internal onlyInitializing {
        __TokenHolder_init();
        __ExecutorManager_init();
        __OwnerManager_init(owners_, threshold_);
        __Multisig_init_unchained();
    }

    /* solhint-disable-next-line func-name-mixedcase */
    function __Multisig_init_unchained() internal onlyInitializing {}

    modifier onlyAtLeastExecutor() {
        require(
            isExecutor(_msgSender()) || isOwner(_msgSender()),
            "MultisigUpgradeable/executorForbidden: caller is neither the owner nor an executor"
        );
        _;
    }

    modifier onlyRequester(uint256 sequence) {
        require(
            _transactionRequests[sequence].requester == _msgSender(),
            "MultisigUpgradeable/requesterForbidden: caller is not a requester"
        );
        _;
    }

    modifier onlyTransactionGenerated(uint256 sequence) {
        require(
            _transactionRequests[sequence].txStatus == Status.GENERATED,
            "MultisigUpgradeable/invalidSequence: not in generated state"
        );
        _;
    }

    modifier whenTransactionExists(uint256 sequence) {
        require(sequence < _transactionRequests.length, "MultisigUpgradeable/invalidSequence: nonexistent sequence");
        _;
    }

    modifier isValidSequence(uint256 sequence) {
        require(sequence >= _ownerUpdatedSequence, "MultisigUpgradeable/invalidSequence: expired sequence");
        _;
    }

    /**
     * @notice Generates transaction request.
     * @param to The target address where the transaction will be sent.
     * @param value The amount of native tokens to be sent in the transaction.
     * @param gas The maximum amount of gas to be used for the transaction.
     * @param data The data payload of the transaction.
     * @return sequence The id of the transaction request.
     */
    function generateTransaction(
        address to,
        uint256 value,
        uint256 gas,
        bytes calldata data
    ) external onlyAtLeastExecutor returns (uint256 sequence) {
        Transaction[] memory transactions = new Transaction[](1);
        transactions[0] = Transaction({ to: to, value: value, gas: gas, data: data });

        return _generateTransaction(transactions);
    }

    /**
     * @notice Generates multiple transaction requests.
     * @param transactions list of the transaction data that contains `to`, `value`, `gas, `data`.
     * @return sequence The id of the transaction request.
     */
    function generateTransactions(
        Transaction[] calldata transactions
    ) external onlyAtLeastExecutor returns (uint256 sequence) {
        return _generateTransaction(transactions);
    }

    /**
     * @notice Cancels transaction requests
     * @param sequence The id of the transaction request.
     */
    function cancelTransaction(
        uint256 sequence
    ) external whenTransactionExists(sequence) onlyTransactionGenerated(sequence) onlyRequester(sequence) {
        _transactionRequests[sequence].txStatus = Status.CANCELLED;

        emit CancelTransaction(sequence);
    }

    /**
     * @notice Signs transaction request.
     * @param sequence The id of the transaction request.
     */
    function signTransaction(
        uint256 sequence
    ) external onlyOwner whenTransactionExists(sequence) onlyTransactionGenerated(sequence) isValidSequence(sequence) {
        require(!_isSigned[sequence][_msgSender()], "MultisigUpgradeable/invalidRequest: already signed");
        _isSigned[sequence][_msgSender()] = true;
        _transactionRequests[sequence].signedCount++;

        emit SignTransaction(sequence, _msgSender());
    }

    /**
     * @notice Executes transaction request.
     * @param sequence The id of the transaction request.
     */
    function executeTransaction(
        uint256 sequence
    )
        external
        whenTransactionExists(sequence)
        onlyTransactionGenerated(sequence)
        onlyRequester(sequence)
        isValidSequence(sequence)
    {
        require(
            _transactionRequests[sequence].signedCount >= threshold(),
            "MultisigUpgradeable/executeForbidden: not all signed yet"
        );
        _transactionRequests[sequence].txStatus = Status.EXECUTED;

        Transaction[] memory transactions = _transactionRequests[sequence].transactions;
        uint256 accumulatedGas = 0;
        for (uint i = 0; i < transactions.length; ) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, bytes memory returnData) = transactions[i].to.call{
                gas: transactions[i].gas,
                value: transactions[i].value
            }(transactions[i].data);
            Address.verifyCallResult(success, returnData, "MultisigUpgradeable/revert: transaction failed");
            accumulatedGas += transactions[i].gas;

            unchecked {
                i++;
            }
        }

        if (gasleft() <= accumulatedGas / 63) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                invalid()
            }
        }

        emit ExecuteTransaction(sequence);
    }

    /**
     * @notice Retrieve the current status of a transaction request.
     * @dev Transaction requests have different states:
     *      - UNDEFINED: Default value when the request is not created.
     *      - GENERATED: Value when the request is created.
     *      - EXECUTED or CANCELLED: Value when the request is executed(canceled).
     * @param sequence The ID of the transaction request
     * @return current status of transaction request as a Status enum.
     */
    function txStatus(uint256 sequence) external view whenTransactionExists(sequence) returns (Status) {
        return _transactionRequests[sequence].txStatus;
    }

    /**
     * @notice Generates multiple transaction requests.
     * @param transactions list of the transaction data that contains `to`, `value`, `gas, `data`.
     * @return sequence The id of the transaction request.
     */
    function _generateTransaction(Transaction[] memory transactions) internal returns (uint256 sequence) {
        _beforeGenerateTransaction(transactions);
        _transactionRequests.push();
        unchecked {
            sequence = _getSequence();
            TransactionRequest storage transactionRequest = _transactionRequests[sequence];
            transactionRequest.requester = _msgSender();
            transactionRequest.signedCount = 0;
            transactionRequest.txStatus = Status.GENERATED;
            uint size = transactions.length;
            for (uint i = 0; i < size; i++) {
                require(
                    transactions[i].to != address(0),
                    "MultisigUpgradeable/invalidAddress: transaction to zero address"
                );
                transactionRequest.transactions.push(transactions[i]);
            }
            emit GenerateTransaction(sequence, _msgSender(), transactions);
        }
    }

    /**
     * @notice See {OwnerManagerUpgradeable-_addOwner}.
     * @dev Overriden {OwnerManagerUpgradeable-_addOwner} to prevent adding executor address as owner.
     */
    function _addOwner(address newOwner) internal override {
        require(!isExecutor(newOwner), "MultisigUpgradeable/invalidAddress: newOwner is Executor");
        super._addOwner(newOwner);
    }

    /**
     * @notice See {ExecutorManagerUpgradeable-_grantExecutor}.
     * @dev Overriden {ExecutorManagerUpgradeable-_grantExecutor} to prevent adding owner address as executor.
     */
    function _grantExecutor(address account) internal override {
        require(!isOwner(account), "MultisigUpgradeable/invalidAddress: new executor is owner");
        super._grantExecutor(account);
    }

    /**
     * @dev Hook that is called before generate transaction request.
     */
    function _beforeGenerateTransaction(Transaction[] memory transactions) internal virtual {}

    /**
     * @dev Hook that is called when owner is updated.
     */
    function _beforeUpdateOwner() internal virtual override {
        _ownerUpdatedSequence = _getSequence() + 1;
    }

    /**
     * @notice Return count of transactionRequest.
     * @return current sequence number.
     */
    function _getSequence() internal view returns (uint) {
        return _transactionRequests.length - 1;
    }

    uint256[50] private __gap;
}

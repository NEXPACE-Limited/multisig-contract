// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { SelfCall } from "../common/SelfCall.sol";

/**
 * @title OwnerManager - Manages owners and threshold for a multisig contract.
 * @notice This contract provides functionalities for managing the list of owners who can sign transactions
 *         and sets the required threshold of confirmations for executing transactions.
 * @dev Implement `_owners` using {EnumerableSet.AddressSet} to ensure uniqueness,
 *      efficient iteration, improved gas efficiency, and more.
 */
contract OwnerManager is SelfCall {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private _owners;

    uint256 private _threshold;

    event OwnerAdded(address indexed newOwner);
    event OwnerRemoved(address indexed previousOwner);
    event ThresholdChanged(uint256 indexed newThreshold);

    constructor(address[] memory owners_, uint256 threshold_) {
        require(owners_.length > 0, "OwnerManager/invalidRequest: owners required");
        require(
            threshold_ <= owners_.length,
            "OwnerManager/invalidThreshold: threshold must be less than or equal to length of owners"
        );

        _threshold = threshold_;

        for (uint256 i = 0; i < owners_.length; i++) {
            _addOwner(owners_[i]);
        }
    }

    /**
     * @notice Adds the owner.
     * @dev Callable only via self call.
     * @param newOwner New owner address to be added.
     */
    function addOwner(address newOwner) external isSelfCall {
        _addOwner(newOwner);
    }

    /**
     * @notice Adds the owner and updates threshold with `newThreshold`.
     * @dev Callable only via self call.
     * @param newOwner New owner address to be added.
     * @param newThreshold New threshold to update.
     */
    function addOwnerWithNewThreshold(address newOwner, uint256 newThreshold) external isSelfCall {
        _addOwner(newOwner);
        _changeThreshold(newThreshold);
    }

    /**
     * @notice Removes the owner.
     * @dev Callable only via self call.
     * @param ownerToRemove Owner address to remove.
     */
    function removeOwner(address ownerToRemove) external isSelfCall {
        require(
            _owners.length() - 1 >= threshold(),
            "OwnerManager/invalidThreshold: threshold must be less than or equal to length of owners"
        );
        _removeOwner(ownerToRemove);
    }

    /**
     * @notice Removes the owner and updates threshold with `newThreshold`.
     * @dev Callable only via self call.
     * @param ownerToRemove Owner address to remove.
     * @param newThreshold New threshold to update.
     */
    function removeOwnerWithNewThreshold(address ownerToRemove, uint256 newThreshold) external isSelfCall {
        require(
            _owners.length() - 1 >= newThreshold,
            "OwnerManager/invalidThreshold: threshold must be less than or equal to length of owners"
        );
        _removeOwner(ownerToRemove);
        _changeThreshold(newThreshold);
    }

    /**
     * @notice Changes the owner.
     * @dev Callable only via self call.
     * @param prevOwner Previous owner address to be removed.
     * @param newOwner New Owner address to be added.
     */
    function changeOwner(address prevOwner, address newOwner) external isSelfCall {
        _changeOwner(prevOwner, newOwner);
    }

    /**
     * @notice Changes the owner and updates threshold with `newThreshold`.
     * @dev Callable only via self call.
     * @param prevOwner Previous owner address to remove to be removed.
     * @param newOwner New Owner address to be added.
     * @param newThreshold New threshold to update.
     */
    function changeOwnerWithNewThreshold(
        address prevOwner,
        address newOwner,
        uint256 newThreshold
    ) external isSelfCall {
        _changeOwner(prevOwner, newOwner);
        _changeThreshold(newThreshold);
    }

    /**
     * @notice Updates threshold with `newThreshold`.
     * @dev Callable only via self call.
     * @param newThreshold New threshold to update.
     */
    function changeThreshold(uint256 newThreshold) external isSelfCall {
        _changeThreshold(newThreshold);
    }

    /**
     * @notice Returns a list owners.
     * @return Array of owners.
     */
    function getAllOwners() external view returns (address[] memory) {
        return _owners.values();
    }

    /**
     * @notice Returns owner that index `idx`.
     * @return Array of Safe owners.
     */
    function getOwner(uint256 idx) external view returns (address) {
        return _owners.at(idx);
    }

    /**
     * @notice Returns count of owners.
     * @return Owner count number.
     */
    function getOwnerCount() external view returns (uint256) {
        return _owners.length();
    }

    /**
     * @notice Returns current Threshold.
     * @return Threshold number.
     */
    function threshold() public view returns (uint256) {
        return _threshold;
    }

    /**
     * @notice Returns if `account` is an owner address.
     * @return Boolean if `account` is an owner address.
     */
    function isOwner(address account) public view returns (bool) {
        return _owners.contains(account);
    }

    /**
     * @notice Prevents adding owner when the `newOwner` is zero address or if it already exists.
     * @dev Can specify conditions for the `newOwner` by override this function.
     * @param newOwner Address of the new owner.
     */
    function _addOwner(address newOwner) internal virtual {
        require(newOwner != address(0), "OwnerManager/invalidAddress: zero address can not be owner");
        require(_owners.add(newOwner), "OwnerManager/invalidOwner: newOwner is already an owner");

        emit OwnerAdded(newOwner);
    }

    /**
     * @notice Prevents removing owner when the `ownerToRemove` does not exists.
     * @param ownerToRemove Address of the new owner.
     */
    function _removeOwner(address ownerToRemove) internal {
        require(_owners.remove(ownerToRemove), "OwnerManager/invalidOwner: ownerToRemove is not owner");

        emit OwnerRemoved(ownerToRemove);
    }

    /**
     * @notice Changes the owner.
     * @dev Callable only via self call.
     * @param prevOwner Previous owner address to be removed.
     * @param newOwner New Owner address to be added.
     */
    function _changeOwner(address prevOwner, address newOwner) internal {
        require(prevOwner != newOwner, "OwnerManager/invalidOwner: prevOwner and newOwner is same address");
        _addOwner(newOwner);
        _removeOwner(prevOwner);
    }

    /**
     * @notice Changes the threshold.
     * @dev Callable only via self call.
     * @param newThreshold New threshold to be updated.
     */
    function _changeThreshold(uint256 newThreshold) internal {
        require(newThreshold >= 1, "OwnerManager/invalidThreshold: newThreshold must be higher than or equal to 1");
        require(
            _owners.length() >= newThreshold,
            "OwnerManager/invalidThreshold: threshold must be less than or equal to length of owners"
        );
        _threshold = newThreshold;

        emit ThresholdChanged(newThreshold);
    }
}

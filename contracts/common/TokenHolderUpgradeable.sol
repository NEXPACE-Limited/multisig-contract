// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC721HolderUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import { ERC1155HolderUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";

/**
 * @title TokenHolderUpgradeable - Implement {ERC721Holder} and {ERC1155Holder} to accept all token transfer
 */
contract TokenHolderUpgradeable is Initializable, ERC721HolderUpgradeable, ERC1155HolderUpgradeable {
    /* solhint-disable-next-line func-name-mixedcase */
    function __TokenHolder_init() internal onlyInitializing {
        __TokenHolder_init_unchained();
        __ERC721Holder_init_unchained();
        __ERC1155Holder_init_unchained();
    }

    /* solhint-disable-next-line func-name-mixedcase */
    function __TokenHolder_init_unchained() internal onlyInitializing {}

    receive() external payable {}

    uint256[50] private __gap;
}

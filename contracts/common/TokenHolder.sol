// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/**
 * @title TokenHolder - Implement {ERC721Holder} and {ERC1155Holder} to accept all token transfer
 */
contract TokenHolder is ERC721Holder, ERC1155Holder {
    receive() external payable {}
}

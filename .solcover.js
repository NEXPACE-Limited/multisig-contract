module.exports = {
  silent: true,
  skipFiles: [
    "mock/MockERC20BridgeToken.sol",
    "mock/MockERC1155BridgeToken.sol",
  ],
  mocha: {
    reporter: "dot",
  },
};

export default {
  ExecutorManager: {
    revokeExecutorConflict: /^ExecutorManager\/revokeExecutorConflict: (account is already a non-executor)/,
    grantExecutorConflict: /^ExecutorManager\/grantExecutorConflict: (account is already an executor)/,
  },
  OwnerManager: {
    ownerForbidden: /^OwnerManager\/ownerForbidden: (caller is not the owner)/,
    invalidRequest: /^OwnerManager\/invalidRequest: (owners required)/,
    invalidThreshold:
      /^OwnerManager\/invalidThreshold: (threshold must be less than or equal to length of owners|newThreshold must be higher than or equal to 1)/,
    invalidAddress: /^OwnerManager\/invalidAddress: (zero address can not be owner)/,
    invalidOwner:
      /^OwnerManager\/invalidOwner: (newOwner is already an owner|ownerToRemove is not owner|prevOwner and newOwner is same address)/,
  },
  Multisig: {
    executorForbidden: /^Multisig\/executorForbidden: (caller is neither the owner nor an executor)/,
    requesterForbidden: /^Multisig\/requesterForbidden: (caller is not a requester)/,
    invalidRequest:
      /^Multisig\/invalidRequest: (transaction has already been generated, cancelled, or executed|transaction has not been generated or msg sender is not requester)/,
    executeForbidden: /^Multisig\/executeForbidden: (not all signed yet)/,
    revert: /^Multisig\/revert: (transaction failed)/,
    invalidAddress:
      /^Multisig\/invalidAddress: (transaction to zero address|newOwner is Executor|new executor is owner)/,
    invalidSignature:
      /^Multisig\/invalidSignature: (not enough confirmations to execute transaction|signature is not valid|signer is not owner|signature length must be 65)/,
  },
  SelfCall: {
    forbidden: /^SelfCall\/forbidden: (caller is not this contract)/,
  },
  ECDSA: {
    invalidSignature: /^ECDSA: (invalid signature length|invalid signature)/,
  },
  ExecutorManagerUpgradeable: {
    revokeExecutorConflict: /^ExecutorManagerUpgradeable\/revokeExecutorConflict: (account is already a non-executor)/,
    grantExecutorConflict: /^ExecutorManagerUpgradeable\/grantExecutorConflict: (account is already an executor)/,
  },
  OwnerManagerUpgradeable: {
    ownerForbidden: /^OwnerManagerUpgradeable\/ownerForbidden: (caller is not the owner)/,
    invalidRequest: /^OwnerManagerUpgradeable\/invalidRequest: (owners required)/,
    invalidThreshold:
      /^OwnerManagerUpgradeable\/invalidThreshold: (threshold must be less than or equal to length of owners|newThreshold must be higher than or equal to 1)/,
    invalidAddress: /^OwnerManagerUpgradeable\/invalidAddress: (zero address can not be owner)/,
    invalidOwner:
      /^OwnerManagerUpgradeable\/invalidOwner: (newOwner is already an owner|ownerToRemove is not owner|prevOwner and newOwner is same address)/,
  },
  MultisigUpgradeable: {
    executorForbidden: /^MultisigUpgradeable\/executorForbidden: (caller is neither the owner nor an executor)/,
    requesterForbidden: /^MultisigUpgradeable\/requesterForbidden: (caller is not a requester)/,
    invalidSequence:
      /^MultisigUpgradeable\/invalidSequence: (nonexistent sequence|not in generated state|expired sequence)/,
    invalidRequest: /^MultisigUpgradeable\/invalidRequest: (already signed)/,
    executeForbidden: /^MultisigUpgradeable\/executeForbidden: (not all signed yet)/,
    revert: /^MultisigUpgradeable\/revert: (transaction failed)/,
    invalidAddress:
      /^MultisigUpgradeable\/invalidAddress: (transaction to zero address|newOwner is Executor|new executor is owner)/,
  },
  SelfCallUpgradeable: {
    forbidden: /^SelfCallUpgradeable\/forbidden: (caller is not this contract)/,
  },
};

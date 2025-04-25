// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockFdcHub
 * @dev Mock contract for Flare's FDC Hub to use in tests
 */
contract MockFdcHub {
    // Latest finalized block
    uint256 private latestFinalizedBlockNumber;
    // Mapping of blocks to finalization status
    mapping(uint256 => bool) private finalizedBlocks;
    
    /**
     * @dev Sets a specific block as finalized
     * @param _blockNumber The block number to set as finalized
     */
    function setFinalized(uint256 _blockNumber) external {
        finalizedBlocks[_blockNumber] = true;
        if (_blockNumber > latestFinalizedBlockNumber) {
            latestFinalizedBlockNumber = _blockNumber;
        }
    }
    
    /**
     * @dev Checks if a block is finalized
     * @param _blockNumber The block number to check
     * @return Whether the block is finalized
     */
    function isBlockFinalized(uint256 _blockNumber) external view returns (bool) {
        return finalizedBlocks[_blockNumber];
    }
    
    /**
     * @dev Gets the latest finalized block number
     * @return The block number
     */
    function getLatestFinalizedBlockNumber() external view returns (uint256) {
        return latestFinalizedBlockNumber;
    }
}
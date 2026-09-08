// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VoiceFingerprintRegistry {
    mapping(bytes32 => address) public fingerprintOwners;
    mapping(bytes32 => uint256) public registeredAt;

    event FingerprintRegistered(bytes32 indexed fingerprint, address indexed owner, uint256 timestamp);

    function registerFingerprint(bytes32 fingerprint) external {
        require(fingerprintOwners[fingerprint] == address(0), "Fingerprint already registered");
        fingerprintOwners[fingerprint] = msg.sender;
        registeredAt[fingerprint] = block.timestamp;
        emit FingerprintRegistered(fingerprint, msg.sender, block.timestamp);
    }
}

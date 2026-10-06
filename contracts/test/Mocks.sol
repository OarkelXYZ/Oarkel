// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Oarkel", "OARKEL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Takes 1% on every transfer: the pool must refuse it.
contract FeeToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 cut = value / 100;
            super._update(from, address(0xdead), cut);
            value -= cut;
        }
        super._update(from, to, value);
    }
}

/// Accepts every proof. Only for accounting fuzz tests, where the handler plays an honest prover.
contract AcceptAllVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}

contract RejectEth {
    receive() external payable {
        revert("no");
    }
}

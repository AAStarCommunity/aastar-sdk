export declare const SUPERPAYMASTER_ABI: readonly [{
    readonly name: "deposit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "operators";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "bool";
    }, {
        readonly type: "bool";
    }, {
        readonly type: "address";
    }, {
        readonly type: "uint96";
    }, {
        readonly type: "uint256";
    }, {
        readonly type: "uint256";
    }, {
        readonly type: "uint256";
    }, {
        readonly type: "uint256";
    }];
}, {
    readonly name: "getAvailableCredit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "postOp";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint8";
    }, {
        readonly type: "bytes";
    }, {
        readonly type: "uint256";
    }, {
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "withdrawProtocolRevenue";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setOperatorPaused";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "bool";
    }];
    readonly outputs: readonly [];
}];
export declare const REGISTRY_ABI: readonly [{
    readonly name: "hasRole";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
    }, {
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "getCreditLimit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "registerRole";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
    }, {
        readonly type: "address";
    }, {
        readonly type: "bytes";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setCreditLimit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "createNewRole";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
        }, {
            readonly type: "uint256";
        }, {
            readonly type: "address";
        }, {
            readonly type: "bool";
        }];
    }, {
        readonly type: "address";
    }];
    readonly outputs: readonly [];
}];
export declare const XPNT_ABI: readonly [{
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getDebt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "recordDebt";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
    }, {
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}];
export declare const ENTRYPOINT_ADDRESS = "0x5FF137D4B0FDCD49DcA30c7CF57E578a026d2789";

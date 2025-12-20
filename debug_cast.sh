#!/bin/bash
export RPC='http://127.0.0.1:8545'
export REGISTRY='0x927b167526bAbB9be047421db732C663a0b77B11'
export DAVE='0x593B641e752fCc4A6e7C635EE84eF905401ce2F6'
export COMM='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' # Admin/Deployer
export ROLE_ID='0x0c34ecc75d3bf122e0609d2576e167f53fb42429262ce8c9b33cab91ff670e3a' # ROLE_ENDUSER

# Construct RoleData: (address account, address community, string avatar, string ens, uint256 stake)
# Note: Struct tuple encoding
DATA=$(cast abi-encode "f((address,address,string,string,uint256))" "($DAVE,$COMM,ipfs://dave,dave.c,500)")

echo "Simulating registerRoleSelf via cast call..."
cast call $REGISTRY "registerRoleSelf(bytes32,bytes)" $ROLE_ID $DATA --from $DAVE --rpc-url $RPC --trace

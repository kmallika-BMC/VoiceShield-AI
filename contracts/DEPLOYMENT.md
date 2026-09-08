# Polygon deployment

`VoiceFingerprintRegistry.sol` is ready for deployment on Polygon or Polygon
Amoy. Compile it with Solidity `0.8.20`, deploy it from a funded deployer
wallet, and set the resulting address in `POLYGON_CONTRACT_ADDRESS`.

The backend uses `POLYGON_RPC_URL`, `POLYGON_PRIVATE_KEY`, and
`POLYGON_CONTRACT_ADDRESS` to submit and verify registrations. Keep the private
key in the deployment environment only; never commit it.

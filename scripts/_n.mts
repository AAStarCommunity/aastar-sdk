import { createPublicClient, http } from 'viem';
for (const [n,u] of [['RPC2',process.env.G2!],['RPC3',process.env.G3!]]) {
  try { const c=createPublicClient({transport:http(u)}); const bn=await c.getBlockNumber(); console.log(n,'block',bn); } catch(e:any){ console.log(n,'DEAD',e?.status); }
}
const c=createPublicClient({transport:http(process.env.G3!)});
const J='0xb5600060e6de5E11D3636731964218E53caadf0E';
console.log('JASON latest',await c.getTransactionCount({address:J,blockTag:'latest'}),'pending',await c.getTransactionCount({address:J,blockTag:'pending'}));
const r=await c.getTransactionReceipt({hash:'0x28bf294f732dcfde3f43be4703c04d4d1dc0c62b141ba9c21f83131f9c1f953c'}).catch(()=>null);
console.log('0x28bf294f', r?`mined ${r.status}`:'NOT mined');

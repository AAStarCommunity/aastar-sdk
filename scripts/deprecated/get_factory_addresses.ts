// Official EntryPoint and Factory addresses for different versions

const addresses = {
  v06: {
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    simpleAccountFactory: '0x9406Cc6185a346906296840746125a0E44976454', // Official v0.6
  },
  v07: {
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    simpleAccountFactory: '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985', // Official v0.7
  },
  // From shared-config
  sharedConfig: {
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    simpleAccountFactory: '0x8B516A71c134A4b5196775e63b944f88Cc637F2b',
  }
};

console.log('EntryPoint & SimpleAccountFactory Addresses:\n');
console.log('v0.6 (Current deployed AA uses this):');
console.log(`  EntryPoint: ${addresses.v06.entryPoint}`);
console.log(`  Factory:    ${addresses.v06.simpleAccountFactory}`);
console.log('\nv0.7 (Should use for new deployment):');
console.log(`  EntryPoint: ${addresses.v07.entryPoint}`);
console.log(`  Factory:    ${addresses.v07.simpleAccountFactory}`);
console.log('\nShared-Config (Custom):');
console.log(`  EntryPoint: ${addresses.sharedConfig.entryPoint}`);
console.log(`  Factory:    ${addresses.sharedConfig.simpleAccountFactory}`);

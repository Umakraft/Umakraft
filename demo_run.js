// Demo: Miner -> Courier -> Inspector -> Vault
const { callMiner } = require('./Umamoe/Miner/miner');
const { transport } = require('./Umamoe/Courier/courier');
const inspector = require('./Umamoe/Inspector/inspector');

async function main(){
  console.log('Starting demo pipeline...');

  const input = {
    endpoint: '/trainers/{id}',
    pathParams: { id: 'alice-001' }
  };

  console.log('Calling Miner...');
  const minerResult = await callMiner(input);
  console.log('Miner result:', JSON.stringify(minerResult, null, 2));

  console.log('Transporting via Courier to Inspector...');
  const courierResult = await transport(minerResult, { receive: inspector.receive });
  console.log('Courier/Inspector final result:', JSON.stringify(courierResult, null, 2));

  if(courierResult && courierResult.passed && courierResult.vault){
    console.log('Stored in Vault at:', courierResult.vault.storedAt);
  }

  console.log('Demo complete.');
}

main().catch(err=>{ console.error('Demo run failed:', err); process.exit(1); });

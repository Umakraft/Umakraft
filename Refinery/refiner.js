const Vault = require('../Umamoe/Vault/vault');

const vault = new Vault();

async function refine(trustedEnvelope){
  // minimal scaffold implementation: reads historical by id and computes dailyGain if possible
  if(!trustedEnvelope || !trustedEnvelope.trustedData || !trustedEnvelope.trustedData.id){
    return { success: false, error: 'REFINER_INVALID_INPUT' };
  }

  const id = trustedEnvelope.trustedData.id;
  // attempt to fetch previous snapshot
  const prev = await vault.getById(id);
  const previous = (prev && prev.success) ? prev.data.trustedData : null;

  let dailyGain = null;
  try{
    if(previous && typeof previous.fans === 'number' && typeof trustedEnvelope.trustedData.fans === 'number'){
      dailyGain = trustedEnvelope.trustedData.fans - previous.fans;
    }
  }catch(e){
    return { success: false, error: 'REFINER_CALCULATION_ERROR', message: e.message };
  }

  const result = {
    success: true,
    refinedResult: {
      id,
      fans: trustedEnvelope.trustedData.fans,
      dailyGain
    },
    metadata: {
      sourceStoredAt: trustedEnvelope.metadata && trustedEnvelope.metadata.storedAt,
      refinedAt: new Date().toISOString(),
      refinerVersion: 'v0.1'
    }
  };

  return result;
}

async function refineBatch(envelopes){
  const results = [];
  for(const env of envelopes){
    results.push(await refine(env));
  }
  return { success: true, results };
}

module.exports = { refine, refineBatch };

const { logger } = require('@librechat/data-schemas');
const { getStates, getDistricts, getSubdistricts, getVillages } = require('~/server/services/LocationService');

const getStatesController = async (req, res) => {
  logger.debug('[getStatesController] Request received');
  try {
    const states = await getStates();
    logger.debug(`[getStatesController] Successfully returning ${states.length} states`);
    res.status(200).send(states);
  } catch (error) {
    logger.error('[getStatesController] ===== ERROR FETCHING STATES =====');
    logger.error('[getStatesController] Error message: ' + error.message);
    logger.error('[getStatesController] Error code: ' + error.code);
    logger.error('[getStatesController] Error name: ' + error.name);
    logger.error('[getStatesController] Full error stack: ' + error.stack);
    if (error.response) {
      logger.error('[getStatesController] Axios response status: ' + error.response.status);
      logger.error('[getStatesController] Axios response data: ' + JSON.stringify(error.response.data));
    }
    logger.error('[getStatesController] ===== END ERROR =====');
    res.status(500).send({ message: 'Failed to retrieve states', error: error.message });
  }
};

const getDistrictsController = async (req, res) => {
  try {
    const { stateCode } = req.query;
    if (!stateCode) {
      return res.status(400).send({ message: 'stateCode query parameter is required' });
    }
    const districts = await getDistricts(stateCode);
    res.status(200).send(districts);
  } catch (error) {
    logger.error('[getDistrictsController] Error fetching districts:', error.message);
    logger.error('[getDistrictsController] Stack:', error.stack);
    res.status(500).send({ message: 'Failed to retrieve districts', error: error.message });
  }
};

const getSubdistrictsController = async (req, res) => {
  try {
    const { districtCode } = req.query;
    if (!districtCode) {
      return res.status(400).send({ message: 'districtCode query parameter is required' });
    }
    const subdistricts = await getSubdistricts(districtCode);
    res.status(200).send(subdistricts);
  } catch (error) {
    logger.error('[getSubdistrictsController] Error fetching subdistricts:', error.message);
    logger.error('[getSubdistrictsController] Stack:', error.stack);
    res.status(500).send({ message: 'Failed to retrieve subdistricts', error: error.message });
  }
};

const getVillagesController = async (req, res) => {
  try {
    const { subdistrictCode } = req.query;
    if (!subdistrictCode) {
      return res.status(400).send({ message: 'subdistrictCode query parameter is required' });
    }
    const villages = await getVillages(subdistrictCode);
    res.status(200).send(villages);
  } catch (error) {
    logger.error('[getVillagesController] Error fetching villages:', error.message);
    logger.error('[getVillagesController] Stack:', error.stack);
    res.status(500).send({ message: 'Failed to retrieve villages', error: error.message });
  }
};

module.exports = {
  getStatesController,
  getDistrictsController,
  getSubdistrictsController,
  getVillagesController,
};

const removePorts = require('./removePorts');
const handleText = require('./handleText');
const sendEmail = require('./sendEmail');
const queue = require('./queue');
const files = require('./files');
const { geocoding, geocodeWithMeta, cleanPart } = require('./geocoding');
module.exports = {
  ...handleText,
  removePorts,
  sendEmail,
  ...files,
  ...queue,
  geocoding,
  geocodeWithMeta,
  cleanPart,
};

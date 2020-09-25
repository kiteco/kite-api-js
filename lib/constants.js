
// MAX_FILE_SIZE is the maximum file size to send to Kite
const DEFAULT_MAX_FILE_SIZE = 1024 * Math.pow(2, 10); // 75 KB

// MAX_PAYLOAD_SIZE is the maximum length for a POST reqest body
const MAX_PAYLOAD_SIZE = Math.pow(2, 21); // 2097152

module.exports = {
  DEFAULT_MAX_FILE_SIZE,
  MAX_PAYLOAD_SIZE,
};

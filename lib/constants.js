
// MAX_FILE_SIZE is the maximum file size to send to Kite
const MAX_FILE_SIZE = 75 * Math.pow(2, 10); // 75 KB

// MAX_PAYLOAD_SIZE is the maximum length for a POST reqest body
const MAX_PAYLOAD_SIZE = Math.pow(2, 21); // 2097152

module.exports = {
  MAX_FILE_SIZE,
  MAX_PAYLOAD_SIZE,
};

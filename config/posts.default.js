// Post configurations

module.exports = {
    // Character lengths
    maxNameLength: 16,
    maxSubjectLength: 20,
    maxContentLength: 900,
    // In bytes
    maxFileSize: 4096 * 1000,
    // Maximum amount of files per post
    maxFiles: 2,
    // Temporary files will be written here
    // Use string path (e.g. "tempDir: /tmp/")
    // Ensure directory exists and has correct permissions before running
    tmpDir: require("os").tmpdir
};
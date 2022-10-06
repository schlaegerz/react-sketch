const path = require("path");

const root = path.resolve(__dirname, "../");

module.exports = {
  root: root,
  srcPath: path.join(root, "src"),
  buildPath: path.join(root, "build"),
  outputPath: path.join(root, "dist"),
};

const path = require('path');

module.exports = {
  mode: 'development',
  devtool: "source-map",
  entry: path.join(__dirname, 'src/main.ts'),
  output: {
    path: path.join(__dirname, 'public'),
    filename: "bundle.js"
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: 'ts-loader',
    }],
  },
  resolve: {
    extensions: ['.js', '.ts'],
    alias: {
      "@src": path.resolve(__dirname, 'src/')
    }
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    open: true,
    hot: true
  }
};

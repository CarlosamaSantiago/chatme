const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/chat.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'chat.js',
    clean: true
  },
  mode: 'development',
  devtool: 'source-map',
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'index.html', to: 'index.html' },
        { from: 'chat.css', to: 'chat.css' }
      ]
    })
  ],
  resolve: {
    fallback: {
      "crypto": false,
      "stream": false,
      "buffer": false,
      "util": false
    }
  },
  devServer: {
    static: './dist',
    port: 8080,
    open: true
  }
};


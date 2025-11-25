const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: './src/chat.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'chat.js',
    clean: true
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'index.html', to: 'index.html' },
        { from: 'chat.css', to: 'chat.css' }
      ]
    }),
    // Polyfills para Ice en el browser
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ],
  resolve: {
    fallback: {
      "crypto": false,
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "util": require.resolve("util/"),
      "process": require.resolve("process/browser"),
      "net": false,
      "tls": false,
      "fs": false,
      "path": false,
      "os": false
    }
  },
  devServer: {
    static: './dist',
    port: 8080,
    open: true
  }
};

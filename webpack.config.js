const path = require('path');

module.exports = {
  entry: './src/scripts/main.ts',   // archivo principal TS
  module: {
    rules: [
      {
        test: /\.ts$/, // Se analizan todos los ficheros que terminan en .ts
        use: 'ts-loader', // Usando el type script loader
        include: [path.resolve(__dirname, "src")] // Y haremos eso en el directorio src
        //exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // reconoce TS y JS
    // Los alias (#core/*, ...) NO se configuran aquí: webpack 5 lee el campo
    // "imports" de package.json de forma nativa.
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'public/js/'),
    publicPath: '/js/'
  },
  devServer: {
    static: path.resolve(__dirname, 'public'),
    port: 8080,
    hot: true,
    watchFiles: ['src/**/*.ts']
  },
  mode: 'development'          // desarrollo (usa 'production' para producción)
};
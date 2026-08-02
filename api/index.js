const { app, connectToDatabase } = require('../server');

let databaseConnection;

module.exports = async (req, res) => {
  if (!databaseConnection) {
    databaseConnection = connectToDatabase();
  }

  await databaseConnection;
  return app(req, res);
};

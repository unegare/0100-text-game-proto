const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const config = require('../config.json');

const schema = new Schema({
  id: {
    type: String,
    required: false
  },
  gameClass: {
    type: String,
    required: true
  },
  subClasses: {
    type: JSON,
    required: false
  }
});

module.exports = mongoose.model('GameClass', schema, config.mongo.collections.classes);









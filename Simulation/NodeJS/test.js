// const express = require('express');
// const app = express()
//
// app.use(express.static('public'))
//
// app.get('/', (req, res) => {
//
//   res.send('Hello World!')
// });
//
//
// app.get('/main.html', (req, res) => {
//   console.log(req);
//   res.send('Hello World Main Page');
// });
//
//
// app.post('/user',  (req, res) => {
//   res.send('POST Request Sent');
// })
//
// app.listen(3000, () => console.log('Listening on port 3000'));

var mongoose = require('mongoose');
var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  username: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
  },
  passwordConf: {
    type: String,
    required: true,
  }
});
var User = mongoose.model('User', UserSchema);
module.exports = User;


let UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true
  }
})

var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret : 'secret',
  resave: false,
  saveUninitialized: false
}));

// var sesh;
app.get('/', 
function(req, res) {
  util.checkUser(req, res, function () {
    res.render('index');
  });
});

app.get('/login', function (req, res) {
  res.render('login');
});

app.get('/create', 
function(req, res) {
  util.checkUser(req, res, function () {
    res.render('create');
  });
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.get('/links', 
function(req, res) {
  util.checkUser(req, res, function(){
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models)
    });
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

app.post('/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  new User({
    username: username
  }).fetch().then(function(user){
    if(!user){
      res.redirect('/login');
    } else {
      bcrypt.compare(password, user.get('password'), function(err, match){
        if (match){
            req.session.regenerate(function(){
            req.session.user = username;
            res.redirect('/');
          });
        } else {
          res.redirect('/login');
        }
      });
    }
  });
});

app.post('/signup', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  new User({
   username: username
  }).fetch().then(function(found) {
    if (found) {
      console.log('username already exists');
      res.redirect('/signup');
    } else {
      bcrypt.hash(password, null, null, function (err, hash) {
        var newUser = new User({
          username: username,
          password: hash
        });
        newUser.save().then(function (user) {
          Users.add(user);
          req.session.regenerate(function () {
            req.session.user = username;
            console.log('created that shiz:');
            res.redirect('/');
          });
        });
      }); 
    }
 });
 
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/logout', function (req, res) {
  console.log('butt');
  req.session.destroy(function(err) {
    res.redirect('/login');
  });
});
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

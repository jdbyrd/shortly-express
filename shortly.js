var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');



var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


var app = express();
//WE ADDED THIS TOO
app.use(session({
  secret: 'keyboard cat',
  cookie: {maxAge: 60000}
}));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
  var sessData = req.session;
  if (!sessData.user) {
    res.redirect('/login');
  } else {
    res.render('index');
  }
});

//OUR CODE STARTS HERE

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  let username = req.body.username;
  let password = req.body.password;
    
  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      bcrypt.compare(password, found.attributes.password, function(err, response) {
        if (response) {
          req.session.user = username;
          res.redirect('/');
        } else {
          res.redirect('/login');
        } 
      });
    } else {
      console.log('This User is not the user youre looking for');
      res.redirect('/login');
    }
  });
  
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  let username = req.body.username;
  let password = req.body.password;
  
  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      console.log('Username taken');
      res.redirect('/signup');
    } else {
      bcrypt.hash(password, null, null, function(err, hash) {
        Users.create({
          username: username,
          password: hash,
        });
        req.session.user = username;
        res.redirect('/');  
      });
    }
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});


//OUR CODE ENDS HERE

app.get('/create', function(req, res) {
  if (!req.session.user) {
    res.redirect('/');
  } else {
    res.render('index');
  }
});

app.get('/links', function(req, res) {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    Links.reset().query('where', 'user', '=', req.session.user).fetch().then(function(links) {
      res.status(200).send(links.models);
    });
  }
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri, user: req.session.user }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin,
          user: req.session.user
        })
          .then(function(newLink) {
            res.status(200).send(newLink);
          });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



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
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;

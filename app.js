//jshint esversion:6
require("dotenv").config()
const express = require("express")
const bodyParser = require("body-parser")
const ejs = require("ejs")
const mongoose = require("mongoose")
const session = require("express-session")
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const findOrCreate = require("mongoose-findorcreate")

const app = express()



app.use(express.static("public"))
app.set("view engine", "ejs")
app.use(bodyParser.urlencoded({extended: true}))

app.use(session({
    secret: "Our little secret",
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())


mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true})

const userSchema = new mongoose.Schema ({
    email: String, 
    password: String,
    googleId: String
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy()) //create a local login strategy

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home")
})

app.get("/auth/google", 
    passport.authenticate("google", { scope: ["profile", "email"]}))

app.get('/auth/google/secrets',
    passport.authenticate( 'google', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
}));

app.get("/login", function(req, res){
    res.render("login")
})

app.get("/register", function(req, res){
    res.render("register")
})


app.get("/secrets", function(req, res){

    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0'); //this line solves the isse of back button, from Q&A of students

    if (req.isAuthenticated()) {
      User.find({"secret": {$ne: null}}, function(err, foundUsers){
        if (err){
          console.log(err);
        } else {
          if (foundUsers) {
            res.render("secrets", {usersWithSecrets: foundUsers});
          }
        }
      });
    } else {
      res.redirect("/login");
    }
  });

app.get("/logout", function(req, res){
    req.logout(function(err){
        if(err){
            return next(err)
        }
    })
    res.redirect("/")
})

app.post("/register", function(req, res){
    
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if(err) {
            console.log(err)
            res.redirect("/register")                                   //go back to register page, then try again
        } else {
            passport.authenticate("local")(req, res, function(){        //if login is okay, then we authenticate using the ff. lines of codes
                res.redirect("/secrets")
            })    
        }
    })
  
})

//below changes were from the Q&A ofthe lesson
app.post("/login", passport.authenticate("local"), function(req, res){
    res.redirect("/secrets");
});


app.listen(3000, function(){
    console.log("Succuessfully started on port 3000")
})
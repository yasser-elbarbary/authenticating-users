//jshint esversion:6
require("dotenv").config();
const express     = require("express");
const ejs         = require("ejs");
const bodyParser  = require("body-parser");
const mongoose    = require("mongoose");
const session     = require("express-session");
const passport    = require("passport");
const passportLocalMongoose    = require("passport-local-mongoose");
const GoogleStrategy           = require("passport-google-oauth2").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
  secret:"secret string",
  resave:false,
  saveUninitialized:false,
}));
app.use(passport.initialize());
app.use(passport.session());

///// Creating a DataBase \\\\\\
//db shcema
const userSchema =new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret:String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// encrypting our DB passwords
//userSchema.plugin(encrypt, {secret:process.env.SECRET, encryptedFields: ["password"]});

//db model
mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser:true , useUnifiedTopology: true});
mongoose.set("useCreateIndex",true);

const User = new mongoose.model("User",userSchema);
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});
passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/",function(req,res){
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google",{scope:["profile"]})
);

app.get( '/auth/google/secrets',
    passport.authenticate( 'google', {
        successRedirect: '/Secrets',
        failureRedirect: '/login'
}));
app.get("/login",function(req,res){
  res.render("login");
});

app.get("/secrets",function(req,res){
  if(req.isAuthenticated()){
    User.find({"secret":{$ne:null}},function(err,foundUsers){
      if(err){
        console.log(err);
      }else{
        if(foundUsers){
          res.render("secrets",{usersWithSecrets:foundUsers});
        }
      }
    });
  }
  else{
    res.redirect("/login");
  }
});

app.get("/submit",function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
  }
  else{
    res.redirect("/login");
  }
});

app.post("/submit", function(req,res){
  const sumbittedPost = req.body.secret;
  console.log(req.user.id);
  User.findById(req.user.id, function(err, foundUser){
    if(err){
      console.log(err);
    }
    else{
      if(foundUser){
        foundUser.secret = sumbittedPost;
        foundUser.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get("/register",function(req,res){
  res.render("register");
});

app.post("/register",function(req, res){
  User.register({username:req.body.username} , req.body.password , function(err, user){
    if(err){
      console.log(err);
      res.redirect("/register");
    }
    else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login",function(req,res){
  const user = new User({
    username:req.body.username,
    password:req.body.password
  });
  req.login(user, function(err){
    if(err){
      console.log(err);
    }
    else{
      passport.authenticate("local")(req,res, function(){
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/");
});
app.listen(3000,function(){
  console.log("running on port 3000");
});

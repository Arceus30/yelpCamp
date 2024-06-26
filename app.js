// env
if (process.env.NODE_ENV !== "production") require("dotenv").config();

// imports
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { User } = require("./models");
const MongoStore = require("connect-mongo");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");

// Routes
const { campgroundsRoutes, reviewRoutes, userRoutes } = require("./routes");

// Error Class
const ExpressError = require("./utility/ExpressError");

// Database connection
const dbUrl = process.env.DB_URL;
mongoose
    .connect(dbUrl)
    .then(() => {
        console.log("Database Connected");
    })
    .catch((e) => {
        console.log(`Error: ${e}`);
    });

// creating app
const app = express();

// EJS
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//public route for static files
app.use(express.static(path.join(__dirname, "public")));

// Parser for requests other than GET
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// sanitize any mongo syntax and replaces it with _
app.use(
    mongoSanitize({
        replaceWith: "_",
    })
);

const secret = process.env.SECRET;

// Mongo Store creation
const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret,
    },
});

// Session Management
const sessionConfig = {
    store,
    name: "session",
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
};
app.use(session(sessionConfig));

// Flash Notification
app.use(flash());

// adds security headers
app.use(helmet());

// allowed scripts
const scriptSrcUrls = [
    "https://cdn.jsdelivr.net",
    "https://api.mapbox.com/",
    "https://kit.fontawesome.com/",
    "https://code.jquery.com/",
    "https://api.tiles.mapbox.com/",
    "https://cdnjs.cloudflare.com/",
];
// allowed styles
const styleSrcUrls = [
    "https://cdn.jsdelivr.net",
    "https://api.mapbox.com/",
    "https://api.tiles.mapbox.com/",
];
// can make network requests to, including AJAX requests, WebSocket connections, and fetch requests
const connectSrcUrls = [
    "https://ka-f.fontawesome.com/",
    "https://api.mapbox.com/",
    "https://a.tiles.mapbox.com/",
    "https://b.tiles.mapbox.com/",
    "https://events.mapbox.com/",
];
// allowed font urls
const fontSrcUrls = ["https://ka-f.fontawesome.com/"];
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            // default policies to load sites
            defaultSrc: [],
            // valid sources to make network requests
            connectSrc: ["'self'", ...connectSrcUrls],
            // valid sources to request javascripts
            scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
            // valid sources to request styles
            styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
            // valid sources to load web workers
            workerSrc: ["'self'", "blob:"],
            // valid sources to load plugins
            objectSrc: [],
            // valid sources to load images
            imgSrc: [
                "'self'",
                "blob:",
                "data:",
                `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`,
                "https://images.unsplash.com/",
            ],
            // valid sources to load fonts
            fontSrc: ["'self'", ...fontSrcUrls],
        },
    })
);

// set up passport authentication
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// flash notifications stored in local storage
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.formData = req.flash("formData");
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.warn = req.flash("warn");
    if (req.originalUrl != "/login") {
        req.session.returnTo = req.originalUrl;
    }
    next();
});

// user Routes
app.use("/", userRoutes);

// review Routes
app.use("/campgrounds/:id", reviewRoutes);

// campgrounds routes
app.use("/campgrounds", campgroundsRoutes);

// home route
app.get("/", (req, res) => {
    res.render("home");
});

// undefined page error handling
app.all("*", (req, res, next) => {
    return next(new ExpressError(404, "Page not found"));
});

// error middleware
app.use((err, req, res, next) => {
    err.message = err.message || "Something is not right";
    err.statusCode = err.statusCode || 500;
    res.status(err.statusCode).render("error", { err });
});

// launching server
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

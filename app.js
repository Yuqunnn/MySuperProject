const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');
const app = express();

// Create MySQL connection
const connection = mysql.createConnection({
    host: 'mysql-yuqun.alwaysdata.net',
    user: 'yuqun',
    password: 'Yuqun@030916',
    database: 'yuqun_miniproject'
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/image');
    },
    filename: (req, file, cb) =>{
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');

// Enable static files
app.use(express.static('public'));

// Set up body parser
app.use(express.urlencoded({ extended: true }));

// Set up session
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Authentication middleware
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Define routes
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    connection.query(sql, [username, password], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error logging in');
        }
        if (results.length > 0) {
            req.session.user = results[0];
            console.log('Session user:', req.session.user); // Debugging line
            res.redirect('/home');
        } else {
            res.status(401).send('Invalid credentials');
        }
    });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, password, confirm_password } = req.body;

    // Simple validation for password match
    if (password !== confirm_password) {
        return res.status(400).send('Passwords do not match');
    }

    // Insert the new user into the database
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    connection.query(sql, [username, password], (error, results) => {
        if (error) {
            console.error('Error registering user:', error);
            return res.status(500).send('Error registering user');
        }
        res.redirect('/login');
    });
});

app.get("/", (req, res) => {
    res.redirect('/login');
});

app.get("/home", isAuthenticated, (req, res) => {
    res.render('home');
});

app.get('/user/:id', isAuthenticated, (req, res) => {
    const userID = req.params.id;
    const sql = 'SELECT * FROM users WHERE userID = ?';
    connection.query(sql, [userID], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving User by ID');
        }
        if (results.length > 0) {
            res.render('user', { user: results[0] });
        } else {
            res.status(404).send('User not found');
        }
    });
});

app.get('/addPost', isAuthenticated, (req, res) => {
    res.render('addPost');
});

app.post('/addPost', isAuthenticated, upload.single('image'), (req, res) => {
    const { description } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename;
    } 
    const sql = 'INSERT INTO post (userID, description, image) VALUES (?, ?, ?)';
    connection.query(sql, [req.session.user.userID, description, image], (error, results) => {
        if (error) {
            console.error('Error adding post:', error);
            res.status(500).send('Error adding post');
        } else {
            res.redirect('/viewPosts');
        }
    });
});

app.get('/editPost/:id', isAuthenticated, (req, res) => {
    const postId = req.params.id;
    const sql = 'SELECT * FROM post WHERE id = ?';
    connection.query(sql, [postId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving Post by ID');
        }
        if (results.length > 0) {
            res.render('editPost', { post: results[0] });
        } else {
            res.status(404).send('Post not found');
        }
    });
});

app.post('/editPost/:id', isAuthenticated, upload.single('image'),(req, res) => {
    const postId = req.params.id;
    const { description} = req.body;

    let image;
    if (req.file) {
        image = req.file.filename;
    }
    
    const sql = 'UPDATE post SET description = ?, image = ? WHERE id = ?'; // Ensure table name is 'post'
    connection.query(sql, [description, image, postId], (error, results) => {
        if (error) {
            console.error('Error updating post:', error);
            res.status(500).send('Error updating post');
        } else {
            res.redirect('/viewPosts');
        }
    });
});


app.get('/deletePost/:id', isAuthenticated, (req, res) => {
    const postId = req.params.id;
    const sql = 'SELECT * FROM post WHERE id = ?';
    connection.query(sql, [postId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving post');
        }
        if (results.length > 0) {
            res.render('deletePost', { post: results[0] });
        } else {
            res.status(404).send('Post not found');
        }
    });
});


app.post('/deletePost/:id', isAuthenticated, (req, res) => {
    const postId = req.params.id;
    const sql = 'DELETE FROM post WHERE id = ?';
    connection.query(sql, [postId], (error, results) => {
        if (error) {
            console.error('Error deleting post:', error);
            res.status(500).send('Error deleting post');
        } else {
            res.redirect('/viewPosts');
        }
    });
});

// New route to fetch and display all posts
app.get('/viewPosts', isAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM post JOIN users ON post.userID = users.userID';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving posts');
        }
        res.render('viewPosts', { posts: results });
    });
});

// New route to fetch and display account details of the logged-in user
app.get('/myProfile', isAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM users WHERE userID = ?';
    console.log('Session userID:', req.session.user.userID); // Debugging line
    connection.query(sql, [req.session.user.userID], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving account details');
        }
        res.render('myProfile', { user: results[0] });
    });
});

app.post('/myProfile', isAuthenticated, (req, res) => {
    const { username, password, confirm_password } = req.body;

    if (password !== confirm_password) {
        return res.status(400).send('Passwords do not match');
    }

    const sql = 'UPDATE users SET username = ?, password = ? WHERE userID = ?';
    connection.query(sql, [username, password, req.session.user.userID], (error, results) => {
        if (error) {
            console.error('Error updating account details:', error);
            return res.status(500).send('Error updating account details');
        }
        req.session.user.username = username; // Update session username
        res.redirect('/myProfile');
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));

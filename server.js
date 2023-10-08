const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require('multer');
const app = express();
const secretKey = 'vamsidvd';
const path = require('path');
mongodburl="mongodb+srv://vamsidb:cnXvfRMtjaAqIJAU@cluster0.cr4dnvd.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(mongodburl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  })
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '/public')))
const Book = mongoose.model("Book", {
  title: String,
  authors: [String],
  description: String,
  images: String,
  currentbook: Boolean,
  readingProgress: Number,
  ratingProgress: Number,
  User_id:String,
  comments: [
    {
      text: String,
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  ],
});

const User = mongoose.model("User", {
  name: String,
  username: String,
  email: String,
  password: String,
  profilePic: {
    type: String, // Store the profile picture path or URL as a string
    default: 'uploads/profiles/default.png', // Set a default value (adjust the path as needed)
  },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const corsOptions = {
  origin: "http://localhost:3000",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
};

app.use(bodyParser.json());
app.use(cors(corsOptions));

function generateToken(user) {
  const payload = {
    id: user._id,
  };

  const token = jwt.sign(payload, secretKey, { expiresIn: "1h" });

  return token;
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profiles'); // Directory where profile pictures will be stored
  },
  filename: function (req, file, cb) {
    if (file) {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + ext);
    } else {
      // Handle the case where no file was uploaded
      cb(new Error('No file uploaded'), null);
    }// Rename the file with a timestamp to avoid duplicates
  },
});

const upload = multer({ storage: storage });
app.post("/api/signup", upload.single('profilePic'), async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let profilePicPath = null; // Initialize profilePicPath to null

    // Check if a file was uploaded before accessing its properties
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      profilePicPath = req.file.path;
    }
    const newUser = new User({
      name,
      username,
      email,
      password: hashedPassword,
      profilePic: profilePicPath,
    });

    await newUser.save();

    res.status(200).json({ message: "Signup successful" });
  } catch (error) {
    console.error("Error signing up:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const verifyToken = (req, res, next) => {
  const token = req.headers.Authorization;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Failed to authenticate token" });
    }

    req.decoded = decoded;
    next();
  });
};

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = generateToken(user);

    res.status(200).json({ message: "Login successful!", token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Error logging in. Please try again." });
  }
});

// Other routes and middleware ...
app.put("/api/mybookshelf/:id/currentbook", async (req, res) => {
  const bookId = req.params.id;
  const newStatus = req.body.currentbook;

  try {
    // Find the book by ID and update the "currentbook" field
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { currentbook: newStatus },
      { new: true }
    );

    res.json(updatedBook);
  } catch (error) {
    console.error("Error updating book status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/api/mybookshelf/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(userId);
    const books = await Book.find({ User_id: userId });  // Fetch all books from the database
    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ error: "Could not fetch books" });
  }
});
app.delete("/api/mybookshelf/:bookId/:userId/delete", async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const userId = req.params.userId;

    // Check if the book with the given ID and User_id exists
    const result = await Book.findOneAndDelete({ _id: bookId, User_id: userId });

    if (!result) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/books/:bookId/progress", async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json({ progressReading: book.progressReading });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update progressReading for a specific book by ID
app.put("/api/books/:bookId/progress", async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const { readingProgress, currentbook } = req.body;
    console.log(currentbook);
    // Find the book by its ID and update both fields
    const book = await Book.findByIdAndUpdate(
      bookId,
      { readingProgress, currentbook },
      { new: true } // Return the updated book
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({ progressReading: book.readingProgress, currentbook: book.currentbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/api/books", async (req, res) => {
  try {
    const { book } = req.body;
    const loggedInUserId = req.body.loggedInUserId;
     // Check if 'book' and 'volumeInfo' properties exist
     if (!book || !book.volumeInfo) {
      throw new Error("Invalid book data");
    }
    const existingBook = await Book.findOne({
      title: book.volumeInfo.title,
      authors: book.volumeInfo.authors,
      User_id: loggedInUserId,
    });

    if (existingBook) {
      // Book already exists, return an error response
      return res.status(400).json({ error: "Book already exists" });
    }
    const image = book.volumeInfo.imageLinks
      ? book.volumeInfo.imageLinks.thumbnail
      : "";
    const newBook = new Book({
      title: book.volumeInfo.title,
      authors: book.volumeInfo.authors,
      description: book.volumeInfo.description  || "",
      images:image,
      currentbook:false,
      User_id:loggedInUserId,
      // Map other fields from the book object
    });
    await newBook.save();
    res.json({ success: true }); // Send a success response when the book is added
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).json({ error: "Could not add book" }); // Send an error response for other errors
  }
});

app.get('/api/mybookshelf/:bookId/ratingProgress', async (req, res) => {
  const bookId = req.params.bookId;
  try {
    const book = await Book.findById(bookId);
    if (book) {
      res.json({ ratingProgress: book.ratingProgress,readingProgressV:book.readingProgress });
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/mybookshelf/:bookId/ratingProgress', async (req, res) => {
  const bookId = req.params.bookId;
  const newratingProgress = req.body.ratingProgress;
  try {
    const book = await Book.findByIdAndUpdate(bookId, { ratingProgress: newratingProgress });
    if (book) {
      res.json({ message: 'Reading progress updated' });
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/mybookshelf/:bookId/readingProgress', async (req, res) => {
  const bookId = req.params.bookId;
  try {
    const book = await Book.findById(bookId);
    if (book) {
      res.json({ readingProgress: book.readingProgress });
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/mybookshelf/:bookId/readingProgress', async (req, res) => {
  const bookId = req.params.bookId;
  const newReadingProgress = req.body.readingProgress;
  try {
    const book = await Book.findByIdAndUpdate(bookId, { readingProgress: newReadingProgress });
    if (book) {
      res.json({ message: 'Reading progress updated' });
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/users/:loggedInUserId', async (req, res) => {
  try {
    const loggedInUserId = req.params.loggedInUserId;

    // Find all users except the currently logged-in user
    const users = await User.find({ _id: { $ne: loggedInUserId } });

    res.json(users);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post("/api/addFriend", async (req, res) => {
  try {
    const { userId } = req.body;
    const loggedInUserId = req.body.loggedInUserId;
    if (!loggedInUserId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    // Add the friend's ID to the user's friends array
    await User.findByIdAndUpdate(loggedInUserId, { $push: { friends: userId } });

    res.status(200).json({ message: "Friend added successfully" });
  } catch (error) {
    console.error("Error adding friend:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/api/removeFriend", async (req, res) => {
  try {
    const { userId } = req.body;
    const loggedInUserId = req.body.loggedInUserId;
    if (!loggedInUserId) {
      console.log(loggedInUserId);
      return res.status(401).json({ message: "User not authenticated" });
    }
    await User.findByIdAndUpdate(loggedInUserId, { $pull: { friends: userId } });

    res.status(200).json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.get('/api/userFriendStatus/:loggedInUserId', async (req, res) => {
  const loggedInUserId = req.params.loggedInUserId;

  try {
    const user = await User.findById(loggedInUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendStatus = user.friends;

    res.json(friendStatus);
  } catch (error) {
    console.error('Error fetching user friend status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/api/user-books/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userBooks = await Book.find({ User_id: userId });
    const user = await User.findById(userId);
    const username = user ? user.username : 'Unknown';
    res.json({ username, books: userBooks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch friends' books
// Fetch friends' books
// Fetch friends' books
app.get('/api/booksposts/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find the logged-in user
    const user = await User.findById(userId);

    // Find the friends of the logged-in user
    const friends = await User.find({ _id: { $in: user.friends } });

    // Get all books (including the logged-in user's books and friends' books)
    const allBooks = await Book.find({
      User_id: { $in: [userId, ...friends.map(friend => friend._id)] },
    });

    // Map book data to include user names
    const booksWithUserNames = allBooks.map(book => {
      const userName = book.User_id.toString() === userId ? user.name : friends.find(friend => friend._id.toString() === book.User_id.toString()).name;
      return {
        ...book.toObject(),
        userName: userName,
      };
    });

    res.json(booksWithUserNames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Create a new comment for a book
app.post("/api/books/:bookId/comments", async (req, res) => {
  // Extract the book ID from the URL params
  const bookId = req.params.bookId;

  // Extract the comment text and user ID from the request body
  const { text, userId } = req.body;

  try {
    // Find the book by ID
    const book = await Book.findById(bookId);

    if (!book) {
      // If the book is not found, return a 404 error
      return res.status(404).json({ message: 'Book not found' });
    }

    // Create a new comment
    const comment = {
      text,
      user: userId,
    };

    // Add the comment to the book's comments array
    book.comments.push(comment);

    // Save the book with the new comment
    await book.save();

    // Send the newly created comment as a JSON response
    return res.status(201).json(comment);
  } catch (error) {
    // Handle any errors that occur during comment creation
    console.error('Error adding comment:', error);
    
    // Send a 500 Internal Server Error response with an error message
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/api/books/:bookId/comments', async (req, res) => {
  try {
    const bookId = req.params.bookId;
    
    // Find the book by its ID and populate the 'comments' field with user information
    const book = await Book.findById(bookId).populate({
      path: 'comments.user',
      select: 'username', // Assuming 'username' is a field in your User model
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(book.comments);
  } catch (error) {
    console.error('Error fetching book comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

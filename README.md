# Instagram Clone Backend API

A production-ready Instagram clone backend API built with Node.js, Express, MongoDB, and industry best practices.

## 🏗️ Project Structure

```
projectmanagement/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # MongoDB connection
│   │   └── cloudinary.js # Cloudinary configuration
│   ├── controllers/      # Business logic
│   │   ├── userController.js
│   │   ├── postController.js
│   │   └── commentController.js
│   ├── models/           # Database schemas
│   │   ├── User.js
│   │   ├── Post.js
│   │   └── Comment.js
│   ├── routes/           # API routes
│   │   ├── index.js
│   │   ├── userRoutes.js
│   │   ├── postRoutes.js
│   │   └── commentRoutes.js
│   ├── middleware/       # Custom middleware
│   │   ├── auth.js       # JWT authentication
│   │   ├── errorHandler.js
│   │   ├── logger.js
│   │   └── validation.js
│   └── utils/            # Helper functions
│       ├── cloudinaryHelper.js
│       └── helpers.js
├── .env.example          # Environment variables template
├── .gitignore
├── server.js             # Entry point
└── package.json
```

## 🚀 Features

- **Authentication & Authorization**

  - JWT-based authentication
  - Password hashing with bcrypt
  - Protected routes

- **User Management**

  - User registration and login
  - Profile management
  - Follow/Unfollow system
  - Get followers and following lists

- **Post Management**

  - Create, read, and delete posts
  - Image upload to Cloudinary
  - Like/Unlike posts
  - Feed generation based on following

- **Comment System**

  - Add comments to posts
  - Delete own comments
  - Get all comments for a post

- **Best Practices**
  - MVC architecture
  - Error handling middleware
  - Request logging
  - Input validation
  - Environment variables
  - CORS configuration
  - Database indexing for performance

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Cloudinary account (for image uploads)

## 🛠️ Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   - Copy `.env.example` to `.env`
   - Fill in your credentials:

   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   JWT_EXPIRE=7d
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. **Run the server:**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📡 API Endpoints

### Authentication

- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/me` - Get current user (Protected)

### Users

- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile (Protected)
- `POST /api/users/:id/follow` - Follow user (Protected)
- `DELETE /api/users/:id/follow` - Unfollow user (Protected)
- `GET /api/users/:id/followers` - Get user followers
- `GET /api/users/:id/following` - Get user following

### Posts

- `POST /api/posts` - Create post (Protected)
- `GET /api/posts` - Get all posts
- `GET /api/posts/feed` - Get personalized feed (Protected)
- `GET /api/posts/:id` - Get single post
- `DELETE /api/posts/:id` - Delete post (Protected)
- `POST /api/posts/:id/like` - Like post (Protected)
- `DELETE /api/posts/:id/like` - Unlike post (Protected)
- `GET /api/posts/:id/likes` - Get post likes

### Comments

- `POST /api/comments/posts/:postId/comments` - Add comment (Protected)
- `GET /api/comments/posts/:postId/comments` - Get comments
- `DELETE /api/comments/:id` - Delete comment (Protected)

## 🔐 Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 📦 Technologies Used

- **Express.js** - Web framework
- **MongoDB & Mongoose** - Database
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Cloudinary** - Image hosting
- **CORS** - Cross-origin resource sharing
- **Dotenv** - Environment variables

## 🎯 Best Practices Implemented

1. **Separation of Concerns** - MVC architecture
2. **Error Handling** - Centralized error handler
3. **Security** - Password hashing, JWT authentication
4. **Validation** - Input validation and sanitization
5. **Database Optimization** - Indexes on frequently queried fields
6. **Code Organization** - Modular and maintainable structure
7. **Environment Configuration** - Separate config for different environments
8. **Logging** - Request logging middleware
9. **API Versioning Ready** - Easy to add versioning

## 🧪 Testing

You can test the API using:

- Postman
- Thunder Client (VS Code extension)
- cURL
- Any HTTP client

## 📝 License

ISC

## 👤 Author

Mohammad Naeem

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Serve frontend files (if you add public folder later)
app.use(express.static("public"));

// Socket connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join room
  socket.on("join-room", (room) => {
    socket.join(room);
    socket.to(room).emit("user-joined");
  });

  // WebRTC offer
  socket.on("offer", (data) => {
    socket.to(data.room).emit("offer", data);
  });

  // WebRTC answer
  socket.on("answer", (data) => {
    socket.to(data.room).emit("answer", data);
  });

  // ICE candidate
  socket.on("ice-candidate", (data) => {
    socket.to(data.room).emit("ice-candidate", data);
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});


import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Room state storage (In-memory for now)
  const rooms = new Map<string, {
    id: string;
    adminId: string;
    bookId: string | null;
    bookData: any | null;
    members: { id: string; name: string; currentPage: number; cursor: { x: number, y: number } }[];
    highlights: any[];
    chat: any[];
  }>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create-room", ({ adminName, bookId, bookData }) => {
      const roomId = uuidv4().substring(0, 8);
      rooms.set(roomId, {
        id: roomId,
        adminId: socket.id,
        bookId: bookId || null,
        bookData: bookData || null,
        members: [{ id: socket.id, name: adminName, currentPage: 0, cursor: { x: 0, y: 0 } }],
        highlights: [],
        chat: []
      });
      socket.join(roomId);
      socket.emit("room-created", roomId);
    });

    socket.on("join-room", ({ roomId, name }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.members.push({ id: socket.id, name, currentPage: 0, cursor: { x: 0, y: 0 } });
        socket.join(roomId);
        io.to(roomId).emit("room-updated", room);
      } else {
        socket.emit("error", "Room not found");
      }
    });

    socket.on("select-book", ({ roomId, bookId, bookData }) => {
      const room = rooms.get(roomId);
      if (room && room.adminId === socket.id) {
        room.bookId = bookId;
        room.bookData = bookData;
        io.to(roomId).emit("book-selected", { bookId, bookData });
        io.to(roomId).emit("room-updated", room);
      }
    });

    socket.on("update-page", ({ roomId, page }) => {
      const room = rooms.get(roomId);
      if (room) {
        const member = room.members.find(m => m.id === socket.id);
        if (member) {
          member.currentPage = page;
          io.to(roomId).emit("member-moved", { id: socket.id, page });
        }
      }
    });

    socket.on("summon-all", ({ roomId, page }) => {
      const room = rooms.get(roomId);
      if (room && room.adminId === socket.id) {
        io.to(roomId).emit("summoned", page);
      }
    });

    socket.on("cursor-move", ({ roomId, cursor }) => {
      socket.to(roomId).emit("member-cursor", { id: socket.id, cursor });
    });

    socket.on("send-highlight", ({ roomId, highlight }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.highlights.push(highlight);
        socket.to(roomId).emit("new-highlight", highlight);
      }
    });

    socket.on("send-chat", ({ roomId, message }) => {
      const room = rooms.get(roomId);
      if (room) {
        const chatMsg = { id: uuidv4(), senderId: socket.id, senderName: message.name, text: message.text, time: Date.now() };
        room.chat.push(chatMsg);
        io.to(roomId).emit("new-chat", chatMsg);
      }
    });

    socket.on("send-reaction", ({ roomId, reaction }) => {
      io.to(roomId).emit("new-reaction", { id: socket.id, reaction });
    });

    socket.on("toggle-mic", ({ roomId, active }) => {
      io.to(roomId).emit("mic-status-changed", { id: socket.id, active });
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        const index = room.members.findIndex(m => m.id === socket.id);
        if (index !== -1) {
          room.members.splice(index, 1);
          if (room.members.length === 0) {
            rooms.delete(roomId);
          } else {
            if (room.adminId === socket.id) {
              room.adminId = room.members[0].id;
            }
            io.to(roomId).emit("room-updated", room);
          }
        }
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
